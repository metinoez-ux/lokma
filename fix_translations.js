const fs = require('fs');

const updateHardwareTranslations = () => {
  const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/hardware/translations.ts';
  let content = fs.readFileSync(path, 'utf8');

  const updates = {
    de: {
      eslSub: "'Aktualisieren Sie Tausende von Preisen in Sekundenschnelle mit einem Klick. Ob 2.500 oder 10.000 verschiedene Artikel in Ihrem Geschäft – die Preise werden sofort synchronisiert. Null Fehler, maximale Effizienz.'",
      eslAdv2: "'Unbegrenzte Artikelsynchronisation'",
      eslAdv2Desc: "'Egal ob 2.500 oder 10.000 Artikel, verwalten Sie alle Preise in Ihrem Geschäft gleichzeitig. Eliminieren Sie manuelle Fehler und garantieren Sie 100 % Preisparität zwischen Kasse, App und Regal.'"
    },
    tr: {
      eslSub: "'Mağazanızdaki binlerce fiyatı tek tıkla saniyeler içinde güncelleyin. İster 2.500 ister 10.000 çeşit ürününüz olsun, fiyatlar anında senkronize olur. Sıfır hata, maksimum verimlilik.'",
      eslAdv2: "'Sınırsız Ürün Senkronizasyonu'",
      eslAdv2Desc: "'Mağazanızda 2.500 veya 10.000 ürün olması fark etmez, tüm fiyatları tek seferde yönetin. Manuel hataları ortadan kaldırın; kasa, uygulama ve raf arasında %100 fiyat tutarlılığını garanti altına alın.'"
    },
    en: {
      eslSub: "'Update thousands of prices in your store in seconds with a single click. Whether you have 2,500 or 10,000 different items, prices sync instantly. Zero errors, maximum efficiency.'",
      eslAdv2: "'Unlimited Item Synchronization'",
      eslAdv2Desc: "'Whether you have 2,500 or 10,000 products, manage all prices in your store simultaneously. Eliminate manual errors and guarantee 100% price parity between POS, app, and shelf.'"
    },
    fr: {
      eslSub: "'Mettez à jour des milliers de prix dans votre magasin en quelques secondes. Que vous ayez 2 500 ou 10 000 articles, les prix se synchronisent instantanément. Zéro erreur, efficacité maximale.'",
      eslAdv2: "'Synchronisation illimitée des articles'",
      eslAdv2Desc: "'Que vous ayez 2 500 ou 10 000 produits, gérez tous les prix simultanément. Éliminez les erreurs manuelles et garantissez une parité de prix à 100 % entre la caisse, l\\'application et le rayon.'"
    },
    es: {
      eslSub: "'Actualice miles de precios en su tienda en segundos con un solo clic. Ya sea que tenga 2,500 o 10,000 artículos diferentes, los precios se sincronizan al instante. Cero errores, máxima eficiencia.'",
      eslAdv2: "'Sincronización ilimitada de artículos'",
      eslAdv2Desc: "'Ya sea que tenga 2,500 o 10,000 productos, gestione todos los precios de su tienda simultáneamente. Elimine errores manuales y garantice el 100 % de paridad de precios entre el TPV, la aplicación y el estante.'"
    },
    it: {
      eslSub: "'Aggiorna migliaia di prezzi nel tuo negozio in pochi secondi con un clic. Che tu abbia 2.500 o 10.000 articoli, i prezzi si sincronizzano istantaneamente. Zero errori, massima efficienza.'",
      eslAdv2: "'Sincronizzazione illimitata degli articoli'",
      eslAdv2Desc: "'Che tu abbia 2.500 o 10.000 prodotti, gestisci tutti i prezzi contemporaneamente. Elimina gli errori manuali e garantisci la parità di prezzo al 100% tra cassa, app e scaffale.'"
    },
    nl: {
      eslSub: "'Update duizenden prijzen in uw winkel in seconden met één klik. Of u nu 2.500 of 10.000 artikelen heeft, prijzen synchroniseren direct. Nul fouten, maximale efficiëntie.'",
      eslAdv2: "'Onbeperkte artikelsynchronisatie'",
      eslAdv2Desc: "'Of u nu 2.500 of 10.000 producten heeft, beheer alle prijzen tegelijkertijd. Elimineer handmatige fouten en garandeer 100% prijspariteit tussen kassa, app en schap.'"
    }
  };

  for (const lang in updates) {
    const blockStart = content.indexOf(`  ${lang}: {`);
    if (blockStart === -1) continue;
    
    let blockEnd = content.indexOf(`  },`, blockStart);
    if (blockEnd === -1) blockEnd = content.length;

    let block = content.substring(blockStart, blockEnd);

    block = block.replace(/eslSub:\s*'[^']*',?/, `eslSub: ${updates[lang].eslSub},`);
    block = block.replace(/eslAdv2:\s*'[^']*',?/, `eslAdv2: ${updates[lang].eslAdv2},`);
    block = block.replace(/eslAdv2Desc:\s*'[^']*',?/, `eslAdv2Desc: ${updates[lang].eslAdv2Desc},`);

    content = content.substring(0, blockStart) + block + content.substring(blockEnd);
  }

  fs.writeFileSync(path, content, 'utf8');
};

const updateVendorTranslations = () => {
  const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/vendor/translations.ts';
  let content = fs.readFileSync(path, 'utf8');

  const updates = {
    de: {
      eslSub: "'Ob 2.500 oder 10.000 verschiedene Artikel in Ihrem Geschäft – mit den elektronischen Regaletiketten (ESL) von LOKMA werden alle Preise in Sekundenschnelle synchronisiert. Null Fehler, maximale Effizienz.'"
    },
    tr: {
      eslSub: "'İster 2.500 ister 10.000 çeşit ürününüz olsun, LOKMA Elektronik Raf Etiketleri (ESL) ile mağazanızdaki tüm fiyatlar saniyeler içinde senkronize olur. Sıfır hata, maksimum verimlilik.'"
    },
    en: {
      eslSub: "'Whether you have 2,500 or 10,000 different items, LOKMA Electronic Shelf Labels (ESL) sync all prices in your store in seconds. Zero errors, maximum efficiency.'"
    },
    fr: {
      eslSub: "'Que vous ayez 2 500 ou 10 000 articles, les étiquettes électroniques LOKMA (ESL) synchronisent tous les prix en quelques secondes. Zéro erreur, efficacité maximale.'"
    },
    es: {
      eslSub: "'Ya sea que tenga 2,500 o 10,000 artículos, las Etiquetas Electrónicas (ESL) de LOKMA sincronizan todos los precios en segundos. Cero errores, máxima eficiencia.'"
    },
    it: {
      eslSub: "'Che tu abbia 2.500 o 10.000 articoli, le etichette elettroniche LOKMA (ESL) sincronizzano tutti i prezzi in pochi secondi. Zero errori, massima efficienza.'"
    },
    nl: {
      eslSub: "'Of u nu 2.500 of 10.000 artikelen heeft, LOKMA Elektronische Schapetiketten (ESL) synchroniseren alle prijzen in seconden. Nul fouten, maximale efficiëntie.'"
    }
  };

  for (const lang in updates) {
    const blockStart = content.indexOf(`  ${lang}: {`);
    if (blockStart === -1) continue;
    
    let blockEnd = content.indexOf(`  },`, blockStart);
    if (blockEnd === -1) blockEnd = content.length;

    let block = content.substring(blockStart, blockEnd);

    block = block.replace(/eslSub:\s*'[^']*',?/, `eslSub: ${updates[lang].eslSub},`);

    content = content.substring(0, blockStart) + block + content.substring(blockEnd);
  }

  fs.writeFileSync(path, content, 'utf8');
};

updateHardwareTranslations();
updateVendorTranslations();
console.log('Translations updated.');
