import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const staffs = await db.collectionGroup('kermes_staff_status').get();
  console.log('Total staffs found:', staffs.size);
  let changed = false;
  for (const s of staffs.docs) {
    const data = s.data();
    if (data.kermesPrepZones && data.kermesPrepZones.includes('Kahve')) {
      console.log('Found orphaned Kahve in user:', s.ref.path);
      // Remove it!
      const newZones = data.kermesPrepZones.filter(z => z !== 'Kahve');
      await s.ref.update({ kermesPrepZones: newZones });
      console.log('Removed Kahve from', s.ref.path);
      changed = true;
    }
  }
  if (!changed) console.log('No orphaned Kahve found.');
}
run().catch(console.error).then(() => process.exit(0));
