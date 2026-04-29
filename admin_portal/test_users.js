const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
async function run() {
  const snap = await db.collection('users').limit(2).get();
  snap.forEach(doc => console.log(doc.id, Object.keys(doc.data())));
}
run().catch(console.error);
