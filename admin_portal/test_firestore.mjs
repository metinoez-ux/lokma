import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const snapshot = await db.collection('businesses').where('companyName', '==', 'Günes Supermarkt').get();
  snapshot.forEach(doc => {
    const d = doc.data();
    console.log(doc.id, '=>', d.companyName);
    console.log('brand:', d.brand);
    console.log('isTunaPartner:', d.isTunaPartner);
    console.log('brandLabel:', d.brandLabel);
    console.log('tags:', d.tags);
    console.log('sellsTunaProducts:', d.sellsTunaProducts);
    console.log('activeBrandIds:', d.activeBrandIds);
  });
}
main().catch(console.error);
