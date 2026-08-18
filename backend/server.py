from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import base64
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta

import jwt
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'saklio_dev_secret')
JWT_ALGO = 'HS256'
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "saklio"
_storage_key = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("saklio")

# ----------------------------------------------------------------------------
# Push notifications (Emergent managed relay)
# ----------------------------------------------------------------------------
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)


async def send_push(recipients, data, idempotency_key=None):
    if not recipients:
        return
    payload = {"recipients": recipients[:100], "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


# ----------------------------------------------------------------------------
# Email (SMTP)
# ----------------------------------------------------------------------------
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "")
EMAIL_DEBUG = os.environ.get("EMAIL_DEBUG", "false").lower() == "true"


def _email_shell(title: str, body_html: str) -> str:
    return f"""<div style="background:#F8F7F2;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #EAE8DF;">
    <div style="background:linear-gradient(135deg,#8FCFAE,#5B9F7D);padding:28px 32px;">
      <div style="color:#0E241A;font-size:22px;font-weight:700;letter-spacing:2px;">saklio</div>
    </div>
    <div style="padding:28px 32px;color:#202522;">
      <h2 style="margin:0 0 12px;font-size:20px;">{title}</h2>
      {body_html}
    </div>
    <div style="padding:16px 32px;color:#757D78;font-size:12px;border-top:1px solid #EAE8DF;">
      Fişi çek, gerisini Saklio halletsin.
    </div>
  </div>
</div>"""


def send_email(to_addr: str, subject: str, html: str, attachment: tuple = None) -> bool:
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        logger.warning("SMTP not configured; skipping email")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        if attachment:
            fname, data_bytes = attachment
            part = MIMEApplication(data_bytes, Name=fname)
            part["Content-Disposition"] = f'attachment; filename="{fname}"'
            msg.attach(part)
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to_addr], msg.as_string())
        return True
    except Exception as e:
        logger.warning(f"Email send failed: {e}")
        return False


app = FastAPI()
api_router = APIRouter(prefix="/api")


# ----------------------------------------------------------------------------
# Object storage helpers
# ----------------------------------------------------------------------------
def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Yetkilendirme gerekli")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Geçersiz oturum")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ProductItem(BaseModel):
    name: str
    price: Optional[float] = None


class ProductInput(BaseModel):
    name: str
    merchant: Optional[str] = None
    category: str = "diger"  # elektronik, moda, ev, otomotiv, diger
    price: Optional[float] = None
    currency: str = "TL"
    purchase_date: Optional[str] = None  # ISO date
    return_days: int = 14
    warranty_months: int = 24
    image_path: Optional[str] = None
    receipt_path: Optional[str] = None
    items: List[ProductItem] = []
    note: Optional[str] = None
    notify_return: bool = True
    notify_warranty: bool = True


class ChatInput(BaseModel):
    message: str
    session_id: Optional[str] = None


class ScanInput(BaseModel):
    image_base64: str


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def compute_status(product: dict) -> dict:
    """Derive return / warranty status from purchase_date."""
    pd = product.get("purchase_date")
    out = {"return_days_left": None, "warranty_days_left": None,
           "return_status": "unknown", "warranty_status": "unknown"}
    if not pd:
        return out
    try:
        base = datetime.fromisoformat(pd.replace("Z", "+00:00"))
    except Exception:
        return out
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    today = datetime.now(timezone.utc)
    return_deadline = base + timedelta(days=product.get("return_days", 14))
    warranty_end = base + timedelta(days=product.get("warranty_months", 24) * 30)
    rdl = (return_deadline - today).days
    wdl = (warranty_end - today).days
    out["return_days_left"] = rdl
    out["warranty_days_left"] = wdl
    out["return_status"] = "active" if rdl > 3 else ("ending" if rdl >= 0 else "expired")
    out["warranty_status"] = "active" if wdl > 30 else ("ending" if wdl >= 0 else "expired")
    return out


def clean(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


def enrich(product: dict) -> dict:
    p = clean(product)
    p.update(compute_status(p))
    return p


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(inp: RegisterInput):
    existing = await db.users.find_one({"email": inp.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    user = {
        "id": str(uuid.uuid4()),
        "name": inp.name,
        "email": inp.email.lower(),
        "password": hash_password(inp.password),
        "theme": "soft",
        "currency": "TL",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    try:
        body = _email_shell("Saklio’ya hoş geldin 👋", f"""
          <p style="color:#757D78;line-height:22px;">Merhaba {inp.name}, hesabın oluşturuldu.</p>
          <p style="color:#202522;">Artık fişlerini tarayıp iade ve garanti sürelerini tek yerden takip edebilirsin.</p>""")
        await run_in_threadpool(send_email, user["email"], "Saklio’ya hoş geldin", body)
    except Exception as e:
        logger.warning(f"Welcome email failed: {e}")
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "theme": user["theme"], "currency": user["currency"]}}


@api_router.post("/auth/login")
async def login(inp: LoginInput):
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not verify_password(inp.password, user["password"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "theme": user.get("theme", "soft"), "currency": user.get("currency", "TL")}}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"id": user["id"], "name": user["name"], "email": user["email"], "theme": user.get("theme", "soft"), "currency": user.get("currency", "TL")}


class ProfileUpdate(BaseModel):
    theme: Optional[str] = None
    currency: Optional[str] = None
    name: Optional[str] = None


@api_router.put("/auth/profile")
async def update_profile(inp: ProfileUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in inp.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]})
    return {"id": u["id"], "name": u["name"], "email": u["email"], "theme": u.get("theme", "soft"), "currency": u.get("currency", "TL")}


# ----------------------------------------------------------------------------
# Image upload / download
# ----------------------------------------------------------------------------
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    ext = (file.filename or "img.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    ct = file.content_type or "image/jpeg"
    try:
        result = await run_in_threadpool(put_object, path, data, ct)
    except Exception as e:
        logger.exception("upload failed")
        raise HTTPException(status_code=500, detail="Yükleme başarısız")
    await db.files.insert_one({"path": result["path"], "owner_id": user["id"], "content_type": ct, "created_at": now_iso()})
    return {"path": result["path"]}


@api_router.get("/files/{file_path:path}")
async def download_file(file_path: str, token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    # accept token via query (web <img>) or Authorization header (native)
    user_id = None
    tok = token
    if not tok and authorization and authorization.startswith("Bearer "):
        tok = authorization.split(" ", 1)[1]
    if tok:
        try:
            payload = jwt.decode(tok, JWT_SECRET, algorithms=[JWT_ALGO])
            user_id = payload["sub"]
        except Exception:
            raise HTTPException(status_code=401, detail="Geçersiz oturum")
    if not user_id:
        raise HTTPException(status_code=401, detail="Yetkilendirme gerekli")
    rec = await db.files.find_one({"path": file_path, "owner_id": user_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    try:
        content, ct = await run_in_threadpool(get_object, file_path)
    except Exception:
        raise HTTPException(status_code=500, detail="Dosya alınamadı")
    return Response(content=content, media_type=ct)


# ----------------------------------------------------------------------------
# Products
# ----------------------------------------------------------------------------
@api_router.post("/products")
async def create_product(inp: ProductInput, user=Depends(get_current_user)):
    product = inp.dict()
    product["id"] = str(uuid.uuid4())
    product["owner_id"] = user["id"]
    if not product.get("purchase_date"):
        product["purchase_date"] = now_iso()
    product["created_at"] = now_iso()
    await db.products.insert_one(product)
    return enrich(product)


@api_router.get("/products")
async def list_products(category: Optional[str] = None, user=Depends(get_current_user)):
    q = {"owner_id": user["id"]}
    if category and category != "tumu":
        q["category"] = category
    products = await db.products.find(q).sort("created_at", -1).to_list(1000)
    return [enrich(p) for p in products]


@api_router.get("/products/{product_id}")
async def get_product(product_id: str, user=Depends(get_current_user)):
    p = await db.products.find_one({"id": product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return enrich(p)


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, inp: ProductInput, user=Depends(get_current_user)):
    p = await db.products.find_one({"id": product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    await db.products.update_one({"id": product_id}, {"$set": inp.dict()})
    p = await db.products.find_one({"id": product_id})
    return enrich(p)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    await db.products.delete_one({"id": product_id, "owner_id": user["id"]})
    await db.documents.delete_many({"product_id": product_id, "owner_id": user["id"]})
    return {"ok": True}


# ----------------------------------------------------------------------------
# Documents vault (per product)
# ----------------------------------------------------------------------------
DOC_TYPES = {"fis", "fatura", "garanti", "kilavuz", "servis"}


class DocumentInput(BaseModel):
    type: str = "fis"  # fis, fatura, garanti, kilavuz, servis
    name: Optional[str] = None
    file_path: str


@api_router.get("/products/{product_id}/documents")
async def list_documents(product_id: str, user=Depends(get_current_user)):
    docs = await db.documents.find({"product_id": product_id, "owner_id": user["id"]}).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


@api_router.post("/products/{product_id}/documents")
async def add_document(product_id: str, inp: DocumentInput, user=Depends(get_current_user)):
    p = await db.products.find_one({"id": product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    dtype = inp.type if inp.type in DOC_TYPES else "fis"
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "product_id": product_id,
        "type": dtype,
        "name": inp.name or dtype,
        "file_path": inp.file_path,
        "created_at": now_iso(),
    }
    await db.documents.insert_one(doc)
    # if it's a receipt and product has none, attach it
    if dtype in ("fis", "fatura") and not p.get("receipt_path"):
        await db.products.update_one({"id": product_id}, {"$set": {"receipt_path": inp.file_path}})
    return clean(doc)


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user=Depends(get_current_user)):
    await db.documents.delete_one({"id": doc_id, "owner_id": user["id"]})
    return {"ok": True}


# ----------------------------------------------------------------------------
# Push registration + notification prefs
# ----------------------------------------------------------------------------
class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


class NotifyPrefs(BaseModel):
    notify_return: Optional[bool] = None
    notify_warranty: Optional[bool] = None


@api_router.put("/products/{product_id}/notify")
async def update_notify(product_id: str, inp: NotifyPrefs, user=Depends(get_current_user)):
    updates = {k: v for k, v in inp.dict().items() if v is not None}
    if updates:
        await db.products.update_one({"id": product_id, "owner_id": user["id"]}, {"$set": updates})
    p = await db.products.find_one({"id": product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return enrich(p)


# ----------------------------------------------------------------------------
# Share via deeplink
# ----------------------------------------------------------------------------
@api_router.post("/products/{product_id}/share")
async def share_product(product_id: str, user=Depends(get_current_user)):
    p = await db.products.find_one({"id": product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    token = uuid.uuid4().hex[:12]
    await db.shares.insert_one({
        "token": token, "product_id": product_id, "from_user_id": user["id"],
        "from_name": user.get("name", ""), "created_at": now_iso(),
        "snapshot": {
            "name": p.get("name"), "merchant": p.get("merchant"), "category": p.get("category"),
            "price": p.get("price"), "currency": p.get("currency"), "purchase_date": p.get("purchase_date"),
            "return_days": p.get("return_days", 14), "warranty_months": p.get("warranty_months", 24),
            "image_path": p.get("image_path"),
        },
    })
    return {"token": token, "deeplink": f"saklio://share/{token}"}


@api_router.get("/share/{token}")
async def get_share(token: str, user=Depends(get_current_user)):
    s = await db.shares.find_one({"token": token})
    if not s:
        raise HTTPException(status_code=404, detail="Paylaşım bulunamadı")
    snap = dict(s["snapshot"])
    snap.update(compute_status(snap))
    return {"from_name": s.get("from_name", ""), "product": snap}


@api_router.post("/share/{token}/accept")
async def accept_share(token: str, user=Depends(get_current_user)):
    s = await db.shares.find_one({"token": token})
    if not s:
        raise HTTPException(status_code=404, detail="Paylaşım bulunamadı")
    snap = s["snapshot"]
    product = {
        "id": str(uuid.uuid4()), "owner_id": user["id"],
        "name": snap.get("name"), "merchant": snap.get("merchant"), "category": snap.get("category", "diger"),
        "price": snap.get("price"), "currency": snap.get("currency", "TL"),
        "purchase_date": snap.get("purchase_date"), "return_days": snap.get("return_days", 14),
        "warranty_months": snap.get("warranty_months", 24), "image_path": snap.get("image_path"),
        "items": [], "created_at": now_iso(), "source": "share",
        "notify_return": True, "notify_warranty": True,
    }
    await db.products.insert_one(product)
    # notify the sharer (best effort)
    try:
        await send_push(
            recipients=[s["from_user_id"]],
            data={"title": "Ürün eklendi", "message": f"{user.get('name','Biri')} paylaştığın '{snap.get('name')}' ürününü ekledi.",
                  "action_url": f"/product/{product['id']}"},
        )
    except Exception as e:
        logger.warning(f"Push failed (non-blocking): {e}")
    return enrich(product)


# ----------------------------------------------------------------------------
# Account data: export & reset (email verified)
# ----------------------------------------------------------------------------
import random


async def _collect_user_data(user):
    products = await db.products.find({"owner_id": user["id"]}).to_list(2000)
    documents = await db.documents.find({"owner_id": user["id"]}).to_list(2000)
    messages = await db.messages.find({"owner_id": user["id"]}).to_list(2000)
    return {
        "user": {"id": user["id"], "name": user.get("name"), "email": user.get("email"),
                 "currency": user.get("currency"), "created_at": user.get("created_at")},
        "products": [clean(p) for p in products],
        "documents": [clean(d) for d in documents],
        "assistant_messages": [clean(m) for m in messages],
        "exported_at": now_iso(),
    }


@api_router.post("/account/export")
async def export_data(user=Depends(get_current_user)):
    data = await _collect_user_data(user)
    payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    counts = {"products": len(data["products"]), "documents": len(data["documents"])}
    body = _email_shell("Verilerin hazır", f"""
      <p style="color:#757D78;line-height:22px;">Talebin üzerine tüm Saklio verilerini ekte bir JSON dosyası olarak hazırladık.</p>
      <p style="color:#202522;"><b>{counts['products']}</b> ürün ve <b>{counts['documents']}</b> belge dahil edildi.</p>""")
    sent = await run_in_threadpool(send_email, user["email"], "Saklio — Verilerin", body, ("saklio-verilerim.json", payload))
    return {"sent": sent, "email": user["email"], "counts": counts}


class ResetConfirm(BaseModel):
    code: str


@api_router.post("/account/request-reset")
async def request_reset(user=Depends(get_current_user)):
    code = f"{random.randint(0, 999999):06d}"
    code_hash = hash_password(code)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {"reset_code_hash": code_hash, "reset_expires": expires}})
    body = _email_shell("Veri silme onayı", f"""
      <p style="color:#757D78;line-height:22px;">Tüm ürün ve belgelerini silmek için onay kodun:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#5B9F7D;margin:16px 0;">{code}</div>
      <p style="color:#DF7C76;font-size:13px;">Bu işlemi sen başlatmadıysan bu e-postayı yok say.</p>""")
    sent = await run_in_threadpool(send_email, user["email"], "Saklio — Veri silme kodu", body)
    resp = {"sent": sent, "email": user["email"]}
    if EMAIL_DEBUG:
        resp["debug_code"] = code
    return resp


@api_router.post("/account/confirm-reset")
async def confirm_reset(inp: ResetConfirm, user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]})
    ch = u.get("reset_code_hash")
    exp = u.get("reset_expires")
    if not ch or not exp:
        raise HTTPException(status_code=400, detail="Önce onay kodu iste")
    if datetime.fromisoformat(exp) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Kodun süresi doldu")
    if not verify_password(inp.code, ch):
        raise HTTPException(status_code=400, detail="Kod hatalı")
    await db.products.delete_many({"owner_id": user["id"]})
    await db.documents.delete_many({"owner_id": user["id"]})
    await db.messages.delete_many({"owner_id": user["id"]})
    await db.shares.delete_many({"from_user_id": user["id"]})
    await db.files.delete_many({"owner_id": user["id"]})
    await db.users.update_one({"id": user["id"]}, {"$unset": {"reset_code_hash": "", "reset_expires": ""}})
    body = _email_shell("Verilerin silindi", "<p style='color:#757D78;line-height:22px;'>Tüm ürün ve belge verilerin silindi. Hesabın aktif kalmaya devam ediyor.</p>")
    await run_in_threadpool(send_email, user["email"], "Saklio — Verilerin silindi", body)
    return {"ok": True}


@api_router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    products = await db.products.find({"owner_id": user["id"]}).to_list(1000)
    enriched = [enrich(p) for p in products]
    act_now = [p for p in enriched if (p.get("return_status") == "ending") or (p.get("warranty_status") == "ending")]
    act_now.sort(key=lambda x: (x.get("return_days_left") if x.get("return_days_left") is not None and x.get("return_days_left") >= 0 else 9999))
    returnable_value = sum((p.get("price") or 0) for p in enriched if p.get("return_status") in ("active", "ending"))
    returnable_count = sum(1 for p in enriched if p.get("return_status") in ("active", "ending"))
    return {
        "total_products": len(enriched),
        "act_now": act_now[:10],
        "returnable_value": returnable_value,
        "returnable_count": returnable_count,
        "currency": user.get("currency", "TL"),
    }


# ----------------------------------------------------------------------------
# AI Receipt Scan (GPT-5.4 vision)
# ----------------------------------------------------------------------------
SCAN_SYSTEM = """Sen bir Türkçe fiş/fatura okuma asistanısın. Sana bir fiş veya fatura görseli verilecek.
Görselden bilgileri çıkar ve SADECE geçerli JSON döndür (markdown, açıklama ekleme).
JSON formatı:
{
  "merchant": "mağaza adı",
  "purchase_date": "YYYY-MM-DD",
  "currency": "TL",
  "total": 0.0,
  "category": "elektronik | moda | ev | otomotiv | diger",
  "return_days": 14,
  "warranty_months": 24,
  "product_name": "ana ürünün kısa adı",
  "items": [{"name": "ürün adı", "price": 0.0}],
  "confidence": 0.0
}
Kurallar:
- Tarih net değilse bugünün tarihini kullan.
- category alanını ürüne göre tahmin et.
- Elektronik ürünlerde warranty_months genelde 24, diğerlerinde 24.
- return_days Türkiye'de genelde 14.
- product_name en pahalı/ana ürünün kısa adı olsun.
- confidence 0-1 arası okuma güvenin."""


@api_router.post("/scan")
async def scan_receipt(inp: ScanInput, user=Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    b64 = inp.image_base64
    if "," in b64 and b64.strip().startswith("data:"):
        b64 = b64.split(",", 1)[1]
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"scan-{uuid.uuid4()}",
        system_message=SCAN_SYSTEM,
    ).with_model("openai", "gpt-5.4")
    try:
        msg = UserMessage(
            text="Bu fişi oku ve JSON döndür.",
            file_contents=[ImageContent(image_base64=b64)],
        )
        resp = await chat.send_message(msg)
    except Exception as e:
        logger.exception("scan failed")
        raise HTTPException(status_code=502, detail="Fiş okunamadı, lütfen tekrar deneyin")
    text = resp if isinstance(resp, str) else str(resp)
    data = _extract_json(text)
    if not data:
        raise HTTPException(status_code=422, detail="Fiş anlaşılamadı")
    # normalize
    data.setdefault("currency", "TL")
    data.setdefault("return_days", 14)
    data.setdefault("warranty_months", 24)
    data.setdefault("category", "diger")
    data.setdefault("items", [])
    data.setdefault("confidence", 0.7)
    if not data.get("purchase_date"):
        data["purchase_date"] = datetime.now(timezone.utc).date().isoformat()
    if not data.get("product_name"):
        data["product_name"] = data.get("merchant", "Ürün")
    return data


def _extract_json(text: str):
    text = text.strip()
    # strip code fences
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


# ----------------------------------------------------------------------------
# AI Assistant chat
# ----------------------------------------------------------------------------
ASSISTANT_SYSTEM = """Sen 'Saklio Asistan'sın. Kullanıcının satın aldığı ürünler, fişler, iade süreleri ve garantiler hakkında Türkçe, kısa, sıcak ve net yanıtlar verirsin.
Kullanıcının ürün listesi sana JSON olarak verilir. İade süresi (return_days_left) ve garanti (warranty_days_left) gün cinsindendir; negatifse süre dolmuştur.
Cevaplarını kısa tut (2-4 cümle). Emojiye çok yer verme."""


@api_router.post("/assistant/chat")
async def assistant_chat(inp: ChatInput, user=Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    products = await db.products.find({"owner_id": user["id"]}).to_list(200)
    enriched = [enrich(p) for p in products]
    context_items = [{
        "name": p.get("name"), "merchant": p.get("merchant"), "price": p.get("price"),
        "return_days_left": p.get("return_days_left"), "warranty_days_left": p.get("warranty_days_left"),
        "category": p.get("category"),
    } for p in enriched]
    session_id = inp.session_id or f"assist-{user['id']}"
    sys = ASSISTANT_SYSTEM + f"\n\nKullanıcının ürünleri: {json.dumps(context_items, ensure_ascii=False)}"
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=session_id, system_message=sys).with_model("openai", "gpt-5.4")
    # persist user message
    await db.messages.insert_one({"id": str(uuid.uuid4()), "owner_id": user["id"], "session_id": session_id,
                                  "role": "user", "text": inp.message, "created_at": now_iso()})
    try:
        reply = await chat.send_message(UserMessage(text=inp.message))
    except Exception:
        logger.exception("assistant failed")
        raise HTTPException(status_code=502, detail="Asistan şu an yanıt veremiyor")
    reply = reply if isinstance(reply, str) else str(reply)
    await db.messages.insert_one({"id": str(uuid.uuid4()), "owner_id": user["id"], "session_id": session_id,
                                  "role": "assistant", "text": reply, "created_at": now_iso()})
    return {"reply": reply, "session_id": session_id}


@api_router.get("/assistant/history")
async def assistant_history(user=Depends(get_current_user)):
    session_id = f"assist-{user['id']}"
    msgs = await db.messages.find({"owner_id": user["id"], "session_id": session_id}).sort("created_at", 1).to_list(200)
    return [clean(m) for m in msgs]


# ----------------------------------------------------------------------------
# Warranty claim (AI)
# ----------------------------------------------------------------------------
class ClaimInput(BaseModel):
    product_id: str
    problem: str


@api_router.post("/warranty/claim")
async def warranty_claim(inp: ClaimInput, user=Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    p = await db.products.find_one({"id": inp.product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    sys = "Sen bir garanti başvuru asistanısın. Verilen ürün ve sorun bilgisine göre kısa, resmi bir Türkçe garanti başvuru metni oluştur (3-5 cümle)."
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"claim-{uuid.uuid4()}", system_message=sys).with_model("openai", "gpt-5.4")
    prompt = f"Ürün: {p.get('name')}\nMağaza: {p.get('merchant')}\nSatın alma: {p.get('purchase_date')}\nSorun: {inp.problem}"
    try:
        text = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        text = f"{p.get('name')} ürününde şu sorun yaşanmaktadır: {inp.problem}. Garanti kapsamında değerlendirilmesini rica ederim."
    text = text if isinstance(text, str) else str(text)
    return {"claim_text": text, "product": enrich(p), "problem": inp.problem}


# ----------------------------------------------------------------------------
# Return verdict (AI-lite heuristic)
# ----------------------------------------------------------------------------
@api_router.get("/return/verdict/{product_id}")
async def return_verdict(product_id: str, user=Depends(get_current_user)):
    p = await db.products.find_one({"id": product_id, "owner_id": user["id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    ep = enrich(p)
    rdl = ep.get("return_days_left")
    checks = {
        "receipt": bool(p.get("receipt_path") or p.get("image_path")),
        "in_time": rdl is not None and rdl >= 0,
        "type_ok": True,
    }
    if checks["in_time"] and checks["receipt"]:
        verdict = "Büyük olasılıkla evet."
        detail = "Bilgiler resmi mağaza koşullarıyla doğrulandı."
    elif checks["in_time"]:
        verdict = "Muhtemelen evet."
        detail = "İade süresi içindesin ancak fişini eklemeni öneririz."
    else:
        verdict = "Maalesef hayır."
        detail = "İade süresi dolmuş görünüyor."
    return {"verdict": verdict, "detail": detail, "checks": checks, "days_left": rdl,
            "warning": "Orijinal ambalaj gerekebilir."}


# ----------------------------------------------------------------------------
# Gmail import (simulated for MVP)
# ----------------------------------------------------------------------------
DEMO_PURCHASES = [
    {"name": "Sony WH-1000XM6", "merchant": "MediaMarkt", "category": "elektronik", "price": 4999, "currency": "TL", "days_ago": 12, "return_days": 14, "warranty_months": 24},
    {"name": "Ray-Ban Meta Wayfarer", "merchant": "Elgiganten", "category": "moda", "price": 3499, "currency": "TL", "days_ago": 2, "return_days": 14, "warranty_months": 24},
    {"name": "Dyson V15 Süpürge", "merchant": "Hepsiburada", "category": "ev", "price": 12999, "currency": "TL", "days_ago": 40, "return_days": 14, "warranty_months": 24},
    {"name": "MacBook Air M4", "merchant": "Apple Store", "category": "elektronik", "price": 44999, "currency": "TL", "days_ago": 700, "return_days": 14, "warranty_months": 24},
    {"name": "Nike Air Max", "merchant": "Nike", "category": "moda", "price": 3299, "currency": "TL", "days_ago": 5, "return_days": 30, "warranty_months": 12},
    {"name": "Philips Airfryer", "merchant": "Trendyol", "category": "ev", "price": 2799, "currency": "TL", "days_ago": 25, "return_days": 14, "warranty_months": 24},
    {"name": "Michelin Lastik Seti", "merchant": "Lastik.com", "category": "otomotiv", "price": 8999, "currency": "TL", "days_ago": 90, "return_days": 14, "warranty_months": 60},
]


@api_router.get("/gmail/preview")
async def gmail_preview(user=Depends(get_current_user)):
    return {"found": len(DEMO_PURCHASES), "purchases": DEMO_PURCHASES}


@api_router.post("/gmail/import")
async def gmail_import(user=Depends(get_current_user)):
    created = []
    for d in DEMO_PURCHASES:
        pd = (datetime.now(timezone.utc) - timedelta(days=d["days_ago"])).date().isoformat()
        product = {
            "id": str(uuid.uuid4()), "owner_id": user["id"], "name": d["name"], "merchant": d["merchant"],
            "category": d["category"], "price": d["price"], "currency": d["currency"],
            "purchase_date": pd, "return_days": d["return_days"], "warranty_months": d["warranty_months"],
            "items": [], "created_at": now_iso(), "source": "gmail",
        }
        await db.products.insert_one(product)
        created.append(enrich(product))
    return {"imported": len(created), "products": created}


# ----------------------------------------------------------------------------
# Notifications (derived)
# ----------------------------------------------------------------------------
@api_router.get("/notifications")
async def notifications(user=Depends(get_current_user)):
    products = await db.products.find({"owner_id": user["id"]}).to_list(1000)
    notes = []
    for p in products:
        ep = enrich(p)
        rdl = ep.get("return_days_left")
        wdl = ep.get("warranty_days_left")
        if rdl is not None and 0 <= rdl <= 5:
            notes.append({"type": "return", "title": "İade süresi yaklaşıyor",
                          "body": f"{p['name']} için {rdl} gün kaldı", "product_id": p["id"], "days": rdl})
        if wdl is not None and 0 <= wdl <= 45:
            notes.append({"type": "warranty", "title": "Garanti bitiyor",
                          "body": f"{p['name']} garantisine {wdl} gün kaldı", "product_id": p["id"], "days": wdl})
    notes.sort(key=lambda x: x["days"])
    return notes


# ----------------------------------------------------------------------------
# Demo seed (for quick preview)
# ----------------------------------------------------------------------------
@api_router.post("/seed-demo")
async def seed_demo(user=Depends(get_current_user)):
    count = await db.products.count_documents({"owner_id": user["id"]})
    if count > 0:
        return {"seeded": False, "message": "Zaten ürünler var"}
    for d in DEMO_PURCHASES[:4]:
        pd = (datetime.now(timezone.utc) - timedelta(days=d["days_ago"])).date().isoformat()
        product = {
            "id": str(uuid.uuid4()), "owner_id": user["id"], "name": d["name"], "merchant": d["merchant"],
            "category": d["category"], "price": d["price"], "currency": d["currency"],
            "purchase_date": pd, "return_days": d["return_days"], "warranty_months": d["warranty_months"],
            "items": [], "created_at": now_iso(),
        }
        await db.products.insert_one(product)
    return {"seeded": True}


@api_router.get("/")
async def root():
    return {"message": "Saklio API"}


# ----------------------------------------------------------------------------
# Live FX rates (free, no key) — cached
# ----------------------------------------------------------------------------
_fx_cache = {"ts": 0, "rates": None}
FX_SYMBOLS = ["TRY", "USD", "EUR", "SEK", "DKK"]


@api_router.get("/fx/rates")
async def fx_rates():
    import time
    now = time.time()
    if _fx_cache["rates"] and (now - _fx_cache["ts"] < 3600):
        return {"base": "USD", "rates": _fx_cache["rates"], "cached": True}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get("https://open.er-api.com/v6/latest/USD")
            data = r.json()
            all_rates = data.get("rates", {})
            rates = {s: all_rates[s] for s in FX_SYMBOLS if s in all_rates}
            if rates:
                _fx_cache["rates"] = rates
                _fx_cache["ts"] = now
                return {"base": "USD", "rates": rates, "cached": False}
    except Exception as e:
        logger.warning(f"FX fetch failed: {e}")
    fallback = {"TRY": 39.0, "USD": 1.0, "EUR": 0.92, "SEK": 10.6, "DKK": 6.85}
    return {"base": "USD", "rates": fallback, "cached": False, "fallback": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_storage():
    try:
        await run_in_threadpool(init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init deferred: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
