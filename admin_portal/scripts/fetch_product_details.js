/**
 * Fetch detailed product info from Shopify JSON API
 * Includes EAN/barcode, price, SKU, weight, and description
 * Run: node fetch_product_details.js
 */

const https = require('https');
const fs = require('fs');

// Read basic products
const products = JSON.parse(fs.readFileSync('./foodpaket_products.json', 'utf8'));

// Fetch product JSON
function fetchProductJson(slug) {
    return new Promise((resolve, reject) => {
        const url = `https://www.foodpaket.de/products/${slug}.json`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
            res.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    });
}

// Sleep function
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log(`\n🔍 Fetching details for ${products.length} products...\n`);

    const detailed = [];
    const withEAN = [];

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        process.stdout.write(`[${i + 1}/${products.length}] ${p.slug.substring(0, 40)}... `);

        const json = await fetchProductJson(p.slug);

        if (json && json.product) {
            const prod = json.product;
            const variant = prod.variants?.[0];

            const detail = {
                // Basic info
                slug: p.slug,
                url: p.url,

                // Product info
                name: prod.title,
                brand: prod.vendor,
                productType: prod.product_type,
                tags: prod.tags || [],

                // Variant info
                price: variant?.price,
                compareAtPrice: variant?.compare_at_price,
                sku: variant?.sku,
                barcode: variant?.barcode, // EAN code
                weight: variant?.weight,
                weightUnit: variant?.weight_unit,

                // Images
                imageUrl: prod.images?.[0]?.src,
                images: prod.images?.map(i => i.src) || [],

                // Description (HTML stripped)
                description: prod.body_html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1000),

                // Created/Updated
                createdAt: prod.created_at,
                updatedAt: prod.updated_at
            };

            detailed.push(detail);

            if (variant?.barcode) {
                withEAN.push(detail);
            }

            console.log(`✓ ${variant?.barcode || 'no EAN'}`);
        } else {
            detailed.push({ ...p, error: 'Failed to fetch' });
            console.log('✗');
        }

        // Rate limiting
        await sleep(100);
    }

    // Save results
    fs.writeFileSync('./foodpaket_products_detailed.json', JSON.stringify(detailed, null, 2));
    fs.writeFileSync('./foodpaket_products_with_ean.json', JSON.stringify(withEAN, null, 2));

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total Products: ${detailed.length}`);
    console.log(`   With EAN/Barcode: ${withEAN.length}`);
    console.log(`   With Price: ${detailed.filter(d => d.price).length}`);
    console.log(`   With Description: ${detailed.filter(d => d.description).length}`);

    // Brand breakdown
    const brands = {};
    detailed.forEach(d => {
        if (d.brand) brands[d.brand] = (brands[d.brand] || 0) + 1;
    });

    console.log('\n🏷️ Top Brands:');
    Object.entries(brands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([brand, count]) => console.log(`   ${brand}: ${count}`));

    console.log('\n✅ Saved to:');
    console.log('   - foodpaket_products_detailed.json');
    console.log('   - foodpaket_products_with_ean.json');
}

main().catch(console.error);
