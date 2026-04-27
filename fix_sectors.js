const fs = require('fs');
const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/hardware/translations.ts';
let content = fs.readFileSync(path, 'utf8');

const updates = {
  de: {
    sectorTitle1: "'Universal-Software'",
    sectorTitle2: "'für alle Branchen'",
    sectorSub: "'LOKMA bietet eine All-in-One-Lösung, die nativ für alle Branchen entwickelt wurde. Mit nur einem Klick passen Sie das System an Ihre Branche an. Zudem bieten wir einen nahtlosen Migrationsservice von Ihrem alten Kassensystem zu LOKMA.'"
  },
  tr: {
    sectorTitle1: "'Tüm Sektörleri Kapsayan'",
    sectorTitle2: "'Tek Bir Yazılım'",
    sectorSub: "'LOKMA, tüm işletme türleri için tek bir altyapıda çalışır. Sektörünüze özel arayüze tek tıkla geçiş yapabilirsiniz. Ayrıca eski sistemlerinizdeki ürün ve verilerinizi yeni sisteme aktarmanızda (veri göçü) birebir destek sağlıyoruz.'"
  },
  en: {
    sectorTitle1: "'Universal Software'",
    sectorTitle2: "'for Every Industry'",
    sectorSub: "'LOKMA is an all-in-one platform built natively for every industry. Switch to your specific industry mode with just one click. We also provide full migration assistance to seamlessly transfer your data from legacy POS systems to LOKMA.'"
  },
  fr: {
    sectorTitle1: "'Logiciel Universel'",
    sectorTitle2: "'pour tous les secteurs'",
    sectorSub: "'LOKMA est une solution tout-en-un conçue nativement pour chaque secteur. Basculez vers le mode spécifique à votre secteur en un seul clic. Nous vous accompagnons également dans la migration complète de votre ancien système vers LOKMA.'"
  },
  es: {
    sectorTitle1: "'Software Universal'",
    sectorTitle2: "'para todas las industrias'",
    sectorSub: "'LOKMA es una solución integral diseñada nativamente para todos los sectores. Cambie a la interfaz de su sector con un solo clic. También ofrecemos asistencia completa de migración desde su antiguo sistema a LOKMA.'"
  },
  it: {
    sectorTitle1: "'Software Universale'",
    sectorTitle2: "'per ogni settore'",
    sectorSub: "'LOKMA è una piattaforma all-in-one costruita nativamente per ogni settore. Passa alla modalità del tuo settore con un solo clic. Offriamo inoltre assistenza completa per la migrazione dei dati dal tuo vecchio sistema a LOKMA.'"
  },
  nl: {
    sectorTitle1: "'Universele Software'",
    sectorTitle2: "'voor elke branche'",
    sectorSub: "'LOKMA is een alles-in-één platform dat native is gebouwd voor elke branche. Schakel met één klik over naar uw branchespecifieke modus. We bieden ook volledige migratieondersteuning vanaf uw oude systeem naar LOKMA.'"
  }
};

for (const lang in updates) {
  const blockStart = content.indexOf(`  ${lang}: {`);
  if (blockStart === -1) continue;
  
  let blockEnd = content.indexOf(`  },`, blockStart);
  if (blockEnd === -1) blockEnd = content.length;

  let block = content.substring(blockStart, blockEnd);

  // Replace sectorTitle1
  block = block.replace(/sectorTitle1:\s*'[^']*',?/, `sectorTitle1: ${updates[lang].sectorTitle1},`);
  // Replace sectorTitle2
  block = block.replace(/sectorTitle2:\s*'[^']*',?/, `sectorTitle2: ${updates[lang].sectorTitle2},`);
  // Replace sectorSub
  block = block.replace(/sectorSub:\s*'[^']*',?/, `sectorSub: ${updates[lang].sectorSub},`);

  content = content.substring(0, blockStart) + block + content.substring(blockEnd);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Sectors updated.');
