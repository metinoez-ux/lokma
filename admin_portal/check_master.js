const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const p = await db.collection('master_products').where('brand', '==', 'Foodpaket').limit(1).get();
    if(p.size > 0) {
        console.log(p.docs[0].data().allowedBusinessTypes);
    }
}
run().then(() => process.exit());
