const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'nl', 'it', 'es', 'fr'];
const messagesDir = path.join(__dirname, 'admin_portal/messages');

const newKeys = {
  "tr": {
    "yonetici_rol": "Yönetici",
    "surucu_rol": "Sürücü / Kurye",
    "garson_rol": "Garson",
    "personel_rol": "Personel",
    "belirsiz_rol": "Belirsiz Rol"
  },
  "en": {
    "yonetici_rol": "Manager",
    "surucu_rol": "Driver / Courier",
    "garson_rol": "Waiter",
    "personel_rol": "Staff",
    "belirsiz_rol": "Unknown Role"
  },
  "de": {
    "yonetici_rol": "Manager",
    "surucu_rol": "Fahrer / Kurier",
    "garson_rol": "Kellner",
    "personel_rol": "Personal",
    "belirsiz_rol": "Unbekannte Rolle"
  },
  "nl": {
    "yonetici_rol": "Manager",
    "surucu_rol": "Chauffeur / Koerier",
    "garson_rol": "Ober",
    "personel_rol": "Personeel",
    "belirsiz_rol": "Onbekende rol"
  },
  "it": {
    "yonetici_rol": "Manager",
    "surucu_rol": "Autista / Corriere",
    "garson_rol": "Cameriere",
    "personel_rol": "Personale",
    "belirsiz_rol": "Ruolo sconosciuto"
  },
  "es": {
    "yonetici_rol": "Gerente",
    "surucu_rol": "Conductor / Mensajero",
    "garson_rol": "Camarero",
    "personel_rol": "Personal",
    "belirsiz_rol": "Rol desconocido"
  },
  "fr": {
    "yonetici_rol": "Manager",
    "surucu_rol": "Chauffeur / Livreur",
    "garson_rol": "Serveur",
    "personel_rol": "Personnel",
    "belirsiz_rol": "Rôle inconnu"
  }
};

for (const locale of locales) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${locale}, file not found.`);
    continue;
  }
  
  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e);
    continue;
  }

  if (!data.AdminBusiness) {
    data.AdminBusiness = {};
  }

  const keys = newKeys[locale] || newKeys['en'];
  let modified = false;

  for (const [key, value] of Object.entries(keys)) {
    if (!data.AdminBusiness[key]) {
      data.AdminBusiness[key] = value;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated ${locale}.json`);
  } else {
    console.log(`No changes needed for ${locale}.json`);
  }
}
