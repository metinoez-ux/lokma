# LOKMA AI Video Production & UI Integration Standards

## 1. Sorun ve Çözüm (Titreme ve Gecikme Problemi)
Kermes detay sayfası ve genel listeleme alanlarında, videoların otomatik başlaması sırasında UI üzerinde oluşan "titreme" (jitter), ani zoom hareketleri ve yükleme gecikmeleri kullanıcı deneyimini bozuyordu. 

Bu sorunu tamamen çözmek için **"1 Saniye Sabit Kamera"** (1 Second Locked-Off Camera) kuralı geliştirildi. Bu sayede, video oynatıcı (Next.js `<video>` veya Flutter `VideoPlayer`) videoyu yükleyip oynatmaya başladığı ilk anlarda (frame droplarının en çok yaşandığı süre), video statik bir resim gibi davrandığı için gözle görülür bir kasılma veya layout kayması (layout shift) yaşanmaz. Birinci saniyenin ardından, cihaz videoyu tamamen arabelleğe almış (buffer) olur ve sinematik hareket (zoom/pan) yumuşakça başlar.

## 2. İdeal AI Video Prompt Yapısı (Freepik vb.)

Videonun sorunsuz entegrasyonu için yapay zeka video üreticilerine (Freepik AI Video, Runway vb.) verilecek prompt iki ana bölüme ayrılmalıdır:

### Bölüm A: Konu ve Estetik (Subject & Aesthetic)
Burada sadece yemeğin görünümü, ortam, ışık ve çözünürlük tarif edilir.

> Cinematic and highly appetizing food photography of a premium Turkish charity bazaar (Kermes). Close-up of freshly made delicious Turkish food: **[BURAYA YEMEĞİ YAZIN: örn: golden crispy Lokma dessert with dripping syrup / sizzling Adana kebab / warm fresh Gözleme]**. Warm, inviting sunlight filtering through. 8k resolution, photorealistic, depth of field with a softly blurred bustling community background. High-end commercial aesthetic. Aspect ratio 16:9.

### Bölüm B: Kamera Hareketi Direktifi (Camera Directive - KRİTİK)
Videoların UI içinde sorunsuz (titremeden) başlaması için bu bölüm **kesinlikle** prompt'un sonuna eklenmelidir.

> The scene starts with a completely static, locked-off camera for exactly 1 second, showing only subtle natural movements like soft steam rising or dripping syrup. After the first 1 second, the camera smoothly transitions into a slow and elegant **[BURADAN SEÇİN: zoom-in / zoom-out / subtle rotation / slow pan]**.

## 3. UI/UX Entegrasyon Kuralları
- **Aspect Ratio:** Tüm üretimler **16:9** (landscape) formatında yapılmalıdır. Bu format hem Kermes listeleme card'larında hem de detay sayfasındaki tepe videoda (hero banner) birebir örtüşür.
- **Kapak Resmi (Poster/Thumbnail) Eşleşmesi:** Video dosyalarının ilk karesi (`00:00:00`) alınarak statik resim olarak kaydedilmeli ve uygulamanın/web sitesinin ilgili kısımlarında `poster` (thumbnail) olarak kullanılmalıdır. Video ilk saniyede zaten sabit olduğu için, statik resimden hareketli videoya geçiş (transition) %100 kusursuz ve görünmez olur.
- **Gelecek Kullanımlar:** Bu standart, sadece Kermes modülü ile sınırlı kalmayıp; gelecekte Restoran menü kapakları, ana sayfa slider'ları veya özel kampanya banner'ları üretilirken de LOKMA'nın ana standardı olarak kullanılmalıdır.
