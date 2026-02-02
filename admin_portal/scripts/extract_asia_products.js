const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// Connect to existing Chrome Debugging Port
const CHROME_DEBUGGING_PORT = 9225;

async function extractProducts() {
    console.log('🔗 Connecting to Chrome with existing session...');

    try {
        // Connect to existing browser
        const browser = await puppeteer.connect({
            browserURL: `http://127.0.0.1:${CHROME_DEBUGGING_PORT}`,
            defaultViewport: null
        });

        console.log('✅ Connected to browser');

        // Get all pages
        const pages = await browser.pages();
        console.log(`📄 Found ${pages.length} pages`);

        // Find the Asia Express page with product data
        let targetPage = null;
        for (const page of pages) {
            const url = page.url();
            if (url.includes('asiaexpressfood.nl')) {
                try {
                    const hasData = await page.evaluate(() => {
                        return !!(window.ASIA_PRODUCTS_FINAL || window.ASIA_PRODUCTS);
                    });
                    if (hasData) {
                        targetPage = page;
                        console.log(`✅ Found page with product data: ${url}`);
                        break;
                    }
                } catch (e) {
                    // Page might be navigating, skip it
                }
            }
        }

        if (!targetPage) {
            console.error('❌ Could not find page with product data');
            await browser.disconnect();
            process.exit(1);
        }

        // Extract all product data
        console.log('📦 Extracting product data...');
        const products = await targetPage.evaluate(() => {
            return window.ASIA_PRODUCTS_FINAL || window.ASIA_PRODUCTS || [];
        });

        console.log(`✅ Extracted ${products.length} products`);

        // Save to file
        const outputPath = path.join(__dirname, 'asia_express_products.json');
        fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
        console.log(`💾 Saved to: ${outputPath}`);

        // Also copy to public/data for the admin portal
        const publicDataPath = path.join(__dirname, '..', 'public', 'data');
        if (!fs.existsSync(publicDataPath)) {
            fs.mkdirSync(publicDataPath, { recursive: true });
        }
        const publicOutputPath = path.join(publicDataPath, 'asia_express_products.json');
        fs.writeFileSync(publicOutputPath, JSON.stringify(products, null, 2));
        console.log(`💾 Saved to public/data: ${publicOutputPath}`);

        // Show category stats
        const categoryStats = {};
        products.forEach(p => {
            categoryStats[p.category] = (categoryStats[p.category] || 0) + 1;
        });

        console.log('\n📊 Category Statistics:');
        Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, count]) => {
                console.log(`  ${cat}: ${count} products`);
            });

        console.log(`\n🎉 Total: ${products.length} products exported successfully!`);

        // Disconnect (don't close - we want to keep the browser open)
        await browser.disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

extractProducts();
