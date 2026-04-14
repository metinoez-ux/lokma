const admin = require('firebase-admin');
const serviceAccount = require('/Users/metinoz/Developer/LOKMA_MASTER/.agents/lokma-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function check() {
    const snap = await db.collection('businesses')
        .where('companyName', '==', 'Günes Supermarkt')
        .get();
    if (snap.empty) {
        console.log("Not found.");
        return;
    }
    snap.docs.forEach(doc => {
        const d = doc.data();
        console.log("ID:", doc.id);
        console.log("type:", d.type);
        console.log("types:", d.types);
        console.log("sellsTunaProducts:", d.sellsTunaProducts);
        console.log("sellsTorosProducts:", d.sellsTorosProducts);
        console.log("brand:", d.brand);
        console.log("isTunaPartner:", d.isTunaPartner);
    });
}
check().catch(console.error).then(() => process.exit(0));
