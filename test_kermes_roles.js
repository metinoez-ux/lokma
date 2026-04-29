const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/functions/serviceAccountKey.json'); // or somehow initialize
admin.initializeApp({
  credential: admin.credential.applicationDefault() // we can just try to run it if it works
});

async function run() {
  const db = admin.firestore();
  const snapshot = await db.collection('kermes_events').limit(1).get();
  if (snapshot.empty) {
    console.log("No kermes events found.");
    return;
  }
  const data = snapshot.docs[0].data();
  console.log(Object.keys(data));
  console.log("PrepZoneAssignments:", data.prepZoneAssignments);
}

run().catch(console.error);
