const admin = require('firebase-admin');
const serviceAccount = require('./mira-firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const db = admin.firestore();
  
  // Get Tuna Kebaphaus
  const doc = await db.collection('kermes_events').doc('KjdsF3N5ACtEKfTprwJW').get();
  console.log("Tuna assignedDrivers:", doc.data()?.assignedDrivers);
  
  // Query Kermes events for Sevket Ay
  const query = await db.collection('kermes_events').where('assignedDrivers', 'array-contains', 'v445u4EsvYfoTwUu8IKDDsarVOq2').get();
  console.log("Query count for array-contains:", query.size);
  
  const adminsDoc = await db.collection('admins').doc('v445u4EsvYfoTwUu8IKDDsarVOq2').get();
  console.log("Admins assignedBusinesses:", adminsDoc.data()?.assignedBusinesses);
  console.log("Admins assignedKermesIds:", adminsDoc.data()?.assignedKermesIds);
}
run().then(() => process.exit(0));
