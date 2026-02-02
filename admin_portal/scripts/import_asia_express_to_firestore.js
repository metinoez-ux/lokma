/**
 * Asia Express Firestore Import Script
 * 
 * Imports 4,517 products from Asia Express Food into LOKMA Master Catalog
 * 
 * Run: node import_asia_express_to_firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Project Configuration
const FIREBASE_PROJECT_ID = 'aylar-a45af';

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, '../../service-account-key.json');

if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId: FIREBASE_PROJECT_ID
    });
} else {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

// Category mapping from Asia Express German to LOKMA Turkish categories
const CATEGORY_MAPPING = {
    'frische-produkte': { name: 'Taze Ürünler', nameTr: 'Taze Ürünler' },
    'konservierte-produkte': { name: 'Konserve Ürünler', nameTr: 'Konserve Ürünler' },
    'getrocknete-produkte': { name: 'Kurutulmuş Ürünler', nameTr: 'Kurutulmuş Ürünler' },
    'reis': { name: 'Pirinç', nameTr: 'Pirinç' },
    'nudeln-instantprodukte': { name: 'Makarna & Hazır Ürünler', nameTr: 'Makarna & Hazır Ürünler' },
    'mehl-starke-panko': { name: 'Un & Nişasta', nameTr: 'Un & Nişasta' },
    'krauter-gewurze': { name: 'Baharat', nameTr: 'Baharat & Otlar' },
    'saucen': { name: 'Soslar', nameTr: 'Soslar' },
    'ole-butter': { name: 'Yağ & Tereyağı', nameTr: 'Yağ & Tereyağı' },
    'kokosmilch-sahne-pulver': { name: 'Hindistancevizi & Kremalar', nameTr: 'Hindistancevizi & Kremalar' },
    'getranke': { name: 'İçecekler', nameTr: 'İçecekler' },
    'milch-milchpulver': { name: 'Süt & Süt Tozu', nameTr: 'Süt & Süt Tozu' },
    'sussigkeiten-snacks': { name: 'Tatlılar & Atıştırmalıklar', nameTr: 'Tatlılar & Atıştırmalıklar' },
    'kosmetik-haare': { name: 'Kozmetik', nameTr: 'Kozmetik & Saç Bakımı' },
    'non-food': { name: 'Gıda Dışı', nameTr: 'Gıda Dışı Ürünler' },
    'tiefkuhlprodukte': { name: 'Dondurulmuş Ürünler', nameTr: 'Dondurulmuş Ürünler' },
    'halb-frisch': { name: 'Yarı Taze', nameTr: 'Yarı Taze Ürünler' }
};

// Generate SKU from product data
function generateSKU(name, brand, sku) {
    if (sku && sku.trim()) {
        return `AE-${sku.trim()}`;
    }
    const brandCode = (brand || 'GEN').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const nameCode = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
    const hash = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `AE-${brandCode}-${nameCode}-${hash}`;
}

// Parse content/weight field (e.g., "50 X 100 G", "1 X 20 KG")
function parseContent(content) {
    if (!content) return { pack: null, weight: null, unit: null };

    const match = content.match(/(\d+)\s*X\s*(\d+(?:[.,]\d+)?)\s*(G|KG|ML|L|STK)/i);
    if (match) {
        return {
            pack: parseInt(match[1]),
            weight: parseFloat(match[2].replace(',', '.')),
            unit: match[3].toUpperCase()
        };
    }
    return { pack: null, weight: null, unit: null };
}

// Get default unit based on category
function getDefaultUnit(categorySlug) {
    if (['getranke', 'kokosmilch-sahne-pulver'].includes(categorySlug)) return 'Adet';
    if (['tiefkuhlprodukte', 'frische-produkte', 'halb-frisch'].includes(categorySlug)) return 'kg';
    return 'Adet';
}

// Main import function
async function importProducts() {
    console.log('\n🚀 Starting Asia Express to LOKMA Master Catalog Import\n');

    // Read products from JSON
    const productsPath = path.join(__dirname, 'asia_express_products.json');

    if (!fs.existsSync(productsPath)) {
        console.error('❌ Products file not found. Run scrape_asia_puppeteer.js first.');
        process.exit(1);
    }

    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`📦 Found ${products.length} products to import\n`);

    // Step 1: Import categories
    console.log('📁 Importing/updating categories...');
    const categoriesRef = db.collection('master_categories');
    const existingCats = await categoriesRef.where('sourcePlatform', '==', 'asia_express').get();
    const existingCatSlugs = new Set(existingCats.docs.map(d => d.data().slug));

    let categoryCount = 0;
    for (const [slug, catData] of Object.entries(CATEGORY_MAPPING)) {
        if (!existingCatSlugs.has(slug)) {
            await categoriesRef.add({
                slug: slug,
                name: catData.name,
                nameTr: catData.nameTr,
                nameDe: catData.name,
                sourcePlatform: 'asia_express',
                isActive: true,
                order: categoryCount,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            categoryCount++;
        }
    }
    console.log(`   Added ${categoryCount} new categories\n`);

    // Step 2: Check for existing products
    console.log('🔍 Checking for existing products...');
    const masterProductsRef = db.collection('master_products');
    const existingProducts = await masterProductsRef.where('sourcePlatform', '==', 'asia_express').get();
    const existingUrls = new Set(existingProducts.docs.map(d => d.data().sourceUrl));
    console.log(`   Found ${existingUrls.size} existing Asia Express products\n`);

    // Step 3: Import products in batches
    console.log('📦 Importing products...');
    const BATCH_SIZE = 500;
    let importedCount = 0;
    let skippedCount = 0;

    let batch = db.batch();
    let batchCount = 0;

    for (const product of products) {
        // Skip if already exists
        if (existingUrls.has(product.productUrl)) {
            skippedCount++;
            continue;
        }

        const categoryData = CATEGORY_MAPPING[product.categorySlug] || { name: 'Diğer', nameTr: 'Diğer' };
        const contentParsed = parseContent(product.content);
        const sku = generateSKU(product.name, product.brand, product.sku);

        const docData = {
            // Identifiers
            sku: sku,
            originalSku: product.sku || null,
            sourceUrl: product.productUrl,
            sourcePlatform: 'asia_express',

            // Basic Info
            name: product.name,
            nameDe: product.name,
            brand: product.brand || null,

            // Categorization
            category: categoryData.name,
            categoryTr: categoryData.nameTr,
            categorySlug: product.categorySlug,
            categoryOriginal: product.category,

            // Images
            imageUrl: product.imageUrl || null,
            images: product.imageUrl ? [product.imageUrl] : [],

            // Unit & Price
            defaultUnit: getDefaultUnit(product.categorySlug),
            defaultPrice: null,

            // Content/Weight
            contentDescription: product.content || null,
            packSize: contentParsed.pack,
            netWeight: contentParsed.weight ? `${contentParsed.weight}${contentParsed.unit}` : null,
            weightValue: contentParsed.weight,
            weightUnit: contentParsed.unit,

            // Extended fields (to be populated later)
            description: null,
            ingredients: null,
            allergens: [],

            // Status & Visibility
            isActive: true,
            visibility: 'super_admin_only',
            allowedBusinessTypes: ['market', 'supermarket', 'restaurant', 'asia_market'],

            // Metadata
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            importedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = masterProductsRef.doc();
        batch.set(docRef, docData);
        batchCount++;
        importedCount++;

        // Commit batch when full
        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`   ✓ Imported ${importedCount} products...`);
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`\n📊 Import Complete!`);
    console.log(`   ✅ Imported: ${importedCount} products`);
    console.log(`   ⏭️ Skipped (existing): ${skippedCount} products`);
    console.log(`   📁 Categories: ${categoryCount} new`);
    console.log(`\n💡 Products imported with visibility: 'super_admin_only'`);

    // Save import report
    const report = {
        timestamp: new Date().toISOString(),
        source: 'asia_express',
        totalProducts: products.length,
        imported: importedCount,
        skipped: skippedCount,
        newCategories: categoryCount
    };
    fs.writeFileSync(
        path.join(__dirname, 'asia_express_import_report.json'),
        JSON.stringify(report, null, 2)
    );
    console.log(`\n📄 Import report saved to asia_express_import_report.json`);
}

// Run
if (process.argv.includes('--dry-run')) {
    console.log('🧪 DRY RUN MODE - Showing category stats\n');
    const products = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'asia_express_products.json'), 'utf8'
    ));
    const categories = {};
    products.forEach(p => {
        const cat = p.categorySlug || 'unknown';
        categories[cat] = (categories[cat] || 0) + 1;
    });
    console.log('📊 Category Distribution:\n');
    Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => console.log(`  ${cat}: ${count} products`));
} else {
    importProducts().catch(console.error);
}
