const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('./firebase-service-account.json'))
});

const db = getFirestore();

async function run() {
  const admins = await db.collection('admins').orderBy('updatedAt', 'desc').limit(5).get();
  console.log("Recent Admins:");
  admins.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.email, "photoURL:", data.photoURL);
  });
}
run().catch(console.error);
