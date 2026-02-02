/**
 * Asia Express Chunked Scraper
 * =============================
 * Scrapes category by category and saves immediately via API
 * This prevents browser memory crashes from large payloads
 * 
 * USAGE in Browser Console at localhost:3000 (admin portal running):
 * 1. Start the admin portal dev server (npm run dev)
 * 2. Open browser console on localhost:3000
 * 3. Paste and run this entire script
 * 4. Monitor progress in console - each category saves immediately
 */

const CATEGORIES = [
    { name: 'Frische Produkte', slug: 'frische-produkte', count: 167 },
    { name: 'Konservierte Produkte', slug: 'konservierte-produkte', count: 190 },
    { name: 'Getrocknete Produkte', slug: 'getrocknete-produkte', count: 143 },
    { name: 'Reis', slug: 'reis', count: 140 },
    { name: 'Nudeln & Instantprodukte', slug: 'nudeln-instantprodukte', count: 447 },
    { name: 'Mehl, Stärke & Panko', slug: 'mehl-starke-panko', count: 176 },
    { name: 'Kräuter & Gewürze', slug: 'krauter-gewurze', count: 548 },
    { name: 'Saucen', slug: 'saucen', count: 376 },
    { name: 'Öle & Butter', slug: 'ole-butter', count: 23 },
    { name: 'Kokosmilch, Sahne & Pulver', slug: 'kokosmilch-sahne-pulver', count: 36 },
    { name: 'Getränke', slug: 'getranke', count: 546 },
    { name: 'Milch & Milchpulver', slug: 'milch-milchpulver', count: 21 },
    { name: 'Süßigkeiten & Snacks', slug: 'sussigkeiten-snacks', count: 434 },
    { name: 'Kosmetik & Haare', slug: 'kosmetik-haare', count: 154 },
    { name: 'Non-Food', slug: 'non-food', count: 67 },
    { name: 'Tiefkühlprodukte', slug: 'tiefkuhlprodukte', count: 954 },
    { name: 'Halb Frisch', slug: 'halb-frisch', count: 118 }
];

const BASE_URL = 'https://order.asiaexpressfood.nl/de/assortiment';
const PRODUCTS_PER_PAGE = 48;
const API_ENDPOINT = '/api/save-products-chunked'; // Assumes running on localhost:3000

// Extract products from HTML document
function extractProductsFromDoc(doc, category) {
    const products = [];

    doc.querySelectorAll('.product-item-link').forEach(link => {
        const parent = link.closest('.product-item-details') || link.parentElement.parentElement;
        const name = link.textContent.trim();
        const productUrl = link.href;

        const itemInfo = link.closest('.product-item-info');
        const imgEl = itemInfo ? itemInfo.querySelector('img.product-image-photo') : null;
        const imageUrl = imgEl ? (imgEl.src || imgEl.dataset.src) : null;

        const fullText = parent ? parent.innerText : '';
        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let brand = lines[0] || '';
        if (brand === name) brand = '';

        let content = '';
        let sku = '';

        lines.forEach((line, i) => {
            if (line.includes('Inhalt:')) {
                content = line.split('Inhalt:')[1].trim();
            } else if (line.includes('Item no.')) {
                sku = line.split('Item no.')[1].trim();
                if (!sku && lines[i + 1]) {
                    sku = lines[i + 1].trim();
                }
            }
        });

        products.push({
            name,
            brand,
            content,
            sku,
            imageUrl,
            productUrl,
            category: category.name,
            categorySlug: category.slug
        });
    });

    return products;
}

// Fetch and parse a single page
async function fetchPage(url, category) {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return extractProductsFromDoc(doc, category);
}

// Save category data via API
async function saveCategoryData(category, products) {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category: category.name,
            categorySlug: category.slug,
            products
        })
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
}

// Scrape entire category and save immediately
async function scrapeAndSaveCategory(category) {
    const totalPages = Math.ceil(category.count / PRODUCTS_PER_PAGE);
    const categoryProducts = [];

    console.log(`📦 Scraping ${category.name} (${totalPages} pages)...`);

    for (let page = 1; page <= totalPages; page++) {
        const url = page === 1
            ? `${BASE_URL}/${category.slug}.html`
            : `${BASE_URL}/${category.slug}.html?p=${page}`;

        try {
            const products = await fetchPage(url, category);
            categoryProducts.push(...products);
            console.log(`  Page ${page}/${totalPages}: ${products.length} products`);

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error(`  ❌ Error on page ${page}:`, error);
        }
    }

    // Save this category immediately!
    try {
        const result = await saveCategoryData(category, categoryProducts);
        console.log(`✅ ${category.name}: ${categoryProducts.length} products SAVED!`);
        console.log(`   Progress: ${result.totalCategories}/${CATEGORIES.length} categories, ${result.totalProducts} total products`);
    } catch (error) {
        console.error(`❌ Failed to save ${category.name}:`, error);
        // Store in window as backup
        window[`ASIA_BACKUP_${category.slug}`] = categoryProducts;
        console.log(`⚠️  Saved to window.ASIA_BACKUP_${category.slug} as backup`);
    }

    return categoryProducts;
}

// Main scraper
async function scrapeAllChunked() {
    console.log('🚀 Starting Asia Express CHUNKED Scrape...');
    console.log(`📊 Total categories: ${CATEGORIES.length}`);
    console.log(`📊 Expected products: ${CATEGORIES.reduce((sum, c) => sum + c.count, 0)}`);
    console.log(`💾 Each category will be saved immediately to API\n`);

    const startTime = Date.now();
    let successCount = 0;

    for (const category of CATEGORIES) {
        try {
            await scrapeAndSaveCategory(category);
            successCount++;
        } catch (error) {
            console.error(`❌ CRITICAL ERROR in ${category.name}:`, error);
        }

        // Progress update
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log(`⏱️  ${elapsed} minutes elapsed\n`);
    }

    console.log('\n========================================');
    console.log(`🎉 SCRAPING COMPLETE!`);
    console.log(`✅ Successfully scraped: ${successCount}/${CATEGORIES.length} categories`);

    // Get final manifest
    try {
        const manifestResponse = await fetch(API_ENDPOINT + '?action=manifest');
        const manifest = await manifestResponse.json();
        console.log(`📦 Total products saved: ${manifest.totalProducts}`);
        console.log('========================================');
        return manifest;
    } catch (error) {
        console.error('Could not fetch manifest:', error);
    }
}

// Auto-run
console.log('⚙️  Asia Express Chunked Scraper loaded!');
console.log('⚠️  Make sure admin portal is running on localhost:3000');
console.log('🚀 Starting in 3 seconds...\n');

setTimeout(() => {
    scrapeAllChunked().then(manifest => {
        window.ASIA_MANIFEST = manifest;
        console.log('\n✅ Scraping complete! Manifest saved to window.ASIA_MANIFEST');
        console.log('📊 To consolidate all files, call: fetch("/api/save-products-chunked?action=consolidate")');
    });
}, 3000);
