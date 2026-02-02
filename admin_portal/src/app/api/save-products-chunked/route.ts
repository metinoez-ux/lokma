import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Chunked Product Saver API
 * Saves category data incrementally to avoid browser memory crashes
 */
export async function POST(request: NextRequest) {
    try {
        const { category, categorySlug, products } = await request.json();

        if (!category || !categorySlug || !Array.isArray(products)) {
            return NextResponse.json(
                { error: 'Missing required fields: category, categorySlug, products' },
                { status: 400 }
            );
        }

        // Ensure scripts directory exists
        const scriptsPath = join(process.cwd(), 'scripts', 'asia_express_chunks');
        if (!existsSync(scriptsPath)) {
            mkdirSync(scriptsPath, { recursive: true });
        }

        // Save this category's data
        const categoryFilePath = join(scriptsPath, `${categorySlug}.json`);
        writeFileSync(categoryFilePath, JSON.stringify(products, null, 2));

        // Update the manifest file
        const manifestPath = join(scriptsPath, 'manifest.json');
        let manifest: any = { categories: [], lastUpdated: null, totalProducts: 0 };

        if (existsSync(manifestPath)) {
            manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        }

        // Update or add this category
        const existingIndex = manifest.categories.findIndex((c: any) => c.slug === categorySlug);
        const categoryData = {
            name: category,
            slug: categorySlug,
            count: products.length,
            savedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            manifest.categories[existingIndex] = categoryData;
        } else {
            manifest.categories.push(categoryData);
        }

        manifest.lastUpdated = new Date().toISOString();
        manifest.totalProducts = manifest.categories.reduce((sum: number, c: any) => sum + c.count, 0);

        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        console.log(`✅ Saved ${products.length} products for category: ${category}`);

        return NextResponse.json({
            success: true,
            category,
            count: products.length,
            totalCategories: manifest.categories.length,
            totalProducts: manifest.totalProducts
        });

    } catch (error: any) {
        console.error('❌ Error saving products:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to retrieve manifest and consolidated data
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'manifest';

        const scriptsPath = join(process.cwd(), 'scripts', 'asia_express_chunks');
        const manifestPath = join(scriptsPath, 'manifest.json');

        if (!existsSync(manifestPath)) {
            return NextResponse.json({
                categories: [],
                totalProducts: 0,
                message: 'No data scraped yet'
            });
        }

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

        if (action === 'manifest') {
            return NextResponse.json(manifest);
        }

        if (action === 'consolidate') {
            // Consolidate all category files into one
            const allProducts: any[] = [];

            for (const cat of manifest.categories) {
                const categoryFilePath = join(scriptsPath, `${cat.slug}.json`);
                if (existsSync(categoryFilePath)) {
                    const categoryProducts = JSON.parse(readFileSync(categoryFilePath, 'utf-8'));
                    allProducts.push(...categoryProducts);
                }
            }

            // Save consolidated file
            const consolidatedPath = join(process.cwd(), 'scripts', 'asia_express_products.json');
            writeFileSync(consolidatedPath, JSON.stringify(allProducts, null, 2));

            return NextResponse.json({
                success: true,
                totalProducts: allProducts.length,
                consolidatedPath
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('❌ Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
