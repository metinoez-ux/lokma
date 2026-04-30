const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'admin_portal', 'messages');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // A1: Remove emoji from i_sletme_performansi
  if (data.i_sletme_performansi && data.i_sletme_performansi.includes('📈')) {
    data.i_sletme_performansi = data.i_sletme_performansi.replace(/📈\s*/, '');
  }

  // A2: Add bugunku_ciro
  if (!data.bugunku_ciro) {
    if (file === 'tr.json') data.bugunku_ciro = "Bugünkü Ciro";
    else if (file === 'de.json') data.bugunku_ciro = "Tagesumsatz";
    else if (file === 'en.json') data.bugunku_ciro = "Today's Revenue";
    else if (file === 'nl.json') data.bugunku_ciro = "Dagomzet";
    else if (file === 'fr.json') data.bugunku_ciro = "Recette du jour";
    else if (file === 'it.json') data.bugunku_ciro = "Incasso Odierno";
    else if (file === 'es.json') data.bugunku_ciro = "Ingresos de hoy";
    else data.bugunku_ciro = "Bugünkü Ciro";
  }

  // A3: Add kermesStaff to AdminKermesDetail
  if (!data.AdminKermesDetail) {
    data.AdminKermesDetail = {};
  }
  if (!data.AdminKermesDetail.kermesStaff) {
    if (file === 'tr.json') data.AdminKermesDetail.kermesStaff = "Kermes Personeli";
    else if (file === 'de.json') data.AdminKermesDetail.kermesStaff = "Kermes-Personal";
    else if (file === 'en.json') data.AdminKermesDetail.kermesStaff = "Kermes Staff";
    else if (file === 'nl.json') data.AdminKermesDetail.kermesStaff = "Kermes Personeel";
    else if (file === 'fr.json') data.AdminKermesDetail.kermesStaff = "Personnel Kermes";
    else if (file === 'it.json') data.AdminKermesDetail.kermesStaff = "Personale Kermes";
    else if (file === 'es.json') data.AdminKermesDetail.kermesStaff = "Personal Kermes";
    else data.AdminKermesDetail.kermesStaff = "Kermes Personeli";
  }
  
  // A2: Add aktif_siparisler
  if (!data.aktif_siparisler) {
    if (file === 'tr.json') data.aktif_siparisler = "Aktif Siparişler";
    else if (file === 'de.json') data.aktif_siparisler = "Aktive Bestellungen";
    else if (file === 'en.json') data.aktif_siparisler = "Active Orders";
    else if (file === 'nl.json') data.aktif_siparisler = "Actieve Bestellingen";
    else if (file === 'fr.json') data.aktif_siparisler = "Commandes Actives";
    else if (file === 'it.json') data.aktif_siparisler = "Ordini Attivi";
    else if (file === 'es.json') data.aktif_siparisler = "Pedidos Activos";
    else data.aktif_siparisler = "Aktif Siparişler";
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

console.log("Translations updated!");
