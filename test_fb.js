const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
  const querySnapshot = await db.collection('kermes_orders')
    .where('kermesId', '==', 'FqEryG6UAXn4mLna2j8S')
    .get();
  console.log('Total Orders:', querySnapshot.size);
  querySnapshot.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.createdAt.toDate());
  });
  process.exit(0);
}
run();
