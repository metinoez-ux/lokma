/**
 * Comprehensive Foodpaket Product Scraper
 * Extracts ALL product details for Master Catalog import
 * Including: Description, Ingredients, Allergens, Nutrition, Hints, Manufacturer, etc.
 * 
 * Run: node scrape_full_details.js
 */

const https = require('https');
const fs = require('fs');

// Read basic products from sitemap
const products = JSON.parse(fs.readFileSync('./foodpaket_products.json', 'utf8'));

// Fetch HTML content
function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', () => resolve(''));
        }).on('error', () => resolve(''));
    });
}

// Extract text between patterns
function extractBetween(html, start, end) {
    const startIdx = html.indexOf(start);
    if (startIdx === -1) return null;
    const endIdx = html.indexOf(end, startIdx + start.length);
    if (endIdx === -1) return null;
    return html.substring(startIdx + start.length, endIdx).trim();
}

// Clean HTML to text
function cleanHtml(html) {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
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
        .replace(/&szlig;/g, 'ß')
        .replace(/\s+/g, ' ')
        .trim();
}

// Parse product page HTML
function parseProductPage(html, baseInfo) {
    const product = {
        // Basic info from sitemap
        slug: baseInfo.slug,
        sourceUrl: baseInfo.url,
        sourcePlatform: 'foodpaket',
        importedAt: new Date().toISOString(),

        // Images
        imageUrl: baseInfo.imageUrl,
        images: [],

        // Product info
        name: '',
        brand: baseInfo.brand || '',

        // Description
        description: '',
        shortDescription: '',

        // Ingredients & Allergens
        ingredients: '',
        allergens: [],
        allergenWarning: '',

        // Nutrition (per 100g)
        nutrition: {
            energy: '',
            fat: '',
            saturatedFat: '',
            carbohydrates: '',
            sugar: '',
            protein: '',
            salt: '',
            fiber: ''
        },

        // Storage & Usage
        storageInstructions: '',
        usageInstructions: '',

        // Manufacturer
        manufacturer: '',
        manufacturerAddress: '',

        // Product details
        netWeight: '',
        drainedWeight: '',
        countryOfOrigin: '',

        // EAN/Barcode (if found)
        ean: '',
        sku: '',

        // Price (if found)
        price: '',
        compareAtPrice: '',

        // Category
        productType: '',
        tags: []
    };

    // Extract product name from title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        product.name = cleanHtml(titleMatch[1].replace(' - Foodpaket', '').trim());
    }

    // Extract OG description
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDescMatch) {
        product.shortDescription = cleanHtml(ogDescMatch[1]);
    }

    // Extract price
    const priceMatch = html.match(/"price":(\d+)/);
    if (priceMatch) {
        product.price = (parseInt(priceMatch[1]) / 100).toFixed(2);
    }

    // Extract compare at price
    const comparePriceMatch = html.match(/"compare_at_price":(\d+)/);
    if (comparePriceMatch && comparePriceMatch[1] !== 'null') {
        product.compareAtPrice = (parseInt(comparePriceMatch[1]) / 100).toFixed(2);
    }

    // Extract images from JSON
    const imagesMatch = html.match(/"images":\s*\[([^\]]+)\]/);
    if (imagesMatch) {
        const imgUrls = imagesMatch[1].match(/https:\/\/[^"]+/g);
        if (imgUrls) {
            product.images = imgUrls.filter(url => url.includes('cdn.shopify.com'));
        }
    }

    // Extract SKU
    const skuMatch = html.match(/"sku":"([^"]+)"/);
    if (skuMatch) {
        product.sku = skuMatch[1];
    }

    // Extract barcode/EAN
    const barcodeMatch = html.match(/"barcode":"(\d+)"/);
    if (barcodeMatch) {
        product.ean = barcodeMatch[1];
    }

    // Extract vendor/brand
    const vendorMatch = html.match(/"vendor":"([^"]+)"/);
    if (vendorMatch) {
        product.brand = cleanHtml(vendorMatch[1]);
    }

    // Extract product type
    const typeMatch = html.match(/"product_type":"([^"]+)"/);
    if (typeMatch) {
        product.productType = cleanHtml(typeMatch[1]);
    }

    // Extract tags
    const tagsMatch = html.match(/"tags":\s*\[([^\]]*)\]/);
    if (tagsMatch && tagsMatch[1]) {
        product.tags = tagsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) || [];
    }

    // Extract description from product-description class
    const descMatch = html.match(/class="product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
        product.description = cleanHtml(descMatch[1]);
    }

    // Alternative: Extract from metafield or body
    if (!product.description) {
        const bodyMatch = html.match(/PRODUKTBESCHREIBUNG:?[\s\S]*?<\/h\d>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        if (bodyMatch) {
            product.description = cleanHtml(bodyMatch[1]);
        }
    }

    // Extract ingredients - look for Zutaten section
    const zutatenPatterns = [
        /Zutaten[:\s]*<\/[^>]+>([\s\S]*?)(?:<h|Allergen|Nährwert|Hinweis)/i,
        /Zutaten[:\s]*([\s\S]*?)(?:Allergen|Nährwert|Hinweis)/i,
        /"Zutaten[:\s]*([^"]+)"/i
    ];

    for (const pattern of zutatenPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            product.ingredients = cleanHtml(match[1]);
            break;
        }
    }

    // Extract allergens
    const allergenPatterns = [
        /Allergenhinweise?[:\s]*<\/[^>]+>([\s\S]*?)(?:<h|Nährwert|Hinweis|Aufbewahr)/i,
        /Enthält[:\s]*([\s\S]*?)(?:\.|<)/i,
        /Allergene?[:\s]*([\s\S]*?)(?:<h|Nährwert)/i
    ];

    for (const pattern of allergenPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            product.allergenWarning = cleanHtml(match[1]);
            // Parse individual allergens
            const allergenText = product.allergenWarning.toLowerCase();
            if (allergenText.includes('milch')) product.allergens.push('Milch');
            if (allergenText.includes('ei')) product.allergens.push('Ei');
            if (allergenText.includes('gluten') || allergenText.includes('weizen')) product.allergens.push('Gluten');
            if (allergenText.includes('soja')) product.allergens.push('Soja');
            if (allergenText.includes('nuss') || allergenText.includes('nüss')) product.allergens.push('Nüsse');
            if (allergenText.includes('erdnuss')) product.allergens.push('Erdnüsse');
            if (allergenText.includes('sesam')) product.allergens.push('Sesam');
            if (allergenText.includes('sellerie')) product.allergens.push('Sellerie');
            if (allergenText.includes('senf')) product.allergens.push('Senf');
            if (allergenText.includes('fisch')) product.allergens.push('Fisch');
            if (allergenText.includes('krebs')) product.allergens.push('Krebstiere');
            if (allergenText.includes('weichtier')) product.allergens.push('Weichtiere');
            if (allergenText.includes('lupine')) product.allergens.push('Lupinen');
            if (allergenText.includes('sulfite') || allergenText.includes('schwefeldioxid')) product.allergens.push('Sulfite');
            break;
        }
    }

    // Extract nutrition info
    const nutritionPatterns = [
        /Brennwert[:\s]*([^<\n]+)/i,
        /Energie[:\s]*([^<\n]+)/i,
        /Enerji[:\s]*([^<\n]+)/i
    ];
    for (const pattern of nutritionPatterns) {
        const match = html.match(pattern);
        if (match) {
            product.nutrition.energy = cleanHtml(match[1]);
            break;
        }
    }

    const fatMatch = html.match(/Fett[:\s]*([^<\n,]+)/i);
    if (fatMatch) product.nutrition.fat = cleanHtml(fatMatch[1]);

    const saturatedMatch = html.match(/gesättigt[^:]*[:\s]*([^<\n,]+)/i);
    if (saturatedMatch) product.nutrition.saturatedFat = cleanHtml(saturatedMatch[1]);

    const carbMatch = html.match(/Kohlenhydrat[^:]*[:\s]*([^<\n,]+)/i);
    if (carbMatch) product.nutrition.carbohydrates = cleanHtml(carbMatch[1]);

    const sugarMatch = html.match(/Zucker[:\s]*([^<\n,]+)/i);
    if (sugarMatch) product.nutrition.sugar = cleanHtml(sugarMatch[1]);

    const proteinMatch = html.match(/Eiweiß|Protein[:\s]*([^<\n,]+)/i);
    if (proteinMatch) product.nutrition.protein = cleanHtml(proteinMatch[1]);

    const saltMatch = html.match(/Salz[:\s]*([^<\n,]+)/i);
    if (saltMatch) product.nutrition.salt = cleanHtml(saltMatch[1]);

    // Extract storage instructions
    const storagePatterns = [
        /Aufbewahrungs[^:]*[:\s]*([\s\S]*?)(?:<h|Verantwort|<\/div>)/i,
        /Lagerung[:\s]*([\s\S]*?)(?:<h|Verantwort)/i,
        /lagern[:\s]*([\s\S]*?)(?:\.|<)/i
    ];
    for (const pattern of storagePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            product.storageInstructions = cleanHtml(match[1]);
            break;
        }
    }

    // Extract manufacturer
    const manufacturerPatterns = [
        /Verantwortliches Lebensmittelunternehmen[:\s]*<\/[^>]+>([\s\S]*?)(?:<h|<\/div>)/i,
        /Hersteller[:\s]*([\s\S]*?)(?:<h|<\/div>)/i,
        /(\w+\s+(?:GmbH|AG|Ltd)[^<\n]*)/i
    ];
    for (const pattern of manufacturerPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            product.manufacturer = cleanHtml(match[1]);
            break;
        }
    }

    // Extract weight/size from name
    const weightMatch = product.name.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|L)\b/i);
    if (weightMatch) {
        product.netWeight = weightMatch[1] + weightMatch[2].toLowerCase();
    }

    // Extract Marke, Nettofüllmenge, Ursprungsland from product details
    const markeMatch = html.match(/Marke[:\s]*([^<\n]+)/i);
    if (markeMatch) product.brand = cleanHtml(markeMatch[1]);

    const nettoMatch = html.match(/Nettofüllmenge[:\s]*([^<\n]+)/i);
    if (nettoMatch) product.netWeight = cleanHtml(nettoMatch[1]);

    const ursprungMatch = html.match(/Ursprungsland[:\s]*([^<\n]+)/i);
    if (ursprungMatch) product.countryOfOrigin = cleanHtml(ursprungMatch[1]);

    const abtropfMatch = html.match(/Abtropfgewicht[:\s]*([^<\n]+)/i);
    if (abtropfMatch && abtropfMatch[1] !== '-') product.drainedWeight = cleanHtml(abtropfMatch[1]);

    return product;
}

// Sleep function
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log(`\n🚀 Starting comprehensive Foodpaket scraping...\n`);
    console.log(`📦 Processing ${products.length} products...\n`);

    const detailed = [];
    const errors = [];

    // Process in batches
    const BATCH_SIZE = 50;
    const DELAY_MS = 150; // 150ms between requests

    for (let i = 0; i < products.length; i++) {
        const p = products[i];

        try {
            process.stdout.write(`[${i + 1}/${products.length}] ${p.slug.substring(0, 50).padEnd(50)}... `);

            const html = await fetchHtml(p.url);
            if (html && html.length > 1000) {
                const product = parseProductPage(html, p);
                detailed.push(product);

                // Show what we got
                const hasIngredients = product.ingredients ? '✓' : '✗';
                const hasNutrition = product.nutrition.energy ? '✓' : '✗';
                const hasEAN = product.ean ? '✓' : '✗';
                console.log(`Z:${hasIngredients} N:${hasNutrition} EAN:${hasEAN}`);
            } else {
                errors.push(p.slug);
                console.log('✗ (empty response)');
            }
        } catch (err) {
            errors.push(p.slug);
            console.log(`✗ (${err.message})`);
        }

        await sleep(DELAY_MS);

        // Save progress every 100 products
        if ((i + 1) % 100 === 0) {
            fs.writeFileSync('./foodpaket_products_full.json', JSON.stringify(detailed, null, 2));
            console.log(`\n   💾 Progress saved (${detailed.length} products)\n`);
        }
    }

    // Final save
    fs.writeFileSync('./foodpaket_products_full.json', JSON.stringify(detailed, null, 2));
    fs.writeFileSync('./foodpaket_scrape_errors.json', JSON.stringify(errors, null, 2));

    // Statistics
    console.log('\n\n📊 Scraping Complete!\n');
    console.log(`   Total Processed: ${detailed.length}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   With Ingredients: ${detailed.filter(p => p.ingredients).length}`);
    console.log(`   With Allergens: ${detailed.filter(p => p.allergens.length > 0).length}`);
    console.log(`   With Nutrition: ${detailed.filter(p => p.nutrition.energy).length}`);
    console.log(`   With EAN: ${detailed.filter(p => p.ean).length}`);
    console.log(`   With Price: ${detailed.filter(p => p.price).length}`);
    console.log(`   With Images: ${detailed.filter(p => p.images.length > 0).length}`);

    console.log('\n   Files saved:');
    console.log('   - foodpaket_products_full.json');
    console.log('   - foodpaket_scrape_errors.json');
}

main().catch(console.error);
