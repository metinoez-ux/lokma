const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const db = admin.firestore();
  const doc = await db.collection('kermes_events').doc('FqEryG6UAXn4mLna2j8S').get();
  console.log(doc.data().kermesAdmins);
  process.exit(0);
}
run();
