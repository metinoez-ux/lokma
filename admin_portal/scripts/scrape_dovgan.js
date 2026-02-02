/**
 * DOVGAN Product Scraper for LOKMA Master Catalog
 * ================================================
 * This script scrapes all products from shop-dovgan.de and saves them as JSON
 * for import into the LOKMA Master Catalog.
 * 
 * EXCLUDED: Alcohol categories (Spirituosen, Wein & Sekt, Bier)
 * 
 * Usage: node scrape_dovgan.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// Categories to scrape (excluding alcohol)
const CATEGORIES = [
    { name: 'Alkoholfreie Getränke', url: 'https://shop-dovgan.de/alkoholfreie_getrenke/', lokmaCategory: 'Alkoholsüz İçecekler' },
    { name: 'Fischkonserven', url: 'https://shop-dovgan.de/fischkonserven/', lokmaCategory: 'Balık Konserveleri' },
    { name: 'Fleischkonserven', url: 'https://shop-dovgan.de/fleischkonserven/', lokmaCategory: 'Et Konserveleri' },
    { name: 'Fertiggerichte', url: 'https://shop-dovgan.de/fertiggerichte/', lokmaCategory: 'Hazır Yemekler' },
    { name: 'Gemüsekonserven', url: 'https://shop-dovgan.de/gemusekonserven/', lokmaCategory: 'Sebze Konserveleri' },
    { name: 'Mayo, Senf, Saucen & Öl', url: 'https://shop-dovgan.de/saucen/', lokmaCategory: 'Soslar & Yağlar' },
    { name: 'Getreide, Mehl & Nudeln', url: 'https://shop-dovgan.de/getreide_mehl_nudeln/', lokmaCategory: 'Tahıllar & Makarna' },
    { name: 'Snack', url: 'https://shop-dovgan.de/snack/', lokmaCategory: 'Atıştırmalıklar' },
    { name: 'Kondensmilch & Backware', url: 'https://shop-dovgan.de/kondensmilch_backware/', lokmaCategory: 'Süt Ürünleri & Unlu Mamüller' },
    { name: 'Süßwaren, Gebäck', url: 'https://shop-dovgan.de/susswaren/', lokmaCategory: 'Şekerlemeler & Tatlılar' },
    { name: 'Kaviar', url: 'https://shop-dovgan.de/kaviar/', lokmaCategory: 'Havyar & Deniz Ürünleri' },
    { name: 'Wurstspezialitäten', url: 'https://shop-dovgan.de/wurstspezialit%C3%A4ten/', lokmaCategory: 'Et & Sosis' },
    { name: 'Frisch & Fertig', url: 'https://shop-dovgan.de/frisch_fertig/', lokmaCategory: 'Taze Ürünler' },
    { name: 'Milch, Quark', url: 'https://shop-dovgan.de/milch_quark/', lokmaCategory: 'Süt & Süt Ürünleri' },
    { name: 'Kosmetik', url: 'https://shop-dovgan.de/kosmetik/', lokmaCategory: 'Kozmetik' },
    { name: 'Vorteilspack', url: 'https://shop-dovgan.de/sparpack/', lokmaCategory: 'Avantajlı Paketler' }
];

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Extract products from a category page
async function extractProductsFromPage(page) {
    return await page.evaluate(() => {
        const products = [];
        document.querySelectorAll('.product-layout').forEach(p => {
            const link = p.querySelector('a[href*="dovgan.de"]');
            const name = p.querySelector('.caption a')?.textContent?.trim();
            const priceEl = p.querySelector('.price-new') || p.querySelector('.price');
            const price = priceEl?.textContent?.trim();
            const image = p.querySelector('img')?.src;

            if (link?.href && name) {
                products.push({
                    url: link.href,
                    name: name,
                    priceText: price,
                    image: image
                });
            }
        });
        return products;
    });
}

// Check if there's a next page
async function getNextPageUrl(page) {
    return await page.evaluate(() => {
        const nextBtn = document.querySelector('.pagination li:last-child a, .pagination .next a');
        if (nextBtn && !nextBtn.parentElement.classList.contains('disabled') && !nextBtn.closest('li')?.classList.contains('active')) {
            return nextBtn.href;
        }
        return null;
    });
}

// Extract detailed product info from a product page
async function extractProductDetails(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(500);

        return await page.evaluate(() => {
            const getElementText = (selector) => document.querySelector(selector)?.textContent?.trim();

            // Extract EAN from page HTML
            const pageHTML = document.body.innerHTML;
            const eanMatch = pageHTML.match(/\b(\d{13})\b/g);
            const ean = eanMatch ? eanMatch.find(e => e.startsWith('40') || e.startsWith('50') || e.startsWith('87')) || eanMatch[0] : null;

            // Get article number
            const articleText = getElementText('.list-unstyled li:first-child');
            const articleNumber = articleText?.replace('Artikelnr. ', '').trim();

            // Get price
            const priceHeading = [...document.querySelectorAll('h2')].find(h2 => h2.textContent.includes('€'));
            const priceText = priceHeading?.textContent?.trim() || getElementText('.price-new') || getElementText('.price');

            // Parse price - extract gross price from format like "2,99€ (Netto 2,79€)"
            let price = null;
            if (priceText) {
                const priceMatch = priceText.match(/(\d+[,.]?\d*)\s*€/);
                if (priceMatch) {
                    price = parseFloat(priceMatch[1].replace(',', '.'));
                }
            }

            // Get images
            const images = [...document.querySelectorAll('.thumbnail img, .main-image img, .product-image img')]
                .map(i => i.src)
                .filter(s => s && !s.includes('placeholder'));

            // Get description from tab or content area
            const description = getElementText('#tab-description') || getElementText('.description');

            // Get ingredients
            const ingredients = getElementText('#tab-zutaten');

            // Get nutrition info
            const nutritionText = getElementText('#tab-nahrwerte');

            // Parse nutrition values
            let nutrition = null;
            if (nutritionText) {
                nutrition = {
                    raw: nutritionText,
                    parsed: {}
                };

                // Try to extract values
                const energyMatch = nutritionText.match(/(\d+)\s*kJ\s*\/\s*(\d+)\s*kcal/i);
                if (energyMatch) {
                    nutrition.parsed.energyKJ = parseInt(energyMatch[1]);
                    nutrition.parsed.energyKcal = parseInt(energyMatch[2]);
                }

                const fatMatch = nutritionText.match(/Fett[:\s]+(\d+[,.]?\d*)\s*g/i);
                if (fatMatch) nutrition.parsed.fat = parseFloat(fatMatch[1].replace(',', '.'));

                const carbMatch = nutritionText.match(/Kohlenhydrate[:\s]+(\d+[,.]?\d*)\s*g/i);
                if (carbMatch) nutrition.parsed.carbohydrates = parseFloat(carbMatch[1].replace(',', '.'));

                const proteinMatch = nutritionText.match(/(?:Eiweiß|Protein)[:\s]+(\d+[,.]?\d*)\s*g/i);
                if (proteinMatch) nutrition.parsed.protein = parseFloat(proteinMatch[1].replace(',', '.'));

                const saltMatch = nutritionText.match(/Salz[:\s]+(\d+[,.]?\d*)\s*g/i);
                if (saltMatch) nutrition.parsed.salt = parseFloat(saltMatch[1].replace(',', '.'));

                const sugarMatch = nutritionText.match(/Zucker[:\s]+(\d+[,.]?\d*)\s*g/i);
                if (sugarMatch) nutrition.parsed.sugar = parseFloat(sugarMatch[1].replace(',', '.'));
            }

            // Get product weight from title
            const title = getElementText('h1');
            let weight = null;
            const weightMatch = title?.match(/(\d+(?:[,.]?\d*)?)\s*(g|kg|ml|l|L)\b/i);
            if (weightMatch) {
                weight = {
                    value: parseFloat(weightMatch[1].replace(',', '.')),
                    unit: weightMatch[2].toLowerCase()
                };
            }

            // Allergen hints
            let allergens = [];
            if (ingredients) {
                const allergenKeywords = ['Gluten', 'Weizen', 'Milch', 'Ei', 'Nüsse', 'Erdnüsse', 'Soja', 'Sellerie', 'Senf', 'Sesam', 'Sulfite', 'Lupine', 'Weichtiere', 'Krebstiere', 'Fisch'];
                allergenKeywords.forEach(kw => {
                    if (ingredients.toLowerCase().includes(kw.toLowerCase())) {
                        allergens.push(kw);
                    }
                });
                // Check for "Spuren von" traces
                const tracesMatch = ingredients.match(/Spuren von ([^.]+)/i);
                if (tracesMatch) {
                    allergens.push(`Traces: ${tracesMatch[1]}`);
                }
            }

            return {
                title,
                articleNumber,
                ean,
                price,
                priceText,
                description,
                ingredients,
                nutrition,
                weight,
                allergens,
                images
            };
        });
    } catch (error) {
        console.error(`Error extracting details from ${url}:`, error.message);
        return null;
    }
}

// Main scraping function
async function scrapeAllProducts() {
    console.log('🚀 Starting DOVGAN Product Scraper...\n');
    console.log(`📁 Scraping ${CATEGORIES.length} categories (excluding alcohol)\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const allProducts = [];
    const categoryStats = {};

    for (const category of CATEGORIES) {
        console.log(`\n📂 Processing: ${category.name}`);
        let categoryProducts = [];
        let currentUrl = category.url;
        let pageNum = 1;

        // Get all products from all pages in this category
        while (currentUrl) {
            console.log(`   Page ${pageNum}...`);

            try {
                await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await delay(1000);

                const products = await extractProductsFromPage(page);
                console.log(`   Found ${products.length} products`);

                // Add category info to each product
                products.forEach(p => {
                    p.sourceCategory = category.name;
                    p.lokmaCategory = category.lokmaCategory;
                    categoryProducts.push(p);
                });

                // Check for next page
                currentUrl = await getNextPageUrl(page);
                if (currentUrl) {
                    pageNum++;
                    await delay(500);
                }
            } catch (error) {
                console.error(`   Error on page ${pageNum}:`, error.message);
                break;
            }
        }

        categoryStats[category.name] = categoryProducts.length;
        console.log(`   ✓ Total: ${categoryProducts.length} products`);

        allProducts.push(...categoryProducts);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Total products found: ${allProducts.length}`);
    console.log('='.repeat(50) + '\n');

    // Now extract detailed info for each product
    console.log('🔍 Extracting detailed product information...\n');

    const detailedProducts = [];
    let processed = 0;
    let withEAN = 0;
    let errors = 0;

    for (const product of allProducts) {
        processed++;
        process.stdout.write(`\r   Processing ${processed}/${allProducts.length} (${Math.round(processed / allProducts.length * 100)}%) - EAN: ${withEAN}, Errors: ${errors}`);

        const details = await extractProductDetails(page, product.url);

        if (details) {
            const fullProduct = {
                ...product,
                ...details,
                source: 'dovgan',
                scrapedAt: new Date().toISOString()
            };

            if (details.ean) withEAN++;
            detailedProducts.push(fullProduct);
        } else {
            errors++;
            detailedProducts.push({
                ...product,
                source: 'dovgan',
                scrapedAt: new Date().toISOString(),
                error: 'Failed to extract details'
            });
        }

        // Rate limiting
        await delay(300);
    }

    await browser.close();

    console.log('\n\n' + '='.repeat(50));
    console.log('📊 SCRAPING COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total products: ${detailedProducts.length}`);
    console.log(`With EAN: ${withEAN} (${Math.round(withEAN / detailedProducts.length * 100)}%)`);
    console.log(`Errors: ${errors}`);
    console.log('\nCategory breakdown:');
    Object.entries(categoryStats).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
    });

    // Save results
    const outputPath = 'dovgan_products.json';
    fs.writeFileSync(outputPath, JSON.stringify(detailedProducts, null, 2));
    console.log(`\n✅ Saved to ${outputPath}`);

    // Also save a summary
    const summary = {
        totalProducts: detailedProducts.length,
        withEAN: withEAN,
        withoutEAN: detailedProducts.length - withEAN,
        errors: errors,
        categories: categoryStats,
        scrapedAt: new Date().toISOString()
    };
    fs.writeFileSync('dovgan_summary.json', JSON.stringify(summary, null, 2));
    console.log('✅ Saved summary to dovgan_summary.json');

    return detailedProducts;
}

// Run the scraper
scrapeAllProducts().catch(console.error);
