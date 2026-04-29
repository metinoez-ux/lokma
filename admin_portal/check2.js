require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountRaw = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let parsedServiceAccount;
try {
  parsedServiceAccount = JSON.parse(serviceAccountRaw);
} catch(e) {
  const sanitized = serviceAccountRaw.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  try {
      parsedServiceAccount = JSON.parse(sanitized);
  } catch (err2) {
      const realNewlinesSanitized = serviceAccountRaw.replace(/\n/g, '\\n');
      parsedServiceAccount = JSON.parse(realNewlinesSanitized);
  }
}

initializeApp({
  credential: cert(parsedServiceAccount)
});

const db = getFirestore();

async function check() {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const hist = await db.collection('users').doc(user.id).collection('notifications')
      .where('type', '==', 'kermes_parking')
      .orderBy('createdAt', 'desc')
      .limit(1).get();
    
    if (!hist.empty && hist.docs[0].data().imageUrl) {
      console.log("Image URL:", hist.docs[0].data().imageUrl);
      return;
    }
  }
}

check().catch(console.error);
