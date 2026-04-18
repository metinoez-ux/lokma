const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('businesses').where('name', '==', 'Tuna Kebaphaus & Pizzeria').get();
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}
run().catch(console.error).finally(() => process.exit(0));
