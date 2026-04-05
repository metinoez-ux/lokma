const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function run() {
  const userId = 'yv516R01J8aXXz5TIFyUksQ9mQe2'; // Sevket
  const doc = await db.collection('users').doc(userId).get();
  const oldUserData = doc.data();

  // simulate update by just printing the old user data
  console.log("old assignments:", oldUserData.assignments);
  console.log("old prep zones:", oldUserData.kermesAllowedSections);
}
run();
