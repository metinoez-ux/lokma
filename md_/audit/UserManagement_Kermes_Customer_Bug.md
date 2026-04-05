# LOKMA Audit Raporu: Kullanıcı Yönetimi - Kermes Rolü Hatası Çözümü

## Tespit Edilen Hatalar ve Çözümler
Ferihan kullanıcısının ve genel olarak "Müşteri (Kunde)" statüsünde olan kişilerin sadece Kermes personeli olarak atanması sırasında ortaya çıkan problemler çözüldü.

1. **Rol Seçiminin Atamaları Silmesi:** 
   Önceden Rol dropdown menüsünden "Normal Kullanıcı / Müşteri" seçildiğinde alt kısımdaki `WorkspaceAssignmentsList` gizleniyordu ve aynı anda tüm kermes atamaları siliniyordu.
   - *Çözüm:* Hata tetikleyen bu gizleme ve veriyi temizleme kodu (`setEditAssignments([])`) kaldırıldı ve super adminlere bu listenin her zaman gösterilmesi sağlandı.

2. **Kermes Rollerinin Ana Rollere Eklenmemesi:**
   Backend'e gönderilen formda, kullanıcının asıl rolü "Müşteri" olduğu için `roles: ["customer"]` olarak gidiyordu ve içerideki kermes yetkisi görmezden geliniyordu.
   - *Çözüm:* Kullanıcı yönetim listesinden Kermes ataması yapılan kişilerin (örn: kermes personeli), sahip olduğu o rol (`staff`, `driver` vb.) `finalRoles` içerisine otomatik olarak eklendi.

3. **Backend Type Hatası ve Inaktiv Kalma Durumu:**
   UI üzerinden eklenen kermes bilgilerinde `entityType` kullanılırken, `update-user/route.ts` API'si `type` değerini arıyordu. Bu nedenle kermes bilgisi okunamayıp `businessId: null` kalıyor ve hesabı `isActive: false` yani inaktif olarak işaretliyordu. O yüzden Ferihan listede kırmızı renkte "Inaktiv" gözüküyordu.
   - *Çözüm:* API'deki bu mapping hatası düzeltildi. `entityType` başarıyla okunabiliyor.

## Aksiyon Önerisi
Lütfen kullanıcı yönetim ekranına gidip Ferihan'ın satırındaki **Details** butonuna tıklayın ve hiçbir şeyi değiştirmeden sadece sayfadaki **Tüm Değişiklikleri Kaydet** butonuna basın. Yeni yazdığımız mantık devreye girecek ve hesabını otomatik olarak onarıp "Aktiv" duruma geçirecektir.
