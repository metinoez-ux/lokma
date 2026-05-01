const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const doc = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').get();
    const data = doc.data();
    if (data.categories) {
        console.log(`Business has categories array field! Length: ${data.categories.length}`);
    } else {
        console.log("No categories array field in business document.");
    }
}
run().then(() => process.exit());
