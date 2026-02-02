# 🔧 LOKMA Firebase & Kod Hizalama Planı

## 📊 Mevcut Firebase Koleksiyonları (22 Ocak 2026)

### İşletme İlişkili Koleksiyonlar

| Koleksiyon | Kayıt | Durum | Aksiyon |
|------------|-------|-------|---------|
| `butcher_partners` | 29 | ✅ AKTİF - Ana koleksiyon | `businesses` olarak yeniden adlandır |
| `businesses` | 10 | ❌ YETIM - Kullanılmıyor | Sil veya arşivle |
| `butcher_orders` | ? | Sipariş koleksiyonu | `orders` olarak yeniden adlandır |
| `butcher_products` | ? | Ürün koleksiyonu | Kontrol et |
| `meat_orders` | ? | Et siparişleri | `orders` ile birleştir |

### Admin Koleksiyonu Alanları

| Alan | Örnek Değer | Yeni Alan |
|------|-------------|-----------|
| `butcherId` | `aOTmMmSArHjBbym459j5` | `businessId` |
| `butcherName` | `Hilal Market - Hückelhoven` | `businessName` |

---

## 🎯 HEDEF YAPI

### Firebase Koleksiyonları (YENİ)

```
businesses/              ← Tüm işletmeler (kasap, restoran, market, vs.)
  └── {businessId}/
       └── products/     ← İşletmeye özel ürünler
       └── suppliers/    ← Tedarikçiler
       └── inventory/    ← Envanter

orders/                  ← Tüm siparişler (birleştirilmiş)
  └── {orderId}
       businessId: string

sectors/                 ← Sektör tanımları (mevcut, değişmeyecek)

admins/                  ← Admin kayıtları
  └── {adminId}
       businessId: string   ← butcherId yerine
       businessName: string ← butcherName yerine

master_products/         ← Ana katalog (mevcut, değişmeyecek)
```

---

## 📱 MOBİL UYGULAMA - DEĞİŞİKLİKLER

### Koleksiyon Referansları

| Dosya | Mevcut | Yeni |
|-------|--------|------|
| `firestore_service.dart` | `butcher_partners` | `businesses` |
| `order_service.dart` | `butcher_orders` | `orders` |
| `cart_screen.dart` | `meat_orders` | `orders` |
| Tüm ekranlar | `butcher_partners` | `businesses` |

### Alan İsimleri

| Mevcut | Yeni |
|--------|------|
| `butcherId` | `businessId` |
| `butcherName` | `businessName` |
| `ButcherProduct` | `Product` veya aynı kalabilir (sadece kasap için) |
| `ButcherDetailScreen` | `BusinessDetailScreen` |

---

## 🖥️ ADMIN PORTAL - DEĞİŞİKLİKLER

### Koleksiyon Referansları (~200 yer)

| Mevcut | Yeni |
|--------|------|
| `butcher_partners` | `businesses` |

### Alan İsimleri (~50 yer)

| Mevcut | Yeni |
|--------|------|
| `butcherId` | `businessId` |
| `butcherName` | `businessName` |

---

## 🚀 MİGRASYON ADIMLARI

### Adım 1: Firebase Migration (VERİ)

```bash
# 1. butcher_partners → businesses kopyala
# 2. butcherId → businessId alanlarını güncelle
# 3. Eski koleksiyonları arşivle
```

### Adım 2: Admin Portal Kod Değişiklikleri

```bash
# sed ile toplu değiştirme
sed -i '' "s/butcher_partners/businesses/g" src/**/*.ts src/**/*.tsx
sed -i '' "s/butcherId/businessId/g" src/**/*.ts src/**/*.tsx
sed -i '' "s/butcherName/businessName/g" src/**/*.ts src/**/*.tsx
```

### Adım 3: Mobil Uygulama Kod Değişiklikleri

```bash
# sed ile toplu değiştirme
sed -i '' "s/butcher_partners/businesses/g" lib/**/*.dart
sed -i '' "s/butcherId/businessId/g" lib/**/*.dart
sed -i '' "s/butcherName/businessName/g" lib/**/*.dart
```

### Adım 4: Test & Deploy

- Admin Portal: `npm run build` + `firebase deploy`
- Mobil: `flutter build ios`

---

## ⚠️ DİKKAT EDİLECEKLER

1. **Geriye Dönük Uyumluluk**: Mevcut siparişlerdeki `butcherId` alanları da güncellenmeli
2. **Firestore Index**: Yeni koleksiyon için index'ler oluşturulmalı
3. **Güvenlik Kuralları**: `firestore.rules` güncellenmeli
4. **Backup**: İşlem öncesi tam yedek alınmalı

---

## 📝 İLERLEME DURUMU

- [ ] Firebase veritabanı yedeklendi
- [ ] butcher_partners → businesses migration scripti yazıldı
- [ ] Admin portal kod değişiklikleri yapıldı
- [ ] Mobil uygulama kod değişiklikleri yapıldı
- [ ] Firestore kuralları güncellendi
- [ ] Test edildi
- [ ] Production'a deploy edildi
