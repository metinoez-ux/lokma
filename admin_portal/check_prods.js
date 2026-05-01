const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businessId = 'aOTmMmSArHjBbym459j5'; // Hilal Market
    const prods = await db.collection('businesses').doc(businessId).collection('products').get();
    let cats = new Set();
    prods.forEach(d => {
        const cat = d.data().category;
        cats.add(cat);
    });
    console.log(`Unique categories in products: ${cats.size}`);
    console.log(Array.from(cats));
}
run().then(() => process.exit());
