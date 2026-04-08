# 🗂️ LOKMA Backlog

> Son güncelleme: 04.03.2026

## 🔥 Devam Eden / Yarım Kalan İşler

- [ ] **Yazıcı Entegrasyonu** — Kod hazır, yazıcı gelince test edilecek
  - `/api/print/route.ts`, `printerService.ts`, IoT ayarları, sipariş yazdır butonu
  - Beklenen: WiFi termal yazıcı (MUNBYN 80mm)

## 📋 Yapılacaklar (Yeni Özellikler)

- [ ] **Kermes Seyahat Suresi - Gercek Rota Hesaplama** -- Su an 80 km/h sabit ortalama hiz ile hesaplaniyor. Ileride OSRM (ucretsiz, self-host) veya Google Distance Matrix API (cache ile) kullanilarak gercek rota suresi gosterilebilir.
  - Maliyet analizi: Google API ~$5/1000 istek, OSRM ucretsiz
  - Oneri: Kermes **detay sayfasinda** tek istek + Firestore cache, **liste ekraninda** mevcut formul korunsun
  - Oncelik: Dusuk (mevcut cozum yeterli)

- [ ] **Mobil App - Park Alani Yonetimi** -- Kermes personeli (deneme fazinda tum personel, sonra sadece park gorevi atananlar) mobil uygulamadan park alani ekleyebilsin/duzenleyebilsin. Admin paneldeki `kermes_parking_screen.dart` altyapisi mevcut, harita ile konum secme + GPS destegi eklenmeli.
  - Erisim: Staff Hub > Park Alanlari
  - Deneme fazi: Tum kermes personeli erisebilir
  - Uretim fazi: Sadece park gorevi atanan personel

- [x] **Park Alani Doluluk Statusu** -- Belirsiz/Bos/Dolu toggle hem admin panelde hem mobil uygulamada aktif. Firestore realtime ile senkronize. (09.04.2026)

- [ ] **Bildirim Kutusu (Notification Inbox)** -- Push bildirimler gelip gidiyor, gozden kacabiliyor. Tum push bildirimlerin kalici olarak kronolojik listede gorunecegi bir Inbox sayfasi gerekli.
  - Konum: Mobil app header'da zil ikonu + okunmamis sayisi badge
  - Icerik: Gorev atamalari, siparis bildirimleri, acil anonslar, sistem bildirimleri
  - Firestore: `users/{uid}/notifications` sub-collection (her bildirim bir doc)
  - Cloud Function: `onNotificationSend` trigger'i ile her push bildirim ayni zamanda Firestore'a yazilir
  - Ozellikler: Okundu/okunmadi durumu, tarihe gore gruplama (bugun/dun/onceki), tek tikla silme
  - Oncelik: Yuksek

## 🐛 Bug Fix / Revize

- [ ] **Push Bildirim Tiklaninca Hata** -- Gorev atamasi (kermes_assignment) gibi siparis-disi bildirimler tiklandiginda hata veriyor. `fcm_service.dart` sadece siparis tipli (orderId) bildirimleri yonlendirebiliyor. Siparis-disi tipler icin graceful fallback gerekli (ana sayfa veya staff-hub'a yonlendir).
  - Dosya: `mobile_app/lib/services/fcm_service.dart` (`_handleMessageOpenedApp`)
  - Etki: Tum kermes gorev atamalari, acil anonslar, sistem bildirimleri

## ✅ Tamamlananlar

- [x] Admin Settings hub refaktör (IoT + Sponsored ayrı sayfalara)
- [x] Yazıcı entegrasyonu yazılım tarafı (04.03.2026)
