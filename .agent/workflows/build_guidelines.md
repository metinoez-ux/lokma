---
description: Guidelines for building and deploying the mobile application.
---

# Build & Deployment Guidelines

## 🚨 MUTLAK ZORUNLU: SADECE KABLOLU BAĞLANTI

> [!CAUTION]
> **WIRELESS BUILD YAPMAK KESİNLİKLE YASAKTIR!**
> Bu kural istisna kabul etmez. Her iOS build'den önce kablolu bağlantı doğrulanmalıdır.

### Neden?

- Wireless bağlantı Exit Code 2 hatalarının ana nedenidir
- Build süreleri 3-5x daha uzun olur
- Cihaz bağlantısı kopabilir ve build yarım kalır

### Build Öncesi Zorunlu Kontroller

```bash
# 1. CoreDeviceService'i sıfırla (wireless önbelleklerini temizler)
pkill -f CoreDeviceService

# 2. Flutter daemon'u temizle
flutter daemon --shutdown

# 3. USB bağlantısını doğrula (UDID görünmeli)
system_profiler SPUSBDataType 2>/dev/null | grep -A3 "iPhone"

# 4. idevice ile kontrol (alternatif)
idevice_id -l
```

### Build Komutu (Kablolu Zorunlu)

```bash
# UDID'yi belirterek build yap
flutter run --release -d <DEVICE_UDID>
```

**Örnek:** `flutter run --release -d 00008150-000808603C52401C`

## ⚠️ Eğer Flutter "(wireless)" Gösteriyorsa

Build logunda `Launching lib/main.dart on iPhone (wireless)` görürseniz:

1. **DURDURUN** (Ctrl+C)
2. Kullanıcıdan kabloyu çıkarıp tekrar takmasını isteyin
3. `pkill -f CoreDeviceService` çalıştırın
4. `system_profiler SPUSBDataType` ile USB bağlantısını doğrulayın
5. Tekrar deneyin

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
