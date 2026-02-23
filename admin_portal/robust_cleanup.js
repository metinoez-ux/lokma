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
    if (!fs.existsSync(langPath)) continue;
    
    let content = fs.readFileSync(langPath, 'utf8');
    let langData = JSON.parse(content);
    let changed = false;

    // Remove from root
    for (const key of keysToFix) {
        if (key in langData) {
            delete langData[key];
            changed = true;
            console.log(`Deleted root key ${key} from ${lang}.json`);
        }
    }

    if (changed) {
        fs.writeFileSync(langPath, JSON.stringify(langData, null, 2));
    } else {
        console.log(`No changes for ${lang}.json`);
    }
}
