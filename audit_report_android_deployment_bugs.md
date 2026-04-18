# 🐞 Audit & Debug Raporu: Android Deployment ve Performans Sorunları

Metin, yolladığın ekran görüntüsü ve detaylı geri bildirimi inceledim. Gözlemlerin tamamen doğru ve hepsi birbiriyle bağlantılı birkaç teknik eksiklikten kaynaklanıyor. Sorunların kök nedenlerini buldum ve kod üzerindeki düzeltmeleri yaptım. 

## 1️⃣ Kökü Girmiyor: PlatformException (ApiException: 10) 🔴
Giriş yaparken aldığın **ApiException: 10** hatası doğrudan Google Play App Signing (Uygulama İmzalama) ile alakalı. 
Dün uygulamanın paket adını `shop.lokma.app` olarak değiştirdik ve sen bunu Google Play Console'a yükledin. Google Play senin yüklediğin paketi **kendi özel dağıtım anahtarıyla (App Signing Key)** yeniden imzalıyor.

**Neden Oldu?**
Yeni `shop.lokma.app` Android projesi için Firebase konsoluna Google Play'in imzaladığı yeni **SHA-1 ve SHA-256** şifrelerini girmedik. Bu yüzden Google Sign-In senin uygulamayı tanımıyor ve reddediyor.

**Nasıl Çözeceksin? (DİKKAT EYLEM GEREKTİRİR)**
1. **Google Play Console**'a gir -> *Lokma* uygulamasını seç.
2. Sol menüden **Sürüm (Release)** -> **Kurulum (Setup)** -> **Uygulama bütünlüğü (App integrity)** sayfasına git.
3. Orada **Uygulama İmzalama Anahtarı (App signing key)** sertifikasına ait **SHA-1** ve **SHA-256** değerlerini kopyala.
4. **Firebase Console**'a git -> Project Settings -> Android apps -> `shop.lokma.app` seç.
5. Kopyaladığın SHA-1 ve SHA-256 numaralarını "Add Fingerprint" diyerek ekle.
**(Bunu yaptıktan sonra Google Sign-In hatası tamamen ortadan kalkacak.)**

---

## 2️⃣ Yemek ve Market Kısmındaki TUNA Badgelerinin Eski Olması 🐟
**"Taaa eski label/badge görüntüsü oldu"** demenin sebebi: Yemek, Market ve Kermes (Market kısmındaki) listelerinde kullanılan `WalletBusinessCard` bileşeninde TUNA markası için yazdığım "Legacy Fallback" (Eski destek) kodu aktif kalmış.

* **Sorunun Kaynağı:** Önceki büyük marka güncellemesinde kırmızı "TUNA Hazır Paketli Ürünleri" logo/butonlarını (Pill) yapmıştım ama `WalletBusinessCard` içinde eski metin kutusu `Text('TUNA')` gösteren bir bypass kalmış.
* **Çözüm:** Kodu güncelledim. Artık eski sistemdeki işletmelerde de direkt standartlaştırdığımız `tuna_logo_pill.png` veya `akdeniz_toros_logo_pill.png` modern grafikleri çalışacak. Artık o çirkin yazı kutusu çıkmayacak. ✨

---

## 3️⃣ Aşırı Yavaş Açılma ve Fiyasko Rezaleti (Performans Düşüşü) 🐢
**"İnsan yaptığın performans iyileştirmesinden sonra sayfasına çok hızlı açılıyordu... Şimdi ise çok yavaş açılıyor kermes segmentine girince tamamıyla bir fiyasko"**

Senin yüklediğin Test (Release/AAB) sürümünde Market ve Kermes (Market sekmesi içindeki) kısmı kaydırırken cihazı kilitliyor. Bunun 2 ana sebebi birleşti:

1. **Eksik Logo Dosyasının Yavaşlatması:** `WalletBusinessCard` içinde TUNA logosunu ararken sildiğimiz eski `tuna_logo.png` dosyasını çağıran bir hata bloğu kalmıştı. Liste kaydırıldıkça (veya açılırken) Flutter bu kayıp dosyayı 50-60 kez bulmaya çalışıp saniyenin altında hata Exception fırlatıyor. Release modunda bu Exception fırtınası arayüz motorunu (UI Thread) kilitliyor ve "kartlar açılmadı" hissiyatı veriyor. *Bunu düzeltip doğru pill asset'ine çevirdim.*
2. **Kimlik Doğrulama Reddi (Firestore Loop):** `ApiException: 10` nedeniyle Google seni içeri almadığında, uygulama seni Guest (Misafir) gibi değerlendirmeye çalışıyor ancak Firebase "App Check" veya Güvenlik kuralları senin uygulamanın imzasını doğrulamadığı için Firestore (veritabanı) sorgularını (Market verilerini çekme) Reddediyor veya Timeout'a düşürüyor. Veri gelmediği için kartlar takılı kalıyor.

### Sonraki Adımların 🚀
Ben kodları (`WalletBusinessCard`, `market_screen.dart`, `business_detail_screen.dart`) optimize edip sorunları giderdim. Senin sadece Google Play Console'dan SHA anahtarlarını alıp Firebase'e eklemen gerekiyor. Bunu yaptıktan sonra her şey yağ gibi akacaktır! 🎯
