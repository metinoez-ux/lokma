const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const ordersRef = db.collection('orders');
  const q = await ordersRef.orderBy('createdAt', 'desc').limit(5).get();
  q.forEach(doc => {
    console.log('Order:', doc.id, doc.data().orderType, doc.data().isGroupOrder);
    const items = doc.data().items || [];
    items.forEach(i => console.log('Item:', i.name, i.customerName, i.guestName, i.userName));
  });
}
run().then(() => process.exit(0));
