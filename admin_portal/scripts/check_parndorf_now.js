const admin = require('firebase-admin');
const serviceAccount = require('../../admin_portal/service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  console.log("Checking Firestore for Parndorf...");
  const kermesRef = db.collection('kermes_events');
  const snapshot = await kermesRef.get();
  
  let found = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('parndorf')) {
      console.log(`\nFOUND: ${doc.id}`);
      console.log(`Title: ${data.title}`);
      console.log(`isArchived: ${data.isArchived}`);
      console.log(`isActive: ${data.isActive}`);
      // find the specific field holding parndorf
      for (const [k, v] of Object.entries(data)) {
        if (String(v).toLowerCase().includes('parndorf')) {
          console.log(`=> Field Match: ${k} = "${v}"`);
        }
      }
      found++;
    }
  });

  console.log(`\nTotal results: ${found}`);
  if (found === 0) {
      console.log("WAIT!!!! PARNDORF IS COMPLETELY MISSING FROM THE DATABASE!!");
  }
}

check().catch(console.error);
