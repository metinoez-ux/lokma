const fs = require('fs');
const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/hardware/translations.ts';
let content = fs.readFileSync(path, 'utf8');

const updates = {
  de: {
    eslSub: "'Aktualisieren Sie alle Preise in mehr als 2500 Filialen in Sekundenschnelle mit einem Klick. Null Fehler, maximale Effizienz und absolute Preiskonsistenz über alle LOKMA-Kanäle hinweg.'",
    eslAdv2: "'Skalierbarkeit auf Enterprise-Niveau'",
    eslAdv2Desc: "'Verwalten Sie Tausende von Preisen in 2500+ Filialen gleichzeitig. Keine manuellen Fehler mehr und absolute Preisparität zwischen Kasse, App und Regal garantiert.'"
  },
  tr: {
    eslSub: "'Tüm fiyatlarınızı 2500\\'den fazla mağazada tek tıkla saniyeler içinde senkronize edin. Tüm LOKMA kanallarında sıfır hata, maksimum verimlilik ve mutlak fiyat tutarlılığı.'",
    eslAdv2: "'Kurumsal Ölçekte Senkronizasyon'",
    eslAdv2Desc: "'2500\\'den fazla şubedeki binlerce fiyatı aynı anda yönetin. Manuel hatalara son verin; kasa, uygulama ve raf arasında %100 fiyat tutarlılığını garanti altına alın.'"
  },
  en: {
    eslSub: "'Update all your prices across 2500+ stores in seconds with a single click. Zero errors, maximum efficiency, and absolute price parity across all LOKMA channels.'",
    eslAdv2: "'Enterprise-Scale Synchronization'",
    eslAdv2Desc: "'Manage thousands of prices across 2500+ branches simultaneously. Eliminate manual errors and guarantee 100% price parity between POS, app, and shelf.'"
  },
  fr: {
    eslSub: "'Mettez à jour tous vos prix dans plus de 2500 magasins en quelques secondes d\\'un simple clic. Zéro erreur, efficacité maximale et parité absolue des prix sur tous les canaux LOKMA.'",
    eslAdv2: "'Synchronisation à l\\'échelle de l\\'entreprise'",
    eslAdv2Desc: "'Gérez simultanément des milliers de prix dans plus de 2500 succursales. Éliminez les erreurs manuelles et garantissez une parité de prix à 100 % entre la caisse, l\\'application et le rayon.'"
  },
  es: {
    eslSub: "'Actualice todos sus precios en más de 2500 tiendas en segundos con un solo clic. Cero errores, máxima eficiencia y paridad absoluta de precios en todos los canales de LOKMA.'",
    eslAdv2: "'Sincronización a escala empresarial'",
    eslAdv2Desc: "'Gestione miles de precios en más de 2500 sucursales simultáneamente. Elimine los errores manuales y garantice el 100 % de paridad de precios entre el TPV, la aplicación y el estante.'"
  },
  it: {
    eslSub: "'Aggiorna tutti i tuoi prezzi in oltre 2500 negozi in pochi secondi con un solo clic. Zero errori, massima efficienza e assoluta parità di prezzo su tutti i canali LOKMA.'",
    eslAdv2: "'Sincronizzazione su scala aziendale'",
    eslAdv2Desc: "'Gestisci contemporaneamente migliaia di prezzi in oltre 2500 filiali. Elimina gli errori manuali e garantisci la parità di prezzo al 100% tra POS, app e scaffale.'"
  },
  nl: {
    eslSub: "'Update al uw prijzen in meer dan 2500 winkels binnen enkele seconden met één enkele klik. Nul fouten, maximale efficiëntie en absolute prijspariteit over alle LOKMA-kanalen.'",
    eslAdv2: "'Synchronisatie op bedrijfsniveau'",
    eslAdv2Desc: "'Beheer tegelijkertijd duizenden prijzen in meer dan 2500 vestigingen. Elimineer handmatige fouten en garandeer 100% prijspariteit tussen kassa, app en schap.'"
  }
};

for (const lang in updates) {
  const blockStart = content.indexOf(`  ${lang}: {`);
  if (blockStart === -1) continue;
  
  let blockEnd = content.indexOf(`  },`, blockStart);
  if (blockEnd === -1) blockEnd = content.length;

  let block = content.substring(blockStart, blockEnd);

  // Replace eslSub
  block = block.replace(/eslSub:\s*'[^']*',?/, `eslSub: ${updates[lang].eslSub},`);
  // Replace eslAdv2
  block = block.replace(/eslAdv2:\s*'[^']*',?/, `eslAdv2: ${updates[lang].eslAdv2},`);
  // Replace eslAdv2Desc
  block = block.replace(/eslAdv2Desc:\s*'[^']*',?/, `eslAdv2Desc: ${updates[lang].eslAdv2Desc},`);

  content = content.substring(0, blockStart) + block + content.substring(blockEnd);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Translations updated.');
