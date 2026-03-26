const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '../messages');
const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));

const trMap = {
  tr: "Masa (Ön Sipariş)",
  de: "Tisch (Vorbestellung)",
  en: "Dine-in (Pre-order)",
  nl: "Tafel (Vooraf besteld)",
  es: "Mesa (Reserva)",
  it: "Tavolo (Pre-ordine)",
  fr: "Table (Précommande)"
};

for (const file of files) {
  const lang = file.split('.')[0];
  const filePath = path.join(messagesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!data.AdminPortal) data.AdminPortal = {};
  if (!data.AdminPortal.Orders) data.AdminPortal.Orders = {};
  
  if (!data.AdminPortal.Orders.type_dineInPreorder) {
    data.AdminPortal.Orders.type_dineInPreorder = trMap[lang] || trMap.en;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Updated ${file} with type_dineInPreorder`);
  } else {
    console.log(`${file} already has type_dineInPreorder`);
  }
}
