const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming it exists, or just use default

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('../../firebase-service-account.json')) // Adjust path to key
  });
}

async function check() {
  const db = admin.firestore();
  const users = await db.collection('users').orderBy('updatedAt', 'desc').limit(5).get();
  users.forEach(doc => {
    console.log(doc.id, doc.data().displayName, doc.data().photoURL);
  });
}
check().catch(console.error);
