import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

let parsedServiceAccount;
const serviceAccount = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccount) {
    const sanitized = serviceAccount.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    parsedServiceAccount = JSON.parse(sanitized);
}

if (!getApps().length) {
    initializeApp({
        credential: cert(parsedServiceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('kermes_events').get();
  console.log('Total kermeses in DB:', snapshot.size);
  let missingCount = 0;
  snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.state || data.state.trim() === '') {
          missingCount++;
          console.log(`Missing state: ${data.title} | City: ${data.city} | Zip: ${data.postalCode}`);
      }
  });
  console.log('Total missing state:', missingCount);
}
run().then(() => process.exit(0)).catch(console.error);
