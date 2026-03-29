const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('kermes_events').limit(5).get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nID: ${doc.id}`);
    console.log(`Title: ${data.title}`);
    console.log(`IsActive: ${data.isActive}`);
    console.log(`IsArchived: ${data.isArchived}`);
    
    if (data.startDate) {
        console.log(`StartDate: ${data.startDate.toDate()}`);
    } else {
        console.log(`StartDate: MISSING`);
    }
    if (data.endDate) {
        console.log(`EndDate: ${data.endDate.toDate()}`);
    } else {
        console.log(`EndDate: MISSING`);
    }
  });
}
check().catch(console.error);
