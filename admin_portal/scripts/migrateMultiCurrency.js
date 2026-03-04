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

async function migrateMultiCurrency() {
    console.log('--- MIGRATING BUTCHERS ---');
    const butchersSnapshot = await db.collection('butchers').get();
    let butcherCount = 0;

    // Using simple batching just in case there are many documents
    let batch = db.batch();
    for (const doc of butchersSnapshot.docs) {
        batch.update(doc.ref, {
            currency: 'EUR',
            country: 'DE'
        });
        butcherCount++;
        if (butcherCount % 400 === 0) {
            await batch.commit();
            console.log(`Committed ${butcherCount} butchers`);
            batch = db.batch();
        }
    }
    if (butcherCount % 400 !== 0) {
        await batch.commit();
        console.log(`Committed ${butcherCount} butchers`);
    }

    console.log('--- MIGRATING ORDERS ---');
    const ordersSnapshot = await db.collection('meat_orders').get();
    let orderCount = 0;
    batch = db.batch();
    for (const doc of ordersSnapshot.docs) {
        batch.update(doc.ref, {
            currency: 'EUR'
        });
        orderCount++;
        if (orderCount % 400 === 0) {
            await batch.commit();
            console.log(`Committed ${orderCount} orders`);
            batch = db.batch();
        }
    }
    if (orderCount % 400 !== 0) {
        await batch.commit();
        console.log(`Committed ${orderCount} orders`);
    }

    console.log('--- MIGRATING INVOICES ---');
    const invoicesSnapshot = await db.collection('invoices').get();
    let invoiceCount = 0;
    batch = db.batch();
    for (const doc of invoicesSnapshot.docs) {
        batch.update(doc.ref, {
            currency: 'EUR'
        });
        invoiceCount++;
        if (invoiceCount % 400 === 0) {
            await batch.commit();
            console.log(`Committed ${invoiceCount} invoices`);
            batch = db.batch();
        }
    }
    if (invoiceCount % 400 !== 0) {
        await batch.commit();
        console.log(`Committed ${invoiceCount} invoices`);
    }

    console.log('--- MIGRATING SUBSCRIPTION PLANS ---');
    const plansSnapshot = await db.collection('subscription_plans').get();
    let planCount = 0;
    batch = db.batch();
    for (const doc of plansSnapshot.docs) {
        batch.update(doc.ref, {
            currency: 'EUR'
        });
        planCount++;
        if (planCount % 400 === 0) {
            await batch.commit();
            console.log(`Committed ${planCount} plans`);
            batch = db.batch();
        }
    }
    if (planCount % 400 !== 0) {
        await batch.commit();
        console.log(`Committed ${planCount} plans`);
    }

    console.log('Migration Complete.');
}

migrateMultiCurrency().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
