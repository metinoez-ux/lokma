import * as admin from 'firebase-admin';
const serviceAccount = require('../mira-firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  const meat = await db.collection('meat_orders').where('butcherId', '==', 'KjdsF3N5ACtEKfTprwJW').get();
  console.log("meat_orders for Tuna:", meat.size);
  const kermes = await db.collection('kermes_orders').where('butcherId', '==', 'KjdsF3N5ACtEKfTprwJW').get();
  console.log("kermes_orders for Tuna (by butcherId):", kermes.size);
  const kermes2 = await db.collection('kermes_orders').where('businessId', '==', 'KjdsF3N5ACtEKfTprwJW').get();
  console.log("kermes_orders for Tuna (by businessId):", kermes2.size);
  const kermes3 = await db.collection('kermes_orders').where('kermesId', '==', 'KjdsF3N5ACtEKfTprwJW').get();
  console.log("kermes_orders for Tuna (by kermesId):", kermes3.size);
}
run().then(() => process.exit(0));
