import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, storageBucket } from "@/src/lib/firebase";

export const TOKEN_KEY = "saklio_token";

const DEMO_PURCHASES = [
  { name: "Sony WH-1000XM6", merchant: "MediaMarkt", category: "elektronik", price: 4999, currency: "TL", days_ago: 12, return_days: 14, warranty_months: 24 },
  { name: "Ray-Ban Meta Wayfarer", merchant: "Elgiganten", category: "moda", price: 3499, currency: "TL", days_ago: 2, return_days: 14, warranty_months: 24 },
  { name: "Dyson V15 Süpürge", merchant: "Hepsiburada", category: "ev", price: 12999, currency: "TL", days_ago: 40, return_days: 14, warranty_months: 24 },
  { name: "MacBook Air M4", merchant: "Apple Store", category: "elektronik", price: 44999, currency: "TL", days_ago: 700, return_days: 14, warranty_months: 24 },
  { name: "Nike Air Max", merchant: "Nike", category: "moda", price: 3299, currency: "TL", days_ago: 5, return_days: 30, warranty_months: 12 },
  { name: "Philips Airfryer", merchant: "Trendyol", category: "ev", price: 2799, currency: "TL", days_ago: 25, return_days: 14, warranty_months: 24 },
  { name: "Michelin Lastik Seti", merchant: "Lastik.com", category: "otomotiv", price: 8999, currency: "TL", days_ago: 90, return_days: 14, warranty_months: 60 },
];

function uid() {
  const u = auth.currentUser;
  if (!u) throw new Error("Giriş gerekli");
  return u.uid;
}

function productsCol(userId = uid()) {
  return collection(db, "users", userId, "products");
}
function docsCol(userId = uid()) {
  return collection(db, "users", userId, "documents");
}
function messagesCol(userId = uid()) {
  return collection(db, "users", userId, "messages");
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function tsToIso(v: any): string {
  if (!v) return new Date().toISOString();
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function enrich(product: any) {
  const out: any = {
    ...product,
    return_days_left: null,
    warranty_days_left: null,
    return_status: "unknown",
    warranty_status: "unknown",
  };
  const pd = product?.purchase_date;
  if (!pd) return out;
  const base = new Date(String(pd));
  if (Number.isNaN(base.getTime())) return out;
  const today = new Date();
  const returnDeadline = new Date(base);
  returnDeadline.setDate(returnDeadline.getDate() + (product.return_days ?? 14));
  const warrantyEnd = new Date(base);
  warrantyEnd.setDate(warrantyEnd.getDate() + (product.warranty_months ?? 24) * 30);
  const rdl = Math.ceil((returnDeadline.getTime() - today.getTime()) / 86400000);
  const wdl = Math.ceil((warrantyEnd.getTime() - today.getTime()) / 86400000);
  out.return_days_left = rdl;
  out.warranty_days_left = wdl;
  out.return_status = rdl > 3 ? "active" : rdl >= 0 ? "ending" : "expired";
  out.warranty_status = wdl > 30 ? "active" : wdl >= 0 ? "ending" : "expired";
  return out;
}

function productFromDoc(d: any) {
  const data = d.data();
  return enrich({
    id: d.id,
    ...data,
    created_at: tsToIso(data.created_at),
  });
}

async function profileDoc() {
  const snap = await getDoc(doc(db, "users", uid()));
  const data = snap.data() || {};
  const user = auth.currentUser!;
  return {
    id: user.uid,
    name: data.name || user.displayName || "Saklio",
    email: data.email || user.email,
    theme: data.theme || "soft",
    currency: data.currency || "TL",
    language: data.language || "tr",
  };
}

async function listAllProducts() {
  const q = query(productsCol(), orderBy("created_at", "desc"), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map(productFromDoc);
}

export const api = {
  async register(name: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email: email.trim().toLowerCase(),
      theme: "soft",
      currency: "TL",
      language: "tr",
      owner_id: cred.user.uid,
      created_at: serverTimestamp(),
    });
    const user = await profileDoc();
    return { token: await cred.user.getIdToken(), user };
  },

  async login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) {
      await setDoc(doc(db, "users", cred.user.uid), {
        name: cred.user.displayName || "Saklio",
        email: cred.user.email,
        theme: "soft",
        currency: "TL",
        language: "tr",
        owner_id: cred.user.uid,
        created_at: serverTimestamp(),
      });
    }
    const user = await profileDoc();
    return { token: await cred.user.getIdToken(), user };
  },

  async me() {
    return profileDoc();
  },

  async updateProfile(body: any) {
    const refUser = doc(db, "users", uid());
    const current = (await getDoc(refUser)).data() || {};
    const next = {
      name: current.name,
      email: current.email,
      theme: body.theme ?? current.theme ?? "soft",
      currency: body.currency ?? current.currency ?? "TL",
      language: body.language ?? current.language ?? "tr",
      owner_id: uid(),
      created_at: current.created_at || Timestamp.now(),
    };
    if (current.reset_code_hash) next.reset_code_hash = current.reset_code_hash;
    if (current.reset_expires) next.reset_expires = current.reset_expires;
    await setDoc(refUser, next);
    return profileDoc();
  },

  async dashboard() {
    const [products, user] = await Promise.all([listAllProducts(), profileDoc()]);
    const act_now = products
      .filter((p) => p.return_status === "ending" || p.warranty_status === "ending")
      .sort((a, b) => (a.return_days_left ?? 9999) - (b.return_days_left ?? 9999))
      .slice(0, 10);
    const returnable = products.filter((p) => p.return_status === "active" || p.return_status === "ending");
    return {
      total_products: products.length,
      act_now,
      returnable_value: returnable.reduce((s, p) => s + (p.price || 0), 0),
      returnable_count: returnable.length,
      currency: user.currency,
    };
  },

  async listProducts(category?: string) {
    const products = await listAllProducts();
    if (category && category !== "tumu") return products.filter((p) => p.category === category);
    return products;
  },

  async getProduct(id: string) {
    const snap = await getDoc(doc(db, "users", uid(), "products", id));
    if (!snap.exists()) throw new Error("Ürün bulunamadı");
    return productFromDoc(snap);
  },

  async createProduct(body: any) {
    const payload = {
      name: String(body.name).slice(0, 120),
      owner_id: uid(),
      merchant: body.merchant ? String(body.merchant).slice(0, 80) : "",
      category: body.category || "diger",
      price: body.price == null ? null : Number(body.price),
      currency: body.currency || "TL",
      purchase_date: body.purchase_date || isoDate(new Date()),
      return_days: body.return_days ?? 14,
      warranty_months: body.warranty_months ?? 24,
      image_path: body.image_path || null,
      receipt_path: body.receipt_path || null,
      items: Array.isArray(body.items) ? body.items.slice(0, 40) : [],
      note: body.note || null,
      notify_return: body.notify_return !== false,
      notify_warranty: body.notify_warranty !== false,
      created_at: serverTimestamp(),
      source: body.source || "manual",
    };
    const added = await addDoc(productsCol(), payload);
    return productFromDoc(await getDoc(added));
  },

  async updateProduct(id: string, body: any) {
    const refP = doc(db, "users", uid(), "products", id);
    const current = (await getDoc(refP)).data();
    if (!current) throw new Error("Ürün bulunamadı");
    await updateDoc(refP, body);
    return productFromDoc(await getDoc(refP));
  },

  async deleteProduct(id: string) {
    const docsSnap = await getDocs(query(docsCol(), where("product_id", "==", id)));
    await Promise.all(docsSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "users", uid(), "products", id));
    return { ok: true };
  },

  async scan(image_base64: string) {
    const fn = httpsCallable(functions, "scanReceipt");
    const res = await fn({ image_base64 });
    return res.data;
  },

  async assistantChat(message: string, session_id?: string) {
    const products = await listAllProducts();
    const context = products.map((p) => ({
      name: p.name,
      merchant: p.merchant,
      price: p.price,
      return_days_left: p.return_days_left,
      warranty_days_left: p.warranty_days_left,
      category: p.category,
    }));
    const sid = session_id || `assist-${uid()}`;
    await addDoc(messagesCol(), {
      owner_id: uid(),
      session_id: sid,
      role: "user",
      text: message,
      created_at: serverTimestamp(),
    });
    const fn = httpsCallable(functions, "assistantChat");
    const res: any = await fn({ message, session_id: sid, products: context });
    await addDoc(messagesCol(), {
      owner_id: uid(),
      session_id: sid,
      role: "assistant",
      text: res.data.reply,
      created_at: serverTimestamp(),
    });
    return res.data;
  },

  async assistantHistory() {
    const sid = `assist-${uid()}`;
    const snap = await getDocs(query(messagesCol(), where("session_id", "==", sid), limit(200)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data(), created_at: tsToIso(d.data().created_at) }))
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
  },

  async returnVerdict(id: string) {
    const p = await api.getProduct(id);
    const rdl = p.return_days_left;
    const checks = {
      receipt: Boolean(p.receipt_path || p.image_path),
      in_time: rdl != null && rdl >= 0,
      type_ok: true,
    };
    let verdict = "Maalesef hayır.";
    let detail = "İade süresi dolmuş görünüyor.";
    if (checks.in_time && checks.receipt) {
      verdict = "Büyük olasılıkla evet.";
      detail = "Bilgiler resmi mağaza koşullarıyla doğrulandı.";
    } else if (checks.in_time) {
      verdict = "Muhtemelen evet.";
      detail = "İade süresi içindesin ancak fişini eklemeni öneririz.";
    }
    return { verdict, detail, checks, days_left: rdl, warning: "Orijinal ambalaj gerekebilir." };
  },

  async warrantyClaim(product_id: string, problem: string) {
    const product = await api.getProduct(product_id);
    const fn = httpsCallable(functions, "warrantyClaim");
    const res: any = await fn({ problem, product });
    return { ...res.data, product };
  },

  async listDocuments(id: string) {
    const snap = await getDocs(query(docsCol(), where("product_id", "==", id), limit(200)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data(), created_at: tsToIso(d.data().created_at) }))
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async addDocument(id: string, body: { type: string; name?: string; file_path: string }) {
    const added = await addDoc(docsCol(), {
      owner_id: uid(),
      product_id: id,
      type: body.type,
      name: body.name || body.type,
      file_path: body.file_path,
      created_at: serverTimestamp(),
    });
    if (body.type === "fis") {
      await updateDoc(doc(db, "users", uid(), "products", id), { receipt_path: body.file_path });
    }
    const snap = await getDoc(added);
    return { id: snap.id, ...snap.data() };
  },

  async deleteDocument(docId: string) {
    await deleteDoc(doc(db, "users", uid(), "documents", docId));
    return { ok: true };
  },

  async updateNotify(id: string, body: { notify_return?: boolean; notify_warranty?: boolean }) {
    const refP = doc(db, "users", uid(), "products", id);
    const current = (await getDoc(refP)).data();
    if (!current) throw new Error("Ürün bulunamadı");
    await updateDoc(refP, body);
    return productFromDoc(await getDoc(refP));
  },

  async shareProduct(id: string) {
    const product = await api.getProduct(id);
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await setDoc(doc(db, "shares", token), {
      from_user_id: uid(),
      product: {
        name: product.name,
        merchant: product.merchant || "",
        category: product.category,
        price: product.price ?? null,
        currency: product.currency || "TL",
        purchase_date: product.purchase_date || isoDate(new Date()),
        return_days: product.return_days ?? 14,
        warranty_months: product.warranty_months ?? 24,
      },
      created_at: serverTimestamp(),
    });
    return { token };
  },

  async getShare(token: string) {
    const snap = await getDoc(doc(db, "shares", token));
    if (!snap.exists()) throw new Error("Paylaşım bulunamadı");
    return { token, ...snap.data() };
  },

  async acceptShare(token: string) {
    const share: any = await api.getShare(token);
    return api.createProduct({ ...share.product, source: "share" });
  },

  async registerPush(body: { user_id: string; platform: string; device_token: string }) {
    const userId = body.user_id || uid();
    await setDoc(doc(db, "users", userId, "pushTokens", body.device_token.slice(-40)), {
      owner_id: userId,
      platform: body.platform,
      device_token: body.device_token,
      created_at: serverTimestamp(),
    });
    return { ok: true };
  },

  async fxRates() {
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await r.json();
      const all = data.rates || {};
      return { base: "USD", rates: { TRY: all.TRY, USD: 1, EUR: all.EUR, SEK: all.SEK, DKK: all.DKK } };
    } catch {
      return { base: "USD", rates: { TRY: 39, USD: 1, EUR: 0.92, SEK: 10.6, DKK: 6.85 }, fallback: true };
    }
  },

  async exportData() {
    const [products, documents, user] = await Promise.all([
      listAllProducts(),
      getDocs(docsCol()),
      profileDoc(),
    ]);
    return {
      sent: false,
      email: user.email,
      counts: { products: products.length, documents: documents.size },
      payload: { user, products, documents: documents.docs.map((d) => ({ id: d.id, ...d.data() })) },
    };
  },

  async requestReset() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const refUser = doc(db, "users", uid());
    const current = (await getDoc(refUser)).data() || {};
    await setDoc(refUser, {
      ...current,
      owner_id: uid(),
      reset_code_hash: code,
      reset_expires: Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
      created_at: current.created_at || Timestamp.now(),
    });
    return { email: current.email || auth.currentUser?.email, debug_code: code };
  },

  async confirmReset(code: string) {
    const refUser = doc(db, "users", uid());
    const current = (await getDoc(refUser)).data() || {};
    const expires = current.reset_expires?.toDate?.() || new Date(0);
    if (current.reset_code_hash !== code || expires < new Date()) throw new Error("Kod hatalı veya süresi doldu");
    const [products, documents, messages] = await Promise.all([
      getDocs(productsCol()),
      getDocs(docsCol()),
      getDocs(messagesCol()),
    ]);
    await Promise.all([
      ...products.docs.map((d) => deleteDoc(d.ref)),
      ...documents.docs.map((d) => deleteDoc(d.ref)),
      ...messages.docs.map((d) => deleteDoc(d.ref)),
    ]);
    const { reset_code_hash, reset_expires, ...rest } = current as any;
    await setDoc(refUser, { ...rest, owner_id: uid(), created_at: rest.created_at || Timestamp.now() });
    return { ok: true };
  },

  async gmailPreview() {
    return { found: DEMO_PURCHASES.length, purchases: DEMO_PURCHASES };
  },

  async gmailImport() {
    const created = [];
    for (const d of DEMO_PURCHASES) {
      const pd = isoDate(new Date(Date.now() - d.days_ago * 86400000));
      created.push(
        await api.createProduct({
          name: d.name,
          merchant: d.merchant,
          category: d.category,
          price: d.price,
          currency: d.currency,
          purchase_date: pd,
          return_days: d.return_days,
          warranty_months: d.warranty_months,
          source: "gmail",
        })
      );
    }
    return { imported: created.length, products: created };
  },

  async notifications() {
    const products = await listAllProducts();
    const notes: any[] = [];
    for (const p of products) {
      if (p.return_days_left != null && p.return_days_left >= 0 && p.return_days_left <= 5) {
        notes.push({ type: "return", title: "İade süresi yaklaşıyor", body: `${p.name} için ${p.return_days_left} gün kaldı`, product_id: p.id, days: p.return_days_left });
      }
      if (p.warranty_days_left != null && p.warranty_days_left >= 0 && p.warranty_days_left <= 45) {
        notes.push({ type: "warranty", title: "Garanti bitiyor", body: `${p.name} garantisine ${p.warranty_days_left} gün kaldı`, product_id: p.id, days: p.warranty_days_left });
      }
    }
    notes.sort((a, b) => a.days - b.days);
    return notes;
  },

  async seedDemo() {
    const existing = await listAllProducts();
    if (existing.length > 0) return { seeded: false, message: "Zaten ürünler var" };
    for (const d of DEMO_PURCHASES.slice(0, 4)) {
      const pd = isoDate(new Date(Date.now() - d.days_ago * 86400000));
      await api.createProduct({
        name: d.name,
        merchant: d.merchant,
        category: d.category,
        price: d.price,
        currency: d.currency,
        purchase_date: pd,
        return_days: d.return_days,
        warranty_months: d.warranty_months,
        source: "demo",
      });
    }
    return { seeded: true };
  },

  async signOut() {
    await fbSignOut(auth);
  },
};

export async function uploadImage(uri: string): Promise<string> {
  const userId = uid();
  const path = `users/${userId}/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storageRef = ref(storageBucket, path);
  const blob = await (await fetch(uri)).blob();
  await uploadBytes(storageRef, blob, { contentType: blob.type || "image/jpeg" });
  return path;
}

export async function fileUrl(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return getDownloadURL(ref(storageBucket, path));
}
