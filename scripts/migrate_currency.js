const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
let serviceAccount;
try {
    serviceAccount = require(path.join(__dirname, '../.secrets/firebase-service-account.json'));
} catch (e) {
    console.log("Service account not found, relying on default credentials or GOOGLE_APPLICATION_CREDENTIALS");
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function migrateCollection(collectionName) {
    console.log(`Migrating collection: ${collectionName}`);
    const snapshot = await db.collection(collectionName).get();

    let count = 0;
    const batchArray = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.currency === undefined || data.currency === null) {
            currentBatch.update(doc.ref, { currency: "EUR" });
            operationCount++;
            count++;

            if (operationCount === 500) {
                batchArray.push(currentBatch);
                currentBatch = db.batch();
                operationCount = 0;
            }
        }
    }

    if (operationCount > 0) {
        batchArray.push(currentBatch);
    }

    for (const batch of batchArray) {
        await batch.commit();
    }

    console.log(`Updated ${count} documents in ${collectionName}.`);
}

async function runMigration() {
    try {
        await migrateCollection('businesses');
        await migrateCollection('butcher_partners');
        await migrateCollection('subscription_plans');
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        process.exit(0);
    }
}

runMigration();
