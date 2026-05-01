const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businesses = await db.collection('businesses').get();
    let hilal = null;
    businesses.forEach(doc => {
        const name = doc.data().companyName || doc.data().brand || '';
        if (name.toLowerCase().includes('hilal')) hilal = doc;
    });
    
    if (!hilal) return;
    
    const cats = await db.collection('businesses').doc(hilal.id).collection('categories').get();
    console.log("Categories subcollection count:", cats.size);
    if(cats.size > 0) {
        cats.docs.slice(0,5).forEach(d => console.log(d.id, JSON.stringify(d.data(), null, 2)));
    }
}
run().then(() => process.exit());
