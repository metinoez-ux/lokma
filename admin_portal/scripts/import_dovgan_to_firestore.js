/**
 * DOVGAN Firestore Import Script
 * ==============================
 * Imports scraped Dovgan products into LOKMA Master Catalog
 * 
 * Usage: node import_dovgan_to_firestore.js [--dry-run]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Project Config
const FIREBASE_PROJECT_ID = 'aylar-a45af';
const PRODUCTS_FILE = path.join(__dirname, 'dovgan_products.json');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log('✅ Using service account key');
} else {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log('✅ Using Application Default Credentials');
}

const db = admin.firestore();

// SKU prefix for Dovgan products
const SKU_PREFIX = 'DVG';

// Category mapping from German to Turkish LOKMA categories
const CATEGORY_MAPPING = {
    'alkoholfreie getränke': 'Alkoholsüz İçecekler',
    'fischkonserven': 'Balık Konserveleri',
    'fleischkonserven': 'Et Konserveleri',
    'fertiggerichte': 'Hazır Yemekler',
    'gemüsekonserven': 'Sebze Konserveleri',
    'mayo, senf, saucen & öl': 'Soslar & Yağlar',
    'getreide, mehl & nudeln': 'Tahıllar & Makarna',
    'snack': 'Atıştırmalıklar',
    'kondensmilch & backware': 'Süt Ürünleri & Unlu Mamüller',
    'süßwaren, gebäck': 'Şekerlemeler & Tatlılar',
    'kaviar': 'Havyar & Deniz Ürünleri',
    'wurstspezialitäten': 'Et & Sosis',
    'frisch & fertig': 'Taze Ürünler',
    'milch, quark': 'Süt & Süt Ürünleri',
    'kosmetik': 'Kozmetik',
    'vorteilspack': 'Avantajlı Paketler'
};

// Tax rates for different product types
const TAX_RATES = {
    food: 7,          // German reduced VAT for food
    beverages: 19,    // Standard VAT for beverages
    kosmetik: 19,     // Standard VAT for cosmetics
    default: 7
};

// Determine tax rate based on category
function getTaxRate(category) {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('getränke') || cat.includes('beverages')) return TAX_RATES.beverages;
    if (cat.includes('kosmetik') || cat.includes('cosmetic')) return TAX_RATES.kosmetik;
    return TAX_RATES.food;
}

// Generate SKU from product data
function generateSKU(product, index) {
    // Use article number if available, otherwise generate from index
    if (product.articleNumber) {
        return `${SKU_PREFIX}-${product.articleNumber}`;
    }
    // Generate from EAN if available
    if (product.ean) {
        return `${SKU_PREFIX}-${product.ean.slice(-6)}`;
    }
    // Fallback to padded index
    return `${SKU_PREFIX}-${String(index + 1).padStart(5, '0')}`;
}

// Parse weight/unit from product data
function parseUnit(product) {
    if (product.weight) {
        return {
            value: product.weight.value,
            unit: product.weight.unit,
            display: `${product.weight.value} ${product.weight.unit}`
        };
    }

    // Try to parse from title
    const title = product.title || product.name || '';
    const match = title.match(/(\d+(?:[,.]?\d*)?)\s*(g|kg|ml|l|L|Stück|St\.?)\b/i);
    if (match) {
        return {
            value: parseFloat(match[1].replace(',', '.')),
            unit: match[2].toLowerCase(),
            display: `${match[1]} ${match[2]}`
        };
    }

    return { value: 1, unit: 'stück', display: '1 Stück' };
}

// Map scraped product to Firestore schema
function mapToFirestoreSchema(product, index) {
    const unit = parseUnit(product);
    const sku = generateSKU(product, index);
    const category = product.lokmaCategory ||
        CATEGORY_MAPPING[product.sourceCategory?.toLowerCase()] ||
        'Diğer';

    return {
        // Core identifiers
        masterProductId: sku,
        sku: sku,
        ean: product.ean || null,
        articleNumber: product.articleNumber || null,

        // Product info
        name: product.title || product.name,
        nameDE: product.title || product.name,
        nameTR: product.title || product.name, // Could be translated later
        description: product.description || null,
        descriptionDE: product.description || null,

        // Categorization
        category: category,
        sourceCategory: product.sourceCategory,

        // Unit and weight
        unit: unit.display,
        unitValue: unit.value,
        unitType: unit.unit,

        // Pricing
        price: product.price || 0,
        priceOriginal: product.priceText || null,
        currency: 'EUR',
        taxRate: getTaxRate(product.sourceCategory),

        // Status
        isActive: true,
        availableForDelivery: true,
        availableForPickup: true,

        // Images
        imageUrl: product.images?.[0] || product.image || null,
        images: product.images || (product.image ? [product.image] : []),

        // Ingredients & Allergens
        ingredients: product.ingredients || null,
        allergens: product.allergens || [],
        allergenInfo: product.allergens?.length > 0 ? product.allergens.join(', ') : null,

        // Nutrition
        nutrition: product.nutrition?.parsed || null,
        nutritionRaw: product.nutrition?.raw || null,
        nutritionPer100g: product.nutrition?.parsed ? {
            energyKJ: product.nutrition.parsed.energyKJ || null,
            energyKcal: product.nutrition.parsed.energyKcal || null,
            fat: product.nutrition.parsed.fat || null,
            saturatedFat: product.nutrition.parsed.saturatedFat || null,
            carbohydrates: product.nutrition.parsed.carbohydrates || null,
            sugar: product.nutrition.parsed.sugar || null,
            fiber: product.nutrition.parsed.fiber || null,
            protein: product.nutrition.parsed.protein || null,
            salt: product.nutrition.parsed.salt || null
        } : null,

        // Source/Origin
        source: 'dovgan',
        sourceUrl: product.url,
        manufacturer: 'DOVGAN GmbH',
        brand: 'DOVGAN',
        origin: 'DE',

        // Visibility (Super Admin Only initially)
        visibility: 'super_admin_only',

        // Metadata
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        scrapedAt: product.scrapedAt ? new Date(product.scrapedAt) : new Date(),
        importedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

// Import products to Firestore
async function importProducts(dryRun = false) {
    console.log('📦 DOVGAN Firebase Import\n');

    // Check if products file exists
    if (!fs.existsSync(PRODUCTS_FILE)) {
        console.error(`❌ Products file not found: ${PRODUCTS_FILE}`);
        console.log('   Run scrape_dovgan.js first to generate the products file.');
        process.exit(1);
    }

    // Load products
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    console.log(`📊 Loaded ${products.length} products from ${PRODUCTS_FILE}`);

    if (dryRun) {
        console.log('\n🧪 DRY RUN MODE - No data will be written to Firestore\n');
    }

    // Statistics
    const stats = {
        total: products.length,
        withEAN: 0,
        withoutEAN: 0,
        withNutrition: 0,
        withIngredients: 0,
        withImages: 0,
        byCategory: {},
        imported: 0,
        errors: 0
    };

    // Process products
    const batch = db.batch();
    const BATCH_SIZE = 500;
    let batchCount = 0;

    for (let i = 0; i < products.length; i++) {
        const product = products[i];

        try {
            const firestoreDoc = mapToFirestoreSchema(product, i);

            // Update stats
            if (firestoreDoc.ean) stats.withEAN++;
            else stats.withoutEAN++;

            if (firestoreDoc.nutrition) stats.withNutrition++;
            if (firestoreDoc.ingredients) stats.withIngredients++;
            if (firestoreDoc.imageUrl) stats.withImages++;

            const cat = firestoreDoc.category;
            stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

            if (!dryRun) {
                const docRef = db.collection('master_products').doc(firestoreDoc.sku);
                batch.set(docRef, firestoreDoc);
                batchCount++;

                // Commit batch when it reaches the limit
                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`   Committed batch of ${batchCount} products`);
                    batchCount = 0;
                }
            }

            stats.imported++;

            // Progress indicator
            if ((i + 1) % 100 === 0) {
                process.stdout.write(`\r   Processing: ${i + 1}/${products.length} (${Math.round((i + 1) / products.length * 100)}%)`);
            }
        } catch (error) {
            console.error(`\n   Error processing product ${i}: ${error.message}`);
            stats.errors++;
        }
    }

    // Commit remaining items in batch
    if (!dryRun && batchCount > 0) {
        await batch.commit();
        console.log(`\n   Committed final batch of ${batchCount} products`);
    }

    // Print summary
    console.log('\n\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Products: ${stats.total}`);
    console.log(`Imported: ${stats.imported}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`\nData Quality:`);
    console.log(`  With EAN: ${stats.withEAN} (${Math.round(stats.withEAN / stats.total * 100)}%)`);
    console.log(`  Without EAN: ${stats.withoutEAN} (${Math.round(stats.withoutEAN / stats.total * 100)}%)`);
    console.log(`  With Nutrition: ${stats.withNutrition} (${Math.round(stats.withNutrition / stats.total * 100)}%)`);
    console.log(`  With Ingredients: ${stats.withIngredients} (${Math.round(stats.withIngredients / stats.total * 100)}%)`);
    console.log(`  With Images: ${stats.withImages} (${Math.round(stats.withImages / stats.total * 100)}%)`);
    console.log(`\nBy Category:`);
    Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            console.log(`  ${cat}: ${count}`);
        });

    if (dryRun) {
        console.log('\n🧪 DRY RUN COMPLETE - No data was written');
        console.log('   Run without --dry-run to actually import the data.');
    } else {
        console.log('\n✅ IMPORT COMPLETE');
    }

    // Save import report
    const report = {
        ...stats,
        importedAt: new Date().toISOString(),
        dryRun
    };
    fs.writeFileSync('dovgan_import_report.json', JSON.stringify(report, null, 2));
    console.log('📝 Saved import report to dovgan_import_report.json');
}

// Run import
const dryRun = process.argv.includes('--dry-run');
importProducts(dryRun)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
