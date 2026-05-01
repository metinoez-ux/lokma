const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businesses = await db.collection('businesses').get();
    businesses.forEach(doc => {
        const data = doc.data();
        const name = (data.companyName || '') + ' ' + (data.brand || '') + ' ' + (data.businessName || '');
        if (name.toLowerCase().includes('hilal')) {
            console.log(`Found Hilal: ${doc.id} - ${name}`);
        }
    });
}
run().then(() => process.exit());
