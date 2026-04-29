require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Attempt to parse exactly as in firebase-admin.ts
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let parsedServiceAccount;
const sanitized = serviceAccountRaw.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
parsedServiceAccount = JSON.parse(sanitized);

initializeApp({
  credential: cert(parsedServiceAccount)
});

const db = getFirestore();

async function check() {
  const users = await db.collection('users').limit(10).get();
  for (const user of users.docs) {
    const notifs = await db.collection('users').doc(user.id).collection('notifications')
      .where('type', '==', 'kermes_parking')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (!notifs.empty) {
      console.log('User:', user.id);
      console.log('Notif data:', notifs.docs[0].data());
      break; // Only need 1
    }
  }
}

check().catch(console.error);
