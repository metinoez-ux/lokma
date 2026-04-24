const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de'];
const data = {
  tr: {
    limitsAndFees: "Limitler ve Ücretler",
    orderLimit: "Aylık Sipariş Limiti",
    extraOrder: "Ekstra Sipariş",
    personnelLimit: "Personel Limiti",
    extraPersonnel: "Ekstra Personel",
    productLimit: "Ürün Ekleme Limiti",
    feature_posSystem: "POS Sistemi",
    feature_courierApp: "Kurye Uygulaması",
    feature_kitchenDisplaySystem: "Mutfak Ekranı (KDS)",
    feature_marketingTools: "Pazarlama Araçları",
    feature_advancedAnalytics: "Gelişmiş Analitik",
    feature_loyaltyProgram: "Sadakat Programı",
    feature_promotions: "Promosyonlar",
    feature_prioritySupport: "Öncelikli Destek",
    feature_customBranding: "Özel Markalama",
    feature_apiAccess: "API Erişimi",
    feature_unlimitedProducts: "Sınırsız Ürün",
    feature_liveCourierTracking: "Canlı Kurye Takibi",
    feature_smartScale: "Akıllı Terazi",
    feature_qrOrdering: "QR Sipariş"
  },
  en: {
    limitsAndFees: "Limits and Fees",
    orderLimit: "Monthly Order Limit",
    extraOrder: "Extra Order",
    personnelLimit: "Personnel Limit",
    extraPersonnel: "Extra Personnel",
    productLimit: "Product Limit",
    feature_posSystem: "POS System",
    feature_courierApp: "Courier App",
    feature_kitchenDisplaySystem: "Kitchen Display (KDS)",
    feature_marketingTools: "Marketing Tools",
    feature_advancedAnalytics: "Advanced Analytics",
    feature_loyaltyProgram: "Loyalty Program",
    feature_promotions: "Promotions",
    feature_prioritySupport: "Priority Support",
    feature_customBranding: "Custom Branding",
    feature_apiAccess: "API Access",
    feature_unlimitedProducts: "Unlimited Products",
    feature_liveCourierTracking: "Live Courier Tracking",
    feature_smartScale: "Smart Scale",
    feature_qrOrdering: "QR Ordering"
  },
  de: {
    limitsAndFees: "Limits und Gebühren",
    orderLimit: "Monatliches Bestelllimit",
    extraOrder: "Zusätzliche Bestellung",
    personnelLimit: "Personal Limit",
    extraPersonnel: "Zusätzliches Personal",
    productLimit: "Produktlimit",
    feature_posSystem: "Kassensystem",
    feature_courierApp: "Kurier-App",
    feature_kitchenDisplaySystem: "Küchen-Display (KDS)",
    feature_marketingTools: "Marketing-Tools",
    feature_advancedAnalytics: "Erweiterte Analysen",
    feature_loyaltyProgram: "Treueprogramm",
    feature_promotions: "Aktionen",
    feature_prioritySupport: "Premium-Support",
    feature_customBranding: "Eigenes Branding",
    feature_apiAccess: "API-Zugang",
    feature_unlimitedProducts: "Unbegrenzte Produkte",
    feature_liveCourierTracking: "Live-Kurier-Tracking",
    feature_smartScale: "Smarte Waage",
    feature_qrOrdering: "QR-Bestellung"
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
