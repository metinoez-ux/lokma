const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  
  const cols = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').listCollections();
  console.log('Hilal Market Collections:');
  cols.forEach(col => console.log(col.id));
}
run().catch(console.error).then(() => process.exit(0));
