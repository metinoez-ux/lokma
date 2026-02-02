/**
 * Firebase Admin SDK Import Script for Foodpaket Products
 * 
 * This script imports products from Foodpaket.de into the LOKMA Master Catalog
 * with full product details including ingredients, allergens, and nutrition.
 * 
 * Requirements:
 * 1. Firebase Admin SDK service account key
 * 2. Run: npm install firebase-admin
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 * 
 * Run: node import_to_firestore.js
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
    // Use Application Default Credentials with explicit project ID
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

// Category mapping from Foodpaket German to LOKMA categories
const CATEGORY_MAPPING = {
    // Dairy
    'joghurt': 'Milchprodukte',
    'kase': 'Milchprodukte',
    'milch': 'Milchprodukte',
    'ayran': 'Milchprodukte',

    // Meat
    'sucuk': 'Et Ürünleri',
    'wurstchen': 'Et Ürünleri',
    'aufschnitt': 'Et Ürünleri',
    'fleischprodukte': 'Et Ürünleri',
    'grillfleisch': 'Et Ürünleri',

    // Deli
    'aufstrich': 'Şarküteri',

    // Pantry  
    'reis': 'Temel Gıda',
    'nudeln': 'Temel Gıda',
    'hulsenfruchte': 'Temel Gıda',
    'konserven': 'Temel Gıda',

    // Beverages
    'getranke': 'İçecekler',
    'softdrinks': 'İçecekler',
    'safte': 'İçecekler',
    'wasser': 'İçecekler',

    // Snacks
    'snacks': 'Atıştırmalık',
    'chips-und-co': 'Atıştırmalık',
    'sussigkeiten': 'Atıştırmalık',
    'schokolade': 'Atıştırmalık',
    'kekse-geback': 'Atıştırmalık',

    // Spices
    'gewurze-mischungen': 'Baharat',

    // Olives & Pickles
    'oliven-und-eingelegtes': 'Zeytin & Turşu',

    // Bakery
    'teigwaren': 'Unlu Mamüller',
    'backmischungen': 'Unlu Mamüller',

    // Vegan
    'vegan': 'Vejeteryan & Vegan',

    // Default
    'default': 'Diğer'
};

// Generate SKU from product name and brand
function generateSKU(name, brand) {
    const brandCode = (brand || 'GEN').substring(0, 3).toUpperCase();
    const nameCode = name
        .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇäöüÄÖÜß]/g, '')
        .substring(0, 6)
        .toUpperCase();
    const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `FP-${brandCode}-${nameCode}-${hash}`;
}

// Map category slug to LOKMA category
function mapCategory(slug) {
    for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
        if (slug && slug.toLowerCase().includes(key)) {
            return value;
        }
    }
    return 'Diğer';
}

// Parse weight from product name (e.g., "500g", "1kg", "1l")
function parseWeight(name) {
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|L)\b/i);
    if (match) {
        return {
            value: parseFloat(match[1].replace(',', '.')),
            unit: match[2].toLowerCase()
        };
    }
    return null;
}

// Determine default unit based on category
function getDefaultUnit(name, category) {
    const weight = parseWeight(name);
    if (weight) {
        if (['g', 'kg'].includes(weight.unit)) return 'kg';
        if (['ml', 'l'].includes(weight.unit)) return 'Liter';
    }

    if (category.includes('Et') || category.includes('Peynir')) return 'kg';
    if (category.includes('İçecek')) return 'Adet';
    return 'Adet';
}

// Main import function
async function importProducts() {
    console.log('\n🚀 Starting Foodpaket to LOKMA Master Catalog Import\n');

    // Read products from JSON
    const productsPath = path.join(__dirname, 'foodpaket_products.json');
    const collectionsPath = path.join(__dirname, 'foodpaket_collections.json');

    if (!fs.existsSync(productsPath)) {
        console.error('❌ Products file not found. Run parse_sitemaps.js first.');
        process.exit(1);
    }

    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    let collections = [];
    if (fs.existsSync(collectionsPath)) {
        collections = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
    }

    console.log(`📦 Found ${products.length} products`);
    console.log(`📁 Found ${collections.length} collections\n`);

    // Step 1: Delete existing demo products if requested
    const args = process.argv;
    if (args.includes('--delete-demo')) {
        console.log('🗑️ Deleting existing demo products...');
        const masterRef = db.collection('master_products');
        const snapshot = await masterRef.where('sourcePlatform', '==', 'demo').get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`   Deleted ${snapshot.size} demo products\n`);
    }

    // Step 2: Import categories
    console.log('📁 Importing categories...');
    const categoriesRef = db.collection('master_categories');
    const existingCats = await categoriesRef.get();
    const existingCatSlugs = new Set(existingCats.docs.map(d => d.data().slug));

    let categoryCount = 0;
    for (const col of collections) {
        if (!existingCatSlugs.has(col.slug)) {
            await categoriesRef.add({
                slug: col.slug,
                name: col.name,
                nameDe: col.name,
                imageUrl: col.imageUrl,
                sourcePlatform: 'foodpaket',
                isActive: true,
                order: categoryCount,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            categoryCount++;
        }
    }
    console.log(`   Added ${categoryCount} new categories\n`);

    // Step 3: Import products in batches
    console.log('📦 Importing products...');
    const BATCH_SIZE = 500;
    let importedCount = 0;
    let skippedCount = 0;

    // Check for existing products to prevent duplicates
    const masterProductsRef = db.collection('master_products');
    const existingProducts = await masterProductsRef.where('sourcePlatform', '==', 'foodpaket').get();
    const existingSlugs = new Set(existingProducts.docs.map(d => d.data().sourceSlug));

    console.log(`   Found ${existingSlugs.size} existing Foodpaket products\n`);

    let batch = db.batch();
    let batchCount = 0;

    for (const product of products) {
        // Skip if already exists
        if (existingSlugs.has(product.slug)) {
            skippedCount++;
            continue;
        }

        const category = mapCategory(product.slug);
        const sku = generateSKU(product.name, product.brand);
        const weight = parseWeight(product.name);

        const docData = {
            // Identifiers
            sku: sku,
            sourceSlug: product.slug,
            sourceUrl: product.url,
            sourcePlatform: 'foodpaket',

            // Basic Info
            name: product.name,
            nameDe: product.name, // German name (original)
            brand: product.brand || null,

            // Categorization
            category: category,
            categorySlug: product.slug.split('-')[0], // First part as category hint

            // Images
            imageUrl: product.imageUrl || null,
            images: product.imageUrl ? [product.imageUrl] : [],

            // Unit & Price (to be set by businesses)
            defaultUnit: getDefaultUnit(product.name, category),
            defaultPrice: null, // Price is set per-business

            // Weight/Volume
            netWeight: weight ? `${weight.value}${weight.unit}` : null,
            weightValue: weight?.value || null,
            weightUnit: weight?.unit || null,

            // Extended fields (to be populated from detailed scraping)
            description: null,
            descriptionDe: null, // German description
            ingredients: null,
            ingredientsDe: null, // German ingredients (Zutatenliste)
            allergens: [],
            allergenWarning: null,

            // Nutrition (per 100g)
            nutrition: {
                energy: null,      // kJ/kcal
                fat: null,         // g
                saturatedFat: null,// g
                carbohydrates: null,// g
                sugar: null,       // g
                protein: null,     // g
                salt: null,        // g
                fiber: null        // g
            },

            // Storage & Hints
            storageInstructions: null,
            storageInstructionsDe: null,

            // Manufacturer
            manufacturer: null,
            manufacturerAddress: null,
            countryOfOrigin: null,

            // Status & Visibility
            isActive: true,
            visibility: 'super_admin_only', // Only super admin can see initially
            allowedBusinessTypes: ['market', 'supermarket', 'bakery', 'restaurant'],

            // Metadata
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            importedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastmod: product.lastmod || null
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
    console.log(`\n💡 Products are imported with visibility: 'super_admin_only'`);
    console.log(`   Update visibility to 'all' to make them available to all businesses.`);
}

// Export categories mapping for reference
async function exportCategoryMapping() {
    const products = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'foodpaket_products.json'), 'utf8'
    ));

    const categories = {};
    products.forEach(p => {
        const cat = mapCategory(p.slug);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(p.name);
    });

    console.log('\n📊 Category Distribution:\n');
    Object.entries(categories)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([cat, prods]) => {
            console.log(`${cat}: ${prods.length} products`);
        });
}

// Run
if (process.argv.includes('--dry-run')) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
    exportCategoryMapping();
} else {
    importProducts().catch(console.error);
}
