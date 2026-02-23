const fs = require('fs');

const keysToFix = {
    "isletme": "İşletme",
    "marka": "Marka",
    "tur": "Tür",
    "konum": "Konum",
    "puan": "Puan",
    "hizmetler": "Hizmetler",
    "temel_bilgiler": "Temel Bilgiler",
    "adresBilgileri": "Adres Bilgileri",
    "sokakCadde": "Sokak/Cadde",
    "postaKodu": "Posta Kodu",
    "sehir": "Şehir",
    "ulke": "Ülke",
    "paraBirimi": "Para Birimi",
    "iletisim": "İletişim",
    "telefon": "Telefon",
    "eposta": "E-posta",
    "website": "Web Sitesi",
    "teslimat": "Teslimat",
    "gelAl": "Gel Al",
    "yerinde": "Yerinde",
    "rezervasyon": "Rezervasyon",
    "bankaBilgileri": "Banka Bilgileri",
    "banka": "Banka",
    "abonelikBilgileri": "Abonelik Bilgileri",
    "plan": "Plan",
    "deneme": "Deneme",
    "durduruldu": "Durduruldu",
    "anonim": "Anonim",
    "isletmeAktifLokmadaGorunsun": "İşletme Aktif (Lokma'da Görünsün)",
    "admin_paneli": "Admin Paneli"
};

const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    if (!fs.existsSync(langPath)) continue;
    
    let content = fs.readFileSync(langPath, 'utf8');
    let langData = JSON.parse(content);
    let changed = false;

    // Remove these keys from the root level (whether string or object)
    for (const key of Object.keys(keysToFix)) {
        if (Object.prototype.hasOwnProperty.call(langData, key)) {
            delete langData[key];
            changed = true;
            console.log(`Deleted root key [${key}] from ${lang}.json`);
        }
    }

    // Add them to AdminBusiness in tr.json
    if (lang === 'tr') {
        if (!langData["AdminBusiness"]) langData["AdminBusiness"] = {};
        for (const [k, v] of Object.entries(keysToFix)) {
            if (!langData["AdminBusiness"][k]) {
                langData["AdminBusiness"][k] = v;
                changed = true;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(langPath, JSON.stringify(langData, null, 2));
        console.log(`Saved fixes for ${lang}.json`);
    }
}
