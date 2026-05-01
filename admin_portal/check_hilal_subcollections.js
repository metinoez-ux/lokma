const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkHilalSubcollections() {
  const ref = db.collection('businesses').doc('aOTmMmSArHjBbym459j5');
  const collections = await ref.listCollections();
  console.log(`Hilal Market has ${collections.length} subcollections:`);
  for (const col of collections) {
    const snap = await col.get();
    console.log(`- ${col.id}: ${snap.size} documents`);
  }
}

checkHilalSubcollections();
