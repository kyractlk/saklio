# SAKLIO — Ürün Gereksinim Dokümanı (PRD)

## Problem Statement
SAKLIO, kullanıcıların satın aldıkları ürünleri, fişleri, faturaları, garanti belgelerini, iade sürelerini ve sahip oldukları ürünlerin tüm yaşam döngüsünü tek yerde yöneten modern bir mobil uygulama. Slogan: "Fişi çek, gerisini Saklio halletsin." — Türkçe, premium "Ownership OS" deneyimi.

## Architecture
- **Frontend**: Expo (SDK 54) + expo-router (file-based). Reanimated animasyonlar, react-native-svg custom illüstrasyonlar, expo-camera + expo-image-picker, react-native-keyboard-controller, expo-blur (glass tab bar).
- **Backend**: FastAPI (tek dosya `server.py`), `/api` prefix. JWT (bcrypt) auth. GPT-5.4 vision (Emergent LLM Key) fiş okuma + AI asistan + garanti başvuru metni.
- **DB**: MongoDB (motor).
- **Storage**: Emergent Managed Object Storage (görsel yükleme/indirme, token korumalı).
- **Theme**: 3 tema (Saklio Soft / Dark / Color) — Context tabanlı, kullanıcı profilinde saklanıyor.

## User Personas
1. Yoğun tüketici — çok alışveriş yapan, iade/garanti sürelerini kaçıran kullanıcı.
2. Düzen sever — tüm belge ve fişlerini tek yerde tutmak isteyen kullanıcı.
3. Genç kullanıcı — modern, renkli (Saklio Color) ve hızlı deneyim isteyen kullanıcı.

## Core Requirements (static)
- Fiş tarama + AI çıkarımı (mağaza, ürün, fiyat, tarih, iade günü, garanti ayı).
- Ürün yaşam döngüsü: satın alma → fiş → iade süresi → garanti bitişi.
- İade merkezi (countdown ring) & garanti merkezi.
- AI asistan (kullanıcının ürün bağlamında sohbet).
- Gmail import (MVP'de simüle demo verisi).
- 3 tema, Türkçe UI, mikro animasyonlar, skeleton loader'lar.

## Implemented (2026-06)
- [x] Splash (animasyonlu logo) → Onboarding (4 ekran) → Login/Register (email+şifre, JWT)
- [x] 5 sekmeli bottom nav + ortada floating Scan butonu (glass efekti)
- [x] Ana Sayfa: selamlama, "Şimdi ilgilen" countdown ring kartları, İade Merkezi özeti, hızlı aksiyonlar, son eklenenler
- [x] Eşyalarım: grid/list toggle + kategori chip filtresi (yatay scroll)
- [x] Aktiviteler: İade/Garanti segment + Aktif/Yakında/Süresi dolmuş chip'leri, bildirim rozeti
- [x] Ürün Detay: hero görsel, countdown ring, garanti/fiş kartları, yaşam döngüsü timeline, aksiyonlar
- [x] Scan (kamera + izin akışı) → AI Processing (adım adım) → Confirm → Success (confetti)
- [x] İade Verdict, Garanti Talebi (AI metin), Gmail Connect (animasyonlu sayaç), Asistan sohbeti
- [x] Arama, Bildirimler, Profil, Tema Ayarları (3 tema kartı), Elle Ekle
- [x] Emergent Object Storage görsel yükleme, GPT-5.4 vision fiş okuma
- [x] 27/27 backend testi geçti; tüm frontend E2E akışları doğrulandı

## Implemented (2026-06 — İkinci tur)
- [x] Benzersiz Saklio logosu + uygulama ikonu (mint gradient kalkan + "S"), bildirim ikonu
- [x] 5 tema: Soft / Dark / Color / Sunset / Ocean
- [x] Belgeler Kasası: ürün başına fiş/fatura/garanti/kılavuz/servis; Kamera/Galeri/Dosyalardan seç, tam ekran görüntüleyici
- [x] Gmail ana sayfadan kaldırıldı → Profil > Bağlı Hesaplar "Yakında"
- [x] Push bildirim altyapısı (Emergent-managed); build sonrası çalışır
- [x] Ürün bazında bildirim tercihleri (İade/Garanti toggle)
- [x] Deeplink ile ürün paylaşımı + ekleme onay ekranı
- [x] Canlı döviz çevirisi TL/USD/EUR/SEK/DKK + Profil para birimi seçici
- [x] Verilerim: e-posta ile dışa aktarma + kodlu veri sıfırlama (SMTP aystech)
- [x] 15/15 yeni backend testi + yeni frontend akışları doğrulandı

## Deferred / Sonraki adımlar
- [ ] Tam İngilizce i18n (TR/EN dil değiştirici) — kapsamlı ayrı bir tur gerektirir
- [ ] Canlı Gmail OAuth (kullanıcının Google Cloud kimlik bilgileri gerekli)
- [ ] Ürün eklenince internetten otomatik görsel bulma
- [ ] Garanti talebi geçmişi/takibi (başvuru tarihi, kaç gün önce) + tamir fişi ilişkilendirme

## Backlog / Remaining
- Gerçek Gmail OAuth entegrasyonu (Google doğrulama süreci gerekli) — şu an simüle
- Belgeler (Documents) vault ekranı: fiş/fatura/garanti/kılavuz kategorileri
- Ürün düzenleme ekranı (şu an yalnızca oluştur/sil)
### P2
- Tablet iki-kolon dashboard yerleşimi
- Fiyat düşüşü bildirimleri, "reduced motion" erişilebilirlik seçeneği
- RN-Web `shadow*`/`transformOrigin` deprecation uyarılarının temizliği (yalnızca web)

## Notes
- Kamera tarama Expo Go/web önizlemede tam çalışmaz; AI pipeline backend `/api/scan` ile doğrulandı.
- Test hesabı: demo@saklio.app / demo1234 (POST /api/seed-demo ile 4 demo ürün).
