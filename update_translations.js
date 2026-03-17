const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'mobile_app', 'assets', 'translations');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const trMap = {
  en: { courier: "Courier", business: "Business", delivery: "Delivery" },
  tr: { courier: "Kurye", business: "İşletme", delivery: "Teslimat" },
  de: { courier: "Kurier", business: "Geschäft", delivery: "Lieferung" },
  fr: { courier: "Livreur", business: "Commerce", delivery: "Livraison" },
  es: { courier: "Repartidor", business: "Negocio", delivery: "Entrega" },
  it: { courier: "Corriere", business: "Negozio", delivery: "Consegna" },
  nl: { courier: "Koerier", business: "Bedrijf", delivery: "Bezorging" }
};

for (const file of files) {
  const lang = path.basename(file, '.json');
  const filePath = path.join(localesDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!data.orders) {
      data.orders = {};
    }
    
    // Add missing keys
    const texts = trMap[lang] || trMap['en'];
    data.orders.courier = texts.courier;
    data.orders.business = texts.business;
    data.orders.delivery = texts.delivery;
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log('Updated ' + file);
  } catch(e) {
    console.error('Error on ' + file, e);
  }
}
