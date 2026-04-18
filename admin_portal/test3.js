const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const doc = await db.collection('platform_brands').doc('dYiMJo1dqBvp9bNoCiYu').get();
  console.log(doc.id, '=>', doc.data());
}
run().catch(console.error).finally(() => process.exit(0));
