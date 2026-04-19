const admin = require('firebase-admin');
const serviceAccount = require('../../admin_portal/service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fix() {
  const kermesRef = db.collection('kermes_events').doc('kermes-sila-yolu-parndorf');
  const doc = await kermesRef.get();
  
  if (doc.exists) {
    const data = doc.data();
    if (!data.createdAt) {
      await kermesRef.update({
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("Successfully added createdAt field to Parndorf Kermes");
    } else {
      console.log("createdAt already exists on Parndorf Kermes");
    }
  } else {
    console.log("Document does not exist");
  }
}

fix().catch(console.error);
