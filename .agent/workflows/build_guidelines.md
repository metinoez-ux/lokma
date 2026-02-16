---
description: Guidelines for building and deploying the mobile application.
---

# Build & Deployment Guidelines

## 🚨 MUTLAK ZORUNLU: SADECE KABLOLU BAĞLANTI — WIRELESS KESİNLİKLE YASAK

> [!CAUTION]
> **WIRELESS BUILD/RUN/INSTALL YAPMAK KESİNLİKLE YASAKTIR!**
> Bu kural istisna kabul etmez.
> `flutter devices` çıktısında cihaz `(wireless)` olarak görünüyorsa → DURDURUN, cihaz USB ile bağlı değildir.
> **ASLA wireless cihaza build/run/install denemeyin.**

### Neden?

- Wireless bağlantı Exit Code 2 hatalarının ana nedenidir
- Build süreleri 3-5x daha uzun olur
- Cihaz bağlantısı kopabilir ve build yarım kalır
- `flutter install` wireless cihazda codesigning hatası verir

### ✅ Build Öncesi Zorunlu Kontroller (HER SEFERINDE)

// turbo-all

```bash
# 1. Bağlı cihazları listele — cihaz adının yanında "(wireless)" OLMAMALI
flutter devices

# 2. USB bağlantısını doğrula
system_profiler SPUSBDataType 2>/dev/null | grep -A3 "iPhone"
```

- Eğer cihaz listesinde sadece `(wireless)` varsa → **KULLANICIYA SOR: "iPhone'u USB ile bağlar mısın?"**
- `(mobile)` olarak görünüp `(wireless)` yazmıyorsa → USB bağlı, devam et

### ✅ Build & Run Komutu

```bash
# UDID'yi belirterek çalıştır — ASLA wireless UDID kullanma
flutter run --debug -d <USB_DEVICE_UDID>
```

**Güncel USB UDID:** `00008150-000808603C52401C` (iPhone 17 Pro Metin)

### ⚠️ flutter run Debug Session Timeout Verirse

Eğer `flutter run` Xcode debug session timeout hatası verirse:

```bash
# Xcode workspace'i aç
open ios/Runner.xcworkspace
```

Sonra kullanıcıya de: **"Xcode'da Product > Run yap"**

## 📦 Admin Portal Deploy

```bash
# 1. Build
cd admin_portal && npm run build

# 2. Deploy (nohup ile background'da)
nohup firebase deploy --only hosting:lokma 2>&1 &
```

## Troubleshooting

Exit Code 2 hatası alırsanız:

```bash
# Tam temizlik protokolü
pkill -f CoreDeviceService
flutter daemon --shutdown
flutter clean
rm -rf ios/Pods ios/Podfile.lock ios/.symlinks
rm -rf ~/Library/Developer/Xcode/DerivedData/Runner-*
flutter pub get
cd ios && pod install --repo-update
```

Sonra tekrar build başlatın.
