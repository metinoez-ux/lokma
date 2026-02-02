# 🔍 FİREBASE - KOD EŞLEŞTİRME RAPORU

**Tarih:** 22 Ocak 2026, 22:24

---

## 📦 FIREBASE KOLEKSİYONLARI (Gerçek)

```
activity_logs, admins, businesses, butcher_orders, butcher_partners,
butcher_products, carpet_clusters, carpet_facilities, carpet_plz_analytics,
carpet_plz_search_logs, custom_zikir, daily_logs, daily_tasks, hatim_logs,
kermesEvents, kermesOrders, kermes_events, location_notes, master_products,
meat_orders, notes, notifications, order_counters, oruc_kaza_log,
pending_invitations, qada_tasks, quran_sessions, receb_hacet_logs,
receb_namazi_logs, sectors, shared_hatims, subscription_plans, system_config,
tevhid_logs, transfer_partner_applications, user_profiles, user_travels,
users, zekat_debts, zikir_logs
```

---

## 📱 MOBİL APP KOLEKSİYON REFERANSLARI

| Kod'daki Koleksiyon | Kullanım | Firebase'de Var mı? | Durum |
|---------------------|----------|---------------------|-------|
| `businesses` | 23x | ✅ VAR | ✅ OK |
| `users` | 11x | ✅ VAR | ✅ OK |
| `lokma_orders` | 4x | ❌ YOK | ⚠️ İlk yazma ile oluşur |
| `products` | 3x | Subcollection | ✅ OK (businesses/{id}/products) |
| `lokma_users` | 3x | ❌ YOK | ⚠️ İlk yazma ile oluşur |
| `sectors` | 2x | ✅ VAR | ✅ OK |
| `meat_orders` | 2x | ✅ VAR | ✅ OK |
| `feedback` | 2x | ❌ YOK | ⚠️ İlk yazma ile oluşur |
| `master_products` | 1x | ✅ VAR | ✅ OK |
| `kermesEvents` | 1x | ✅ VAR | ✅ OK |
| `categories` | 1x | Subcollection | ✅ OK (businesses/{id}/categories) |

---

## 🖥️ ADMIN PORTAL KOLEKSİYON REFERANSLARI

| Kod'daki Koleksiyon | Kullanım | Firebase'de Var mı? | Durum |
|---------------------|----------|---------------------|-------|
| `businesses` | 11x | ✅ VAR | ✅ OK |
| `sectors` | 6x | ✅ VAR | ✅ OK |
| `invoices` | 5x | ❌ YOK | ⚠️ İlk yazma ile oluşur |
| `admins` | 5x | ✅ VAR | ✅ OK |
| `users` | 3x | ✅ VAR | ✅ OK |
| `master_products` | 3x | ✅ VAR | ✅ OK |
| `user_profiles` | 2x | ✅ VAR | ✅ OK |
| `stripe_payouts` | 2x | ❌ YOK | ⚠️ İlk yazma ile oluşur |
| `subscription_plans` | 1x | ✅ VAR | ✅ OK |
| `admin_invitations` | 1x | ❌ YOK | ⚠️ İlk yazma ile oluşur |

---

## 🔴 EKSİK/DÜZELTİLMESİ GEREKEN REFERANSLAR

### Admin Portal'da `butcher_orders` Kullanımı

Bu koleksiyon Firebase'de VAR ve admin portal'da doğru kullanılıyor.

### Kontrol Edilmesi Gereken

1. `butcher_orders` - Admin portal'da hala bu isimle mi kullanılıyor?
2. `butcher_products` - Subcollection olarak mı kullanılıyor?

---

## ✅ SONUÇ

**Kritik Sorunlar:** YOK ✅
**Uyarılar:** Bazı koleksiyonlar henüz oluşturulmamış (ilk yazma ile oluşacak)
**Durum:** Firebase ile kod hizalı

---

## 📋 YAPILDI

- [x] `butcher_partners` → `businesses` (Mobil App)
- [x] `butcher_partners` → `businesses` (Admin Portal)
- [x] `orders` → `meat_orders` (feedback_form_screen.dart)
- [x] Firebase'de `businesses` koleksiyonu oluşturuldu (26 kayıt)
- [x] Firebase'de `admins` koleksiyonuna `businessId` eklendi
