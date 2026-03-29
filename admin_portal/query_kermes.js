require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const saKey = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) {
    console.error("No service account key found in env.");
    process.exit(1);
}

const parsedServiceAccount = JSON.parse(saKey);
const adminApp = initializeApp({
    credential: cert(parsedServiceAccount)
});
const db = getFirestore(adminApp);

async function check() {
    const snapshot = await db.collection('kermes_events').get();
    
    let total = snapshot.docs.length;
    let isActiveCount = 0;
    let notArchivedCount = 0;
    let validDateCount = 0;
    let hasLocationCount = 0;
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); 

    for (let doc of snapshot.docs) {
        const data = doc.data();
        let active = data.isActive === true;
        let archived = data.isArchived === true;
        
        if (active) isActiveCount++;
        if (!archived) notArchivedCount++;
        
        let startDate = data.startDate ? data.startDate.toDate() : (data.date ? data.date.toDate() : new Date());
        let endDate = data.endDate ? data.endDate.toDate() : new Date(startDate.getTime() + 12 * 60 * 60 * 1000);
        
        let validDate = endDate >= cutoff;
        if (validDate) validDateCount++;

        if (active && !archived && validDate) hasLocationCount++;
    }

    console.log(`Total Kermes in DB: ${total}`);
    console.log(`isActive == true: ${isActiveCount}`);
    console.log(`isArchived == false: ${notArchivedCount}`);
    console.log(`EndDate >= -1 day: ${validDateCount}`);
    console.log(`Surviving app filters (Active + !Archived + Valid Date): ${hasLocationCount}`);
}

check().catch(console.error);
