import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    const data = doc.data();
    const name = data.name || data.displayName || data.firstName || '';
    if (name.toLowerCase().includes('ferihan') || name.toLowerCase().includes('oez')) {
      console.log('User found:', doc.id, name);
      console.log('kermesAllowedSections:', data.kermesAllowedSections);
      console.log('kermesPrepZones:', data.kermesPrepZones);
      
      const statuses = await db.collection(`users/${doc.id}/kermes_staff_status`).get();
      statuses.docs.forEach(s => {
        console.log('Staff Status ID:', s.id);
        console.log('kermesAllowedSections:', s.data().kermesAllowedSections);
        console.log('kermesPrepZones:', s.data().kermesPrepZones);
      });
    }
  }
}
run().catch(console.error).then(() => process.exit(0));
