const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkOrders() {
  const snapshot = await db.collection('meat_orders')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Order ${doc.id}: status=${data.status}, deliveryMethod=${data.deliveryMethod}, orderType=${data.orderType}, butcherId=${data.butcherId}, deliveryType=${data.deliveryType}`);
  });
  process.exit(0);
}
checkOrders();
