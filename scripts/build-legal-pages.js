function page(title, inner) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} · Saklio</title>
  <link rel="stylesheet" href="/legal.css"/>
  <link rel="icon" href="/brand/aystech.png"/>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <b>saklio</b>
      <div style="opacity:.8;margin-top:4px;">Fişi çek, gerisini Saklio halletsin.</div>
      <nav>
        <a href="/">Ana sayfa</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/child-safety">Child safety</a>
        <a href="/delete-account">Delete account</a>
        <a href="/support">Support</a>
      </nav>
    </div>
    <div class="card">${inner}</div>
    <div class="footer">
      <img src="/brand/aystech.png" alt="aystech"/>
      <p class="muted">Produced by aystech · Kayra Çatalkaya · contact: alikayracatalkaya@gmail.com</p>
    </div>
  </div>
</body>
</html>`;
}

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "../frontend/public");

const privacy = page(
  "Privacy Policy",
  `<h1>Privacy Policy / Gizlilik Politikası</h1>
<p class="muted">Last updated: 18 August 2026 · Effective for Saklio (app.saklio) operated by aystech / Kayra Çatalkaya.</p>
<h2>English</h2>
<p>Saklio stores your account, product, receipt, shopping-list and notification data so we can track returns and warranties for you. We use Firebase Authentication, Cloud Firestore and Cloud Storage in the European Union (eur3 / europe-west1). Receipt scans may be sent to OpenAI solely to extract purchase details. We do not sell personal data. You can export or delete your data in the app, or via <a href="/delete-account">saklio.app/delete-account</a>.</p>
<p>Data we process: name, email, hashed password (Firebase Auth), product metadata, uploaded images/PDFs, shopping list items, language/theme/currency preferences, and push tokens. Legal bases: contract (providing the app) and legitimate interest (security, reminders). Retention: until you delete your account. Recipients: Google Firebase, OpenAI (scan/assistant). Contact: alikayracatalkaya@gmail.com.</p>
<h2>Türkçe</h2>
<p>Saklio, iade ve garanti takibi için hesabını, ürünlerini, fişlerini, alışveriş listeni ve bildirim tercihlerini saklar. Kimlik doğrulama, veritabanı ve dosya depolama Firebase üzerinde, Avrupa bölgesinde tutulur. Fiş okuma için görseller yalnızca bu amaçla OpenAI’ye gönderilebilir. Kişisel veriler satılmaz. Verilerini uygulamadan dışa aktarabilir veya <a href="/delete-account">saklio.app/delete-account</a> üzerinden hesabını silebilirsin.</p>
<p>İşlenen veriler: ad, e-posta, Firebase kimliği, ürün bilgileri, yüklenen görseller, alışveriş listesi, dil/tema/para birimi, push jetonları. Saklama: hesap silinene kadar. Alıcılar: Google Firebase, OpenAI. İletişim: alikayracatalkaya@gmail.com.</p>`
);

const terms = page(
  "Terms of Use",
  `<h1>Terms of Use / Kullanım Şartları</h1>
<p class="muted">Last updated: 18 August 2026</p>
<h2>English</h2>
<p>Saklio is a consumer tool for storing receipts and reminders. It is provided “as is”. AI extraction can be wrong; you must check dates before returning an item. You must be 13 or older. Do not upload unlawful content. We may suspend abuse. Apple, Google and OpenAI are not parties to this agreement. Governing contact: aystech / Kayra Çatalkaya, alikayracatalkaya@gmail.com.</p>
<h2>Türkçe</h2>
<p>Saklio fiş ve hatırlatma aracıdır; “olduğu gibi” sunulur. Yapay zekâ okuması hatalı olabilir; iade öncesi tarihleri kontrol etmek sana aittir. 13 yaşından küçükler kullanamaz. Yasadışı içerik yüklenemez. İletişim: aystech / Kayra Çatalkaya, alikayracatalkaya@gmail.com.</p>`
);

const child = page(
  "Child Safety",
  `<h1>Child Safety / Çocuk Güvenliği</h1>
<h2>English</h2>
<p>Saklio is not directed at children under 13 and is not a Kids app. We do not knowingly collect data from children. There is no user-to-user chat, social feed or location sharing. CSAE (child sexual abuse and exploitation) is strictly prohibited. To report abuse: alikayracatalkaya@gmail.com. We will review and remove violating content and report to authorities when required.</p>
<h2>Türkçe</h2>
<p>Saklio 13 yaş altı çocuklara yönelik değildir. Çocuklardan bilerek veri toplanmaz. Kullanıcılar arası sohbet, sosyal akış veya konum paylaşımı yoktur. Çocuk cinsel istismarı ve sömürüsü kesinlikle yasaktır. Bildirim: alikayracatalkaya@gmail.com.</p>`
);

const support = page(
  "Support",
  `<h1>Support / Destek</h1>
<p>Email: <a href="mailto:alikayracatalkaya@gmail.com">alikayracatalkaya@gmail.com</a></p>
<p>Web app: <a href="https://saklio.app/login">https://saklio.app/login</a></p>
<p>Account deletion: <a href="/delete-account">https://saklio.app/delete-account</a></p>
<p>Produced by <b>aystech · Kayra Çatalkaya</b></p>`
);

fs.writeFileSync(path.join(root, "privacy.html"), privacy);
fs.writeFileSync(path.join(root, "terms.html"), terms);
fs.writeFileSync(path.join(root, "child-safety.html"), child);
fs.writeFileSync(path.join(root, "support.html"), support);
console.log("legal pages written");
