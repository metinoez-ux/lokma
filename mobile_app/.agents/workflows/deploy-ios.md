---
description: Deploy LOKMA Flutter app to iOS device (wired USB only)
---

# iOS Device Deployment Workflow

> **KURAL: Sadece Kablolu (USB) Baglanti!** Wireless deploy kesinlikle yasaktir.

## Device IDs
- **iPhone 17 Pro Metin**: `00008150-000808603C52401C` (CoreDevice: `6BBA6FC8-F6A4-5FCE-A8B9-9249CE6FE670`)
- **iPhone 11 Metin**: `00008030-000655243A88802E` (CoreDevice: `BC5C06CB-3B68-5B28-B347-5E7C3841E083`)

## Hazirlik: Wireless Pairing Kontrolu

Cihazin wireless baglanip baglanmadigini kontrol et:
// turbo
1. `flutter devices` calistir. Eger hedef cihazda `(wireless)` yaziyorsa, once unpair yap:
   ```
   xcrun devicectl manage unpair --device <COREDEVICE_ID>
   ```
   Sonra kullanicidan kabloyu cikarip takmasini ve telefonda "Trust/Guven" demesini iste.
   Ardindan `idevicepair pair` ile yeniden esle.

## Adim 1: Build (RELEASE modu)

> **ONEMLI:** `--release` kullan! Debug build, `xcrun devicectl` ile yuklendiginde crash eder cunku Flutter CLI debug baglantisi gerektirir. Release (AOT) build standalone calisir.

// turbo
2. `cd /Users/metinoz/Developer/LOKMA/mobile_app && flutter build ios --release` komutu ile build et.
   - Build ~90sn surer. Tamamlaninca `build/ios/iphoneos/Runner.app` olusur.
   - Eger hata alirsan `dart analyze lib/` ile kontrol et.

## Adim 2: Install (xcrun devicectl)

Flutter CLI'nin `flutter run` komutu Xcode timeout hatasi veriyor (CONFIGURATION_BUILD_DIR). Bu yuzden `xcrun devicectl` kullan:

// turbo
3. Cihazi kontrol et:
   ```
   xcrun devicectl list devices
   ```
   Hedef cihazin `connected` durumda oldugundan emin ol.

// turbo
4. Uygulamayi yukle:
   ```
   xcrun devicectl device install app --device <COREDEVICE_ID> build/ios/iphoneos/Runner.app
   ```

## Adim 3: Launch

// turbo
5. Uygulamayi baslat:
   ```
   xcrun devicectl device process launch --device <COREDEVICE_ID> shop.lokma.app
   ```

## Adim 4: Hot Reload (Opsiyonel)

Release modda hot reload mumkun degildir. Kod degisikligi icin tekrar build-install-launch yap (Adim 1-3).

Debug modda hot reload gerekiyorsa:
- Xcode'u ac (`open ios/Runner.xcworkspace`)
- Xcode icerisinde Cmd+R ile calistir
- Flutter debug baglantisi kurulunca `r` ile hot reload yap

## Sorun Giderme

| Sorun | Cozum |
|-------|-------|
| `(wireless)` gorunuyor | `xcrun devicectl manage unpair` ile kablosuz eslestirmeyi kaldir |
| `host is not paired` | Kabloyu cikar-tak, telefonda "Guven" de, `idevicepair pair` calistir |
| `CONFIGURATION_BUILD_DIR timeout` | `flutter run` yerine `xcrun devicectl` kullan (Adim 2-3) |
| Debug build crash ediyor | `--release` ile build et, debug build standalone calismaz |
| Build hatasi | `dart analyze lib/` ile hatalari bul ve duzelt |
| DerivedData bozuk | `rm -rf ~/Library/Developer/Xcode/DerivedData/Runner-*` |
