const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
async function run() {
  const snap = await db.collection('kermes_events').limit(1).get();
  snap.forEach(doc => {
    console.log("prepZoneAssignments:", doc.data().prepZoneAssignments);
  });
}
run().catch(console.error);
