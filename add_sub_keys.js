const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'es', 'fr', 'it', 'nl'];
const messagesDir = path.join(__dirname, 'admin_portal/messages');

const translations = {
  tr: {
    "activePlan": "Aktif Plan",
    "pendingPlanChange": "Bekleyen Plan Değişikliği",
    "planTransitionInfo": "planına geçişiniz onaylandı.",
    "dateWillBeActive": "tarihinde aktif olacaktır.",
    "nextMonthFirstDay": "Gelecek ayın ilk günü",
    "freePlanTitle": "Ücretsiz Planlar",
    "premiumPlansTitle": "Premium Planlar",
    "showMoreFeatures": "Daha Fazla Özellik Göster",
    "feature_campaigns": "Kampanyalar",
    "feature_couponSystem": "Kupon Sistemi",
    "feature_delivery": "Teslimat",
    "feature_referralSystem": "Referans Sistemi",
    "feature_clickAndCollect": "Gel-Al (Tıkla & Al)",
    "feature_marketing": "Pazarlama Araçları",
    "feature_onlinePayment": "Online Ödeme",
    "feature_staffShiftTracking": "Personel & Vardiya Takibi",
    "feature_sponsoredProducts": "Sponsorlu Ürünler",
    "feature_firstOrderDiscount": "İlk Sipariş İndirimi",
    "feature_accountingIntegration": "Muhasebe Entegrasyonu",
    "feature_scaleIntegration": "Akıllı Terazi Entegrasyonu",
    "feature_posIntegration": "Yazarkasa (POS) Entegrasyonu",
    "feature_donationRoundUp": "Bağış & Küsürat Yuvarlama",
    "feature_basicStatsOnly": "Temel İstatistikler",
    "confirmPlanChange": "{planName} planına geçişi onaylıyor musunuz?",
    "planChangeScheduled": "Plan geçişiniz onaylandı. Geçiş tarihi: {date}",
    "planChangeFailed": "İşlem sırasında hata oluştu: ",
    "yourCurrentPlan": "Mevcut Planınız",
    "pendingTransition": "Bekleyen Geçiş",
    "selectThisPlan": "Bu Planı Seç",
    "currentPlan": "Mevcut Plan",
    "recommended": "Önerilen",
    "free": "Ücretsiz",
    "perMonth": "/ay",
    "limitsAndFees": "Limitler ve Ek Ücretler",
    "orderLimit": "Sipariş Limiti (Aylık)",
    "extraOrder": "Ekstra Sipariş",
    "personnelLimit": "Personel Limiti",
    "extraPersonnel": "Ekstra Personel",
    "productLimit": "Ürün Limiti"
  },
  en: {
    "activePlan": "Active Plan",
    "pendingPlanChange": "Pending Plan Change",
    "planTransitionInfo": "plan transition approved.",
    "dateWillBeActive": "will be active on this date.",
    "nextMonthFirstDay": "First day of next month",
    "freePlanTitle": "Free Plans",
    "premiumPlansTitle": "Premium Plans",
    "showMoreFeatures": "Show More Features",
    "feature_campaigns": "Campaigns",
    "feature_couponSystem": "Coupon System",
    "feature_delivery": "Delivery",
    "feature_referralSystem": "Referral System",
    "feature_clickAndCollect": "Click & Collect",
    "feature_marketing": "Marketing Tools",
    "feature_onlinePayment": "Online Payment",
    "feature_staffShiftTracking": "Staff Shift Tracking",
    "feature_sponsoredProducts": "Sponsored Products",
    "feature_firstOrderDiscount": "First Order Discount",
    "feature_accountingIntegration": "Accounting Integration",
    "feature_scaleIntegration": "Smart Scale Integration",
    "feature_posIntegration": "POS Integration",
    "feature_donationRoundUp": "Donation Round-Up",
    "feature_basicStatsOnly": "Basic Statistics",
    "confirmPlanChange": "Do you confirm transition to {planName} plan?",
    "planChangeScheduled": "Plan transition scheduled for {date}.",
    "planChangeFailed": "An error occurred: ",
    "yourCurrentPlan": "Your Current Plan",
    "pendingTransition": "Pending Transition",
    "selectThisPlan": "Select This Plan",
    "currentPlan": "Current Plan",
    "recommended": "Recommended",
    "free": "Free",
    "perMonth": "/month",
    "limitsAndFees": "Limits and Fees",
    "orderLimit": "Order Limit",
    "extraOrder": "Extra Order",
    "personnelLimit": "Staff Limit",
    "extraPersonnel": "Extra Staff",
    "productLimit": "Product Limit"
  },
  de: {
    "activePlan": "Aktiver Plan",
    "pendingPlanChange": "Ausstehender Planwechsel",
    "planTransitionInfo": "Wechsel in den Plan bestätigt.",
    "dateWillBeActive": "wird an diesem Datum aktiv.",
    "nextMonthFirstDay": "Erster Tag des nächsten Monats",
    "freePlanTitle": "Kostenlose Pläne",
    "premiumPlansTitle": "Premium-Pläne",
    "showMoreFeatures": "Weitere Funktionen anzeigen",
    "feature_campaigns": "Kampagnen",
    "feature_couponSystem": "Gutscheinsystem",
    "feature_delivery": "Lieferung",
    "feature_referralSystem": "Empfehlungssystem",
    "feature_clickAndCollect": "Click & Collect",
    "feature_marketing": "Marketing-Tools",
    "feature_onlinePayment": "Online-Zahlung",
    "feature_staffShiftTracking": "Personal- & Schichtverfolgung",
    "feature_sponsoredProducts": "Gesponserte Produkte",
    "feature_firstOrderDiscount": "Neukundenrabatt",
    "feature_accountingIntegration": "Buchhaltungsintegration",
    "feature_scaleIntegration": "Waagen-Integration",
    "feature_posIntegration": "Kassen-Integration (POS)",
    "feature_donationRoundUp": "Spenden & Aufrunden",
    "feature_basicStatsOnly": "Grundlegende Statistiken",
    "confirmPlanChange": "Bestätigen Sie den Wechsel zum Plan {planName}?",
    "planChangeScheduled": "Planwechsel geplant für {date}.",
    "planChangeFailed": "Es ist ein Fehler aufgetreten: ",
    "yourCurrentPlan": "Ihr aktueller Plan",
    "pendingTransition": "Ausstehender Wechsel",
    "selectThisPlan": "Diesen Plan wählen",
    "currentPlan": "Aktueller Plan",
    "recommended": "Empfohlen",
    "free": "Kostenlos",
    "perMonth": "/Monat",
    "limitsAndFees": "Limits & Gebühren",
    "orderLimit": "Bestelllimit",
    "extraOrder": "Zusätzliche Bestellung",
    "personnelLimit": "Personal-Limit",
    "extraPersonnel": "Zusätzliches Personal",
    "productLimit": "Produktlimit"
  }
};

// Use English as fallback for missing locales
['es', 'fr', 'it', 'nl'].forEach(loc => {
  translations[loc] = translations.en;
});

locales.forEach(loc => {
  const filePath = path.join(messagesDir, `${loc}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!data.AdminBusiness) {
      data.AdminBusiness = {};
    }
    
    Object.keys(translations[loc]).forEach(key => {
      data.AdminBusiness[key] = translations[loc][key];
    });
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated ${loc}.json`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
