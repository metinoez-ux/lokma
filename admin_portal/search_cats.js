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
        if (cats.size > 20) {
            console.log(`Business ${biz.id} (${biz.data().companyName || biz.data().brand || 'unnamed'}) has ${cats.size} categories.`);
        }
    }
}
run().then(() => process.exit());
