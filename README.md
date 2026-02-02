# 🚀 LOKMA 2026 - ANA WORKSPACE

> ⚠️ **ANTİGRAVİTY AÇTIĞINIZDA BU KLASÖRÜ AÇIN!**
>
> `File → Open Folder → ~/.gemini/antigravity/scratch/LOKMA_2026`

---

## 📱 Projeler

| Proje | Klasör | Açıklama |
|-------|--------|----------|
| 🖥️ **Admin Portal** | `admin_portal/` | lokma.shop web paneli |
| 📱 **Mobile App** | `mobile_app/` | Flutter (iOS + Android) |

## 🗄️ Veritabanı

**Firebase Project**: `ibadet_defterim` (aylar-a45af)

---

## 💾 BACKUP KONUMLARI

| Hedef | Yol | Açıklama |
|-------|-----|----------|
| **Yerel (LOKMA_2026)** | `./backups/` | Anlık backup'lar |
| **Mac6TB Disk** | `/Volumes/Mac6TB/BACKUPS/MIRA_2026/` | 3 saatlik backup |
| **GitHub** | `github.com/user/lokma` | Git push |
| **Google Drive** | Synology Drive → Google | 6 saatlik sync |
| **TestFlight** | App Store Connect | iOS release builds |

---

## 🎯 Hızlı Komutlar

### Admin Portal Deploy

```bash
cd admin_portal && npm run build && firebase deploy --only hosting:lokma
```

### iOS Build (iPhone 15 Pro Max)

```bash
cd mobile_app && flutter clean && flutter pub get && flutter build ios --release
```

### TestFlight Upload

```bash
cd mobile_app && flutter build ipa --release
# Sonra Transporter ile yükle
```

---

## 📁 Klasör Yapısı

```
LOKMA_2026/
├── admin_portal/      ← Next.js (lokma.shop)
├── mobile_app/        ← Flutter (iOS + Android)
├── shared_assets/     ← Ortak görseller
├── backups/           ← Günlük backup'lar
└── docs/              ← Dokümantasyon
```

## ❌ ESKİ KLASÖRLER (Kullanmayın)

- `/scratch/LOKMA/` → Eski
- `/scratch/MIRAPORTAL/` → Referans
- `/scratch/MIRA/` → Eski MIRA

---

**Son Güncelleme**: 2026-01-15 18:17
