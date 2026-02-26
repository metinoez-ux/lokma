const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'es', 'fr', 'it', 'nl'];
const messagesDir = path.join(__dirname);

// New keys to inject into the "Landing" namespace
const newTranslations = {
  tr: {
    regionLangSettings: "Bölge & Dil Ayarları",
    selectPreferences: "Tercihlerinizi seçin",
    selectLanguage: "Dil Seçin",
    regionCountry: "Bölge / Ülke",
    lokmaRider: "LOKMA Kuryesi",
    artisanPartnership: "Esnaf Ortaklığı"
  },
  de: {
    regionLangSettings: "Region & Spracheinstellungen",
    selectPreferences: "Wählen Sie Ihre Einstellungen",
    selectLanguage: "Sprache wählen",
    regionCountry: "Region / Land",
    lokmaRider: "LOKMA Fahrer",
    artisanPartnership: "Händlerpartnerschaft"
  },
  en: {
    regionLangSettings: "Region & Language Settings",
    selectPreferences: "Select your preferences",
    selectLanguage: "Select Language",
    regionCountry: "Region / Country",
    lokmaRider: "LOKMA Rider",
    artisanPartnership: "Merchant Partnership"
  },
  es: {
      regionLangSettings: "Configuración de Región e Idioma",
      selectPreferences: "Selecciona tus preferencias",
      selectLanguage: "Seleccionar Idioma",
      regionCountry: "Región / País",
      lokmaRider: "Repartidor LOKMA",
      artisanPartnership: "Asociación de Comerciantes"
  },
  fr: {
      regionLangSettings: "Paramètres de Région et de Langue",
      selectPreferences: "Sélectionnez vos préférences",
      selectLanguage: "Choisir la langue",
      regionCountry: "Région / Pays",
      lokmaRider: "Livreur LOKMA",
      artisanPartnership: "Partenariat Commerçant"
  },
  it: {
      regionLangSettings: "Impostazioni Regione e Lingua",
      selectPreferences: "Seleziona le tue preferenze",
      selectLanguage: "Seleziona Lingua",
      regionCountry: "Regione / Paese",
      lokmaRider: "Corriere LOKMA",
      artisanPartnership: "Partnership Commerciale"
  },
  nl: {
      regionLangSettings: "Regio- en Taalinstellingen",
      selectPreferences: "Selecteer uw voorkeuren",
      selectLanguage: "Selecteer Taal",
      regionCountry: "Regio / Land",
      lokmaRider: "LOKMA Bezorger",
      artisanPartnership: "Handelaarspartnerschap"
  }
};

locales.forEach(locale => {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    if (data.Landing) {
      Object.assign(data.Landing, newTranslations[locale]);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated ${locale}.json`);
    } else {
      console.warn(`No 'Landing' key found in ${locale}.json`);
    }
  } else {
    console.warn(`File not found: ${locale}.json`);
  }
});
