const fs = require('fs');

const keysToFix = [
    "isletme", "marka", "tur", "konum", "puan", "hizmetler", "temel_bilgiler",
    "adresBilgileri", "sokakCadde", "postaKodu", "sehir", "ulke", "paraBirimi",
    "iletisim", "telefon", "eposta", "website", "teslimat", "gelAl", "yerinde",
    "rezervasyon", "bankaBilgileri", "banka", "abonelikBilgileri", "plan",
    "deneme", "durduruldu", "anonim", "isletmeAktifLokmadaGorunsun", "admin_paneli"
];

const LANGUAGES = ['de', 'en', 'fr', 'it', 'es'];

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    let changed = false;

    for (const key of keysToFix) {
        if (typeof langData[key] === 'object') {
            delete langData[key];
            changed = true;
            console.log(`Deleted object key ${key} in ${lang}.json`);
        }
    }

    if (changed) {
        fs.writeFileSync(langPath, JSON.stringify(langData, null, 2));
    }
}
