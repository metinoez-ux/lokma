const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de'];
const data = {
  tr: {
    currentPlan: "Mevcut Plan",
    recommended: "Önerilen",
    free: "Ücretsiz",
    perMonth: "/ay",
    confirmPlanChange: "{planName} planına geçiş yapmak istediğinize emin misiniz?\\n\\nDeğişiklik önümüzdeki ayın ilk günü aktif olacaktır.",
    planChangeScheduled: "Plan değişikliği planlandı. {date} tarihinde aktif olacak."
  },
  en: {
    currentPlan: "Current Plan",
    recommended: "Recommended",
    free: "Free",
    perMonth: "/mo",
    confirmPlanChange: "Are you sure you want to switch to the {planName} plan?\\n\\nThe change will be effective on the first day of the next month.",
    planChangeScheduled: "Plan change scheduled. It will be active on {date}."
  },
  de: {
    currentPlan: "Aktueller Plan",
    recommended: "Empfohlen",
    free: "Kostenlos",
    perMonth: "/monat",
    confirmPlanChange: "Sind Sie sicher, dass Sie zum Plan {planName} wechseln möchten?\\n\\nDie Änderung wird am ersten Tag des nächsten Monats wirksam.",
    planChangeScheduled: "Planänderung geplant. Sie wird am {date} aktiv."
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
