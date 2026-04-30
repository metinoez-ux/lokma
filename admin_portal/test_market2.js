const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  
  const all = await db.collection('businesses').get();
  console.log('Total businesses:', all.size);
  all.forEach(doc => {
      const data = doc.data();
      const title = data.title || '';
      console.log('Business:', doc.id, title, data.location ? data.location.address : 'no address');
  });
}
run().catch(console.error).then(() => process.exit(0));
