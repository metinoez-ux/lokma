const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'es', 'fr', 'it'];
const prefixMap = {
  tr: "Sipariş",
  en: "Order",
  de: "Bestellung",
  es: "Pedido",
  fr: "Commande",
  it: "Ordine"
};

const messagesDir = path.join(__dirname, '.');

locales.forEach(locale => {
    const filePath = path.join(messagesDir, `${locale}.json`);
    let data = require(filePath);
    
    if (data.PushNotifications) {
        data.PushNotifications.orderPrefix = prefixMap[locale];
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Added orderPrefix to ${locale}.json`);
    } else {
        console.log(`PushNotifications missing in ${locale}.json`);
    }
});
