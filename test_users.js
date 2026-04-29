const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/serviceAccountKey.json'); // assuming it exists or use default
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});
const db = admin.firestore();
async function run() {
  const snap = await db.collection('users').count().get();
  console.log("Users count:", snap.data().count);
}
run().catch(console.error);
