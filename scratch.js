import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/.config/gcloud/lokma.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('kermes_events').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.title && data.title.includes('Sıla')) {
      console.log('ID:', doc.id);
      console.log('Title:', data.title);
      console.log('City:', data.city);
      console.log('Postal Code:', data.postalCode);
      console.log('Country:', data.country);
      console.log('Location:', data.location);
      console.log('Description:', data.description);
      console.log('---');
    }
  });
}
run();
