const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const cats = await db.collection('businesses').doc('aOTmMmSArHjBbym459j5').collection('categories').get();
    console.log(`Categories count: ${cats.docs.length}`);
    if (cats.docs.length > 0) {
        console.log(cats.docs.map(d => ({id: d.id, name: d.data().name})).slice(0, 10));
    }
}
run().then(() => process.exit());
