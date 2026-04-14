import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = require('./admin_portal/service-account.json');
if (!require('firebase-admin/app').getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();
async function run() {
  const snapshot = await db.collection('kermes_events').limit(3).get();
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
run();
