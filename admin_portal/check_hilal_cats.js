const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkHilal() {
  const businessId = 'aOTmMmSArHjBbym459j5';
  const cats = await db.collection('businesses').doc(businessId).collection('categories').get();
  console.log(`Hilal Market has ${cats.size} categories.`);
  
  cats.docs.forEach(c => {
    console.log(`Category: ${c.id} - ${c.data().name}`);
  });
}

checkHilal();
