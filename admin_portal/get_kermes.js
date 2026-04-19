const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming it's in admin_portal
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('kermes_events').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if(data.title && data.title.toLowerCase().includes('fourdays') || data.name && data.name.toLowerCase().includes('fourdays')) {
      console.log(`FOUND: ${doc.id}`);
      console.log(`Title: ${data.title || data.name}`);
      console.log(`Header Image: ${data.headerImage}`);
    }
  });
}
run().then(() => process.exit(0)).catch(console.error);
