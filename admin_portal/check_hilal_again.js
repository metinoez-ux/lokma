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
    console.log("Categories count in aOTmMmSArHjBbym459j5:", cats.size);
    
    // Check if there's another Hilal Market?
    const allBiz = await db.collection('businesses').get();
    allBiz.forEach(doc => {
        const name = doc.data().companyName || doc.data().brand || '';
        if (name.toLowerCase().includes('hilal')) {
            console.log("Found Hilal:", doc.id, name);
        }
    });
}
run().then(() => process.exit());
