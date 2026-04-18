const admin = require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/node_modules/firebase-admin');
const serviceAccount = require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('butchers').where('companyName', '==', 'TUNA Metzgerei Hückelhoven').limit(1).get();
  if (snapshot.empty) { console.log('not found'); return; }
  const doc = snapshot.docs[0].data();
  console.log('ID:', snapshot.docs[0].id);
  console.log('openingHours:', doc.openingHours);
  console.log('deliveryHours:', doc.deliveryHours);
  console.log('pickupHours:', doc.pickupHours);
}
run().then(() => process.exit(0));
