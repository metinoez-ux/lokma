const admin = require('firebase-admin');

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp();
  }
} catch (error) {
  console.log("Firebase default init failed:", error);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  try {
    const doc = await db.collection('translations').doc('tr').get();
    if (doc.exists) {
      console.log('Keys in Firestore for TR:');
      console.log(Object.keys(doc.data()));
    } else {
      console.log('Document not found!');
    }
  } catch (e) {
    console.error('Error fetching doc:', e);
  }
}
run();
