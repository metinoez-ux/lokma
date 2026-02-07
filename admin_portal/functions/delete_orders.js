const admin = require('firebase-admin');

// Initialize with explicit project ID
process.env.GCLOUD_PROJECT = 'lokma-71e498';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'lokma-71e498' });

admin.initializeApp({
    projectId: 'lokma-71e498'
});

const db = admin.firestore();

async function deleteAllOrders() {
    console.log('🗑️ Deleting all orders from meat_orders collection...');

    const collection = db.collection('meat_orders');
    let snapshot = await collection.get();

    if (snapshot.empty) {
        console.log('✅ No orders found - collection is already empty!');
        return;
    }

    console.log(`Found ${snapshot.size} orders to delete...`);

    // Delete in batches
    let deleted = 0;

    for (const doc of snapshot.docs) {
        await doc.ref.delete();
        deleted++;
        if (deleted % 10 === 0) {
            console.log(`Deleted ${deleted} orders...`);
        }
    }

    console.log(`\n✅ Successfully deleted ${deleted} orders!`);
    console.log('🧹 Collection is now empty - ready for fresh testing.');
}

deleteAllOrders()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
