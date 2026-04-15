const admin = require('firebase-admin');
const serviceAccount = require('./aylar-a45af-firebase-adminsdk-jrdl0-34d3b66479.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
async function run() {
  const snaps = await db.collection('kermes_cash_handovers')
    .orderBy('createdAt', 'desc').limit(5).get();
  snaps.docs.forEach(doc => {
    console.log(doc.id, doc.data().status, doc.data().amount, doc.data().actualAmount);
  });
}
run();
