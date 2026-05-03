const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();
async function run() {
    const p = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').collection('products').limit(1).get();
    p.forEach(d => console.log(d.data()));
}
run().catch(console.error);
