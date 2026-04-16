const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const snaps = await db.collection('kermes_events').limit(10).get();
  for (const doc of snaps.docs) {
     const data = doc.data();
     console.log(doc.id, "hours->", data.operatingHours, data.openingHours, data.workingHours);
  }
}
check();
