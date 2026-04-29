import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fix() {
  const docRef = db.collection('kermes_events').doc('FqEryG6UAXn4mLna2j8S');
  await docRef.update({
    'prepZoneAssignments.Kahve': FieldValue.delete()
  });
  console.log('Deleted Kahve from prepZoneAssignments for Four-Days Kulturevent');
}

fix().catch(console.error);
