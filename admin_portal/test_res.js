const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function check() {
  const qs = await db.collectionGroup('reservations').get();
  console.log('Total reservations:', qs.size);
  let preOrders = 0;
  qs.forEach(doc => {
    const d = doc.data();
    if (d.tabStatus === 'pre_ordered' || d.tabStatus === 'seated') {
      preOrders++;
      console.log('Found Pre-Order:', d.reservationDate, d.status, d.tabStatus, 'createdAt:', d.createdAt?.toDate());
    }
  });
  console.log('Total pre_ordered or seated tabs:', preOrders);
}
check().catch(console.error);
