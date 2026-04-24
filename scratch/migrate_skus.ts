import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin SDK initialization
const serviceAccountPath = path.resolve(__dirname, '../admin_portal/service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ service-account.json bulunamadı! Yol: ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

function generateRandomSKU(prefix: 'M' | 'B'): string {
    const randomPart = Math.floor(10000 + Math.random() * 90000).toString();
    return `${prefix}-${randomPart}`;
}

async function migrateSKUs() {
    console.log('🚀 Starting SKU Migration...');

    try {
        // 1. Migrate master_products
        console.log('\n📦 Migrating master_products...');
        const masterProductsRef = db.collection('master_products');
        const masterSnapshot = await masterProductsRef.get();

        let masterUpdateCount = 0;
        let masterBatch = db.batch();
        let masterBatchCount = 0;

        for (const doc of masterSnapshot.docs) {
            const data = doc.data();
            if (!data.sku) {
                const newSku = generateRandomSKU('M');
                masterBatch.update(doc.ref, { sku: newSku });
                masterUpdateCount++;
                masterBatchCount++;

                if (masterBatchCount >= 500) {
                    await masterBatch.commit();
                    masterBatch = db.batch();
                    masterBatchCount = 0;
                }
            }
        }
        
        if (masterBatchCount > 0) {
            await masterBatch.commit();
        }
        console.log(`✅ Updated ${masterUpdateCount} master_products with M-SKUs.`);

        // 2. Migrate custom products in all businesses
        console.log('\n🏪 Migrating businesses/{businessId}/products...');
        const businessesRef = db.collection('businesses');
        const businessesSnapshot = await businessesRef.get();

        let customUpdateCount = 0;
        let businessBatch = db.batch();
        let businessBatchCount = 0;

        for (const businessDoc of businessesSnapshot.docs) {
            const productsRef = businessDoc.ref.collection('products');
            const productsSnapshot = await productsRef.get();

            for (const productDoc of productsSnapshot.docs) {
                const productData = productDoc.data();
                
                // If it is a custom product (no masterId) and has no sku
                if (!productData.masterId && !productData.sku) {
                    const newSku = generateRandomSKU('B');
                    businessBatch.update(productDoc.ref, { sku: newSku });
                    customUpdateCount++;
                    businessBatchCount++;

                    if (businessBatchCount >= 500) {
                        await businessBatch.commit();
                        businessBatch = db.batch();
                        businessBatchCount = 0;
                    }
                }
            }
        }

        if (businessBatchCount > 0) {
            await businessBatch.commit();
        }
        console.log(`✅ Updated ${customUpdateCount} custom business products with B-SKUs.`);

        console.log('\n🎉 SKU Migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration Error:', error);
        process.exit(1);
    }
}

migrateSKUs();
