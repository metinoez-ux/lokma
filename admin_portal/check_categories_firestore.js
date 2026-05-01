const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businessId = 'aOTmMmSArHjBbym459j5'; // Hilal Market
    const catsRef = db.collection('businesses').doc(businessId).collection('categories');
    
    const cats = await catsRef.get();
    console.log(`Docs count: ${cats.size}`);
    cats.forEach(doc => {
        console.log(`Cat: ${doc.id} ->`, JSON.stringify(doc.data()));
    });
}
run().then(() => process.exit());
