import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const badgesSnap = await db.collection('kermes_badges').get();
  let tunaBadgeId = null;
  badgesSnap.forEach(doc => {
    const data = doc.data();
    if (data.label && data.label.toLowerCase().includes('tuna')) {
      tunaBadgeId = doc.id;
    }
  });

  if (!tunaBadgeId) {
    console.log("No TUNA badge found.");
    return;
  }

  const eventsSnap = await db.collection('kermes_events').get();
  let updatedCount = 0;
  
  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    const c = data.country || 'NONE';
    const isGermany = ['Almanya', 'Deutschland', 'NONE'].includes(c);
    
    // Quick check to not give TUNA to obviously Turkey events if country=NONE
    const city = (data.city || '').toLowerCase();
    const isTurkey = c === 'Türkiye' || city === 'istanbul' || city === 'ankara' || data.isSilaYolu;
    
    if (isGermany && !isTurkey) {
      const badges = data.activeBadgeIds || [];
      if (!badges.includes(tunaBadgeId)) {
        badges.push(tunaBadgeId);
        await doc.ref.update({ activeBadgeIds: badges });
        updatedCount++;
      }
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} events in Germany to have TUNA badge.`);
}

run().catch(console.error);
