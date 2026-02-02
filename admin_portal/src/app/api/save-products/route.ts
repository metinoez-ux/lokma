import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
    try {
        const products = await request.json();

        if (!Array.isArray(products)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Save to scripts folder
        const scriptsPath = join(process.cwd(), 'scripts', 'asia_express_products.json');
        writeFileSync(scriptsPath, JSON.stringify(products, null, 2));

        // Also save to public/data folder
        const publicPath = join(process.cwd(), 'public', 'data', 'asia_express_products.json');
        writeFileSync(publicPath, JSON.stringify(products, null, 2));

        console.log(`✅ Saved ${products.length} products to:`, scriptsPath, publicPath);

        return NextResponse.json({
            success: true,
            count: products.length,
            paths: [scriptsPath, publicPath]
        });
    } catch (error) {
        console.error('Error saving products:', error);
        return NextResponse.json({ error: 'Failed to save products' }, { status: 500 });
    }
}
