const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Read service account from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
if (!match) {
    console.error('Could not find FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
    process.exit(1);
}

const serviceAccount = JSON.parse(match[1]);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'aylar-a45af'
});

const db = admin.firestore();

async function listOrders() {
    console.log('\n=== MEAT_ORDERS COLLECTION (aylar-a45af) ===\n');
    const meatOrders = await db.collection('meat_orders').get();
    console.log('Total orders: ' + meatOrders.size);

    meatOrders.forEach(doc => {
        const data = doc.data();
        console.log('\n[' + doc.id + '] #' + doc.id.substring(0, 6).toUpperCase());
        console.log('  Status: ' + data.status);
        console.log('  Business: ' + (data.butcherName || 'N/A'));
        console.log('  CourierId: ' + (data.courierId || 'NONE'));
        console.log('  Total: €' + data.totalAmount);
    });

    process.exit(0);
}

listOrders().catch(e => { console.error(e); process.exit(1); });
