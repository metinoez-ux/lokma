import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const kermesId = 'FqEryG6UAXn4mLna2j8S';
  const doc = await db.collection('kermes_events').doc(kermesId).get();
  
  // sections is undefined on kermes_events.
  // Wait, in Kermes, where are the sections stored?!
  const sectionsSnap = await db.collection('kermes_events').doc(kermesId).collection('kermes_sections').get();
  const validStations = [];
  sectionsSnap.docs.forEach(d => {
    const data = d.data();
    for (const st of data.stations || []) {
      validStations.push(st.name);
    }
  });
  console.log('Valid stations:', validStations);
  console.log('prepZoneAssignments:', doc.data().prepZoneAssignments);
}
run().catch(console.error).then(() => process.exit(0));
