const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('businesses').where('name', '==', 'Camlica Döner').get();
  snapshot.docs.forEach(doc => {
      console.log(`- ID: ${doc.id}`);
      console.log(`brand: ${doc.data().brand}`);
      console.log(`badges:`, doc.data().badges);
      console.log(`tunaProductOnly:`, doc.data().tunaProductOnly);
  });
}
run();
