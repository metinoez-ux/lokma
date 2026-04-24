const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('admins')
    .where('displayName', '>=', 'Ibrahim')
    .where('displayName', '<=', 'Ibrahim\uf8ff')
    .get();
    
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().displayName, "role:", doc.data().role, "adminType:", doc.data().adminType);
  });
}

check().then(() => process.exit(0)).catch(console.error);
