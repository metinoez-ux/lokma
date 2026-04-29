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
    
    // Check customRoleAssignments
    if (data.customRoleAssignments && data.customRoleAssignments['Kahve']) {
      console.log('Found Kahve in customRoleAssignments for event', doc.id);
      const newMap = { ...data.customRoleAssignments };
      delete newMap['Kahve'];
      await doc.ref.update({ customRoleAssignments: newMap });
      changed = true;
    }
    
    // Check prepZoneAssignments
    if (data.prepZoneAssignments && data.prepZoneAssignments['Kahve']) {
      console.log('Found Kahve in prepZoneAssignments for event', doc.id);
      const newMap = { ...data.prepZoneAssignments };
      delete newMap['Kahve'];
      await doc.ref.update({ prepZoneAssignments: newMap });
      changed = true;
    }
  }
  if (!changed) console.log('No orphaned Kahve found in events.');
}
run().catch(console.error).then(() => process.exit(0));
