const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  
  const all = await db.collection('businesses').get();
  all.forEach(doc => {
      const data = doc.data();
      const companyName = data.companyName || '';
      if (companyName.toLowerCase().includes('hilal')) {
          console.log('Found Hilal Market:', doc.id, companyName, data.address);
      }
  });
}
run().catch(console.error).then(() => process.exit(0));
