require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountRaw = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const sanitized = serviceAccountRaw.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
const parsedServiceAccount = JSON.parse(sanitized);

initializeApp({
  credential: cert(parsedServiceAccount)
});

const db = getFirestore();

async function check() {
  const users = await db.collection('users').limit(10).get();
  for (const user of users.docs) {
    const hist = await db.collection('users').doc(user.id).collection('notifications')
      .where('type', '==', 'kermes_parking')
      .get();
    
    // Sort manually since we don't have index
    const sorted = hist.docs.sort((a,b) => {
        const da = a.data().createdAt?.toDate() || new Date(0);
        const db = b.data().createdAt?.toDate() || new Date(0);
        return db - da; // desc
    });
    
    if (sorted.length > 0 && sorted[0].data().imageUrl) {
        console.log("Image URL:", sorted[0].data().imageUrl);
        return;
    }
  }
}

check().catch(console.error);
