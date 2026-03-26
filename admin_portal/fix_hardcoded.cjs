const fs = require('fs');
const filePath = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';

let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  '>Fiyat (€)<': '>{t(\'price_eur\') || "Fiyat (€)"}<',
  '>Kg<': '>{t(\'kg\') || "Kg"}<',
  '>kg<': '>{t(\'kg\') || "kg"}<',
  '>Durum Filtresi:<': '>{t(\'status_filter\') || "Durum Filtresi:"}<',
  '>Durum<': '>{t(\'status\') || "Durum"}<',
  '>Stok<': '>{t(\'stock\') || "Stok"}<',
  '>SKU<': '>{t(\'sku\') || "SKU"}<',
  '>SKU (ID)<': '>{t(\'sku_id\') || "SKU (ID)"}<',
  '>Fiyat (Netto / Brutto)<': '>{t(\'price_netto_brutto\') || "Fiyat (Netto / Brutto)"}<',
  '>KDV<': '>{t(\'tax_vat\') || "KDV"}<',
  '>Netto (€)<': '>{t(\'netto_eur\') || "Netto (€)"}<',
  '>Brutto (€)<': '>{t(\'brutto_eur\') || "Brutto (€)"}<',
  '>Herkunft / Menşe<': '>{t(\'origin\') || "Herkunft / Menşe"}<',
  '>SKU / Master ID<': '>{t(\'sku_master_id\') || "SKU / Master ID"}<',
  '>Gewicht (Ağırlık)<': '>{t(\'weight\') || "Gewicht (Ağırlık)"}<',
  '>Packung (Ambalaj)<': '>{t(\'packaging\') || "Packung (Ambalaj)"}<',
  '>Gehäusetemperatur (Saklama)<': '>{t(\'storage_temp\') || "Gehäusetemperatur (Saklama)"}<',
  '>Stok Durumu (App)<': '>{t(\'stock_status_app\') || "Stok Durumu (App)"}<',
  '>Seçenek Grupları (Opsiyonlar/Extras)<': '>{t(\'option_groups\') || "Seçenek Grupları (Opsiyonlar/Extras)"}<',
  '>(arama sonuçları)<': '>({t(\'search_results\') || "arama sonuçları"})<',
  '>Sayfa başı:<': '>{t(\'per_page\') || "Sayfa başı:"}<',
  '>için sonuç bulunamadı.<': '>{t(\'no_results_for\') || "için sonuç bulunamadı."}<',
  '>Plan<': '>{t(\'plan\') || "Plan"}<',
  '>Plan Ozellikleri<': '>{t(\'plan_features\') || "Plan Özellikleri"}<',
  '>Tedarikçi *<': '>{t(\'supplier\') || "Tedarikçi"} *<',
  '>Adet (Stück)<': '>{t(\'pieces\') || "Adet (Stück)"}<',
  '>Kutu (Karton)<': '>{t(\'box_carton\') || "Kutu (Karton)"}<',
  '>Parti / Charge No<': '>{t(\'batch_no\') || "Parti / Charge No"}<',
  '>Son Kullanma (MHD)<': '>{t(\'expiration_date\') || "Son Kullanma (MHD)"}<',
  '>E-Posta<': '>{t(\'email\') || "E-Posta"}<'
};

let replaceCount = 0;
for (const [search, replace] of Object.entries(replacements)) {
  // Global replacement
  const regex = new RegExp(search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  const initialLength = content.length;
  content = content.replace(regex, replace);
  if (content.length !== initialLength) {
    replaceCount++;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Replaced ${replaceCount} explicit string types in page.tsx`);
