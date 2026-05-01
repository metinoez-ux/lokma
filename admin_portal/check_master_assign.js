const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const prods = await db.collection('master_products').get();
    let assignedCount = 0;
    let assignedCats = new Set();
    prods.docs.forEach(d => {
        const p = d.data();
        if (p.assignedBusinessIds && p.assignedBusinessIds.includes('aOTmMmSArHjBbym459j5')) {
            assignedCount++;
            if (p.category) assignedCats.add(p.category);
            else if (p.categoryData) assignedCats.add(p.categoryData.de || p.categoryData.tr || 'unknown');
        }
    });
    console.log(`Master products assigned to Hilal Market: ${assignedCount}`);
    console.log(`Unique categories in assigned master products: ${assignedCats.size}`);
    if (assignedCats.size > 0) {
        console.log(Array.from(assignedCats));
    }
}
run().then(() => process.exit());
