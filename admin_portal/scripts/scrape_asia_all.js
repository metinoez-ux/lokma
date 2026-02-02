/**
 * Asia Express Full Product Scraper
 * ==================================
 * Run in browser console at order.asiaexpressfood.nl
 * 
 * Usage:
 * 1. Open https://order.asiaexpressfood.nl/de/assortiment.html
 * 2. Open browser console (F12 > Console)
 * 3. Paste and run this entire script
 * 4. Wait for completion, then copy the JSON
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

// Extract products from current page
function extractProducts() {
    const products = [];
    document.querySelectorAll('.product-item-link').forEach(link => {
        const parent = link.closest('.product-item-details') || link.parentElement.parentElement;
        const name = link.textContent.trim();
        const productUrl = link.href;

        const itemInfo = link.closest('.product-item-info');
        const imgEl = itemInfo ? itemInfo.querySelector('img.product-image-photo') : null;
        const imageUrl = imgEl ? imgEl.src : null;

        const fullText = parent.innerText;
        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let brand = lines[0];
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
            productUrl
        });
    });
    return products;
}

// Fetch page and extract products
async function fetchPage(url) {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

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
            productUrl
        });
    });
    return products;
}

// Scrape entire category
async function scrapeCategory(category) {
    const totalPages = Math.ceil(category.count / PRODUCTS_PER_PAGE);
    const allProducts = [];

    console.log(`📦 Scraping ${category.name} (${totalPages} pages)...`);

    for (let page = 1; page <= totalPages; page++) {
        const url = page === 1
            ? `${BASE_URL}/${category.slug}.html`
            : `${BASE_URL}/${category.slug}.html?p=${page}`;

        try {
            const products = await fetchPage(url);
            products.forEach(p => {
                p.category = category.name;
                p.categorySlug = category.slug;
            });
            allProducts.push(...products);
            console.log(`  Page ${page}/${totalPages}: ${products.length} products`);

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error(`  Error on page ${page}:`, error);
        }
    }

    return allProducts;
}

// Main scraper function
async function scrapeAll() {
    console.log('🚀 Starting Asia Express Full Scrape...');
    console.log(`📊 Total categories: ${CATEGORIES.length}`);
    console.log(`📊 Expected products: ${CATEGORIES.reduce((sum, c) => sum + c.count, 0)}`);

    const allProducts = [];

    for (const category of CATEGORIES) {
        const products = await scrapeCategory(category);
        allProducts.push(...products);
        console.log(`✅ ${category.name}: ${products.length} products scraped`);
    }

    console.log('\n========================================');
    console.log(`🎉 SCRAPING COMPLETE!`);
    console.log(`📦 Total products: ${allProducts.length}`);
    console.log('========================================');

    // Copy to clipboard
    const json = JSON.stringify(allProducts, null, 2);

    // Create download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asia_express_products.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('💾 JSON file downloaded!');

    return allProducts;
}

// Run the scraper
scrapeAll().then(products => {
    window.ASIA_EXPRESS_PRODUCTS = products;
    console.log('Products saved to window.ASIA_EXPRESS_PRODUCTS');
});
