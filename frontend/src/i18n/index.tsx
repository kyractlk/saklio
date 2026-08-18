import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { setLangConfig } from "@/src/lib/format";

export type Lang = "tr" | "en";

type Dict = Record<string, { tr: string; en: string }>;

const D: Dict = {
  // common
  tagline: { tr: "Satın aldığın her şey, güvende.", en: "Everything you own, protected." },
  slogan: { tr: "Fişi çek, gerisini Saklio halletsin.", en: "Snap the receipt, Saklio does the rest." },
  skip: { tr: "Atla", en: "Skip" },
  continue: { tr: "Devam", en: "Continue" },
  getStarted: { tr: "Saklio’ya Başla", en: "Get Started" },
  done: { tr: "Bitti", en: "Done" },
  save: { tr: "Kaydet", en: "Save" },
  cancel: { tr: "Vazgeç", en: "Cancel" },
  soon: { tr: "Yakında", en: "Soon" },
  all: { tr: "Tümü", en: "All" },
  loading: { tr: "Yükleniyor…", en: "Loading…" },
  // categories
  cat_elektronik: { tr: "Elektronik", en: "Electronics" },
  cat_moda: { tr: "Moda", en: "Fashion" },
  cat_ev: { tr: "Ev", en: "Home" },
  cat_otomotiv: { tr: "Otomotiv", en: "Automotive" },
  cat_diger: { tr: "Diğer", en: "Other" },
  // tabs
  tab_home: { tr: "Ana Sayfa", en: "Home" },
  tab_stuff: { tr: "Eşyalarım", en: "My Stuff" },
  tab_activity: { tr: "Aktiviteler", en: "Activity" },
  tab_profile: { tr: "Profil", en: "Profile" },
  scan: { tr: "Fiş Tara", en: "Scan" },
  // onboarding
  ob1_t: { tr: "Fişi çek. Saklio hatırlasın.", en: "Snap it. Saklio remembers." },
  ob1_b: { tr: "Fişlerini, faturalarını ve satın aldığın ürünleri saniyeler içinde kaydet.", en: "Save your receipts, invoices and purchases in seconds." },
  ob2_t: { tr: "İade süresini kaçırma.", en: "Never miss a return." },
  ob2_b: { tr: "Saklio iade tarihlerini takip eder ve süresi dolmadan sana haber verir.", en: "Saklio tracks return dates and reminds you before they expire." },
  ob3_t: { tr: "Garantin hep yanında.", en: "Your warranty, always with you." },
  ob3_b: { tr: "Fiş, garanti, kullanım kılavuzu ve ürün bilgileri tek yerde.", en: "Receipts, warranties, manuals and product info in one place." },
  ob4_t: { tr: "Sahip olduğun her şey. Tek yerde.", en: "Everything you own. In one place." },
  ob4_b: { tr: "Fişten garantiye, her şey Saklio’da.", en: "From receipt to warranty, it's all in Saklio." },
  // auth
  welcomeBack: { tr: "Tekrar hoş geldin", en: "Welcome back" },
  email: { tr: "E-posta", en: "Email" },
  password: { tr: "Şifre", en: "Password" },
  continueEmail: { tr: "E-posta ile devam et", en: "Continue with email" },
  noAccount: { tr: "Hesabın yok mu? ", en: "Don't have an account? " },
  register: { tr: "Kayıt ol", en: "Sign up" },
  privacy: { tr: "Kişisel verilerin yalnızca senin ürünlerini yönetmek için kullanılır.", en: "Your personal data is used only to manage your products." },
  createAccount: { tr: "Hesap oluştur", en: "Create account" },
  firstStep: { tr: "Saklio’ya ilk adımını at", en: "Take your first step into Saklio" },
  yourName: { tr: "Adın", en: "Your name" },
  fillAll: { tr: "Lütfen tüm alanları doldur", en: "Please fill in all fields" },
  pwShort: { tr: "Şifre en az 6 karakter olmalı", en: "Password must be at least 6 characters" },
  loginFail: { tr: "Giriş başarısız", en: "Login failed" },
  registerFail: { tr: "Kayıt başarısız", en: "Sign up failed" },
  // home
  hello: { tr: "Merhaba", en: "Hi" },
  todoSome: { tr: "Bugün ilgilenmen gereken {n} şey var.", en: "You have {n} things to handle today." },
  allGood: { tr: "Her şey yolunda görünüyor.", en: "Everything looks good." },
  searchPlaceholder: { tr: "Ürün, mağaza veya fiş ara", en: "Search products, stores or receipts" },
  emptyHomeT: { tr: "Henüz bir şey saklamadın.", en: "You haven't saved anything yet." },
  emptyHomeB: { tr: "İlk fişini tara, Saklio gerisini halletsin.", en: "Scan your first receipt, Saklio does the rest." },
  scanFirst: { tr: "İlk fişini tara", en: "Scan your first receipt" },
  exploreDemo: { tr: "Örnek verilerle keşfet", en: "Explore with sample data" },
  actNow: { tr: "Şimdi ilgilen", en: "Act now" },
  returnEnding: { tr: "İade süresi bitiyor", en: "Return window ending" },
  warrantyEnding: { tr: "Garanti bitiyor", en: "Warranty ending" },
  days: { tr: "gün", en: "days" },
  returnCenter: { tr: "İade Merkezi", en: "Return Center" },
  worthValue: { tr: "{v} değerinde", en: "worth {v}" },
  returnableCount: { tr: "{n} ürün hâlâ iade edilebilir", en: "{n} products still returnable" },
  assistant: { tr: "Saklio Asistan", en: "Saklio Assistant" },
  recent: { tr: "Son eklenenler", en: "Recently added" },
  // stuff
  myStuff: { tr: "Eşyalarım", en: "My Stuff" },
  emptyCatT: { tr: "Bu kategoride ürün yok", en: "No products in this category" },
  emptyCatB: { tr: "Yeni bir fiş tarayarak eşyalarını eklemeye başla.", en: "Scan a new receipt to start adding your stuff." },
  // activity
  activity: { tr: "Aktiviteler", en: "Activity" },
  warranties: { tr: "Garantilerim", en: "My Warranties" },
  active: { tr: "Aktif", en: "Active" },
  endingSoon: { tr: "Yakında bitecek", en: "Ending soon" },
  expired: { tr: "Süresi dolmuş", en: "Expired" },
  totalReturnable: { tr: "Toplam {v} değerinde ürün hâlâ iade edilebilir.", en: "Products worth {v} in total are still returnable." },
  noneHereT_r: { tr: "Bu durumda ürün yok", en: "No products in this state" },
  noneHereT_w: { tr: "Bu durumda garanti yok", en: "No warranties in this state" },
  returnLabel: { tr: "İade: ", en: "Return: " },
  warrantyLabel: { tr: "Garanti: ", en: "Warranty: " },
  // profile
  profile: { tr: "Profil", en: "Profile" },
  saklioUser: { tr: "Saklio Kullanıcısı", en: "Saklio User" },
  account: { tr: "Hesabım", en: "My account" },
  currency: { tr: "Para birimim", en: "Currency" },
  language: { tr: "Dil", en: "Language" },
  notifications: { tr: "Bildirimler", en: "Notifications" },
  theme: { tr: "Tema", en: "Theme" },
  connectedAccounts: { tr: "BAĞLI HESAPLAR", en: "CONNECTED ACCOUNTS" },
  connectGmail: { tr: "Gmail’i bağla", en: "Connect Gmail" },
  connectOutlook: { tr: "Outlook’u bağla", en: "Connect Outlook" },
  myData: { tr: "VERİLERİM", en: "MY DATA" },
  exportData: { tr: "Verilerimi indir", en: "Export my data" },
  deleteData: { tr: "Verilerimi sil", en: "Delete my data" },
  signOut: { tr: "Çıkış yap", en: "Sign out" },
  currencyTitle: { tr: "Para birimi", en: "Currency" },
  languageTitle: { tr: "Dil", en: "Language" },
  cur_TL: { tr: "Türk Lirası", en: "Turkish Lira" },
  cur_USD: { tr: "Dolar", en: "US Dollar" },
  cur_EUR: { tr: "Euro", en: "Euro" },
  cur_SEK: { tr: "İsveç Kronu", en: "Swedish Krona" },
  cur_DKK: { tr: "Danimarka Kronu", en: "Danish Krone" },
  // product detail
  status: { tr: "Durum", en: "Status" },
  returnPeriod: { tr: "İade süresi", en: "Return period" },
  warranty: { tr: "Garanti", en: "Warranty" },
  receipt: { tr: "Fiş", en: "Receipt" },
  saved: { tr: "Kayıtlı", en: "Saved" },
  missing: { tr: "Eksik", en: "Missing" },
  lifecycle: { tr: "Yaşam döngüsü", en: "Lifecycle" },
  tlBought: { tr: "Satın alındı", en: "Purchased" },
  tlReceipt: { tr: "Fiş kaydedildi", en: "Receipt saved" },
  tlReturnEnd: { tr: "İade süresi bitiyor", en: "Return window ends" },
  tlWarrantyEnd: { tr: "Garanti bitiyor", en: "Warranty ends" },
  notifyPrefs: { tr: "Bildirim tercihleri", en: "Notification preferences" },
  notifyReturn: { tr: "İade hatırlatması", en: "Return reminder" },
  notifyReturnB: { tr: "Süre bitmeden haber ver", en: "Notify before it expires" },
  notifyWarranty: { tr: "Garanti hatırlatması", en: "Warranty reminder" },
  notifyWarrantyB: { tr: "Garanti bitmeden haber ver", en: "Notify before warranty ends" },
  canReturn: { tr: "İade edebilir miyim?", en: "Can I return this?" },
  createWarranty: { tr: "Garanti talebi oluştur", en: "Create warranty claim" },
  documents: { tr: "Belgeler", en: "Documents" },
  shareMsg: { tr: "Saklio’da bir ürün paylaştım", en: "I shared a product on Saklio" },
  // scan
  camPermT: { tr: "Fişini taramak için kamera izni", en: "Camera access to scan receipts" },
  camPermB: { tr: "Saklio yalnızca fiş tararken kameranı kullanır.", en: "Saklio uses your camera only while scanning receipts." },
  grantCam: { tr: "Kamera iznini ver", en: "Grant camera access" },
  openSettings: { tr: "Ayarları aç", en: "Open Settings" },
  pickGallery: { tr: "Galeriden seç", en: "Pick from gallery" },
  frameHint: { tr: "Fişi çerçevenin içine getir", en: "Align the receipt within the frame" },
  // processing
  working: { tr: "Saklio çalışıyor", en: "Saklio is working" },
  processingReceipt: { tr: "Fişin yapay zekâ ile işleniyor…", en: "Processing your receipt with AI…" },
  step1: { tr: "Fiş okunuyor", en: "Reading receipt" },
  step2: { tr: "Mağaza bulundu", en: "Store found" },
  step3: { tr: "Ürünler tanınıyor", en: "Recognizing items" },
  step4: { tr: "İade koşulları kontrol ediliyor", en: "Checking return terms" },
  step5: { tr: "Garanti bilgileri hazırlanıyor", en: "Preparing warranty info" },
  scanErrT: { tr: "Bu fişi okumakta biraz zorlandık.", en: "We had trouble reading this receipt." },
  scanErrB: { tr: "Daha net bir fotoğraf çekebilir veya bilgileri elle girebilirsin.", en: "Take a clearer photo or enter details manually." },
  retryScan: { tr: "Tekrar çek", en: "Retake" },
  manualEntry: { tr: "Bilgileri elle gir", en: "Enter manually" },
  // confirm
  confirmT: { tr: "Bunu doğru mu anladım?", en: "Did I get this right?" },
  confirmB: { tr: "Bilgileri kontrol et ve onayla", en: "Check the details and confirm" },
  lowConf: { tr: "Bazı bilgilerden tam emin olamadım. Lütfen kontrol et.", en: "I'm not fully sure of some details. Please review." },
  product: { tr: "Ürün", en: "Product" },
  store: { tr: "Mağaza", en: "Store" },
  price: { tr: "Fiyat", en: "Price" },
  date: { tr: "Tarih", en: "Date" },
  returnDays: { tr: "İade süresi", en: "Return window" },
  yesCorrect: { tr: "Evet, doğru", en: "Yes, correct" },
  edit: { tr: "Düzelt", en: "Edit" },
  months: { tr: "ay", en: "months" },
  // success
  added: { tr: "Ürünün Saklio’ya eklendi.", en: "Your product was added to Saklio." },
  returnShort: { tr: "İade", en: "Return" },
  viewProduct: { tr: "Ürünü Gör", en: "View product" },
  backHome: { tr: "Ana sayfaya dön", en: "Back to home" },
  // add manually
  addManualT: { tr: "Ürünü elle ekle", en: "Add product manually" },
  addManualB: { tr: "Bilgileri kendin doldur", en: "Fill in the details yourself" },
  productName: { tr: "Ürün adı", en: "Product name" },
  category: { tr: "Kategori", en: "Category" },
  priceTl: { tr: "Fiyat", en: "Price" },
  purchaseDate: { tr: "Satın alma tarihi (YYYY-AA-GG)", en: "Purchase date (YYYY-MM-DD)" },
  returnDaysField: { tr: "İade (gün)", en: "Return (days)" },
  warrantyField: { tr: "Garanti (ay)", en: "Warranty (months)" },
  nameRequired: { tr: "Ürün adı gerekli", en: "Product name required" },
  // return detail
  canReturnT: { tr: "Bu ürünü iade edebilir miyim?", en: "Can I return this product?" },
  forReturn: { tr: "İade için", en: "For a return" },
  chkReceipt: { tr: "Fiş mevcut", en: "Receipt available" },
  chkTime: { tr: "Süre içinde", en: "Within the window" },
  chkType: { tr: "Ürün tipi uygun", en: "Product type eligible" },
  startReturn: { tr: "İade işlemini başlat", en: "Start return process" },
  returnStarted: { tr: "İade işlemi başlatıldı ✓", en: "Return process started ✓" },
  // warranty claim
  warrantyClaim: { tr: "Garanti talebi", en: "Warranty claim" },
  whatProblem: { tr: "Üründe ne sorun var?", en: "What's the problem?" },
  describeProblem: { tr: "Sorunu anlat", en: "Describe the problem" },
  problemPlaceholder: { tr: "Örn. Sol kulaklık ses vermiyor.", en: "e.g. Left earbud has no sound." },
  prepareClaim: { tr: "Başvuruyu hazırla", en: "Prepare claim" },
  claimReady: { tr: "Garanti başvurun hazır.", en: "Your warranty claim is ready." },
  claimText: { tr: "Başvuru metni", en: "Claim text" },
  // assistant
  assistantSub: { tr: "Eşyaların hakkında her şeyi sor", en: "Ask anything about your stuff" },
  assistantHi: { tr: "Merhaba, ben Saklio Asistan", en: "Hi, I'm Saklio Assistant" },
  assistantHiB: { tr: "İade, garanti ve eşyaların hakkında soru sor.", en: "Ask about returns, warranties and your items." },
  q1: { tr: "Neyi iade edebilirim?", en: "What can I return?" },
  q2: { tr: "Garantisi biten ürünlerim?", en: "Which warranties are ending?" },
  q3: { tr: "En pahalı eşyam ne?", en: "What's my most expensive item?" },
  askSomething: { tr: "Bir şey sor…", en: "Ask something…" },
  assistantErr: { tr: "Şu an yanıt veremiyorum, birazdan tekrar dene.", en: "I can't respond right now, try again shortly." },
  // search
  search: { tr: "Ara", en: "Search" },
  noResultsT: { tr: "Sonuç bulunamadı", en: "No results found" },
  noResultsB: { tr: "Farklı bir kelime deneyebilirsin.", en: "Try a different keyword." },
  // notifications
  notifCenter: { tr: "Bildirimler", en: "Notifications" },
  allCurrentT: { tr: "Her şey güncel", en: "You're all caught up" },
  allCurrentB: { tr: "Yaklaşan iade ve garanti tarihleri burada görünecek.", en: "Upcoming return and warranty dates appear here." },
  // theme
  themeSub: { tr: "Saklio’yu kendine göre ayarla", en: "Make Saklio your own" },
  // documents
  docsSub: { tr: "Fiş, fatura, garanti ve kılavuzlar", en: "Receipts, invoices, warranties and manuals" },
  noDocsT: { tr: "Henüz belge yok", en: "No documents yet" },
  noDocsB: { tr: "Bu ürüne fiş, garanti veya kullanım kılavuzu ekleyerek her şeyi tek yerde tut.", en: "Add receipts, warranties or manuals to keep everything in one place." },
  addDoc: { tr: "Belge ekle", en: "Add document" },
  pickDocType: { tr: "Belge türü seç", en: "Choose document type" },
  camera: { tr: "Kamera", en: "Camera" },
  gallery: { tr: "Galeri", en: "Gallery" },
  fromFiles: { tr: "Dosyalardan seç", en: "Pick from files" },
  doc_fis: { tr: "Fiş", en: "Receipt" },
  doc_fatura: { tr: "Fatura", en: "Invoice" },
  doc_garanti: { tr: "Garanti", en: "Warranty" },
  doc_kilavuz: { tr: "Kullanım Kılavuzu", en: "Manual" },
  doc_servis: { tr: "Servis Belgesi", en: "Service Document" },
  // data screen
  exportTitle: { tr: "Verilerimi indir", en: "Export my data" },
  deleteTitle: { tr: "Verilerimi sil", en: "Delete my data" },
  exportInfo: { tr: "Ürünlerin, belgelerin ve asistan geçmişin dahil tüm verilerin JSON dosyası olarak e-postana gönderilir.", en: "All your data, including products, documents and assistant history, is emailed to you as a JSON file." },
  deleteInfo: { tr: "Tüm ürünlerin, belgelerin ve asistan geçmişin silinir. Hesabın açık kalır. Onay için e-postana bir kod göndeririz.", en: "All your products, documents and assistant history are deleted. Your account stays active. We email you a code to confirm." },
  emailLabel: { tr: "E-posta", en: "Email" },
  sendCode: { tr: "Onay kodu gönder", en: "Send confirmation code" },
  confirmCode: { tr: "Onay kodu", en: "Confirmation code" },
  codePlaceholder: { tr: "6 haneli kod", en: "6-digit code" },
  sendMyData: { tr: "Verilerimi e-posta ile gönder", en: "Email me my data" },
  deletePermanently: { tr: "Verilerimi kalıcı olarak sil", en: "Delete my data permanently" },
  opDone: { tr: "İşlem tamam", en: "Done" },
  // share
  shareTitle: { tr: "Ürün paylaşımı", en: "Shared product" },
  sharedWithYou: { tr: "{name} seninle bir ürün paylaştı", en: "{name} shared a product with you" },
  someone: { tr: "Bir kullanıcı", en: "A user" },
  addProduct: { tr: "Ürünü ekle", en: "Add product" },
  shareNotFoundT: { tr: "Paylaşım bulunamadı", en: "Share not found" },
  shareNotFoundB: { tr: "Bu bağlantının süresi dolmuş olabilir.", en: "This link may have expired." },
};

const CATEGORY_KEY: Record<string, string> = {
  tumu: "all", elektronik: "cat_elektronik", moda: "cat_moda", ev: "cat_ev", otomotiv: "cat_otomotiv", diger: "cat_diger",
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tc: (category: string) => string;
}

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    storage.getItem<Lang>("saklio_lang", "tr").then((l) => {
      if (l) {
        setLangState(l);
        setLangConfig(l);
      }
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setLangConfig(l);
    storage.setItem("saklio_lang", l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let s = D[key]?.[lang] ?? key;
      if (params) for (const k in params) s = s.replace(`{${k}}`, String(params[k]));
      return s;
    },
    [lang]
  );

  const tc = useCallback((category: string) => (D[CATEGORY_KEY[category] || "cat_diger"]?.[lang] ?? category), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t, tc }}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used within LanguageProvider");
  return ctx;
}
