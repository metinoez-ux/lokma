const admin = require('firebase-admin');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
const saLine = lines.find(l => l.startsWith('ADMIN_SERVICE_ACCOUNT='));
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
    const snap = await db.collection('platform_admins').get();
    console.log("PLATFORM ADMINS:");
    snap.forEach(doc => {
      console.log(doc.id, doc.data().name, "--- ROLE:", doc.data().role, "--- ASSIGNED TO:", doc.data().assignedName);
    });
  }
  check().catch(console.error);
}
