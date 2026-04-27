const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'nl', 'it', 'es', 'fr'];
const messagesDir = path.join(__dirname, 'admin_portal/messages');

const newKeys = {
  "tr": {
    "sertifikaGecmisi": "Sertifika İşlem Geçmişi",
    "sertifikasini": "sertifikasını",
    "ekledi": "ekledi",
    "kaldirdi": "kaldırdı"
  },
  "en": {
    "sertifikaGecmisi": "Certificate Action History",
    "sertifikasini": "certificate",
    "ekledi": "added",
    "kaldirdi": "removed"
  },
  "de": {
    "sertifikaGecmisi": "Zertifikat-Aktionsverlauf",
    "sertifikasini": "Zertifikat",
    "ekledi": "hinzugefügt",
    "kaldirdi": "entfernt"
  },
  "nl": {
    "sertifikaGecmisi": "Geschiedenis van certificaatacties",
    "sertifikasini": "certificaat",
    "ekledi": "toegevoegd",
    "kaldirdi": "verwijderd"
  },
  "it": {
    "sertifikaGecmisi": "Cronologia delle azioni sui certificati",
    "sertifikasini": "certificato",
    "ekledi": "aggiunto",
    "kaldirdi": "rimosso"
  },
  "es": {
    "sertifikaGecmisi": "Historial de acciones de certificados",
    "sertifikasini": "certificado",
    "ekledi": "añadido",
    "kaldirdi": "eliminado"
  },
  "fr": {
    "sertifikaGecmisi": "Historique des actions de certificat",
    "sertifikasini": "certificat",
    "ekledi": "ajouté",
    "kaldirdi": "supprimé"
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
