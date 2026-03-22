---
description: How to resolve Xcode and iOS wireless debug timeouts during flutter run
---

# Fix: Xcode Timeout Waiting for CONFIGURATION_BUILD_DIR

Bu hata genellikle macOS ve iPhone arasindaki kablosuz (wireless) debug koprusunun askida kalmasi veya Xcode'un `Runner.app`'i fiziksel cihaza yuklerken onbellek sismesi yasamasindan kaynaklanir.

Hata mesaji ornegi:
`Error starting debug session in Xcode: Timed out waiting for CONFIGURATION_BUILD_DIR to update.`
`Could not run build/ios/iphoneos/Runner.app on [DEVICE_ID].`

## Cozum Adimlari

Eger cihaz USB uzerinden (kablolu) baglanmis olmasina ragmen hala \`(wireless)\` isaretiyle gorunuyor ve ayni hatayi veriyorsa, asagidaki adimlari birebir uygulayin:

1. **Hayalet Onbellegi Temizle (Flutter Clean)**
   Cihazin eski wireless debug onbellegini ve tum Xcode turetilmis verilerini (DerivedData) silin:
   \`\`\`bash
   // turbo
   cd mobile_app && flutter clean
   \`\`\`

2. **Paketleri Yeniden Yukle**
   \`\`\`bash
   // turbo
   cd mobile_app && flutter pub get
   \`\`\`

3. **Cihaz ID'sini Bul ve Yeniden Tetikle**
   Cihaz takiliyken `flutter devices` ciktisindan cihazin ID'sini alin.
   \`\`\`bash
   // turbo
   cd mobile_app && flutter run -d <DEVICE_ID>
   \`\`\`

> Bu islem projedeki tum native C++ ve Objective-C dosyalarinin (ozellikle Firebase, Stripe gibi agir paketlerin) bastan derlenmesini gerektirdigi icin yaklasik **3-6 dakika (veya cihaziniza bagli olarak 10 dakikaya kadar)** surebilir. Sabirla bekleyin; `Xcode build done` ciktisini aldiktan hemen sonra cihazda direkt uygulama acilacaktir.
