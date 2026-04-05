const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function run() {
  const userId = 'yv516R01J8aXXz5TIFyUksQ9mQe2'; // We can test on Sevket Ay (Wait, I need Sevket's correct UID. Let's find him).
  
  const snap = await db.collection('users').where('email', '==', 'sevket.ay@lokma.shop').get();
  if (snap.empty) { console.log('not found'); return; }
  const doc = snap.docs[0];
  const uid = doc.id;
  const data = doc.data();
  
  console.log('Old assignments:', data.assignments);
  console.log('Old prep zones:', data.kermesAllowedSections);
  
}
run();
