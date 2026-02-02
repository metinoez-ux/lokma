/**
 * Retry single failed category: Öle & Butter
 * Run with: node scripts/retry_ole_butter.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CATEGORY = { name: 'Öle & Butter', slug: 'ole-butter', count: 23 };
const BASE_URL = 'https://order.asiaexpressfood.nl/de/assortiment';
const OUTPUT_DIR = path.join(__dirname, 'asia_express_chunks');

async function extractProducts(page, category) {
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
            let content = '', sku = '';
            lines.forEach((line, i) => {
                if (line.includes('Inhalt:')) content = line.split('Inhalt:')[1].trim();
                else if (line.includes('Item no.')) {
                    sku = line.split('Item no.')[1].trim();
                    if (!sku && lines[i + 1]) sku = lines[i + 1].trim();
                }
            });
            products.push({ name, brand, content, sku, imageUrl, productUrl, category: cat.name, categorySlug: cat.slug });
        });
        return products;
    }, category);
}

async function main() {
    console.log('🔄 Retrying Öle & Butter category...');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const url = `${BASE_URL}/${CATEGORY.slug}.html`;

    try {
        // Longer timeout and wait for full load
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForSelector('.product-item-link, .products-grid', { timeout: 30000 });

        const products = await extractProducts(page, CATEGORY);
        console.log(`✅ Found ${products.length} products`);

        // Save to file
        const categoryFilePath = path.join(OUTPUT_DIR, `${CATEGORY.slug}.json`);
        fs.writeFileSync(categoryFilePath, JSON.stringify(products, null, 2));
        console.log(`💾 Saved to ${CATEGORY.slug}.json`);

        // Update consolidated file
        const mainFile = path.join(__dirname, 'asia_express_products.json');
        const allProducts = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
        allProducts.push(...products);
        fs.writeFileSync(mainFile, JSON.stringify(allProducts, null, 2));
        console.log(`📦 Updated main file: ${allProducts.length} total products`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await browser.close();
}

main().catch(console.error);
