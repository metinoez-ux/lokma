const admin = require('firebase-admin');

// Ensure we don't initialize twice
if (!admin.apps.length) {
    // We assume the environment has GOOGLE_APPLICATION_CREDENTIALS set or similar, 
    // but the LOKMA project uses iot-gateway or scripts with admin config.
    // Let's use the standard service account if available, or just standard initializeApp().
    const serviceAccountPath = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/serviceAccountKey.json';
    try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        // Fallback
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
    try {
        const snap = await db.collection('kermes_events').get();
        console.log(`Total events in DB: ${snap.size}`);
        
        let activeCount = 0;
        let pastCount = 0;
        let archivedCount = 0;
        let inactiveCount = 0;

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.isArchived) {
                archivedCount++;
                return;
            }
            if (data.isActive !== true) {
                inactiveCount++;
                return;
            }
            
            let endDate;
            if (data.endDate) {
                endDate = data.endDate.toDate();
            } else if (data.startDate) {
                endDate = new Date(data.startDate.toDate());
                endDate.setHours(endDate.getHours() + 12);
            } else if (data.date) {
                endDate = new Date(data.date.toDate());
                endDate.setHours(endDate.getHours() + 12);
            } else {
                endDate = new Date();
            }

            if (endDate < yesterday) {
                pastCount++;
                return;
            }

            activeCount++;
            console.log(`- Active: ${data.name || data.title} (${doc.id})`);
        });

        console.log('');
        console.log('--- SUMMARY ---');
        console.log(`Active & Valid: ${activeCount}`);
        console.log(`Inactive (isActive=false): ${inactiveCount}`);
        console.log(`Archived (isArchived=true): ${archivedCount}`);
        console.log(`Expired (endDate < yesterday): ${pastCount}`);
        console.log('---------------');
        
    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

run();
