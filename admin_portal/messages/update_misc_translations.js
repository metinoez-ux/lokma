const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'es', 'fr', 'it', 'nl'];
const messagesDir = path.join(__dirname);

locales.forEach(locale => {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Kurye
    if (!data.Kurye) data.Kurye = {};
    const lokmaRiderMap = {
      tr: "LOKMA Kuryesi",
      de: "LOKMA Fahrer",
      en: "LOKMA Rider",
      es: "Repartidor LOKMA",
      fr: "Livreur LOKMA",
      it: "Corriere LOKMA",
      nl: "LOKMA Bezorger"
    };
    data.Kurye.lokmaRider = lokmaRiderMap[locale];

    // Partner
    if (!data.Partner) data.Partner = {};
    const esnafMap = {
      tr: "Esnaf Ortaklığı",
      de: "Händlerpartnerschaft",
      en: "Merchant Partnership",
      es: "Asociación de Comerciantes",
      fr: "Partenariat Commerçant",
      it: "Partnership Commerciale",
      nl: "Handelaarspartnerschap"
    };
    data.Partner.esnafMap = esnafMap[locale];

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated ${locale}.json`);
  }
});
