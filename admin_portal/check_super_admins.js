const admin = require('firebase-admin');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
const saLine = lines.find(l => l.startsWith('ADMIN_SERVICE_ACCOUNT='));
if (saLine) {
  let jsonStr = saLine.substring('ADMIN_SERVICE_ACCOUNT='.length);
  // remove starting and ending quotes if present
  if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
    jsonStr = jsonStr.substring(1, jsonStr.length - 1);
  }
  
  const serviceAccount = JSON.parse(jsonStr);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  async function check() {
    const q = db.collection('admins').where('adminType', '==', 'super');
    const snap = await q.get();
    console.log("SUPER ADMINS:");
    snap.forEach(doc => {
      console.log(doc.id, doc.data().displayName, "--- TITLE:", doc.data().title);
    });
  }
  check().catch(console.error);
}
