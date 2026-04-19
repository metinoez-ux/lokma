const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const kermes = await db.collection('kermes_events').get();
  console.log('Total kermes:', kermes.size);
  kermes.forEach(doc => {
    const d = doc.data();
    console.log(`- ${d.title} | City: ${d.city} | Country: ${d.country} | State: ${d.state} | Zip: ${d.postalCode}`);
  });
}
run().then(() => process.exit(0));
