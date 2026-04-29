import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('kermes_events').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`Checking ${doc.id} - ${data.name}`);
    let changed = false;
    const pz = { ...data.prepZoneAssignments };
    
    // In LOKMA Kermes, stations might be stored in 'kermes_sections' collection
    const secSnapshot = await db.collection('kermes_events').doc(doc.id).collection('kermes_sections').get();
    const validStations = [];
    for (const secDoc of secSnapshot.docs) {
      const secData = secDoc.data();
      for (const st of secData.stations || []) {
        validStations.push(st.name);
      }
    }
    console.log('Valid stations:', validStations);
    
    for (const key of Object.keys(pz)) {
      if (!validStations.includes(key)) {
        console.log(`Orphaned station found: ${key}, removing from prepZoneAssignments`);
        delete pz[key];
        changed = true;
      }
    }
    
    if (changed) {
      await db.collection('kermes_events').doc(doc.id).update({ prepZoneAssignments: pz });
      console.log('Updated prepZoneAssignments');
    } else {
      console.log('No orphaned stations found');
    }
  }
}
run().catch(console.error).then(() => process.exit(0));
