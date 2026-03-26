const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'admin_portal/messages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('updated'));

const keys = {
  tr: {
    rc_on_siparis_odeme: "Ön Sipariş Ödeme Zorunluluğu",
    rc_on_siparis_odeme_aciklama: "Müşterilerin ön siparişli rezervasyonlarda ödemeyi online olarak yapması zorunlu olsun mu?",
    rc_odeme_zorunlu: "Zorunlu (Online Kart)",
    rc_odeme_opsiyonel: "Opsiyonel (Mekanda Ödeme)"
  },
  de: {
    rc_on_siparis_odeme: "Zahlungspflicht bei Vorbestellungen",
    rc_on_siparis_odeme_aciklama: "Sollen Kunden bei Vorbestellungen für Reservierungen zwingend online bezahlen?",
    rc_odeme_zorunlu: "Zwingend (Online-Zahlung)",
    rc_odeme_opsiyonel: "Optional (Zahlung vor Ort)"
  },
  en: {
    rc_on_siparis_odeme: "Mandatory Payment for Pre-orders",
    rc_on_siparis_odeme_aciklama: "Should customers be required to pay online for reservations with pre-orders?",
    rc_odeme_zorunlu: "Mandatory (Online Payment)",
    rc_odeme_opsiyonel: "Optional (Pay at Venue)"
  }
};

for (const file of files) {
  const lang = file.split('.')[0];
  const translations = keys[lang] || keys.en;
  
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (data.AdminBusinessDetail) {
    Object.assign(data.AdminBusinessDetail, translations);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
}
