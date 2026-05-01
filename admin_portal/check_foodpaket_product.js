const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json')) });
const db = admin.firestore();

async function run() {
    const p = await db.collection('master_products').where('brand', '==', 'Foodpaket').limit(5).get();
    p.forEach(doc => console.log(doc.data().category, doc.data().subCategory, doc.data().kategoriler));
}
run().then(() => process.exit());
