const admin = require('firebase-admin');
const sa = require('../serviceAccount.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  try {
    const snap = await db.collection('businesses').get();
    console.log('Total businesses:', snap.size);
    const urlMap = {};

    for (const doc of snap.docs) {
      const d = doc.data();
      const name = d.companyName || d.name || 'N/A';
      const type = d.type || d.businessType || 'N/A';
      const cover = d.coverImageUrl || d.coverImage || '';

      if (cover) {
        if (!urlMap[cover]) urlMap[cover] = [];
        urlMap[cover].push(name + ' (' + type + ') [' + doc.id + ']');
      }

      // Print specific businesses
      const nl = name.toLowerCase();
      if (nl.includes('alfredo') || nl.includes('blumen') || nl.includes('fleur') || nl.includes('baklav')) {
        console.log('FOUND:', name, '|', type, '| id:', doc.id, '| cover:', cover ? cover.substring(0, 60) : 'NONE');
      }
    }

    // Duplicates
    let dupCount = 0;
    for (const [url, bs] of Object.entries(urlMap)) {
      if (bs.length > 1) {
        dupCount++;
        console.log('\nDUPLICATE #' + dupCount + ': ' + url.substring(0, 80));
        bs.forEach(b => console.log('  ' + b));
      }
    }
    if (dupCount === 0) console.log('\nNo duplicate covers found.');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
