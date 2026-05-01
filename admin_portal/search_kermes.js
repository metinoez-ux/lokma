const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const kermeses = await db.collection('kermeses').get();
    for (const k of kermeses.docs) {
        const cats = await db.collection('kermeses').doc(k.id).collection('categories').get();
        if (cats.size > 20) {
            console.log(`Kermes ${k.id} (${k.data().eventName || 'unnamed'}) has ${cats.size} categories.`);
        }
    }
}
run().then(() => process.exit());
