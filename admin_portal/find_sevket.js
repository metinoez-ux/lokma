const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function findSevket() {
    const allAdmins = await db.collection("admins").get();
    console.log(`Total admins: ${allAdmins.size}`);
    let found = false;
    allAdmins.forEach(doc => {
        const data = doc.data();
        const name = (data.displayName || data.name || '').toLowerCase();
        if (name.includes('sevket') || name.includes('şevket') || name.includes('sev')) {
            found = true;
            console.log(`\n--- FOUND ---`);
            console.log(`  UID: ${doc.id}`);
            console.log(`  displayName: ${data.displayName}`);
            console.log(`  adminType: ${data.adminType}`);
            console.log(`  butcherId: ${data.butcherId}`);
            console.log(`  email: ${data.email}`);
            console.log(`  phone: ${data.phone}`);
            console.log(`  permissionGroupId: ${data.permissionGroupId}`);
            console.log(`  permissions keys: ${data.permissions ? Object.keys(data.permissions).length : 'none'}`);
        }
    });
    if (!found) {
        console.log('\nSevket not found. Listing all admins with adminType=super:');
        allAdmins.forEach(doc => {
            const data = doc.data();
            if (data.adminType === 'super') {
                console.log(`  UID: ${doc.id} | name: ${data.displayName} | email: ${data.email} | phone: ${data.phone}`);
            }
        });
    }
    process.exit(0);
}

findSevket().catch(err => { console.error(err); process.exit(1); });
