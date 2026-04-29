import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const kermesId = 'four-days-kulturevent-huckelhoven';
  const doc = await db.collection('kermes_events').doc(kermesId).get();
  console.log(doc.data()?.title);
  const sections = doc.data()?.sections || doc.data()?.kermesSections || [];
  console.log(sections);
  console.log(Object.keys(doc.data() || {}));
}
run().catch(console.error).then(() => process.exit(0));
