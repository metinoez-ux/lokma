/**
 * Foodpaket.de Product Scraper
 * Extracts all products with images, names, and details from sitemap
 * 
 * Usage: node scrape_foodpaket.js
 */

const https = require('https');
const fs = require('fs');

// Configuration
const SITEMAP_PRODUCTS_URL = 'https://www.foodpaket.de/sitemap_products_1.xml?from=7526637994240&to=10851728130315';
const SITEMAP_COLLECTIONS_URL = 'https://www.foodpaket.de/sitemap_collections_1.xml?from=385270350080&to=643184951563';
const OUTPUT_FILE = './foodpaket_products.json';
const COLLECTIONS_FILE = './foodpaket_collections.json';

// Fetch URL content
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Parse sitemap XML and extract product data
function parseProductSitemap(xml) {
    const products = [];
    const urlRegex = /<url>([\s\S]*?)<\/url>/g;
    let match;

    while ((match = urlRegex.exec(xml)) !== null) {
        const urlBlock = match[1];

        // Extract loc (URL)
        const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
        const url = locMatch ? locMatch[1] : null;

        // Skip non-product URLs
        if (!url || !url.includes('/products/')) continue;

        // Extract lastmod
        const lastmodMatch = urlBlock.match(/<lastmod>(.*?)<\/lastmod>/);
        const lastmod = lastmodMatch ? lastmodMatch[1] : null;

        // Extract image data
        const imageLocMatch = urlBlock.match(/<image:loc>(.*?)<\/image:loc>/);
        const imageTitleMatch = urlBlock.match(/<image:title>(.*?)<\/image:title>/);
        const imageCaptionMatch = urlBlock.match(/<image:caption>(.*?)<\/image:caption>/);

        const imageUrl = imageLocMatch ? imageLocMatch[1] : null;
        const imageTitle = imageTitleMatch ? imageTitleMatch[1] : null;
        const imageCaption = imageCaptionMatch ? imageCaptionMatch[1] : null;

        // Extract product slug from URL
        const slug = url.split('/products/')[1];

        // Parse brand and name from image title/caption
        let brand = '';
        let name = imageTitle || '';

        if (imageCaption) {
            // Caption often has format: "Product Name Brand"
            const captionParts = imageCaption.split(' ');
            brand = captionParts[captionParts.length - 1] || '';
        }

        products.push({
            url,
            slug,
            name: decodeHtmlEntities(name),
            brand: decodeHtmlEntities(brand),
            imageUrl,
            lastmod,
            // Additional fields to be filled by detailed scraping
            price: null,
            ingredients: null,
            weight: null,
            ean: null
        });
    }

    return products;
}

// Parse collections sitemap
function parseCollectionsSitemap(xml) {
    const collections = [];
    const urlRegex = /<url>([\s\S]*?)<\/url>/g;
    let match;

    while ((match = urlRegex.exec(xml)) !== null) {
        const urlBlock = match[1];

        // Extract loc (URL)
        const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
        const url = locMatch ? locMatch[1] : null;

        if (!url || !url.includes('/collections/')) continue;

        // Extract image data
        const imageLocMatch = urlBlock.match(/<image:loc>(.*?)<\/image:loc>/);
        const imageTitleMatch = urlBlock.match(/<image:title>(.*?)<\/image:title>/);

        const imageUrl = imageLocMatch ? imageLocMatch[1] : null;
        const title = imageTitleMatch ? imageTitleMatch[1] : url.split('/collections/')[1];

        // Extract collection slug
        const slug = url.split('/collections/')[1];

        collections.push({
            url,
            slug,
            title: decodeHtmlEntities(title),
            imageUrl
        });
    }

    return collections;
}

// Decode HTML entities
function decodeHtmlEntities(text) {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&auml;/g, 'ä')
        .replace(/&ouml;/g, 'ö')
        .replace(/&uuml;/g, 'ü')
        .replace(/&Auml;/g, 'Ä')
        .replace(/&Ouml;/g, 'Ö')
        .replace(/&Uuml;/g, 'Ü')
        .replace(/&szlig;/g, 'ß');
}

// Fetch detailed product info from product page JSON
async function fetchProductDetails(productUrl) {
    try {
        const jsonUrl = productUrl + '.json';
        const response = await fetchUrl(jsonUrl);
        const data = JSON.parse(response);

        if (data.product) {
            return {
                title: data.product.title,
                vendor: data.product.vendor,
                productType: data.product.product_type,
                tags: data.product.tags,
                variants: data.product.variants?.map(v => ({
                    price: v.price,
                    sku: v.sku,
                    weight: v.weight,
                    weightUnit: v.weight_unit,
                    barcode: v.barcode
                })),
                images: data.product.images?.map(i => i.src),
                bodyHtml: data.product.body_html
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching ${productUrl}:`, error.message);
        return null;
    }
}

// Main scraping function
async function scrapeAllProducts() {
    console.log('🚀 Starting Foodpaket.de product scraper...\n');

    // Step 1: Fetch and parse collections
    console.log('📁 Fetching collections sitemap...');
    const collectionsXml = await fetchUrl(SITEMAP_COLLECTIONS_URL);
    const collections = parseCollectionsSitemap(collectionsXml);
    console.log(`   Found ${collections.length} collections\n`);

    // Save collections
    fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(collections, null, 2));
    console.log(`   Saved to ${COLLECTIONS_FILE}\n`);

    // Step 2: Fetch and parse products from sitemap
    console.log('📦 Fetching products sitemap...');
    const productsXml = await fetchUrl(SITEMAP_PRODUCTS_URL);
    const products = parseProductSitemap(productsXml);
    console.log(`   Found ${products.length} products from sitemap\n`);

    // Step 3: Fetch detailed information for each product (optional, rate-limited)
    console.log('🔍 Fetching detailed product information...');
    const detailedProducts = [];

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        process.stdout.write(`   [${i + 1}/${products.length}] ${product.slug}...`);

        const details = await fetchProductDetails(product.url);

        if (details) {
            detailedProducts.push({
                ...product,
                title: details.title,
                vendor: details.vendor,
                productType: details.productType,
                tags: details.tags,
                price: details.variants?.[0]?.price,
                sku: details.variants?.[0]?.sku,
                weight: details.variants?.[0]?.weight,
                weightUnit: details.variants?.[0]?.weightUnit,
                ean: details.variants?.[0]?.barcode,
                images: details.images,
                description: details.bodyHtml?.replace(/<[^>]*>/g, '').substring(0, 500)
            });
            console.log(' ✓');
        } else {
            detailedProducts.push(product);
            console.log(' ✗');
        }

        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Step 4: Save results
    console.log('\n💾 Saving results...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(detailedProducts, null, 2));
    console.log(`   Saved ${detailedProducts.length} products to ${OUTPUT_FILE}`);

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   Collections: ${collections.length}`);
    console.log(`   Products: ${detailedProducts.length}`);

    const withEAN = detailedProducts.filter(p => p.ean).length;
    const withImages = detailedProducts.filter(p => p.imageUrl || p.images?.length).length;
    console.log(`   With EAN/Barcode: ${withEAN}`);
    console.log(`   With Images: ${withImages}`);

    console.log('\n✅ Scraping complete!');
}

// Run the scraper
scrapeAllProducts().catch(console.error);
