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
      const dbName = doc.data().name?.toLowerCase() || '';
      if (dbName.includes('camlica') || dbName.includes('çamlıca')) {
         console.log(`- ID: ${doc.id}`);
         console.log(`name: ${doc.data().name}`);
         console.log(`brand: ${doc.data().brand}`);
         console.log(`badges:`, doc.data().badges);
         console.log(`tunaProductOnly:`, doc.data().tunaProductOnly);
         console.log(`torosProductOnly:`, doc.data().torosProductOnly);
      }
  });
}
run();
