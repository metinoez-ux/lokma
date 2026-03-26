const fs = require('fs');
const path = require('path');

const targetFile = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

console.log('Original size:', content.length);

// 1. Fixing Theme Constraints (Responsive & Semantic Tokens)
// Scrubbing common dark mode breakers
content = content.replace(/bg-gray-700/g, 'bg-muted');
content = content.replace(/bg-gray-200/g, 'bg-accent');
content = content.replace(/text-gray-500/g, 'text-muted-foreground');
content = content.replace(/text-gray-600/g, 'text-muted-foreground');
content = content.replace(/text-gray-800/g, 'text-foreground');
content = content.replace(/border-gray-600/g, 'border-border');
content = content.replace(/border-gray-200/g, 'border-border');

// Fixing the known Responsive Constraints issue in Kanban board
// The kanban and order stats usually use strict grid-cols-5. Let's make sure it flexes.
// The code earlier showed Kanban uses: md:grid-cols-5. That's fine.
// What about the Quick Stats we just added?
// It was: grid-cols-2 md:grid-cols-3 xl:grid-cols-5 or similar.
// We will leave responsive layouts if they appear correct from visual checks earlier.

// 2. Fixing i18n Hardcoded Translations in the last chunks (Procurement etc)
content = content.replace(/' Ürünü Kaydet'/g, " ` ${t('urunu_kaydet', { defaultValue: 'Ürünü Kaydet' })}`");
content = content.replace(/' Tedarikçi Düzenle'/g, " t('tedarikci_duzenle', { defaultValue: 'Tedarikçi Düzenle' })");
content = content.replace(/' Yeni Tedarikçi Ekle'/g, " t('yeni_tedarikci_ekle', { defaultValue: 'Yeni Tedarikçi Ekle' })");
content = content.replace(/' Sipariş Düzenle'/g, " t('siparis_duzenle', { defaultValue: 'Sipariş Düzenle' })");
content = content.replace(/' Yeni Tedarik Siparişi'/g, " t('yeni_tedarik_siparisi', { defaultValue: 'Yeni Tedarik Siparişi' })");

content = content.replace(/>Firma Adı \*/g, ">{t('firma_adi', { defaultValue: 'Firma Adı *' })}");
content = content.replace(/>Vergi No \(USt-IdNr\)/g, ">{t('vergi_no', { defaultValue: 'Vergi No (USt-IdNr)' })}");
content = content.replace(/>Teslimat Süresi \(gün\)/g, ">{t('teslimat_suresi_gun', { defaultValue: 'Teslimat Süresi (gün)' })}");
content = content.replace(/>Min\. Sipariş Tutarı \(€\)/g, ">{t('min_siparis_tutari', { defaultValue: 'Min. Sipariş Tutarı (€)' })}");

content = content.replace(/' Kaydediliyor\.\.\.'/g, " t('kaydediliyor', { defaultValue: ' Kaydediliyor...' })");
content = content.replace(/' Güncelle'/g, " t('guncelle', { defaultValue: ' Güncelle' })");
content = content.replace(/' Kaydet'/g, " t('kaydet', { defaultValue: ' Kaydet' })");
content = content.replace(/' Sipariş Oluştur'/g, " t('siparis_olustur', { defaultValue: ' Sipariş Oluştur' })");

content = content.replace(/> \+ Kalem Ekle/g, "> + {t('kalem_ekle', { defaultValue: 'Kalem Ekle' })}");
content = content.replace(/> Kaldır/g, ">{t('kaldir', { defaultValue: 'Kaldır' })}");
content = content.replace(/>SKU \/ Artikelnr/g, ">{t('sku_artikelnr', { defaultValue: 'SKU / Artikelnr' })}");
content = content.replace(/>Sipariş Miktarı \*/g, ">{t('siparis_miktari', { defaultValue: 'Sipariş Miktarı *' })}");

content = content.replace(/Toplam: /g, "{t('toplam', { defaultValue: 'Toplam: ' })}");

content = content.replace(/'📥 Mal Kabulü Kaydet'/g, " '📥 ' + t('mal_kabulu_kaydet', { defaultValue: 'Mal Kabulü Kaydet'})");
content = content.replace(/>📥 Mal Kabul \(Wareneingang\)/g, ">📥 {t('mal_kabul', { defaultValue: 'Mal Kabul (Wareneingang)' })}");

fs.writeFileSync(targetFile, content, 'utf8');

console.log('Fixed theme and i18n violations successfully. New size:', content.length);
