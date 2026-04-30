const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  
  const all = await db.collection('master_products').limit(5).get();
  all.forEach(doc => {
      console.log('Master product:', doc.id, JSON.stringify(doc.data(), null, 2));
  });
}
run().catch(console.error).then(() => process.exit(0));
