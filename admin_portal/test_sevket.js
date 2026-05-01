const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('admins').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.firstName === 'Sevket' || (data.name && data.name.includes('Sevket'))) {
       console.log("Found Sevket: ", doc.id, JSON.stringify(data, null, 2));
    }
  });
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
