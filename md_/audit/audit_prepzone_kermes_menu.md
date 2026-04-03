# Audit Raporu: Kermes Menüsü Hazırlık Bölgesi (prepZone) Entegrasyonu

> [!NOTE]
> Bu raporda, kermes menüsü düzenleme ekranlarında hazırlık ve garson alanlarının (prepZone) girilebilmesi için yapılan ekosistem güncellemeleri listelenmektedir.

## 🛠 Neler Yapıldı?

Kermes menü yönetimindeki 3 temel ürün ekleme/düzenleme adımına `prepZone` desteği eklendi:
1. **Master / Katalog Ürünü Eklerken (Modal)**: 
   - `editBeforeAdd` nesnesine `prepZone` tanımı eklendi.
   - Master veya katalogdan ürün seçildiğinde çıkan fiyata karar verdiğimiz ön-düzenleme ekranına 'Hazırlık / Garson Alanı' inputu 
     (`örn: EK1, KT1`) eklendi.
2. **Kermese Özel (Custom) Ürün Eklerken**:
   - `customProduct` state'ine `prepZone` eklendi.
   - "Yeni Özel Ürün Ekle" formuna giriş alanı eklendi ve Firebase dökümanına kaydı sağlandı.
3. **Mevcut Ürünü Düzenlerken**:
   - Ürün düzenleme (editProduct) işlemi butonuna basıldığında `prepZone` verisi product içinden alındı.
   - Düzenleme modalında ilgili input eklendi ve Cloud Firestore güncellemelerinde de kayda alınması garantilendi.

## 📁 Değiştirilen Dosya

- [MODIFY] [page.tsx](file:///Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/%5Blocale%5D/admin/kermes/%5Bid%5D/page.tsx)
  > Kermes içerik editörü ekranı güncellenerek tüm model state'lerine ve arayüze `prepZone` inputları dahil edildi.

> [!IMPORTANT]
> Sistem genelindeki Master Catalog veya İşletme(Restoran) yönetim ekranlarında (`admin/products` vs.) da bu alanı istersen lütfen haber ver, şu an kermes spesifik organizasyonlar üzerinden revizyonlar tamamlanmıştır.

## ✅ Doğrulama Adımları

- [x] Tür tanımına eklenmesi (`KermesProduct`)
- [x] `editBeforeAdd` arayüzüne ve `handleConfirmAdd` firebase çağrısına entegrasyon
- [x] `setEditProduct` arayüzüne ve `handleSaveProduct` çağısına entegrasyon
- [x] `customProduct` form arayüzüne ve `handleCreateCustom` çağrısına entegrasyon
- [x] Varsa tüm dosyadaki diğer yerlerin analizi ve sorunsuz entegrasyon kontrolü

🚀 Tüm UI bileşenleri React tarafında tutulan state modülleri ile reaktif hale getirilmiş ve veri yönetimi tamamlanmıştır.
