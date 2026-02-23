const fs = require('fs');
const tr = JSON.parse(fs.readFileSync('messages/tr.json', 'utf8'));

const newKeys = {
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

let added = 0;
// Note: assuming flat structure or at least checking root level since that's how tr.json seems to work.
// We'll put them in the root namespace if they don't exist.
for (const [key, value] of Object.entries(newKeys)) {
    if (!tr[key]) {
        tr[key] = value;
        added++;
        console.log(`Added: ${key}`);
    }
}

if (added > 0) {
    fs.writeFileSync('messages/tr.json', JSON.stringify(tr, null, 2));
    console.log(`Updated tr.json with ${added} new keys.`);
} else {
    console.log('No new keys needed.');
}
