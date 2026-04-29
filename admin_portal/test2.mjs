import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const snap = await db.collection('kermes_events').get();
  for (const d of snap.docs) {
    if (d.data().title?.includes('Four-Days') || d.data().kermesTitle?.includes('Four-Days')) {
      console.log('ID:', d.id);
      console.log('Title:', d.data().title || d.data().kermesTitle);
      console.log('Keys:', Object.keys(d.data()));
      console.log('prepZoneAssignments:', d.data().prepZoneAssignments);
      console.log('sections:', d.data().sections);
    }
  }
}
run().catch(console.error).then(() => process.exit(0));
