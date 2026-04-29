import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const kermesId = 'FqEryG6UAXn4mLna2j8S';
  
  const staffs = await db.collectionGroup('kermes_staff_status').where('kermesId', '==', kermesId).get();
  console.log('Total staffs found:', staffs.size);
  for (const s of staffs.docs) {
    const data = s.data();
    if (data.kermesPrepZones && data.kermesPrepZones.includes('Kahve')) {
      console.log('Found orphaned Kahve in user:', s.ref.path);
      // Remove it!
      const newZones = data.kermesPrepZones.filter(z => z !== 'Kahve');
      await s.ref.update({ kermesPrepZones: newZones });
      console.log('Removed Kahve from', s.ref.path);
    }
  }
}
run().catch(console.error).then(() => process.exit(0));
