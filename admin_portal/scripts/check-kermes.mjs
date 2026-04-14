import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const serviceAccount = JSON.parse(fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
async function run() {
  const eventsSnap = await db.collection('kermes_events').get();
  console.log(`Total events: ${eventsSnap.size}`);
  let dict = {};
  eventsSnap.forEach(e => {
    const c = e.data().country || 'NONE';
    dict[c] = (dict[c] || 0) + 1;
  });
  console.log("Countries distribution:", dict);
}
run().catch(console.error);
