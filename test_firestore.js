const admin = require('firebase-admin');
const serviceAccount = require('./firebase/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const products = await admin.firestore().collection('kermes_events').doc('fourdays_kulturevent').collection('products').get();
  console.log("fourdays_kulturevent has ", products.docs.length, " products");
  
  const event = await admin.firestore().collection('kermes_events').doc('fourdays_kulturevent').get();
  console.log("fourdays_kulturevent menu array size:", event.data().menu ? event.data().menu.length : 0);
}
run().catch(console.error).then(() => process.exit(0));
