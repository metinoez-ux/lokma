const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./admin_portal/service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('meat_orders').where('status', '==', 'onTheWay').get();
  console.log(`Found ${snapshot.docs.length} orders onTheWay`);
  snapshot.docs.forEach(doc => {
      console.log(`- ID: ${doc.id}, userId: ${doc.data().userId}, status: ${doc.data().status}`);
  });
}
run();
