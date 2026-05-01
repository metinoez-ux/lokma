const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const masterProductsSnap = await db.collection('master_products').get();
    const kasapProducts = masterProductsSnap.docs
        .map(d => d.data())
        .filter(p => p.allowedBusinessTypes && p.allowedBusinessTypes.includes('kasap'));

    const uniqueCats = Array.from(new Set(kasapProducts.map(p => {
        if(typeof p.category === 'object') return p.category.tr || p.category.de || p.category.en;
        return p.category;
    }).filter(Boolean)));
    
    console.log(`Kasap categories count: ${uniqueCats.length}`);
    if (uniqueCats.length > 50) {
        console.log(uniqueCats.slice(0, 10));
    }
}
run().then(() => process.exit());
