const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkKermesler() {
  const kermesler = await db.collection('kermesler').get();
  console.log(`Found ${kermesler.size} kermesler`);
  for (const doc of kermesler.docs) {
    const data = doc.data();
    if (data.categories && data.categories.length) {
      console.log(`Kermes ${doc.id} (${data.name}) has ${data.categories.length} categories in the document.`);
    }
  }
}

checkKermesler();
