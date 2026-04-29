import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./admin_portal/service-account-key.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const users = await db.collection('users').get();
  for (const u of users.docs) {
    const d = u.data();
    if (d.firstName === 'Ferihan') {
      console.log('Ferihan in users:', d);
    }
  }

  const staff = await db.collection('kermes_staff_status').get();
  for (const s of staff.docs) {
    const d = s.data();
    if (d.name && d.name.includes('Ferihan')) {
      console.log('Ferihan in kermes_staff_status:', s.id, d);
    }
  }

  // check events
  const events = await db.collection('kermes_events').get();
  for (const e of events.docs) {
      console.log('Event', e.id, e.data().title);
      const members = await db.collection('kermes_events').doc(e.id).collection('members').get();
      for (const m of members.docs) {
          const d = m.data();
          if (d.name && d.name.includes('Ferihan')) {
             console.log('Ferihan in members:', e.id, m.id, d);
          }
      }
  }
}

check().catch(console.error);
