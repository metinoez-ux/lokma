/**
 * ASIA EXPRESS FOOD Product Scraper
 * ===================================
 * Scrapes products from order.asiaexpressfood.nl
 * 
 * Total Products: ~4,540
 * Categories: 17
 * Pagination: 48 products per page
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

// LOKMA Category Mapping
const CATEGORY_MAPPING = {
    'Frische Produkte': 'Taze Ürünler',
    'Konservierte Produkte': 'Konserve Ürünler',
    'Getrocknete Produkte': 'Kurutulmuş Ürünler',
    'Reis': 'Pirinç & Tahıllar',
    'Nudeln & Instantprodukte': 'Makarna & Hazır Ürünler',
    'Mehl, Stärke & Panko': 'Un & Nişasta',
    'Kräuter & Gewürze': 'Baharatlar',
    'Saucen': 'Soslar',
    'Öle & Butter': 'Yağlar',
    'Kokosmilch, Sahne & Pulver': 'Hindistan Cevizi Ürünleri',
    'Getränke': 'İçecekler',
    'Milch & Milchpulver': 'Süt & Süt Ürünleri',
    'Süßigkeiten & Snacks': 'Atıştırmalıklar',
    'Kosmetik & Haare': 'Kozmetik',
    'Non-Food': 'Diğer',
    'Tiefkühlprodukte': 'Dondurulmuş Ürünler',
    'Halb Frisch': 'Yarı Taze Ürünler'
};

// Parse product card HTML
function parseProductCard(html) {
    const nameMatch = html.match(/class="product-item-link"[^>]*>([^<]+)</);
    const brandMatch = html.match(/class="product-attribution[^"]*brand[^"]*"[^>]*>([^<]+)</);
    const contentMatch = html.match(/Inhalt:\s*([^<]+)</);
    const itemNoMatch = html.match(/Item no\.\s*(\w+)/);
    const imageMatch = html.match(/src="([^"]+\.(jpg|jpeg|png|webp))"/i);
    const urlMatch = html.match(/href="([^"]+\.html)"/);

    return {
        name: nameMatch ? nameMatch[1].trim() : null,
        brand: brandMatch ? brandMatch[1].trim() : null,
        content: contentMatch ? contentMatch[1].trim() : null,
        articleNumber: itemNoMatch ? itemNoMatch[1] : null,
        imageUrl: imageMatch ? imageMatch[1] : null,
        url: urlMatch ? urlMatch[1] : null
    };
}

// Generate URL for category page
function getCategoryPageUrl(slug, page = 1) {
    const url = `${BASE_URL}/${slug}.html`;
    return page > 1 ? `${url}?p=${page}` : url;
}

// Calculate total pages for category
function getTotalPages(productCount) {
    return Math.ceil(productCount / PRODUCTS_PER_PAGE);
}

// Summary
console.log('='.repeat(60));
console.log('ASIA EXPRESS FOOD SCRAPER CONFIG');
console.log('='.repeat(60));
console.log(`\nTotal Categories: ${CATEGORIES.length}`);
console.log(`Total Products: ${CATEGORIES.reduce((sum, c) => sum + c.count, 0)}`);
console.log(`Products per Page: ${PRODUCTS_PER_PAGE}`);
console.log(`\nCategories:`);
CATEGORIES.sort((a, b) => b.count - a.count).forEach(cat => {
    const pages = getTotalPages(cat.count);
    console.log(`  ${cat.name}: ${cat.count} products (${pages} pages)`);
});

// Export for browser-based scraping
const CONFIG = {
    categories: CATEGORIES,
    baseUrl: BASE_URL,
    productsPerPage: PRODUCTS_PER_PAGE,
    categoryMapping: CATEGORY_MAPPING,
    getCategoryPageUrl,
    getTotalPages,
    parseProductCard
};

module.exports = CONFIG;
