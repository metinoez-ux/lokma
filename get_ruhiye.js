const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./admin_portal/serviceAccountKey.json'); // assuming it exists or similar

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

async function run() {
  const admins = await db.collection('admins').where('displayName', '==', 'Ruhiye Öz').get();
  admins.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
}
run();
