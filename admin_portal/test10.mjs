import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const doc = await db.collection('kermes_events').doc('FqEryG6UAXn4mLna2j8S').get();
  const data = doc.data();
  console.log('prepZoneAssignments:', JSON.stringify(data.prepZoneAssignments, null, 2));
  console.log('customRoleAssignments:', JSON.stringify(data.customRoleAssignments, null, 2));
  console.log('customRoles:', JSON.stringify(data.customRoles, null, 2));
}
run().catch(console.error).then(() => process.exit(0));
