const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./admin_portal/serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

async function run() {
  const admins = await db.collection('admins').limit(15).get();
  admins.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.displayName, data.adminType, data.businessType, data.kermesId, data.businessId);
  });
  process.exit(0);
}
run();
