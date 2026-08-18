const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ region: "europe-west1", maxInstances: 20, timeoutSeconds: 60, memory: "512MiB" });
admin.initializeApp();

const openaiKey = defineSecret("OPENAI_API_KEY");

const LIMITS = {
  scan: { perMin: 4, perDay: 25 },
  assistant: { perMin: 8, perDay: 80 },
  claim: { perMin: 3, perDay: 15 },
};

const SCAN_SYSTEM = `Sen bir Türkçe fiş/fatura okuma asistanısın. Sana bir fiş veya fatura görseli verilecek.
Görselden bilgileri çıkar ve SADECE geçerli JSON döndür.
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
- return_days Türkiye'de genelde 14.
- product_name en pahalı/ana ürünün kısa adı olsun.
- confidence 0-1 arası okuma güvenin.`;

const ASSISTANT_SYSTEM = `Sen 'Saklio Asistan'sın. Kullanıcının satın aldığı ürünler, fişler, iade süreleri ve garantiler hakkında Türkçe, kısa, sıcak ve net yanıtlar verirsin.
İade süresi (return_days_left) ve garanti (warranty_days_left) gün cinsindendir; negatifse süre dolmuştur.
Cevaplarını kısa tut (2-4 cümle).`;

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
      throw new HttpsError("resource-exhausted", "Çok hızlı istek. Bir dakika sonra tekrar dene.");
    }
    if (dayCount >= limits.perDay) {
      throw new HttpsError("resource-exhausted", "Günlük AI limiti doldu. Yarın tekrar dene.");
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
    throw new HttpsError(code, "AI servisi şu an yanıt veremiyor");
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
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Giriş gerekli");
  return request.auth.uid;
}

exports.scanReceipt = onCall({ secrets: [openaiKey], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "scan");
  let b64 = String(request.data?.image_base64 || "");
  if (!b64) throw new HttpsError("invalid-argument", "Görsel gerekli");
  if (b64.includes(",") && b64.trim().startsWith("data:")) b64 = b64.split(",", 1)[1];
  if (b64.length > 8_000_000) throw new HttpsError("invalid-argument", "Görsel çok büyük");

  const text = await chatCompletions({
    model: "gpt-4o",
    json: true,
    maxTokens: 700,
    messages: [
      { role: "system", content: SCAN_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Bu fişi oku ve JSON döndür." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
        ],
      },
    ],
  });
  const data = extractJson(text);
  if (!data) throw new HttpsError("failed-precondition", "Fiş anlaşılamadı");
  data.currency = data.currency || "TL";
  data.return_days = Number(data.return_days) || 14;
  data.warranty_months = Number(data.warranty_months) || 24;
  data.category = ["elektronik", "moda", "ev", "otomotiv", "diger"].includes(data.category)
    ? data.category
    : "diger";
  data.items = Array.isArray(data.items) ? data.items.slice(0, 40) : [];
  data.confidence = Number(data.confidence) || 0.7;
  if (!data.purchase_date) data.purchase_date = new Date().toISOString().slice(0, 10);
  if (!data.product_name) data.product_name = data.merchant || "Ürün";
  return data;
});

exports.assistantChat = onCall({ secrets: [openaiKey], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "assistant");
  const message = String(request.data?.message || "").trim();
  if (!message || message.length > 2000) throw new HttpsError("invalid-argument", "Mesaj geçersiz");
  const products = request.data?.products;
  const context = Array.isArray(products) ? products.slice(0, 80) : [];
  const sessionId = String(request.data?.session_id || `assist-${uid}`);
  const reply = await chatCompletions({
    model: "gpt-4o-mini",
    json: false,
    maxTokens: 400,
    messages: [
      { role: "system", content: `${ASSISTANT_SYSTEM}\n\nKullanıcının ürünleri: ${JSON.stringify(context)}` },
      { role: "user", content: message },
    ],
  });
  return { reply: String(reply).slice(0, 4000), session_id: sessionId };
});

exports.warrantyClaim = onCall({ secrets: [openaiKey], enforceAppCheck: false }, async (request) => {
  const uid = requireUser(request);
  await enforceRateLimit(uid, "claim");
  const problem = String(request.data?.problem || "").trim();
  const product = request.data?.product || {};
  if (!problem || problem.length > 1000) throw new HttpsError("invalid-argument", "Sorun açıklaması gerekli");
  const text = await chatCompletions({
    model: "gpt-4o-mini",
    json: false,
    maxTokens: 350,
    messages: [
      {
        role: "system",
        content: "Sen bir garanti başvuru asistanısın. Verilen ürün ve sorun bilgisine göre kısa, resmi bir Türkçe garanti başvuru metni oluştur (3-5 cümle).",
      },
      {
        role: "user",
        content: `Ürün: ${product.name || "-"}\nMağaza: ${product.merchant || "-"}\nSatın alma: ${product.purchase_date || "-"}\nSorun: ${problem}`,
      },
    ],
  });
  return { claim_text: String(text).slice(0, 4000), problem };
});
