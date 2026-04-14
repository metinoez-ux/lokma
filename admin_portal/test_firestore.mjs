import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function main() {
  const snapshot = await db.collection('businesses').where('companyName', '>=', 'Güne').where('companyName', '<=', 'Güne\uf8ff').get();
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data().companyName, 'type:', doc.data().type, 'types:', doc.data().types, 'isActive:', doc.data().isActive);
  });
}
main().catch(console.error);
