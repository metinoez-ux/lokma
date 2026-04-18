const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function check() {
  const doc = await db.collection('platform_brands').get();
  console.log("PLATFORM BRANDS:");
  doc.docs.forEach(d => console.log(d.id, "=>", d.data()));
}
check().then(() => process.exit(0));
