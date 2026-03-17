const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('meat_orders')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
    
  snapshot.forEach(doc => {
    const d = doc.data();
    console.log(`Order ${doc.id}:`);
    console.log(`  status:`, d.status);
    console.log(`  createdAt:`, d.createdAt ? d.createdAt.toDate() : 'none');
    console.log(`  scheduledDeliveryTime:`, d.scheduledDeliveryTime);
    console.log(`  scheduledDateTime:`, d.scheduledDateTime);
    console.log(`  deliveryDate:`, d.deliveryDate);
    console.log(`  isScheduledOrder:`, d.isScheduledOrder);
    console.log('---');
  });
}
check().catch(console.error);
