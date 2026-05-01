const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findBusinesses() {
  const businesses = await db.collection('businesses').get();
  console.log(`Checking ${businesses.size} businesses...`);
  
  for (const b of businesses.docs) {
    const cats = await b.ref.collection('categories').get();
    if (cats.size > 20) {
      console.log(`Business ${b.id} (${b.data().companyName}) has ${cats.size} categories!`);
    }
  }
  console.log('Done.');
}

findBusinesses();
