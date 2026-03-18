# LOKMA 2026 - Yapılacaklar Listesi

## 🎨 MARKA RENGİ (Brand Color)

**Primary:** `#F43F5E` (Rose/Pembe-Kırmızı)  
**Dart:** `Color(0xFFF43F5E)`

---

## Geçici Olarak Kaldırılan Özellikler

### Profil Sayfası (profile_screen.dart)

- [ ] **Cüzdan (Wallet)** - Ödeme sistemi hazır olunca geri eklenecek
- [ ] **Fırsatlar Bölümü** komple:
  - [ ] Kuponlarım
  - [ ] LOKMA Club

> **Tarih:** 29 Ocak 2026  
> **Sebep:** Özellikler henüz hazır değil, kullanıcı deneyimini bozmamak için geçici olarak kaldırıldı.

---

## Aktif Geliştirmeler

- [x] Dark Mode Desteği - Kermes ve KermesCard
- [x] Theme Selection UI (Profil sayfası)

---

## LOKMA Firma Einstellungen - Dinamik Veri Merkezi (PLANLANACAK)

**Kaynak:** `/admin/settings/company` sayfasindaki veriler (Firestore: `companySettings`)

Bu veriler bir kez girilecek, degistigi anda asagidaki tum yerlere dinamik olarak yansiyacak:

- [ ] **Impressum** - lokma.shop web sayfasi (firma adi, adres, vergi no, handelsregister, geschaeftsfuehrer)
- [ ] **Support/Kontakt sayfasi** - telefon, email, adres verileri
- [ ] **Email Footer / Signature** - Resend API uzerinden gonderilen tum emaillerdeki firma bilgileri
- [ ] **AGB** - sirket adi, adres, vergi bilgileri
- [ ] **Lexware hesap olusturma** - fatura adresi, IBAN, vergi bilgileri
- [ ] **Mobile App** - iletisim verileri, destek bilgileri

> **Tarih:** 18 Mart 2026
> **Durum:** Planlanacak - ayri oturumda implement edilecek
> **Not:** Veriler normalde aylarca degismez, ancak degistigi anda her yerde guncel olmali
