const fs = require('fs');
const path = require('path');

const langs = ['tr', 'en', 'de', 'fr', 'it', 'nl', 'es'];
const messagesDir = path.join(__dirname, '../messages');
const namespace = 'AdminBusiness';

const newTranslations = {
    "kermes": "Kermes",
    "isletmeleryuklenirkenhataolustu": "İşletmeler yüklenirken hata oluştu.",
    "kermes_events": "Kermes Events",
    "_kermes_events_loaded": "✅ Kermes events loaded:",
    "error_loading_kermes_events": "Error loading kermes events:",
    "aramasirasindahataolustu": "Arama sırasında hata oluştu.",
    "isletmekaydedilirkenhataolustu": "İşletme kaydedilirken hata oluştu.",
    "islemsirasindahataolustu": "İşlem sırasında hata oluştu.",
    "isletmedeaktifedildi": "İşletme deaktif edildi.",
    "isletmeaktifedildi": "İşletme aktif edildi.",
    "durumguncellenirkenhataolustu": "Durum güncellenirken hata oluştu.",
    "admin_paneli": "Admin Paneli",
    "kermesyonetimi": "Kermes Yönetimi",
    "aktifkermesleriyonetin": "Aktif kermesleri yönetin:",
    "yeni_kermes_ekle": "Yeni Kermes Ekle",
    "_tuna": "🔴 TUNA",
    "_akdeniz_toros": "🏔️ Akdeniz Toros",
    "_aktif": "✅ Aktif",
    "pasif": "Pasif",
    "kermesleryukleniyor": "Kermesler yükleniyor...",
    "henuzkermesolusturulmamis": "Henüz kermes oluşturulmamış.",
    "yenikermeseklebutonunatiklayarakilk": "Yeni Kermes Ekle butonuna tıklayarak ilk kermesi oluşturun.",
    "ilkkermesiolustur": "İlk Kermesi Oluştur",
    "_kermes": "🎪 Kermes",
    "_konum": "📍 Konum",
    "_durum": "📊 Durum",
    "isimsizkermes": "İsimsiz Kermes",
    "kermesiarsivdencikar": "Kermesi Arşivden Çıkar",
    "bukermesiarsivdencikarmakistiyormusunuz": "Bu kermesi arşivden çıkarmak istiyor musunuz?",
    "kermesikalicisil": "Kermesi Kalıcı Olarak Sil",
    "dikkatbukermesikaliciolaraksilmek": "Dikkat! Bu kermesi kalıcı olarak silmek istediğinizden emin misiniz?",
    "_sil": "🗑️ Sil",
    "kermesiarsivle": "Kermesi Arşivle",
    "bukermesiarsivlemekistiyormusunuz": "Bu kermesi arşivlemek istiyor musunuz?",
    "sonraki": "Sonraki →",
    "marka": "Marka",
    "konum": "Konum",
    "puan": "Puan",
    "hizmetler": "Hizmetler",
    "durum": "Durum",
    "_toros": "⚫ TOROS",
    "ara": "Ara",
    "_temel_bilgiler": "📋 Temel Bilgiler",
    "google_verisi_aktif": "Google Verisi Aktif",
    "_adres_bilgileri": "📍 Adres Bilgileri",
    "sokak_cadde": "Sokak/Cadde",
    "posta_kodu": "Posta Kodu",
    "_almanya": "🇩🇪 Almanya",
    "_hollanda": "🇳🇱 Hollanda",
    "_fransa": "🇫🇷 Fransa",
    "_avusturya": "🇦🇹 Avusturya",
    "telefon": "Telefon",
    "e_posta": "E-posta",
    "website": "Website",
    "_hizmetler": "🛎️ Hizmetler",
    "_masa_kapasite": "🪑 Masa & Kapasite",
    "_finansal_bilgiler": "💳 Finansal Bilgiler",
    "_marka_etiketi": "🏷️ Marka Etiketi",
    "_etiketsiz": "❌ Etiketsiz",
    "_avrupa": "(Avrupa)",
    "_banka_bilgileri": "🏦 Banka Bilgileri",
    "hesap_sahibi": "Hesap Sahibi",
    "banka": "Banka",
    "_abonelik_bilgileri": "📋 Abonelik Bilgileri",
    "plan": "Plan",
    "aktif": "Aktif",
    "_deneme": "🎁 Deneme",
    "_durduruldu": "⏸ Durduruldu",
    "_fatura_durumu": "🧾 Fatura Durumu",
    "isletmeaktiflokmadagorunsun": "İşletme Aktif (Lokma'da görünsün)",
    "kermesacmakistediginizorganizasyonusecin": "Kermes açmak istediğiniz organizasyonu seçin:"
};

for (const lang of langs) {
    const filePath = path.join(messagesDir, `${lang}.json`);
    let trData = {};
    if (fs.existsSync(filePath)) {
        trData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    if (!trData[namespace]) {
        trData[namespace] = {};
    }

    for (const [key, value] of Object.entries(newTranslations)) {
        if (!trData[namespace][key]) {
            // In a real scenario we use Google Translate API for other langs,
            // here we prefix to indicate it needs translation, or just use TR
            trData[namespace][key] = lang === 'tr' ? value : `[${lang.toUpperCase()}] ${value}`;
        }
    }

    // Handle special namespace cases that were previously missed
    // The user reported "Yeni İşletme Ekle", "İşletme Yönetimi" are still hardcoded
    if (!trData[namespace]['yeni_isletme_ekle']) {
        trData[namespace]['yeni_isletme_ekle'] = lang === 'tr' ? 'Yeni İşletme Ekle' : `[${lang.toUpperCase()}] Yeni İşletme Ekle`;
    }
    if (!trData[namespace]['isletme_yonetimi']) {
        trData[namespace]['isletme_yonetimi'] = lang === 'tr' ? 'İşletme Yönetimi' : `[${lang.toUpperCase()}] İşletme Yönetimi`;
    }
    if (!trData[namespace]['tum_kayitli_isletmeleri_yonetin']) {
        trData[namespace]['tum_kayitli_isletmeleri_yonetin'] = lang === 'tr' ? 'Tüm kayıtlı işletmeleri yönetin:' : `[${lang.toUpperCase()}] Tüm kayıtlı işletmeleri yönetin:`;
    }
    if (!trData[namespace]['sektor_modulleri']) {
        trData[namespace]['sektor_modulleri'] = lang === 'tr' ? 'Sektör Modülleri' : `[${lang.toUpperCase()}] Sektör Modülleri`;
    }

    fs.writeFileSync(filePath, JSON.stringify(trData, null, 2));
    console.log(`Injected missing translations into ${lang}.json`);
}

console.log('Business page translations injected.');
