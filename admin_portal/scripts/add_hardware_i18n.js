const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de'];
const translations = {
  tr: {
    "productSize": "Ürün Boyutu",
    "screenSize": "Ekran Boyutu",
    "productWeight": "Ürün Ağırlığı",
    "enduranceTime": "Pil Ömrü (Dayanıklılık)",
    "displayColor": "Renk Kapasitesi",
    "resolution": "Çözünürlük",
    "enduranceInfo": "5 Yıl (Günde 5 güncelleme ile)",
    "techDetails": "Teknik Detaylar",
    "batteryInfoTitle": "Pil Ömrü (Dayanıklılık) Hakkında Bilgi",
    "batteryInfoDesc": "ESL cihazlarında pil bittiğinde cihaz çöp olmaz veya kullanılamaz hale gelmez. Bu cihazlar standart Lityum Düğme Pil (genelde CR2450) kullanır. Pil ömrü dolduğunda kapağı açılarak pil çok düşük bir maliyetle saniyeler içinde yenilenir ve cihaz 5 yıl daha sorunsuz çalışmaya devam eder.",
    "returnToOrder": "Siparişe Dön",
    "rentOr": "veya {price} / ay kiralama"
  },
  en: {
    "productSize": "Product Size",
    "screenSize": "Screen Size",
    "productWeight": "Product Weight",
    "enduranceTime": "Endurance Time (Battery)",
    "displayColor": "Display Color",
    "resolution": "Resolution",
    "enduranceInfo": "5 Years (with 5 updates/day)",
    "techDetails": "Technical Details",
    "batteryInfoTitle": "About Battery Life (Endurance)",
    "batteryInfoDesc": "ESL devices do not become useless when the battery dies. They use standard Lithium Coin Batteries (usually CR2450). When the battery life ends, the back cover is opened and the battery is replaced in seconds at a very low cost, continuing to work smoothly for another 5 years.",
    "returnToOrder": "Return to Order",
    "rentOr": "or {price} / month rent"
  },
  de: {
    "productSize": "Produktgröße",
    "screenSize": "Bildschirmgröße",
    "productWeight": "Produktgewicht",
    "enduranceTime": "Batterielebensdauer (Ausdauer)",
    "displayColor": "Anzeigefarbe",
    "resolution": "Auflösung",
    "enduranceInfo": "5 Jahre (bei 5 Updates/Tag)",
    "techDetails": "Technische Details",
    "batteryInfoTitle": "Über die Batterielebensdauer",
    "batteryInfoDesc": "ESL-Geräte werden nicht unbrauchbar, wenn die Batterie leer ist. Sie verwenden Standard-Lithium-Knopfzellen (meist CR2450). Wenn die Batterie leer ist, wird die hintere Abdeckung geöffnet und die Batterie in Sekundenschnelle kostengünstig ausgetauscht, sodass das Gerät weitere 5 Jahre problemlos funktioniert.",
    "returnToOrder": "Zurück zur Bestellung",
    "rentOr": "oder {price} / Monat mieten"
  }
};

for (const locale of locales) {
  const filePath = path.join('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/messages', `${locale}.json`);
  if (fs.existsSync(filePath)) {
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.HardwareTab) {
      data.HardwareTab = {};
    }
    data.HardwareTab = { ...data.HardwareTab, ...translations[locale] };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Updated ${locale}.json`);
  }
}
