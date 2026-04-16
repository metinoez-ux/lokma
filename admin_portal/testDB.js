const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = require('fs').readFileSync('../.secrets/lokma-service-account.json', 'utf8');
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
db.collection('short_links').get().then(snap => {
  console.log("Documents found:", snap.size);
  snap.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
}).catch(console.error);
