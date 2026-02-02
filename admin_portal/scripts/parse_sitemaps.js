/**
 * Parse downloaded Foodpaket sitemaps
 * Run: node parse_sitemaps.js
 */

const fs = require('fs');

// Read downloaded XML files
const productsXml = fs.readFileSync('./sitemap_products.xml', 'utf8');
const collectionsXml = fs.readFileSync('./sitemap_collections.xml', 'utf8');

console.log('📦 Parsing sitemaps...\n');

// Parse products
const products = [];
const productMatches = productsXml.matchAll(/<url>([\s\S]*?)<\/url>/g);

for (const match of productMatches) {
    const block = match[1];

    const locMatch = block.match(/<loc>(.*?)<\/loc>/);
    const url = locMatch ? locMatch[1] : '';

    if (!url.includes('/products/')) continue;

    const slug = url.split('/products/')[1] || '';
    const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);
    const imageLocMatch = block.match(/<image:loc>(.*?)<\/image:loc>/);
    const imageTitleMatch = block.match(/<image:title>(.*?)<\/image:title>/);
    const imageCaptionMatch = block.match(/<image:caption>(.*?)<\/image:caption>/);

    // Extract brand from caption (usually last word)
    const caption = imageCaptionMatch ? imageCaptionMatch[1] : '';
    const captionParts = caption.split(' ');
    const brand = captionParts[captionParts.length - 1] || '';

    products.push({
        url,
        slug,
        name: imageTitleMatch ? imageTitleMatch[1] : slug,
        brand,
        imageUrl: imageLocMatch ? imageLocMatch[1] : null,
        lastmod: lastmodMatch ? lastmodMatch[1] : null
    });
}

console.log(`Found ${products.length} products\n`);

// Parse collections
const collections = [];
const collectionMatches = collectionsXml.matchAll(/<url>([\s\S]*?)<\/url>/g);

for (const match of collectionMatches) {
    const block = match[1];

    const locMatch = block.match(/<loc>(.*?)<\/loc>/);
    const url = locMatch ? locMatch[1] : '';

    if (!url.includes('/collections/')) continue;

    const slug = url.split('/collections/')[1] || '';
    const imageLocMatch = block.match(/<image:loc>(.*?)<\/image:loc>/);
    const imageTitleMatch = block.match(/<image:title>(.*?)<\/image:title>/);

    collections.push({
        url,
        slug,
        name: imageTitleMatch ? imageTitleMatch[1] : slug,
        imageUrl: imageLocMatch ? imageLocMatch[1] : null
    });
}

console.log(`Found ${collections.length} collections\n`);

// Save JSON files
fs.writeFileSync('./foodpaket_products.json', JSON.stringify(products, null, 2));
fs.writeFileSync('./foodpaket_collections.json', JSON.stringify(collections, null, 2));

// Display sample products
console.log('📦 Sample Products:');
products.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.brand})`);
});

console.log('\n📁 Collections:');
collections.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (${c.slug})`);
});

// Count by brand
const brandCounts = {};
products.forEach(p => {
    const b = p.brand || 'Unknown';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
});

console.log('\n🏷️ Products by Brand:');
Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([brand, count]) => {
        console.log(`   ${brand}: ${count}`);
    });

console.log(`\n✅ Saved to foodpaket_products.json (${products.length} products)`);
console.log(`✅ Saved to foodpaket_collections.json (${collections.length} collections)`);
