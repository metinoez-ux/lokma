const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businesses = await db.collection('businesses').get();
    for (const doc of businesses.docs) {
        const cats = await doc.ref.collection('categories').get();
        if (cats.docs.length > 50) {
            console.log(`Business ${doc.id} (${doc.data().name}) has ${cats.docs.length} categories!`);
        }
    }
    console.log("Done checking categories");
}
run().then(() => process.exit());
