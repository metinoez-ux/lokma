const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

async function run() {
  const c1 = await db.collection('kermes_orders').where('kermesId', '==', 'FqEryG6UAXn4mLna2j8S').limit(1).get();
  console.log('kermes_orders size:', c1.size);

  const c2 = await db.collection('kermes_events').doc('FqEryG6UAXn4mLna2j8S').collection('orders').limit(1).get();
  console.log('kermes_events/orders size:', c2.size);

  process.exit(0);
}
run();
