const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ region: "europe-west1", maxInstances: 20, timeoutSeconds: 60, memory: "512MiB" });
admin.initializeApp();

const openaiKey = defineSecret("OPENAI_API_KEY");
const smtpPass = defineSecret("SMTP_PASS");
const { sendMail } = require("./mail");
const { welcomeEmailHtml, deleteCodeEmailHtml, reminderEmailHtml, exportReadyHtml, bannedHtml, passwordResetEmailHtml } = require("./emails");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const LIMITS = {
  scan: { perMin: 4, perDay: 25 },
  assistant: { perMin: 8, perDay: 80 },
  claim: { perMin: 3, perDay: 15 },
  mail: { perMin: 3, perDay: 20 },
};

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|br|li|h1|h2|h3|tr|td|th)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 200_000);
}

async function makePdfAttachmentFromHtml(html, title) {
  const plain = htmlToPlainText(html);
  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text(String(title || "Saklio"), { align: "left" });
      doc.moveDown();
      doc.fontSize(11).text(plain || "—", { width: 500 });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function normalizeCategory(cat) {
  const allowed = ["elektronik", "moda", "ev", "otomotiv", "gida", "saglik", "ulasim", "fatura", "eglence", "diger"];
  return allowed.includes(cat) ? cat : "diger";
}

const SKIP_LINE_RE =
  /^(toplam|total|totalt|summe|gesamt|montant|importe|subtotal|sub\s*total|ara\s*toplam|zwischensumme|kdv|tax|vat|tva|iva|mwst|gst|moms|nakit|cash|kontant|esp[eè]ces|bar|kart|card|karte|credit|debit|change|para\s*üstü|wechselgeld|monnaie|indirim|rabatt|remise|descuento|discount|ödeme|payment|paiement|pago|taksit|rate|yekün|genel\s*toplam|visa|master|mastercard|amex|banka|bank|pos|fiş|fatura|receipt|invoice|facture|rechnung|bon|ticket|quittung|kvitto|nota|tarih|date|datum|saat|time|uhr|kasiyer|cashier|caissier|kassör|müşteri|customer|client|kunde|tel|phone|telefon|adres|address|adresse|website|www\.|http|thank\s*you|teşekkür|merci|danke|gracias|welcome|hoş\s*geldiniz|items\s*count|item\s*count|qty\s*total|balance|balance\s*due|amount\s*due|amount\s*paid|paid|betrag|belopp)/i;

function isSkipLine(name, raw) {
  if (raw && raw.is_product === false) return true;
  const n = String(name || "").trim();
  if (!n || n.length < 2) return true;
  if (/^\d+$/.test(n)) return true;
  if (/^[\d\s.,\-+/%]+$/.test(n)) return true;
  return SKIP_LINE_RE.test(n);
}

function normalizeCurrency(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z₺$€£]/g, "");
  if (!s) return "TL";
  if (["TL", "TRY", "₺"].includes(s)) return "TL";
  if (["USD", "US", "US$", "$"].includes(s)) return "USD";
  if (["EUR", "€"].includes(s)) return "EUR";
  if (["SEK"].includes(s)) return "SEK";
  if (["DKK"].includes(s)) return "DKK";
  if (["GBP", "£"].includes(s)) return "EUR";
  if (s.includes("TRY") || s.includes("₺")) return "TL";
  if (s.includes("USD") || s.includes("$")) return "USD";
  if (s.includes("EUR") || s.includes("€")) return "EUR";
  if (s.includes("SEK")) return "SEK";
  if (s.includes("DKK")) return "DKK";
  return "TL";
}

function normalizePurchaseDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (m1) {
    let [, a, b, y] = m1;
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    const n1 = Number(a);
    const n2 = Number(b);
    // DD/MM vs MM/DD: if first part > 12 treat as day-first (common outside US)
    const day = n1 > 12 ? n1 : n2 > 12 ? n2 : n1;
    const month = n1 > 12 ? n2 : n2 > 12 ? n1 : n2;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeScanLine(it) {
  const name = String(it?.name || it?.product_name || "").trim().slice(0, 120);
  const qty = Math.max(1, Math.min(999, Number(it?.qty ?? it?.quantity ?? 1) || 1));
  let unitPrice = Number(it?.unit_price ?? it?.unitPrice ?? 0);
  let price = Number(it?.price ?? it?.total ?? 0);
  if (!price && unitPrice) price = unitPrice * qty;
  if (!unitPrice && price && qty > 1) unitPrice = price / qty;
  return {
    name,
    price: price > 0 ? Math.round(price * 100) / 100 : null,
    qty,
    unit_price: unitPrice > 0 ? Math.round(unitPrice * 100) / 100 : null,
    category: normalizeCategory(it?.category),
    return_days: Math.min(365, Math.max(0, Number(it?.return_days) || 14)),
    warranty_months: Math.min(120, Math.max(0, Number(it?.warranty_months ?? 24) || 0)),
    is_product: it?.is_product !== false,
  };
}

function normalizeScanItems(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const it = normalizeScanLine(raw);
    if (!it.name || isSkipLine(it.name, raw)) continue;
    const key = `${it.name.toLowerCase()}|${it.price ?? 0}|${it.qty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { is_product, ...row } = it;
    out.push(row);
    if (out.length >= 50) break;
  }
  return out;
}

function buildProductsFromScan(data, lang) {
  let items = normalizeScanItems(data.products);
  if (!items.length) items = normalizeScanItems(data.items);
  if (!items.length && data.product_name) {
    items = [
      normalizeScanLine({
        name: data.product_name,
        price: data.total,
        qty: 1,
        category: data.category,
        return_days: data.return_days,
        warranty_months: data.warranty_months,
      }),
    ];
  }
  if (!items.length) {
    items = [
      normalizeScanLine({
        name: data.merchant || loc(lang, "Fiş alışverişi", "Receipt purchase"),
        price: data.total,
        qty: 1,
        category: data.category,
        return_days: data.return_days,
        warranty_months: data.warranty_months,
      }),
    ];
  }
  return items;
}

async function fetchProductImageUrl(name, merchant) {
  const query = `${name} ${merchant || ""} product`.trim().slice(0, 180);
  if (!query) return null;
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [/murl&quot;:&quot;(https?:\/\/[^&"]+?)&quot;/g, /"murl":"(https?:\/\/[^"]+?)"/g];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(html))) {
        const candidate = String(m[1] || "").replace(/\\\//g, "/");
        const cl = candidate.toLowerCase();
        if (
          cl.startsWith("https://") &&
          (cl.includes(".jpg") || cl.includes(".jpeg") || cl.includes(".png") || cl.includes(".webp"))
        ) {
          return candidate.slice(0, 500);
        }
      }
    }
    return null;
  } catch (e) {
    console.warn("fetchProductImageUrl failed", name, e?.message || e);
    return null;
  }
}

function scanSystem() {
  return `You are an expert multilingual receipt/invoice OCR assistant.
Receipts may be in ANY language or script (Turkish, English, German, French, Spanish, Arabic, Chinese, Japanese, Swedish, Danish, etc.).
Read the ENTIRE image carefully — including long supermarket, pharmacy, electronics and restaurant receipts with many line items.

Return ONLY valid JSON:
{
  "receipt_language": "detected ISO 639-1 code, e.g. tr, en, de, fr, ar",
  "merchant": "store name as printed (keep original script)",
  "purchase_date": "YYYY-MM-DD",
  "currency": "TL | USD | EUR | SEK | DKK",
  "total": 0.0,
  "category": "elektronik | moda | ev | otomotiv | gida | saglik | ulasim | fatura | eglence | diger",
  "return_days": 14,
  "warranty_months": 24,
  "confidence": 0.0,
  "items": [
    {
      "name": "product name EXACTLY as on receipt — do NOT translate",
      "price": 0.0,
      "qty": 1,
      "unit_price": 0.0,
      "category": "gida",
      "return_days": 14,
      "warranty_months": 0,
      "is_product": true
    }
  ]
}

Rules:
- AUTO-DETECT the receipt language. Keep merchant and product names in the ORIGINAL language/script on the receipt.
- Extract EVERY purchasable product line (up to 50). Never merge multiple products into one line.
- Set is_product=false for non-product lines: subtotal, tax/VAT/GST/MwSt/TVA/KDV, payment method, change, discount summary, cashier, receipt/invoice number, address, loyalty points, tips/service charge headers.
- Parse dates in any locale format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, localized month names) → output ISO YYYY-MM-DD.
- Detect currency from symbols/text on receipt (₺/TRY→TL, $/USD, €/EUR, kr/SEK, DKK). Default TL only if truly unknown.
- Category keys must stay in Turkish enum above (map semantically: food→gida, pharmacy→saglik, transport/fuel→ulasim, bills→fatura, entertainment→eglence, electronics→elektronik, fashion→moda, home→ev, automotive→otomotiv, other→diger).
- return_days: use typical consumer return window for detected country (EU often 14, US varies, groceries/consumables often 0). Default 14.
- warranty_months: 24 for electronics/appliances; 0 for food/consumables/fuel/restaurant items.
- If date unclear use today. total = grand total on receipt. confidence 0-1.`;
}

function assistantSystem(lang) {
  return lang === "en"
    ? `You are 'Saklio Assistant'. Answer briefly, warmly and clearly in English about the user's purchases, receipts, return windows, warranties and monthly spending by sector.
Categories: elektronik, moda, ev, otomotiv, gida, saglik, ulasim, fatura, eglence, diger.
When asked about money, summarize totals and which sectors they spend most in.
return_days_left and warranty_days_left are in days; negative means expired.
Keep answers short (2-4 sentences).`
    : `Sen 'Saklio Asistan'sın. Kullanıcının satın aldığı ürünler, fişler, iade süreleri, garantiler ve sektör bazlı aylık harcamalar hakkında Türkçe, kısa, sıcak ve net yanıtlar verirsin.
Kategoriler: elektronik, moda, ev, otomotiv, gida, saglik, ulasim, fatura, eglence, diger.
Para sorulursa toplamı ve en çok harcadığı sektörleri özetle.
İade süresi (return_days_left) ve garanti (warranty_days_left) gün cinsindendir; negatifse süre dolmuştur.
Cevaplarını kısa tut (2-4 cümle).`;
}

function loc(lang, tr, en) {
  return lang === "en" ? en : tr;
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function minuteKey(d = new Date()) {
  return d.toISOString().slice(0, 16);
}

async function enforceRateLimit(uid, kind) {
  const limits = LIMITS[kind];
  const ref = admin.firestore().doc(`rateLimits/${uid}`);
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const now = new Date();
    const day = dayKey(now);
    const minute = minuteKey(now);
    const dayField = `${kind}Day`;
    const minField = `${kind}Min`;
    const dayState = data[dayField] || { key: "", count: 0 };
    const minState = data[minField] || { key: "", count: 0 };
    const dayCount = dayState.key === day ? dayState.count : 0;
    const minCount = minState.key === minute ? minState.count : 0;
    if (minCount >= limits.perMin) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again in a minute.");
    }
    if (dayCount >= limits.perDay) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    }
    tx.set(
      ref,
      {
        [dayField]: { key: day, count: dayCount + 1 },
        [minField]: { key: minute, count: minCount + 1 },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function chatCompletions({ model, messages, json, maxTokens }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: json ? 0.1 : 0.4,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    const code = res.status === 429 ? "resource-exhausted" : "unavailable";
    throw new HttpsError(code, "AI service is unavailable right now");
  }
  return body.choices?.[0]?.message?.content || "";
}

function extractJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  if (request.auth.token?.banned === true) throw new HttpsError("permission-denied", "Account suspended");
  return request.auth.uid;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function tsIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v._seconds) return new Date(v._seconds * 1000).toISOString();
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

exports.scanReceipt = onCall(
  { secrets: [openaiKey], enforceAppCheck: false, timeoutSeconds: 120, memory: "1GiB" },
  async (request) => {
    try {
      const uid = requireUser(request);
      await enforceRateLimit(uid, "scan");
      const lang = request.data?.lang === "en" ? "en" : "tr";
      let b64 = String(request.data?.image_base64 || "").replace(/\s/g, "");
      if (!b64) throw new HttpsError("invalid-argument", loc(lang, "Görsel gerekli", "Image required"));
      const comma = b64.indexOf(",");
      if (b64.startsWith("data:") && comma !== -1) b64 = b64.slice(comma + 1);
      if (!b64 || b64.length < 32) throw new HttpsError("invalid-argument", loc(lang, "Görsel gerekli", "Image required"));
      if (b64.length > 8_000_000) throw new HttpsError("invalid-argument", loc(lang, "Görsel çok büyük", "Image is too large"));

      const mime = b64.slice(0, 16).includes("iVBOR") ? "image/png" : "image/jpeg";
      const text = await chatCompletions({
        model: "gpt-4o",
        json: true,
        maxTokens: 4096,
        messages: [
          { role: "system", content: scanSystem() },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Read this receipt in whatever language it is written. Extract every product line separately. Keep product names in the original language. Return JSON only.",
              },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
      });
      const data = extractJson(text);
      if (!data) throw new HttpsError("failed-precondition", loc(lang, "Fiş anlaşılamadı", "Could not read the receipt"));
      data.receipt_language = String(data.receipt_language || "unknown").slice(0, 8);
      data.currency = normalizeCurrency(data.currency);
      data.return_days = Number(data.return_days) || 14;
      data.warranty_months = Number(data.warranty_months) || 24;
      data.category = normalizeCategory(data.category);
      data.confidence = Number(data.confidence) || 0.7;
      data.purchase_date = normalizePurchaseDate(data.purchase_date);
      data.products = buildProductsFromScan(data, lang);
      data.item_count = data.products.length;
      data.items = data.products;
      const main = data.products.reduce(
        (best, it) => ((it.price ?? 0) > (best?.price ?? 0) ? it : best),
        data.products[0]
      );
      data.product_name = main?.name || data.merchant || loc(lang, "Ürün", "Product");
      return data;
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("scanReceipt failed", e);
      throw new HttpsError("internal", "Scan failed");
    }
  }
);

exports.lookupProductImages = onCall(
  { enforceAppCheck: false, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    requireUser(request);
    const lang = request.data?.lang === "en" ? "en" : "tr";
    const merchant = String(request.data?.merchant || "").slice(0, 80);
    const raw = Array.isArray(request.data?.items) ? request.data.items : [];
    const items = raw
      .map((it) => String(it?.name || it || "").trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 50);
    if (!items.length) throw new HttpsError("invalid-argument", loc(lang, "Ürün adı gerekli", "Product name required"));
    const results = [];
    for (const name of items) {
      const image_url = await fetchProductImageUrl(name, merchant);
      results.push({ name, image_url: image_url || null });
      await new Promise((r) => setTimeout(r, 250));
    }
    return { results, found: results.filter((r) => r.image_url).length };
  }
);

exports.assistantChat = onCall({ secrets: [openaiKey], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "assistant");
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const message = String(request.data?.message || "").trim();
  if (!message || message.length > 2000) throw new HttpsError("invalid-argument", loc(lang, "Mesaj geçersiz", "Invalid message"));
  const products = request.data?.products;
  const context = Array.isArray(products) ? products.slice(0, 80) : [];
  const sessionId = String(request.data?.session_id || `assist-${uid}`);
  const reply = await chatCompletions({
    model: "gpt-4o-mini",
    json: false,
    maxTokens: 400,
    messages: [
      { role: "system", content: `${assistantSystem(lang)}\n\n${loc(lang, "Kullanıcının ürünleri", "User products")}: ${JSON.stringify(context)}` },
      { role: "user", content: message },
    ],
  });
  return { reply: String(reply).slice(0, 4000), session_id: sessionId };
});

exports.warrantyClaim = onCall({ secrets: [openaiKey], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "claim");
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const problem = String(request.data?.problem || "").trim();
  const product = request.data?.product || {};
  if (!problem || problem.length > 1000) throw new HttpsError("invalid-argument", loc(lang, "Sorun açıklaması gerekli", "Problem description required"));
  const text = await chatCompletions({
    model: "gpt-4o-mini",
    json: false,
    maxTokens: 350,
    messages: [
      {
        role: "system",
        content: lang === "en"
          ? "You are a warranty claim assistant. Write a short, formal English warranty claim (3-5 sentences) from the product and problem details."
          : "Sen bir garanti başvuru asistanısın. Verilen ürün ve sorun bilgisine göre kısa, resmi bir Türkçe garanti başvuru metni oluştur (3-5 cümle).",
      },
      {
        role: "user",
        content: `${loc(lang, "Ürün", "Product")}: ${product.name || "-"}\n${loc(lang, "Mağaza", "Store")}: ${product.merchant || "-"}\n${loc(lang, "Satın alma", "Purchase")}: ${product.purchase_date || "-"}\n${loc(lang, "Sorun", "Problem")}: ${problem}`,
      },
    ],
  });
  return { claim_text: String(text).slice(0, 4000), problem };
});

const ADMIN_EMAIL = "alikayracatalkaya@gmail.com";

async function requireAdmin(request) {
  const uid = requireUser(request);
  const user = await admin.auth().getUser(uid);
  const email = String(user.email || "").toLowerCase();
  if (email !== ADMIN_EMAIL && user.customClaims?.admin !== true) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  if (email === ADMIN_EMAIL && user.customClaims?.admin !== true) {
    await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
  }
  return { uid, email };
}

async function collectPushTokens(userId) {
  const snap = await admin.firestore().collection(`users/${userId}/pushTokens`).get();
  return snap.docs.map((d) => d.data()).filter((t) => t && t.device_token);
}

async function sendExpoMessages(messages) {
  if (!messages.length) return { sent: 0 };
  const chunks = [];
  for (let i = 0; i < messages.length; i += 80) chunks.push(messages.slice(i, i + 80));
  let sent = 0;
  for (const chunk of chunks) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
  }
  return { sent };
}

function expoMessage(token, title, body, data) {
  return {
    to: token,
    title,
    body,
    sound: "default",
    channelId: "default",
    priority: "high",
    data: data || {},
  };
}

exports.sendMyTestPush = onCall({ enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const tokens = await collectPushTokens(uid);
  const title = lang === "en" ? "Saklio" : "Saklio";
  const body = lang === "en" ? "Notifications are working." : "Bildirimler çalışıyor.";
  const messages = tokens.map((t) => expoMessage(t.device_token, title, body, { action_url: "/notifications" }));
  const result = await sendExpoMessages(messages);
  return { ...result, tokens: tokens.length };
});

exports.adminStats = onCall({ enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const db = admin.firestore();
  const users = await db.collection("users").get();
  let products = 0;
  let tokens = 0;
  let shopping = 0;
  for (const u of users.docs) {
    const [p, t, s] = await Promise.all([
      u.ref.collection("products").get(),
      u.ref.collection("pushTokens").get(),
      u.ref.collection("shoppingItems").get(),
    ]);
    products += p.size;
    tokens += t.size;
    shopping += s.size;
  }
  return { users: users.size, products, tokens, shopping };
});

exports.adminListUsers = onCall({ enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const snap = await admin.firestore().collection("users").limit(300).get();
  const rows = [];
  for (const d of snap.docs) {
    const x = d.data() || {};
    const authU = await authUserSafe(d.id);
    const tokens = await d.ref.collection("pushTokens").limit(20).get();
    const created = tsIso(x.created_at) || publicAuth(authU).createdAt;
    const lastSeen = tsIso(x.last_seen) || publicAuth(authU).lastSignIn;
    const ms = created ? Date.now() - new Date(created).getTime() : 0;
    rows.push({
      id: d.id,
      name: x.name || authU?.displayName || "",
      email: x.email || authU?.email || "",
      language: x.language || "tr",
      currency: x.currency || "TL",
      theme: x.theme || "soft",
      banned: x.banned === true || authU?.disabled === true,
      disabled: !!authU?.disabled,
      createdAt: created,
      lastSeen,
      daysOnSystem: Math.max(0, Math.floor(ms / 86400000)),
      devices: tokens.size,
      online: lastSeen ? Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000 : false,
    });
  }
  rows.sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")));
  return rows;
});

exports.adminSendPush = onCall({ enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const title = String(request.data?.title || "Saklio").slice(0, 80);
  const body = String(request.data?.body || "").slice(0, 240);
  const targetUid = String(request.data?.uid || "").trim();
  if (!body) throw new HttpsError("invalid-argument", "Message required");
  const db = admin.firestore();
  const userIds = [];
  if (targetUid) userIds.push(targetUid);
  else {
    const users = await db.collection("users").get();
    users.docs.forEach((d) => userIds.push(d.id));
  }
  const messages = [];
  for (const id of userIds) {
    const tokens = await collectPushTokens(id);
    for (const t of tokens) messages.push(expoMessage(t.device_token, title, body, { action_url: "/notifications" }));
  }
  const result = await sendExpoMessages(messages);
  return { ...result, users: userIds.length, messages: messages.length };
});

exports.deleteMyAccount = onCall({ enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await wipeUser(uid);
  return { ok: true };
});

async function wipeUser(uid) {
  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);
  const cols = ["products", "documents", "messages", "pushTokens", "shoppingItems"];
  for (const col of cols) {
    const snap = await userRef.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await userRef.delete();
  await db.doc(`rateLimits/${uid}`).delete().catch(() => {});
  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    if (!String(e.code || e.message || "").includes("user-not-found")) throw e;
  }
}

async function authUserSafe(uid) {
  try {
    return await admin.auth().getUser(uid);
  } catch {
    return null;
  }
}

function publicAuth(u) {
  if (!u) return { exists: false };
  return {
    exists: true,
    disabled: !!u.disabled,
    emailVerified: !!u.emailVerified,
    createdAt: u.metadata?.creationTime || null,
    lastSignIn: u.metadata?.lastSignInTime || null,
    lastRefresh: u.metadata?.lastRefreshTime || null,
    providers: (u.providerData || []).map((p) => p.providerId),
    banned: u.customClaims?.banned === true,
    admin: u.customClaims?.admin === true,
  };
}

exports.pingSession = onCall({ enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  const authUser = await admin.auth().getUser(uid);
  if (authUser.disabled || authUser.customClaims?.banned) {
    throw new HttpsError("permission-denied", "Account suspended");
  }
  const permissions = request.data?.permissions && typeof request.data.permissions === "object"
    ? {
        notifications: String(request.data.permissions.notifications || "undetermined").slice(0, 24),
        camera: String(request.data.permissions.camera || "undetermined").slice(0, 24),
        photos: String(request.data.permissions.photos || "undetermined").slice(0, 24),
      }
    : null;
  const platform = String(request.data?.platform || "").slice(0, 24);
  const device = String(request.data?.device || "").slice(0, 80);
  const patch = {
    last_seen: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (platform) patch.last_platform = platform;
  if (permissions) patch.permissions = permissions;
  if (device) patch.last_device = device;
  await admin.firestore().doc(`users/${uid}`).set(patch, { merge: true });
  return { ok: true };
});

exports.sendMyEmail = onCall(
  { secrets: [smtpPass], enforceAppCheck: false, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireUser(request);
    await enforceRateLimit(uid, "mail");
    const authUser = await admin.auth().getUser(uid);
    const to = String(authUser.email || "").trim();
    if (!to) throw new HttpsError("failed-precondition", "No email on account");
    const lang = request.data?.lang === "en" ? "en" : "tr";
    const subject = String(request.data?.subject || "Saklio").slice(0, 140);
    const html = String(request.data?.html || "").slice(0, 400_000);
    const text = String(request.data?.text || "").slice(0, 50_000);
    if (html.length < 40 && text.length < 10) throw new HttpsError("invalid-argument", "Email body required");
    const htmlBody = html || `<pre>${text}</pre>`;
    const createPdf = request.data?.createPdf === true;
    const pdfFilename = String(request.data?.pdfFilename || "saklio-rapor.pdf").slice(0, 120);
    const attachments = [];
    const attach = request.data?.attachment;
    if (attach?.filename && attach?.content) {
      const name = String(attach.filename).replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const content = String(attach.content).slice(0, 800_000);
      attachments.push({ filename: name, content, contentType: attach.type || "text/html; charset=utf-8" });
    }
    if (createPdf) {
      try {
        const pdfBuffer = await makePdfAttachmentFromHtml(htmlBody, subject);
        attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" });
      } catch (e) {
        console.error("PDF creation failed:", e);
      }
    }
    await sendMail({
      pass: smtpPass.value(),
      to,
      subject,
      html: htmlBody,
      text,
      attachments,
    });
    return { sent: true, email: to, lang };
  }
);

exports.sendWelcomeEmail = onCall({ secrets: [smtpPass], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  const authUser = await admin.auth().getUser(uid);
  const to = String(authUser.email || "").trim();
  if (!to) return { sent: false };
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const name = String(request.data?.name || authUser.displayName || "").slice(0, 80);
  await sendMail({
    pass: smtpPass.value(),
    to,
    subject: lang === "en" ? "Welcome to Saklio" : "Saklio’ya hoş geldin",
    html: welcomeEmailHtml(lang, name),
  });
  return { sent: true, email: to };
});

exports.requestDeleteCode = onCall({ secrets: [smtpPass], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "mail");
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const authUser = await admin.auth().getUser(uid);
  const to = String(authUser.email || "").trim();
  if (!to) throw new HttpsError("failed-precondition", "No email on account");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await admin.firestore().doc(`users/${uid}`).set(
    {
      reset_code_hash: hashCode(code),
      reset_expires: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
    },
    { merge: true }
  );
  await sendMail({
    pass: smtpPass.value(),
    to,
    subject: lang === "en" ? "Confirm data deletion" : "Veri silme onayı",
    html: deleteCodeEmailHtml(lang, code),
    text: `${lang === "en" ? "Your code" : "Kodun"}: ${code}`,
  });
  return { sent: true, email: to };
});

exports.confirmDeleteData = onCall({ enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  const code = String(request.data?.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Invalid code");
  const ref = admin.firestore().doc(`users/${uid}`);
  const snap = await ref.get();
  const data = snap.data() || {};
  const expires = data.reset_expires?.toDate?.() || new Date(0);
  if (data.reset_code_hash !== hashCode(code) || expires < new Date()) {
    throw new HttpsError("failed-precondition", "Code is invalid or expired");
  }
  const cols = ["products", "documents", "messages"];
  for (const col of cols) {
    const docs = await ref.collection(col).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }
  await ref.set({ reset_code_hash: admin.firestore.FieldValue.delete(), reset_expires: admin.firestore.FieldValue.delete() }, { merge: true });
  return { ok: true };
});

exports.exportMyData = onCall({ secrets: [smtpPass], enforceAppCheck: false, timeoutSeconds: 120 }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "mail");
  const sendEmail = request.data?.sendEmail !== false;
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const authUser = await admin.auth().getUser(uid);
  const to = String(authUser.email || "").trim();
  if (!to) throw new HttpsError("failed-precondition", "No email on account");
  const userRef = admin.firestore().doc(`users/${uid}`);
  const [profile, products, documents, shopping] = await Promise.all([
    userRef.get(),
    userRef.collection("products").get(),
    userRef.collection("documents").get(),
    userRef.collection("shoppingItems").get(),
  ]);
  const payload = {
    user: profile.data() || {},
    products: products.docs.map((d) => ({ id: d.id, ...d.data() })),
    documents: documents.docs.map((d) => ({ id: d.id, ...d.data() })),
    shopping: shopping.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
  const counts = { products: products.size, documents: documents.size, shopping: shopping.size };
  if (sendEmail) {
    const htmlFromClient = String(request.data?.html || "");
    const htmlBody = htmlFromClient.length > 80 ? htmlFromClient.slice(0, 400_000) : exportReadyHtml(lang, counts);
    let pdfBuffer = null;
    try {
      pdfBuffer = await makePdfAttachmentFromHtml(htmlBody, "Saklio Export");
    } catch (e) {
      console.error("exportMyData PDF creation failed:", e);
    }
    await sendMail({
      pass: smtpPass.value(),
      to,
      subject: lang === "en" ? "Your Saklio data export" : "Saklio veri dışa aktarma",
      html: htmlBody,
      attachments: pdfBuffer ? [{ filename: "saklio-export.pdf", content: pdfBuffer, contentType: "application/pdf" }] : undefined,
    });
  }
  return { sent: sendEmail, email: to, counts, payload };
});

exports.adminGetUser = onCall({ enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const target = String(request.data?.uid || "").trim();
  if (!target) throw new HttpsError("invalid-argument", "uid required");
  const db = admin.firestore();
  const ref = db.doc(`users/${target}`);
  const [profile, products, tokens, shopping, authUser] = await Promise.all([
    ref.get(),
    ref.collection("products").get(),
    ref.collection("pushTokens").get(),
    ref.collection("shoppingItems").get(),
    authUserSafe(target),
  ]);
  const x = profile.data() || {};
  const created = tsIso(x.created_at) || publicAuth(authUser).createdAt;
  const lastSeen = tsIso(x.last_seen) || publicAuth(authUser).lastSignIn;
  const ms = created ? Date.now() - new Date(created).getTime() : 0;
  return {
    id: target,
    name: x.name || authUser?.displayName || "",
    email: x.email || authUser?.email || "",
    language: x.language || "tr",
    currency: x.currency || "TL",
    theme: x.theme || "soft",
    createdAt: created,
    lastSeen,
    lastPlatform: x.last_platform || "",
    lastDevice: x.last_device || "",
    daysOnSystem: Math.max(0, Math.floor(ms / 86400000)),
    online: lastSeen ? Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000 : false,
    permissions: x.permissions || {},
    products: products.size,
    shopping: shopping.size,
    devices: tokens.docs.map((d) => {
      const t = d.data() || {};
      return {
        id: d.id,
        platform: t.platform || "",
        device: t.device_name || t.device || "",
        createdAt: tsIso(t.created_at),
        lastSeen: tsIso(t.last_seen),
        tokenTail: String(t.device_token || "").slice(-12),
      };
    }),
    auth: publicAuth(authUser),
  };
});

exports.adminBanUser = onCall({ secrets: [smtpPass], enforceAppCheck: false }, async (request) => {
  const adminUser = await requireAdmin(request);
  const target = String(request.data?.uid || "").trim();
  const banned = request.data?.banned !== false;
  const reason = String(request.data?.reason || "").slice(0, 200);
  if (!target) throw new HttpsError("invalid-argument", "uid required");
  if (target === adminUser.uid) throw new HttpsError("failed-precondition", "Cannot ban yourself");
  const user = await admin.auth().getUser(target);
  if (String(user.email || "").toLowerCase() === ADMIN_EMAIL) {
    throw new HttpsError("failed-precondition", "Cannot ban the primary admin");
  }
  const claims = { ...(user.customClaims || {}), banned };
  if (!banned) delete claims.banned;
  await admin.auth().setCustomUserClaims(target, claims);
  await admin.auth().updateUser(target, { disabled: banned });
  await admin.auth().revokeRefreshTokens(target);
  await admin.firestore().doc(`users/${target}`).set(
    { banned, ban_reason: banned ? reason : admin.firestore.FieldValue.delete() },
    { merge: true }
  );
  const to = String(user.email || "").trim();
  if (banned && to) {
    try {
      const lang = "tr";
      await sendMail({
        pass: smtpPass.value(),
        to,
        subject: "Saklio hesabın askıya alındı",
        html: bannedHtml(lang),
      });
    } catch (e) {
      console.error("ban email failed", e);
    }
  }
  return { ok: true, banned };
});

exports.adminDeleteUser = onCall({ enforceAppCheck: false }, async (request) => {
  const adminUser = await requireAdmin(request);
  const target = String(request.data?.uid || "").trim();
  if (!target) throw new HttpsError("invalid-argument", "uid required");
  if (target === adminUser.uid) throw new HttpsError("failed-precondition", "Cannot delete yourself");
  const user = await authUserSafe(target);
  if (user && String(user.email || "").toLowerCase() === ADMIN_EMAIL) {
    throw new HttpsError("failed-precondition", "Cannot delete the primary admin");
  }
  await wipeUser(target);
  return { ok: true };
});

exports.sendPasswordResetCode = onCall({ secrets: [smtpPass], enforceAppCheck: false }, async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Valid email required");
  }
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    // Güvenlik: e-posta kayıtlı olsun olmasın aynı yanıtı ver
    return { sent: true };
  }
  if (userRecord.disabled) throw new HttpsError("permission-denied", "Account suspended");
  const uid = userRecord.uid;
  await enforceRateLimit(uid, "mail");
  const lang = request.data?.lang === "en" ? "en" : "tr";
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await admin.firestore().doc(`users/${uid}`).set(
    {
      pw_reset_code_hash: hashCode(code),
      pw_reset_expires: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
    },
    { merge: true }
  );
  await sendMail({
    pass: smtpPass.value(),
    to: email,
    subject: lang === "en" ? "Saklio password reset" : "Saklio şifre sıfırlama",
    html: passwordResetEmailHtml(lang, code),
    text: `${lang === "en" ? "Your code" : "Kodun"}: ${code}`,
  });
  return { sent: true };
});

exports.confirmPasswordResetCode = onCall({ enforceAppCheck: false }, async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  const code = String(request.data?.code || "").trim();
  const newPassword = String(request.data?.password || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Valid email required");
  }
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Invalid code");
  if (newPassword.length < 6) throw new HttpsError("invalid-argument", "Password too short");
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "User not found");
  }
  const uid = userRecord.uid;
  const ref = admin.firestore().doc(`users/${uid}`);
  const snap = await ref.get();
  const data = snap.data() || {};
  const expires = data.pw_reset_expires?.toDate?.() || new Date(0);
  if (data.pw_reset_code_hash !== hashCode(code) || expires < new Date()) {
    throw new HttpsError("failed-precondition", "Code is invalid or expired");
  }
  await admin.auth().updateUser(uid, { password: newPassword });
  await ref.set(
    {
      pw_reset_code_hash: admin.firestore.FieldValue.delete(),
      pw_reset_expires: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );
  return { ok: true };
});

exports.notifyReminders = onSchedule(
  { schedule: "every day 08:00", timeZone: "Europe/Istanbul", secrets: [smtpPass] },
  async () => {
    const db = admin.firestore();
    const users = await db.collection("users").get();
    const messages = [];
    const today = new Date();
    let mailed = 0;
    for (const u of users.docs) {
      const profile = u.data() || {};
      if (profile.banned) continue;
      const products = await u.ref.collection("products").get();
      const lang = profile.language === "en" ? "en" : "tr";
      const tokens = await collectPushTokens(u.id);
      const authU = await authUserSafe(u.id);
      const to = String(profile.email || authU?.email || "").trim();
      for (const p of products.docs) {
        const data = p.data() || {};
        const pd = data.purchase_date ? new Date(String(data.purchase_date)) : null;
        if (!pd || Number.isNaN(pd.getTime())) continue;
        const returnEnd = new Date(pd);
        returnEnd.setDate(returnEnd.getDate() + (data.return_days ?? 14));
        const warrantyEnd = new Date(pd);
        warrantyEnd.setDate(warrantyEnd.getDate() + (data.warranty_months ?? 24) * 30);
        const rdl = Math.ceil((returnEnd.getTime() - today.getTime()) / 86400000);
        const wdl = Math.ceil((warrantyEnd.getTime() - today.getTime()) / 86400000);
        const sendBoth = async (kind, title, body, days) => {
          tokens.forEach((t) => messages.push(expoMessage(t.device_token, title, body, { action_url: `/product/${p.id}` })));
          if (to) {
            try {
              await sendMail({
                pass: smtpPass.value(),
                to,
                subject: title,
                html: reminderEmailHtml(lang, kind, data.name || "Saklio", days),
                text: body,
              });
              mailed += 1;
            } catch (e) {
              console.error("reminder email failed", u.id, e);
            }
          }
        };
        if (data.notify_return !== false && rdl >= 0 && rdl <= 3) {
          const title = lang === "en" ? "Return window ending" : "İade süresi yaklaşıyor";
          const body = lang === "en" ? `${rdl} days left for ${data.name}` : `${data.name} için ${rdl} gün kaldı`;
          await sendBoth("return", title, body, rdl);
        }
        if (data.notify_warranty !== false && wdl >= 0 && wdl <= 14) {
          const title = lang === "en" ? "Warranty ending" : "Garanti bitiyor";
          const body = lang === "en" ? `${wdl} days left on ${data.name} warranty` : `${data.name} garantisine ${wdl} gün kaldı`;
          await sendBoth("warranty", title, body, wdl);
        }
      }
    }
    await sendExpoMessages(messages);
    return { sent: messages.length, mailed };
  }
);

const SITE_PUBLIC_REF = () => admin.firestore().doc("site/public");

function normalizeUrl(value, maxLen = 500) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) throw new HttpsError("invalid-argument", "URL must start with http:// or https://");
  return url.slice(0, maxLen);
}

function publicSitePayload(data) {
  const d = data || {};
  return {
    androidPlayUrl: String(d.androidPlayUrl || ""),
    iosAppStoreUrl: String(d.iosAppStoreUrl || ""),
    androidApkUrl: String(d.androidApkUrl || ""),
    webAppUrl: String(d.webAppUrl || "https://saklio.app/login"),
    taglineTr: String(d.taglineTr || "Fişi çek, gerisini Saklio halletsin."),
    taglineEn: String(d.taglineEn || "Snap the receipt, Saklio does the rest."),
    updatedAt: tsIso(d.updatedAt),
  };
}

exports.adminGetSiteConfig = onCall({ enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const snap = await SITE_PUBLIC_REF().get();
  return publicSitePayload(snap.data());
});

exports.adminUpdateSiteConfig = onCall({ enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const payload = {
    androidPlayUrl: normalizeUrl(request.data?.androidPlayUrl),
    iosAppStoreUrl: normalizeUrl(request.data?.iosAppStoreUrl),
    androidApkUrl: normalizeUrl(request.data?.androidApkUrl),
    webAppUrl: normalizeUrl(request.data?.webAppUrl) || "https://saklio.app/login",
    taglineTr: String(request.data?.taglineTr || "Fişi çek, gerisini Saklio halletsin.").slice(0, 160),
    taglineEn: String(request.data?.taglineEn || "Snap the receipt, Saklio does the rest.").slice(0, 160),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await SITE_PUBLIC_REF().set(payload, { merge: true });
  const snap = await SITE_PUBLIC_REF().get();
  return publicSitePayload(snap.data());
});

