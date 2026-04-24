const admin = require('firebase-admin');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const saLine = envContent.split('\n').find(l => l.startsWith('ADMIN_SERVICE_ACCOUNT='));
if (saLine) {
  let jsonStr = saLine.substring('ADMIN_SERVICE_ACCOUNT='.length);
  if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
    jsonStr = jsonStr.substring(1, jsonStr.length - 1);
  }
  const serviceAccount = JSON.parse(jsonStr);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();

  async function check() {
    const snap = await db.collection('admins').get();
    console.log("ALL ADMINS:");
    snap.forEach(doc => {
      console.log(doc.id, doc.data().displayName, "--- TYPE:", doc.data().adminType, "--- TITLE:", doc.data().title);
    });
  }
  check().catch(console.error);
}
