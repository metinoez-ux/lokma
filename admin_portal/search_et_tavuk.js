const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businesses = await db.collection('businesses').get();
    for (const biz of businesses.docs) {
        const cats = await db.collection('businesses').doc(biz.id).collection('categories').get();
        for (const cat of cats.docs) {
            let catName = cat.data().name;
            if (typeof catName === 'object') catName = catName.tr || catName.de || '';
            if (catName === 'Et & Tavuk') {
                console.log(`Found "Et & Tavuk" in Business: ${biz.id} (${biz.data().companyName || biz.data().brand})`);
                console.log(`It has ${cats.size} categories.`);
            }
        }
    }
}
run().then(() => process.exit());
