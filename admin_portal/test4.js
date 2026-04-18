const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const doc = await db.collection('businesses').doc('KjdsF3N5ACtEKfTprwJW').get();
  console.log(doc.data().isActive);
  console.log(doc.data().companyName);
  console.log(doc.data().sectors);
}
run().catch(console.error).finally(() => process.exit(0));
