const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('businesses').get();
  snapshot.docs.forEach(doc => {
      const data = doc.data();
      const n = data.businessName || data.name || data.title || '';
      if (n.toLowerCase().includes('camli') || n.toLowerCase().includes('çamlı')) {
         console.log(`- ID: ${doc.id}`);
         console.log(`name: ${n}`);
         console.log(`brand: ${data.brand}`);
         console.log(`badges:`, data.badges);
         console.log(`tunaProductOnly:`, data.tunaProductOnly);
         console.log(`hazirPaket:`, data.hazirPaketBrand); // from my earlier commit
      }
  });
}
run();
