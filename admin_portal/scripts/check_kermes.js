const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('kermes').get();
  console.log(`Total events: ${snapshot.size}`);

  let missingGeo = 0;
  let missingStatus = 0;
  let missingMenu = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.geohash) missingGeo++;
    if (data.status !== 'approved') missingStatus++;
    if (!data.hasMenu) missingMenu++;
  });

  console.log(`Missing Geohash/Location: ${missingGeo}`);
  console.log(`Not 'approved' status: ${missingStatus}`);
  console.log(`!hasMenu: ${missingMenu}`);
}
check().catch(console.error);
