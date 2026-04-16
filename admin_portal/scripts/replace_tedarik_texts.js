const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/app/[locale]/admin/kermes/[id]/KermesTedarikTab.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes("useTranslations")) {
  content = content.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';\nimport { useTranslations } from 'next-intl';");
}

// Add hook
if (!content.includes("const t = useTranslations('kermes');")) {
  content = content.replace("export default function KermesTedarikTab({ kermesId, adminUid, kermesData }: KermesTedarikTabProps) {", "export default function KermesTedarikTab({ kermesId, adminUid, kermesData }: KermesTedarikTabProps) {\n  const t = useTranslations('kermes');");
}

content = content.replace(/>Malzeme Tedarik ve Kiler Y.netimi</g, ">{t('kermes_supply_management_title')}<");
content = content.replace(/'Malzeme Tedarik ve Kiler Y.netimi'/g, "t('kermes_supply_management_title')");

content = content.replace(/>Kategori Tan.mlar.</g, ">{t('kermes_supply_category_defs')}<");
content = content.replace(/'Kategori Tan.mlar.'/g, "t('kermes_supply_category_defs')");

content = content.replace(/>Sisteme yeni tedarik kategorileri \(.*\) ekl.*/g, ">{t('kermes_supply_category_desc')}<");

content = content.replace(/placeholder="Kategori Ad."/g, "placeholder={t('kermes_supply_category_name')}");
content = content.replace(/>Kategori Ekle</g, ">{t('kermes_supply_add_category')}<");
content = content.replace(/placeholder="Yeni Malzeme\.\.\."/g, "placeholder={t('kermes_supply_new_item')}");
content = content.replace(/>Ekle</g, ">{t('kermes_supply_add_btn')}<");
content = content.replace(/>Canl. İhtiya. Talepleri</g, ">{t('kermes_supply_live_requests')}<");
content = content.replace(/>Sil</g, ">{t('kermes_supply_delete')}<");
content = content.replace(/>Yola Ç.kart</g, ">{t('kermes_supply_dispatch')}<");
content = content.replace(/>Tamamland. İşaretle</g, ">{t('kermes_supply_mark_completed')}<");

fs.writeFileSync(file, content);
console.log("Updated TSX translations");

