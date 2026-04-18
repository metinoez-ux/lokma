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
      const n = (data.companyName || data.businessName || data.name || data.title || '').toLowerCase();
      if (n.includes('tuna kebap')) {
         console.log(`- ID: ${doc.id}`);
         console.log(`name: ${n}`);
         console.log(`brand: ${data.brand}`);
         console.log(`activeBrandIds:`, data.activeBrandIds);
         console.log(`isTunaPartner:`, data.isTunaPartner);
      }
      if (n.includes('camli') || n.includes('çamlı')) {
         console.log(`- ID: ${doc.id}`);
         console.log(`name: ${n}`);
         console.log(`brand: ${data.brand}`);
         console.log(`activeBrandIds:`, data.activeBrandIds);
         console.log(`isTunaPartner:`, data.isTunaPartner);
      }
  });
}
run();
