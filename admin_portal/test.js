const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('businesses').where('name', '==', 'Tuna Kebaphaus & Pizzeria').get();
  snapshot.forEach(doc => {
    console.log(doc.id, '=>');
    const d = doc.data();
    console.log('activeBrandIds:', d.activeBrandIds);
    console.log('isTunaPartner:', d.isTunaPartner);
    console.log('brand:', d.brand);
    console.log('brandLabelActive:', d.brandLabelActive);
    console.log('tags:', d.tags);
  });
}
run().catch(console.error).finally(() => process.exit(0));
