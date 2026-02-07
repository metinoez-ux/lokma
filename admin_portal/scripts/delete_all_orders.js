const admin = require('firebase-admin');

// Initialize with Application Default Credentials
admin.initializeApp({
    projectId: 'aylar-a45af'
});

const db = admin.firestore();

async function deleteAllOrders() {
    console.log('🗑️ Deleting all orders from meat_orders collection...');

    const collection = db.collection('meat_orders');
    const snapshot = await collection.get();

    if (snapshot.empty) {
        console.log('✅ No orders found - collection is already empty!');
        return;
    }

    console.log(`Found ${snapshot.size} orders to delete...`);

    // Delete in batches of 500 (Firestore limit)
    let deleted = 0;

    while (true) {
        const batch = db.batch();
        const docs = await collection.limit(500).get();

        if (docs.empty) break;

        docs.forEach(doc => {
            batch.delete(doc.ref);
            deleted++;
        });

        await batch.commit();
        console.log(`Deleted ${deleted} orders so far...`);
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
