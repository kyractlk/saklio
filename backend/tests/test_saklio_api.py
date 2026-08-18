"""
Saklio backend API pytest suite.
Covers: auth, products CRUD (with status computation), dashboard, gmail preview/import,
notifications, warranty claim, return verdict, assistant chat/history, scan (GPT-5.4 vision),
image upload/download, seed-demo.
"""
import os
import io
import base64
import uuid
import time
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ownership-os-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def user_ctx(session):
    email = f"test+{uuid.uuid4().hex[:10]}@saklio.app"
    r = session.post(f"{API}/auth/register", json={"name": "Test Kullanici", "email": email, "password": "test1234"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "user": d["user"]}


@pytest.fixture(scope="session")
def auth_headers(user_ctx):
    return {"Authorization": f"Bearer {user_ctx['token']}", "Content-Type": "application/json"}


def make_receipt_b64():
    img = Image.new("RGB", (600, 900), "white")
    d = ImageDraw.Draw(img)
    lines = [
        "MEDIAMARKT TICARET A.S.",
        "FIS NO: 12345",
        "TARIH: 2026-01-15",
        "",
        "Sony WH-1000XM6 Kulaklik",
        "  4999.00 TL",
        "",
        "TOPLAM: 4999.00 TL",
        "KDV: 899.82",
        "",
        "IADE: 14 GUN",
        "GARANTI: 24 AY",
    ]
    y = 30
    for l in lines:
        d.text((30, y), l, fill="black")
        y += 48
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "Saklio API"


# ---------------- Auth ----------------
class TestAuth:
    def test_register_and_me(self, user_ctx, auth_headers, session):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert j["email"] == user_ctx["email"]
        assert j["theme"] == "soft"
        assert j["currency"] == "TL"

    def test_login(self, user_ctx, session):
        r = session.post(f"{API}/auth/login", json={"email": user_ctx["email"], "password": "test1234"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, user_ctx, session):
        r = session.post(f"{API}/auth/login", json={"email": user_ctx["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_duplicate_email(self, user_ctx, session):
        r = session.post(f"{API}/auth/register", json={"name": "dup", "email": user_ctx["email"], "password": "x"})
        assert r.status_code == 400

    def test_me_requires_auth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_update_profile(self, session, auth_headers):
        r = session.put(f"{API}/auth/profile", json={"theme": "dark", "currency": "USD"}, headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert j["theme"] == "dark" and j["currency"] == "USD"
        # revert for downstream
        session.put(f"{API}/auth/profile", json={"theme": "soft", "currency": "TL"}, headers=auth_headers)


# ---------------- Products CRUD + status ----------------
class TestProducts:
    def test_create_active_product(self, session, auth_headers):
        # purchase 5 days ago; return_days=14 -> 9 days left, active
        from datetime import datetime, timezone, timedelta
        pd = (datetime.now(timezone.utc) - timedelta(days=5)).date().isoformat()
        payload = {"name": "TEST_Aktif Ürün", "merchant": "Test AVM", "category": "elektronik",
                   "price": 1500.0, "purchase_date": pd, "return_days": 14, "warranty_months": 24}
        r = session.post(f"{API}/products", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["return_status"] == "active"
        assert 8 <= j["return_days_left"] <= 9
        assert j["warranty_status"] == "active"
        # persist
        pytest.p_active_id = j["id"]
        # verify GET
        g = session.get(f"{API}/products/{j['id']}", headers=auth_headers)
        assert g.status_code == 200 and g.json()["id"] == j["id"]

    def test_create_ending_product(self, session, auth_headers):
        from datetime import datetime, timezone, timedelta
        pd = (datetime.now(timezone.utc) - timedelta(days=12)).date().isoformat()
        payload = {"name": "TEST_Sona Yaklasan", "category": "moda", "price": 500.0,
                   "purchase_date": pd, "return_days": 14, "warranty_months": 24}
        r = session.post(f"{API}/products", json=payload, headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert j["return_status"] == "ending"
        pytest.p_ending_id = j["id"]

    def test_create_expired_product(self, session, auth_headers):
        from datetime import datetime, timezone, timedelta
        pd = (datetime.now(timezone.utc) - timedelta(days=800)).date().isoformat()
        payload = {"name": "TEST_Suresi Dolmus", "category": "elektronik", "price": 999.0,
                   "purchase_date": pd, "return_days": 14, "warranty_months": 24}
        r = session.post(f"{API}/products", json=payload, headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert j["return_status"] == "expired"
        assert j["warranty_status"] == "expired"
        pytest.p_expired_id = j["id"]

    def test_list_and_filter(self, session, auth_headers):
        r = session.get(f"{API}/products", headers=auth_headers)
        assert r.status_code == 200
        all_p = r.json()
        assert len(all_p) >= 3
        for p in all_p:
            assert "_id" not in p
        # filter elektronik
        r2 = session.get(f"{API}/products?category=elektronik", headers=auth_headers)
        assert r2.status_code == 200
        for p in r2.json():
            assert p["category"] == "elektronik"

    def test_update_product(self, session, auth_headers):
        pid = pytest.p_active_id
        upd = {"name": "TEST_Aktif Guncel", "merchant": "Yeni", "category": "ev",
               "price": 2500.0, "return_days": 30, "warranty_months": 24}
        r = session.put(f"{API}/products/{pid}", json=upd, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Aktif Guncel"
        # verify persistence
        g = session.get(f"{API}/products/{pid}", headers=auth_headers)
        assert g.json()["category"] == "ev"

    def test_delete_product(self, session, auth_headers):
        pid = pytest.p_expired_id
        r = session.delete(f"{API}/products/{pid}", headers=auth_headers)
        assert r.status_code == 200
        # verify 404
        g = session.get(f"{API}/products/{pid}", headers=auth_headers)
        assert g.status_code == 404


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard(self, session, auth_headers):
        r = session.get(f"{API}/dashboard", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        for k in ("total_products", "act_now", "returnable_value", "returnable_count", "currency"):
            assert k in j
        assert j["currency"] == "TL"
        assert isinstance(j["act_now"], list)
        # ending product should be in act_now
        ids = [p["id"] for p in j["act_now"]]
        assert pytest.p_ending_id in ids


# ---------------- Return verdict ----------------
class TestReturn:
    def test_verdict_active(self, session, auth_headers):
        # locate any ending product owned by test user
        pl = session.get(f"{API}/products", headers=auth_headers).json()
        ending = next((p for p in pl if p.get("return_status") == "ending"), None)
        if not ending:
            # create one
            from datetime import datetime, timezone, timedelta
            pd = (datetime.now(timezone.utc) - timedelta(days=12)).date().isoformat()
            ending = session.post(f"{API}/products", json={
                "name": "TEST_verdict", "category": "moda", "price": 100, "purchase_date": pd,
                "return_days": 14, "warranty_months": 24}, headers=auth_headers).json()
        r = session.get(f"{API}/return/verdict/{ending['id']}", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert "verdict" in j and "checks" in j
        assert j["checks"]["in_time"] is True

    def test_verdict_404(self, session, auth_headers):
        r = session.get(f"{API}/return/verdict/nonexistent", headers=auth_headers)
        assert r.status_code == 404


# ---------------- Warranty claim ----------------
class TestWarranty:
    def test_claim(self, session, auth_headers):
        pl = session.get(f"{API}/products", headers=auth_headers).json()
        target = next((p for p in pl if p.get("return_status") in ("ending", "active")), pl[0])
        payload = {"product_id": target["id"], "problem": "Cihaz açılmıyor"}
        r = session.post(f"{API}/warranty/claim", json=payload, headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "claim_text" in j and len(j["claim_text"]) > 20
        assert j["product"]["id"] == target["id"]

    def test_claim_bad_product(self, session, auth_headers):
        r = session.post(f"{API}/warranty/claim", json={"product_id": "no", "problem": "x"}, headers=auth_headers)
        assert r.status_code == 404


# ---------------- Gmail ----------------
class TestGmail:
    def test_gmail_preview(self, session, auth_headers):
        r = session.get(f"{API}/gmail/preview", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert j["found"] == 7
        assert len(j["purchases"]) == 7

    def test_gmail_import(self, session, auth_headers):
        r = session.post(f"{API}/gmail/import", headers=auth_headers, timeout=60)
        assert r.status_code == 200
        j = r.json()
        assert j["imported"] == 7
        assert len(j["products"]) == 7


# ---------------- Notifications ----------------
class TestNotifications:
    def test_notifications(self, session, auth_headers):
        r = session.get(f"{API}/notifications", headers=auth_headers)
        assert r.status_code == 200
        notes = r.json()
        assert isinstance(notes, list)
        # after gmail import (Ray-Ban 2 days ago, return_days=14 -> ~12 left, not <=5)
        # But Sony WH 12 days ago -> 2 left => should be a return notif
        assert any(n["type"] == "return" for n in notes)


# ---------------- Assistant ----------------
class TestAssistant:
    def test_chat(self, session, auth_headers):
        r = session.post(f"{API}/assistant/chat", json={"message": "Yakında iade süresi dolan ürünüm var mı?"},
                         headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "reply" in j and len(j["reply"]) > 5
        assert "session_id" in j

    def test_history(self, session, auth_headers):
        r = session.get(f"{API}/assistant/history", headers=auth_headers)
        assert r.status_code == 200
        h = r.json()
        assert isinstance(h, list) and len(h) >= 2
        roles = {m["role"] for m in h}
        assert "user" in roles and "assistant" in roles


# ---------------- AI Scan ----------------
class TestScan:
    def test_scan_receipt(self, session, auth_headers):
        b64 = make_receipt_b64()
        r = session.post(f"{API}/scan", json={"image_base64": b64}, headers=auth_headers, timeout=120)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("merchant", "product_name", "total", "category", "return_days", "warranty_months", "confidence"):
            assert k in j, f"missing {k} in {j}"


# ---------------- Upload / Download ----------------
class TestFiles:
    def test_upload_and_download(self, session, user_ctx):
        # small JPEG
        img = Image.new("RGB", (100, 100), "red")
        d = ImageDraw.Draw(img); d.rectangle([20, 20, 80, 80], fill="blue")
        buf = io.BytesIO(); img.save(buf, format="JPEG"); buf.seek(0)
        headers = {"Authorization": f"Bearer {user_ctx['token']}"}
        files = {"file": ("test.jpg", buf.getvalue(), "image/jpeg")}
        r = requests.post(f"{API}/upload", headers=headers, files=files, timeout=60)
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        # download via token query
        g = requests.get(f"{API}/files/{path}?token={user_ctx['token']}", timeout=60)
        assert g.status_code == 200
        assert g.headers.get("content-type", "").startswith("image/")

    def test_download_requires_auth(self):
        r = requests.get(f"{API}/files/nonexistent/path.jpg")
        assert r.status_code == 401


# ---------------- Seed demo ----------------
class TestSeed:
    def test_seed_new_user(self, session):
        email = f"test+seed{uuid.uuid4().hex[:8]}@saklio.app"
        r = session.post(f"{API}/auth/register", json={"name": "Seed User", "email": email, "password": "test1234"})
        assert r.status_code == 200
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        s = session.post(f"{API}/seed-demo", headers=h)
        assert s.status_code == 200
        assert s.json()["seeded"] is True
        lst = session.get(f"{API}/products", headers=h)
        assert len(lst.json()) == 4
        # idempotent
        s2 = session.post(f"{API}/seed-demo", headers=h)
        assert s2.json()["seeded"] is False
