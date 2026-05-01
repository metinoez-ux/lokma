const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const prods = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').collection('products').get();
    let categories = new Set();
    prods.docs.forEach(d => {
        const p = d.data();
        if (p.category) {
            categories.add(p.category);
        } else if (p.categoryData) {
            categories.add(p.categoryData.de || p.categoryData.tr || 'unknown');
        }
    });
    console.log(`Unique categories in products: ${categories.size}`);
    if (categories.size > 0) {
        console.log(Array.from(categories));
    }
}
run().then(() => process.exit());
