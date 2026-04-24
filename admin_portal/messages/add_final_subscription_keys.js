const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de'];
const data = {
  tr: {
    yourCurrentPlan: "Mevcut Planınız",
    pendingTransition: "Bekleyen Geçiş",
    selectThisPlan: "Bu Planı Seç",
    planChangeFailed: "Plan değişikliği ayarlanamadı: "
  },
  en: {
    yourCurrentPlan: "Your Current Plan",
    pendingTransition: "Pending Transition",
    selectThisPlan: "Select This Plan",
    planChangeFailed: "Failed to schedule plan change: "
  },
  de: {
    yourCurrentPlan: "Ihr Aktueller Plan",
    pendingTransition: "Ausstehender Wechsel",
    selectThisPlan: "Diesen Plan Auswählen",
    planChangeFailed: "Planänderung fehlgeschlagen: "
  }
};

locales.forEach(locale => {
  const file = path.join(__dirname, `${locale}.json`);
  if (fs.existsSync(file)) {
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!content.AdminBusiness) content.AdminBusiness = {};
    Object.assign(content.AdminBusiness, data[locale]);
    fs.writeFileSync(file, JSON.stringify(content, null, 2));
    console.log(`Updated ${locale}.json`);
  }
});
