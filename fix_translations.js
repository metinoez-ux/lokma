const fs = require('fs');

const keys = {
  saatlik_siparis_dagilimi: {
    tr: "Saatlik Sipariş Dağılımı",
    de: "Stündliche Bestellverteilung",
    en: "Hourly Order Distribution"
  },
  gunluk_siparis_dagilimi: {
    tr: "Günlük Sipariş Dağılımı",
    de: "Tägliche Bestellverteilung",
    en: "Daily Order Distribution"
  },
  en_cok_satan_urunler: {
    tr: "En Çok Satan Ürünler",
    de: "Meistverkaufte Produkte",
    en: "Best Selling Products"
  }
};

const locales = ['tr', 'en', 'de'];

locales.forEach(locale => {
  const file = `/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/messages/${locale}.json`;
  let data = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (!data.AdminStatistics) data.AdminStatistics = {};
  if (!data.AdminBusiness) data.AdminBusiness = {};

  Object.entries(keys).forEach(([key, value]) => {
    data.AdminStatistics[key] = value[locale];
    data.AdminBusiness[key] = value[locale];
  });

  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${locale}.json`);
});
