const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkKermesCategories() {
  const snapshot = await db.collection('kermes_categories').get();
  console.log(`kermes_categories has ${snapshot.size} documents.`);
  snapshot.docs.forEach(d => console.log(d.id, d.data().name));
}

checkKermesCategories();
