const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const prods = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').collection('products').limit(5).get();
    prods.docs.forEach(p => {
        console.log(`Product ${p.id}:`);
        console.log(`- category:`, p.data().category);
        console.log(`- categoryData:`, p.data().categoryData);
    });
}
run().then(() => process.exit());
