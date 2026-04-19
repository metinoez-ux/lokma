const admin = require('firebase-admin');
const serviceAccount = require('../../admin_portal/service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const kermesRef = db.collection('kermes_events').doc('kermes-sila-yolu-parndorf');
  const doc = await kermesRef.get();
  
  if (doc.exists) {
    const data = doc.data();
    console.log("EXACT COUNTRY DATA:", data.country);
    console.log("All keys:", Object.keys(data).join(', '));
  } else {
    console.log("Document does not exist?!");
  }
}

check().catch(console.error);
