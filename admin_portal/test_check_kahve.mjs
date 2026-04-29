import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const events = await db.collection('kermes_events').get();
  for (const e of events.docs) {
      console.log('Event', e.id, e.data().title);
      const d = e.data();
      if (d.prepZoneAssignments) {
        console.log('prepZoneAssignments:', d.prepZoneAssignments);
      }
      if (d.assignedDrivers) {
          console.log('assignedDrivers:', d.assignedDrivers);
      }
  }
}

check().catch(console.error);
