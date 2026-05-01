const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkProductCats() {
  const snapshot = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').collection('products').get();
  const cats = new Set();
  snapshot.docs.forEach(d => {
    const p = d.data();
    if (p.category) cats.add(p.category);
  });
  console.log(`Hilal Market has ${cats.size} unique categories in its products:`);
  console.log(Array.from(cats).join(', '));
}

checkProductCats();
