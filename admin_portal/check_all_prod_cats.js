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
        const prods = await doc.ref.collection('products').get();
        const cats = new Set();
        prods.docs.forEach(p => cats.add(p.data().category));
        if (cats.size > 50) {
            console.log(`Business ${doc.id} (${doc.data().name}) has ${cats.size} unique product categories!`);
        }
    }
    console.log("Done checking products");
}
run().then(() => process.exit());
