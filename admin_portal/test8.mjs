import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const events = await db.collection('kermes_events').get();
  let changed = false;
  for (const doc of events.docs) {
    const data = doc.data();
    
    if (data.prepZoneAssignments) {
      const pz = { ...data.prepZoneAssignments };
      for (const key of Object.keys(pz)) {
        if (key.toLowerCase().includes('kahve')) {
          console.log(`Found orphaned '${key}' in prepZoneAssignments for event`, doc.id);
          delete pz[key];
          changed = true;
        }
      }
      if (changed) await doc.ref.update({ prepZoneAssignments: pz });
    }
  }
  if (!changed) console.log('No orphaned kahve-related keys found in events.');
}
run().catch(console.error).then(() => process.exit(0));
