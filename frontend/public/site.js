export const FIREBASE = {
  apiKey: "AIzaSyCyXtSVXG6Fvw3h8ZignB4WI7qjATkMRW8",
  authDomain: "sakliov2.firebaseapp.com",
  projectId: "sakliov2",
  storageBucket: "sakliov2.firebasestorage.app",
  messagingSenderId: "532195717768",
  appId: "1:532195717768:web:c7df88492929febb91653d",
};

export function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export async function getSiteConfig() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js");
  const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js");
  const app = initializeApp(FIREBASE);
  const db = getFirestore(app);
  const snap = await getDoc(doc(db, "site", "public"));
  const d = snap.exists() ? snap.data() : {};
  return {
    androidPlayUrl: String(d.androidPlayUrl || "").trim(),
    iosAppStoreUrl: String(d.iosAppStoreUrl || "").trim(),
    androidApkUrl: String(d.androidApkUrl || "").trim(),
    webAppUrl: String(d.webAppUrl || "https://saklio.app/login").trim(),
    taglineTr: String(d.taglineTr || "Fişi çek, gerisini Saklio halletsin.").trim(),
    taglineEn: String(d.taglineEn || "Snap the receipt, Saklio does the rest.").trim(),
  };
}

export function storeUrlForPlatform(cfg, platform) {
  if (platform === "ios" && cfg.iosAppStoreUrl) return cfg.iosAppStoreUrl;
  if (platform === "android") {
    if (cfg.androidPlayUrl) return cfg.androidPlayUrl;
    if (cfg.androidApkUrl) return cfg.androidApkUrl;
  }
  return "";
}
