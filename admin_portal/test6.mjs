import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const staffs = await db.collection('users').get();
  console.log('Total users:', staffs.size);
  let changed = false;
  for (const s of staffs.docs) {
    const data = s.data();
    if (data.kermesPrepZones && data.kermesPrepZones.includes('Kahve')) {
      console.log('Found Kahve in user doc:', s.ref.path);
      const newZones = data.kermesPrepZones.filter(z => z !== 'Kahve');
      await s.ref.update({ kermesPrepZones: newZones });
      console.log('Removed Kahve from user doc', s.ref.path);
      changed = true;
    }
    // Also check kermesAllowedSections
    if (data.kermesAllowedSections && data.kermesAllowedSections.includes('Kahve')) {
      console.log('Found Kahve in user allowedSections:', s.ref.path);
      const newSec = data.kermesAllowedSections.filter(z => z !== 'Kahve');
      await s.ref.update({ kermesAllowedSections: newSec });
      console.log('Removed Kahve from user allowedSections', s.ref.path);
      changed = true;
    }
  }
  if (!changed) console.log('No orphaned Kahve found in users collection.');
}
run().catch(console.error).then(() => process.exit(0));
