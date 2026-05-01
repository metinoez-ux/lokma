const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const prods = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').collection('products').get();
    const categories = new Set();
    prods.docs.forEach(doc => {
        categories.add(doc.data().category);
    });
    console.log(`Unique Categories in Products: ${categories.size}`);
    console.log(Array.from(categories));
}
run().then(() => process.exit());
