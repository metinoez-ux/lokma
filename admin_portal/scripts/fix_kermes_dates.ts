import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

async function fixKermesDates() {
  const kermesEventsRef = db.collection('kermes_events');
  const snapshot = await kermesEventsRef.get();
  
  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    let needsUpdate = false;
    const updates: any = {};

    // For demo purposes, we will assign a random start date in April 2026.
    // If it's already a Timestamp in April/May we keep it, but it's simpler to just reset them all
    // to valid future dates if they failed to parse correctly.
    if (!data.startDate || typeof data.startDate !== 'object' || !data.startDate.toDate) {
      needsUpdate = true;
    }
    
    if (needsUpdate || data.dateStr === 'Invalid Date' || !data.isActive) {
      // Random date between April 1 2026 and May 30 2026
      const startDay = Math.floor(Math.random() * 30) + 1;
      const startMonth = Math.random() > 0.5 ? 3 : 4; // 0-based: 3 = April, 4 = May
      const startDate = new Date(2026, startMonth, startDay, 10, 0, 0);
      const endDate = new Date(startDate.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days duration
      
      updates.startDate = admin.firestore.Timestamp.fromDate(startDate);
      updates.endDate = admin.firestore.Timestamp.fromDate(endDate);
      updates.isActive = true;
      
      batch.update(doc.ref, updates);
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully fixed ${count} kermes events.`);
  } else {
    console.log('No kermes events needed fixing!');
  }
}

fixKermesDates().catch(console.error);
