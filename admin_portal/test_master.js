const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  
  const cols = await db.listCollections();
  cols.forEach(col => {
      if (col.id.includes('catalog') || col.id.includes('master')) {
          console.log('Master Collection:', col.id);
      }
  });
}
run().catch(console.error).then(() => process.exit(0));
