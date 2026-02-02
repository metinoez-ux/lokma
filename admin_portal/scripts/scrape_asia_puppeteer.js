/**
 * Asia Express Node.js Scraper with Puppeteer
 * ============================================
 * Direct scraping via Node.js - no browser subagent needed
 * Saves each category immediately to filesystem
 * 
 * Usage: node scrape_asia_puppeteer.js
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
const OUTPUT_DIR = path.join(__dirname, 'asia_express_chunks');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function extractProductsFromPage(page, category) {
    return await page.evaluate((cat) => {
        const products = [];

        document.querySelectorAll('.product-item-link').forEach(link => {
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
                    if (!sku && lines[i + 1]) sku = lines[i + 1].trim();
                }
            });

            products.push({
                name,
                brand,
                content,
                sku,
                imageUrl,
                productUrl,
                category: cat.name,
                categorySlug: cat.slug
            });
        });

        return products;
    }, category);
}

async function scrapeCategory(browser, category) {
    const page = await browser.newPage();
    const totalPages = Math.ceil(category.count / PRODUCTS_PER_PAGE);
    const categoryProducts = [];

    console.log(`\n📦 Scraping ${category.name} (${totalPages} pages)...`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const url = pageNum === 1
            ? `${BASE_URL}/${category.slug}.html`
            : `${BASE_URL}/${category.slug}.html?p=${pageNum}`;

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForSelector('.product-item-link', { timeout: 10000 });

            const products = await extractProductsFromPage(page, category);
            categoryProducts.push(...products);

            console.log(`  Page ${pageNum}/${totalPages}: ${products.length} products`);

            // Small delay
            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error(`  ❌ Error on page ${pageNum}:`, error.message);
        }
    }

    await page.close();

    // Save immediately!
    const categoryFilePath = path.join(OUTPUT_DIR, `${category.slug}.json`);
    fs.writeFileSync(categoryFilePath, JSON.stringify(categoryProducts, null, 2));
    console.log(`✅ SAVED ${categoryProducts.length} products to ${category.slug}.json`);

    return categoryProducts;
}

async function updateManifest(categories) {
    const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
    const manifest = {
        categories: categories.map(c => ({
            name: c.name,
            slug: c.slug,
            count: c.scraped || 0,
            savedAt: new Date().toISOString()
        })),
        lastUpdated: new Date().toISOString(),
        totalProducts: categories.reduce((sum, c) => sum + (c.scraped || 0), 0)
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function consolidateAll() {
    const allProducts = [];

    for (const file of fs.readdirSync(OUTPUT_DIR)) {
        if (file.endsWith('.json') && file !== 'manifest.json') {
            const filePath = path.join(OUTPUT_DIR, file);
            const products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            allProducts.push(...products);
        }
    }

    const consolidatedPath = path.join(__dirname, 'asia_express_products.json');
    fs.writeFileSync(consolidatedPath, JSON.stringify(allProducts, null, 2));
    console.log(`\n📦 Consolidated ${allProducts.length} products to asia_express_products.json`);

    return allProducts.length;
}

async function main() {
    console.log('🚀 Starting Asia Express Puppeteer Scraping...');
    console.log(`📊 Total categories: ${CATEGORIES.length}`);
    console.log(`📊 Expected products: ${CATEGORIES.reduce((sum, c) => sum + c.count, 0)}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const startTime = Date.now();
    const results = [];

    for (const category of CATEGORIES) {
        try {
            const products = await scrapeCategory(browser, category);
            category.scraped = products.length;
            results.push({ ...category, success: true });
        } catch (error) {
            console.error(`❌ CRITICAL ERROR in ${category.name}:`, error.message);
            category.scraped = 0;
            results.push({ ...category, success: false, error: error.message });
        }

        // Update manifest after each category
        await updateManifest(results);

        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log(`⏱️  ${elapsed} minutes elapsed`);
    }

    await browser.close();

    // Consolidate all files
    const totalProducts = await consolidateAll();

    console.log('\n========================================');
    console.log('🎉 SCRAPING COMPLETE!');
    console.log(`✅ Successfully scraped: ${results.filter(r => r.success).length}/${CATEGORIES.length} categories`);
    console.log(`📦 Total products: ${totalProducts}`);
    console.log('========================================');
}

main().catch(console.error);
