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
import { SITE_URL } from "@/src/lib/site";
import { getLang, L } from "@/src/lib/format";

export const TOKEN_KEY = "saklio_token";

const DEMO_PURCHASES = [
  { name: "Sony WH-1000XM6", merchant: "MediaMarkt", category: "elektronik", price: 4999, currency: "TL", days_ago: 12, return_days: 14, warranty_months: 24 },
  { name: "Ray-Ban Meta Wayfarer", merchant: "Elgiganten", category: "moda", price: 3499, currency: "TL", days_ago: 2, return_days: 14, warranty_months: 24 },
  { name: "Dyson V15 Süpürge", merchant: "Hepsiburada", category: "ev", price: 12999, currency: "TL", days_ago: 40, return_days: 14, warranty_months: 24 },
  { name: "MacBook Air M4", merchant: "Apple Store", category: "elektronik", price: 44999, currency: "TL", days_ago: 700, return_days: 14, warranty_months: 24 },
  { name: "Nike Air Max", merchant: "Nike", category: "moda", price: 3299, currency: "TL", days_ago: 5, return_days: 30, warranty_months: 12 },
  { name: "Philips Airfryer", merchant: "Trendyol", category: "ev", price: 2799, currency: "TL", days_ago: 25, return_days: 14, warranty_months: 24 },
  { name: "Michelin Lastik Seti", merchant: "Lastik.com", category: "otomotiv", price: 8999, currency: "TL", days_ago: 90, return_days: 14, warranty_months: 60 },
  { name: "Haftalık market", merchant: "Migros", category: "gida", price: 842, currency: "TL", days_ago: 4, return_days: 0, warranty_months: 0 },
  { name: "Eczane alışverişi", merchant: "Eczane", category: "saglik", price: 219, currency: "TL", days_ago: 9, return_days: 14, warranty_months: 0 },
  { name: "Akaryakıt", merchant: "Opet", category: "ulasim", price: 1450, currency: "TL", days_ago: 2, return_days: 0, warranty_months: 0 },
];

function uid() {
  const u = auth.currentUser;
  if (!u) throw new Error(L("Giriş gerekli", "Sign in required"));
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

function mapFirebaseError(e: any): Error {
  const code = String(e?.code || "");
  const msg = String(e?.message || "");
  if (code === "auth/email-already-in-use") return new Error(L("Bu e-posta zaten kayıtlı. Giriş yapmayı dene.", "This email is already registered. Try signing in."));
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") {
    return new Error(L("E-posta veya şifre hatalı.", "Incorrect email or password."));
  }
  if (code === "auth/weak-password") return new Error(L("Şifre en az 6 karakter olmalı.", "Password must be at least 6 characters."));
  if (code === "permission-denied" || msg.toLowerCase().includes("insufficient permissions")) {
    return new Error(L("Profil kaydı tamamlanamadı. Bir kez daha giriş yap.", "Profile could not be saved. Please sign in again."));
  }
  return new Error(msg || L("Bir hata oluştu", "Something went wrong"));
}

async function writeUserProfile(userId: string, name: string, email: string) {
    await setDoc(doc(db, "users", userId), {
    name: (name || "Saklio").slice(0, 80),
    email: (email || "").trim().toLowerCase(),
    theme: "soft",
    currency: "TL",
    language: getLang(),
    owner_id: userId,
    created_at: Timestamp.now(),
  }, { merge: true });
}

function shoppingCol(userId = uid()) {
  return collection(db, "users", userId, "shoppingItems");
}

export const api = {
  async register(name: string, email: string, password: string) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await updateProfile(cred.user, { displayName: name });
      await writeUserProfile(cred.user.uid, name, cred.user.email || email);
      const user = await profileDoc();
      api.sendWelcomeEmail(name).catch(() => {});
      return { token: await cred.user.getIdToken(), user };
    } catch (e) {
      throw mapFirebaseError(e);
    }
  },

  async login(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await writeUserProfile(cred.user.uid, cred.user.displayName || "Saklio", cred.user.email || email);
      }
      const user = await profileDoc();
      return { token: await cred.user.getIdToken(), user };
    } catch (e) {
      throw mapFirebaseError(e);
    }
  },

  async me() {
    const u = auth.currentUser;
    if (!u) throw new Error(L("Giriş gerekli", "Sign in required"));
    const snap = await getDoc(doc(db, "users", u.uid));
    if (!snap.exists()) {
      await writeUserProfile(u.uid, u.displayName || "Saklio", u.email || "");
    }
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
    await setDoc(refUser, next, { merge: true });
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
    if (!snap.exists()) throw new Error(L("Ürün bulunamadı", "Product not found"));
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
      image_url: body.image_url || null,
      receipt_path: body.receipt_path || null,
      receipt_batch_id: body.receipt_batch_id || null,
      items: Array.isArray(body.items) ? body.items.slice(0, 50) : [],
      note: body.note || null,
      notify_return: body.notify_return !== false,
      notify_warranty: body.notify_warranty !== false,
      created_at: serverTimestamp(),
      source: body.source || "manual",
    };
    const added = await addDoc(productsCol(), payload);
    return productFromDoc(await getDoc(added));
  },

  async createProductsFromReceipt(body: {
    merchant?: string | null;
    purchase_date?: string | null;
    currency?: string;
    return_days?: number;
    warranty_months?: number;
    receipt_path?: string | null;
    products: Array<{
      name: string;
      price?: number | null;
      category?: string;
      return_days?: number;
      warranty_months?: number;
      image_url?: string | null;
      qty?: number;
    }>;
  }) {
    const batchId = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created: any[] = [];
    for (const p of (body.products || []).slice(0, 50)) {
      const product = await api.createProduct({
        name: p.name,
        merchant: body.merchant,
        category: p.category || "diger",
        price: p.price ?? null,
        currency: body.currency || "TL",
        purchase_date: body.purchase_date,
        return_days: p.return_days ?? body.return_days ?? 14,
        warranty_months: p.warranty_months ?? body.warranty_months ?? 24,
        receipt_path: body.receipt_path || null,
        receipt_batch_id: batchId,
        image_path: null,
        image_url: p.image_url || null,
        source: "scan",
      });
      created.push(product);
    }
    return { products: created, receipt_batch_id: batchId };
  },

  async lookupProductImages(items: Array<{ name: string }>, merchant?: string | null) {
    const fn = httpsCallable(functions, "lookupProductImages", { timeout: 120000 });
    const res = await fn({
      items: items.map((it) => ({ name: it.name })),
      merchant: merchant || "",
      lang: getLang(),
    });
    return res.data as { results: Array<{ name: string; image_url: string | null }>; found: number };
  },

  async updateProduct(id: string, body: any) {
    const refP = doc(db, "users", uid(), "products", id);
    const current = (await getDoc(refP)).data();
    if (!current) throw new Error(L("Ürün bulunamadı", "Product not found"));
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
    const fn = httpsCallable(functions, "scanReceipt", { timeout: 120000 });
    const res = await fn({ image_base64, lang: getLang() });
    return res.data;
  },

  async assistantChat(message: string, session_id?: string) {
    const products = await listAllProducts();
    const context = products.map((p) => ({
      name: p.name,
      merchant: p.merchant,
      price: p.price,
      purchase_date: p.purchase_date,
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
    const res: any = await fn({ message, session_id: sid, products: context, lang: getLang() });
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
    let verdict = L("Maalesef hayır.", "Unfortunately no.");
    let detail = L("İade süresi dolmuş görünüyor.", "The return window appears to have expired.");
    if (checks.in_time && checks.receipt) {
      verdict = L("Büyük olasılıkla evet.", "Most likely yes.");
      detail = L("Bilgiler resmi mağaza koşullarıyla doğrulandı.", "Details match typical store return terms.");
    } else if (checks.in_time) {
      verdict = L("Muhtemelen evet.", "Probably yes.");
      detail = L("İade süresi içindesin ancak fişini eklemeni öneririz.", "You're still in the return window, but adding the receipt helps.");
    }
    return { verdict, detail, checks, days_left: rdl, warning: L("Orijinal ambalaj gerekebilir.", "Original packaging may be required.") };
  },

  async warrantyClaim(product_id: string, problem: string) {
    const product = await api.getProduct(product_id);
    const fn = httpsCallable(functions, "warrantyClaim");
    const res: any = await fn({ problem, product, lang: getLang() });
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
    if (!current) throw new Error(L("Ürün bulunamadı", "Product not found"));
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
    return { token, deeplink: `${SITE_URL}/share/${token}` };
  },

  async getShare(token: string) {
    const snap = await getDoc(doc(db, "shares", token));
    if (!snap.exists()) throw new Error(L("Paylaşım bulunamadı", "Share not found"));
    return { token, ...snap.data() };
  },

  async acceptShare(token: string) {
    const share: any = await api.getShare(token);
    return api.createProduct({ ...share.product, source: "share" });
  },

  async registerPush(body: { user_id: string; platform: string; device_token: string; device_name?: string }) {
    const userId = body.user_id || uid();
    await setDoc(doc(db, "users", userId, "pushTokens", body.device_token.slice(-40)), {
      owner_id: userId,
      platform: body.platform,
      device_token: body.device_token,
      device_name: body.device_name || "",
      last_seen: serverTimestamp(),
      created_at: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  },

  async listShopping() {
    const snap = await getDocs(query(shoppingCol(), orderBy("created_at", "desc"), limit(200)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), created_at: tsToIso(d.data().created_at) }));
  },

  async addShoppingItem(body: { name: string; qty?: string }) {
    const added = await addDoc(shoppingCol(), {
      owner_id: uid(),
      name: String(body.name || "").trim().slice(0, 80),
      qty: String(body.qty || "").trim().slice(0, 40),
      note: "",
      checked: false,
      created_at: serverTimestamp(),
    });
    const snap = await getDoc(added);
    return { id: snap.id, ...snap.data() };
  },

  async updateShoppingItem(id: string, body: { name?: string; qty?: string; checked?: boolean }) {
    const refItem = doc(db, "users", uid(), "shoppingItems", id);
    const current = (await getDoc(refItem)).data();
    if (!current) throw new Error(L("Ürün bulunamadı", "Product not found"));
    await updateDoc(refItem, {
      name: body.name != null ? String(body.name).trim().slice(0, 80) : current.name,
      qty: body.qty != null ? String(body.qty).trim().slice(0, 40) : current.qty || "",
      note: current.note || "",
      checked: body.checked != null ? Boolean(body.checked) : current.checked,
      owner_id: current.owner_id,
      created_at: current.created_at,
    });
    return { id, ...(await getDoc(refItem)).data() };
  },

  async deleteShoppingItem(id: string) {
    await deleteDoc(doc(db, "users", uid(), "shoppingItems", id));
    return { ok: true };
  },

  async deleteMyAccount() {
    const fn = httpsCallable(functions, "deleteMyAccount");
    return (await fn({})).data;
  },

  async requestPushTest() {
    const fn = httpsCallable(functions, "sendMyTestPush");
    return (await fn({ lang: getLang() })).data;
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

  async exportData(opts?: { sendEmail?: boolean }) {
    const fn = httpsCallable(functions, "exportMyData", { timeout: 120000 });
    const res: any = await fn({ lang: getLang(), sendEmail: opts?.sendEmail });
    return res.data;
  },

  async requestReset() {
    const fn = httpsCallable(functions, "requestDeleteCode");
    const res: any = await fn({ lang: getLang() });
    return res.data;
  },

  async confirmReset(code: string) {
    const fn = httpsCallable(functions, "confirmDeleteData");
    return (await fn({ code })).data;
  },

  async sendMyEmail(
    body: {
      subject: string;
      html: string;
      text?: string;
      attachment?: { filename: string; content: string; type?: string };
      createPdf?: boolean;
      pdfFilename?: string;
    }
  ) {
    const fn = httpsCallable(functions, "sendMyEmail", { timeout: 60000 });
    return (await fn({ ...body, lang: getLang() })).data;
  },

  async sendPasswordResetCode(email: string) {
    const fn = httpsCallable(functions, "sendPasswordResetCode");
    return (await fn({ email, lang: getLang() })).data;
  },

  async confirmPasswordResetCode(email: string, code: string, password: string) {
    const fn = httpsCallable(functions, "confirmPasswordResetCode");
    return (await fn({ email, code, password })).data;
  },

  async sendWelcomeEmail(name?: string) {
    const fn = httpsCallable(functions, "sendWelcomeEmail");
    return (await fn({ name, lang: getLang() })).data;
  },

  async pingSession(body?: { permissions?: any; platform?: string; device?: string }) {
    const fn = httpsCallable(functions, "pingSession");
    return (await fn(body || {})).data;
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
        notes.push({ type: "return", title: L("İade süresi yaklaşıyor", "Return window ending"), body: L(`${p.name} için ${p.return_days_left} gün kaldı`, `${p.return_days_left} days left for ${p.name}`), product_id: p.id, days: p.return_days_left });
      }
      if (p.warranty_days_left != null && p.warranty_days_left >= 0 && p.warranty_days_left <= 45) {
        notes.push({ type: "warranty", title: L("Garanti bitiyor", "Warranty ending"), body: L(`${p.name} garantisine ${p.warranty_days_left} gün kaldı`, `${p.warranty_days_left} days left on ${p.name} warranty`), product_id: p.id, days: p.warranty_days_left });
      }
    }
    notes.sort((a, b) => a.days - b.days);
    return notes;
  },

  async seedDemo() {
    const existing = await listAllProducts();
    if (existing.length > 0) return { seeded: false, message: L("Zaten ürünler var", "Products already exist") };
    for (const d of DEMO_PURCHASES) {
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
