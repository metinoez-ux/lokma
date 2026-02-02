import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Category mapping from Asia Express German to LOKMA Turkish
const CATEGORY_MAPPING: Record<string, { name: string; nameTr: string }> = {
    'frische-produkte': { name: 'Taze Ürünler', nameTr: 'Taze Ürünler' },
    'konservierte-produkte': { name: 'Konserve Ürünler', nameTr: 'Konserve Ürünler' },
    'getrocknete-produkte': { name: 'Kurutulmuş Ürünler', nameTr: 'Kurutulmuş Ürünler' },
    'reis': { name: 'Pirinç', nameTr: 'Pirinç' },
    'nudeln-instantprodukte': { name: 'Makarna & Hazır Ürünler', nameTr: 'Makarna & Hazır Ürünler' },
    'mehl-starke-panko': { name: 'Un & Nişasta', nameTr: 'Un & Nişasta' },
    'krauter-gewurze': { name: 'Baharat', nameTr: 'Baharat & Otlar' },
    'saucen': { name: 'Soslar', nameTr: 'Soslar' },
    'ole-butter': { name: 'Yağ & Tereyağı', nameTr: 'Yağ & Tereyağı' },
    'kokosmilch-sahne-pulver': { name: 'Hindistancevizi & Kremalar', nameTr: 'Hindistancevizi & Kremalar' },
    'getranke': { name: 'İçecekler', nameTr: 'İçecekler' },
    'milch-milchpulver': { name: 'Süt & Süt Tozu', nameTr: 'Süt & Süt Tozu' },
    'sussigkeiten-snacks': { name: 'Tatlılar & Atıştırmalıklar', nameTr: 'Tatlılar & Atıştırmalıklar' },
    'kosmetik-haare': { name: 'Kozmetik', nameTr: 'Kozmetik & Saç Bakımı' },
    'non-food': { name: 'Gıda Dışı', nameTr: 'Gıda Dışı Ürünler' },
    'tiefkuhlprodukte': { name: 'Dondurulmuş Ürünler', nameTr: 'Dondurulmuş Ürünler' },
    'halb-frisch': { name: 'Yarı Taze', nameTr: 'Yarı Taze Ürünler' }
};

interface AsiaExpressProduct {
    name: string;
    brand: string;
    content: string;
    sku: string;
    imageUrl: string;
    productUrl: string;
    category: string;
    categorySlug: string;
}

function generateSKU(name: string, brand: string, sku: string): string {
    if (sku && sku.trim()) {
        return `AE-${sku.trim()}`;
    }
    const brandCode = (brand || 'GEN').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const nameCode = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
    const hash = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `AE-${brandCode}-${nameCode}-${hash}`;
}

function parseContent(content: string) {
    if (!content) return { pack: null, weight: null, unit: null };
    const match = content.match(/(\d+)\s*X\s*(\d+(?:[.,]\d+)?)\s*(G|KG|ML|L|STK)/i);
    if (match) {
        return {
            pack: parseInt(match[1]),
            weight: parseFloat(match[2].replace(',', '.')),
            unit: match[3].toUpperCase()
        };
    }
    return { pack: null, weight: null, unit: null };
}

export async function POST(request: NextRequest) {
    try {
        const { batchStart = 0, batchSize = 500 } = await request.json();

        // Read products from JSON
        const productsPath = join(process.cwd(), 'scripts', 'asia_express_products.json');
        if (!existsSync(productsPath)) {
            return NextResponse.json({ error: 'Products file not found' }, { status: 404 });
        }

        const allProducts: AsiaExpressProduct[] = JSON.parse(readFileSync(productsPath, 'utf8'));
        const products = allProducts.slice(batchStart, batchStart + batchSize);

        if (products.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All products imported',
                totalProducts: allProducts.length
            });
        }

        // Get Firebase Admin DB
        const { db } = getFirebaseAdmin();

        // Get existing products to avoid duplicates
        const existingSnapshot = await db
            .collection('master_products')
            .where('sourcePlatform', '==', 'asia_express')
            .select('sourceUrl')
            .get();
        const existingUrls = new Set(existingSnapshot.docs.map(d => d.data().sourceUrl));

        const batch = db.batch();
        let importedCount = 0;
        let skippedCount = 0;

        for (const product of products) {
            if (existingUrls.has(product.productUrl)) {
                skippedCount++;
                continue;
            }

            const categoryData = CATEGORY_MAPPING[product.categorySlug] || { name: 'Diğer', nameTr: 'Diğer' };
            const contentParsed = parseContent(product.content);
            const sku = generateSKU(product.name, product.brand, product.sku);

            const docRef = db.collection('master_products').doc();
            batch.set(docRef, {
                sku,
                originalSku: product.sku || null,
                sourceUrl: product.productUrl,
                sourcePlatform: 'asia_express',
                name: product.name,
                nameDe: product.name,
                brand: product.brand || null,
                category: categoryData.name,
                categoryTr: categoryData.nameTr,
                categorySlug: product.categorySlug,
                categoryOriginal: product.category,
                imageUrl: product.imageUrl || null,
                images: product.imageUrl ? [product.imageUrl] : [],
                defaultUnit: 'Adet',
                defaultPrice: null,
                contentDescription: product.content || null,
                packSize: contentParsed.pack,
                netWeight: contentParsed.weight ? `${contentParsed.weight}${contentParsed.unit}` : null,
                weightValue: contentParsed.weight,
                weightUnit: contentParsed.unit,
                isActive: true,
                visibility: 'super_admin_only',
                allowedBusinessTypes: ['market', 'supermarket', 'restaurant', 'asia_market'],
                createdAt: new Date(),
                updatedAt: new Date(),
                importedAt: new Date()
            });

            importedCount++;
        }

        await batch.commit();

        const nextBatchStart = batchStart + batchSize;
        const hasMore = nextBatchStart < allProducts.length;

        return NextResponse.json({
            success: true,
            batchStart,
            batchSize,
            imported: importedCount,
            skipped: skippedCount,
            nextBatchStart: hasMore ? nextBatchStart : null,
            totalProducts: allProducts.length,
            progress: `${Math.min(nextBatchStart, allProducts.length)}/${allProducts.length}`
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const productsPath = join(process.cwd(), 'scripts', 'asia_express_products.json');
        if (!existsSync(productsPath)) {
            return NextResponse.json({ error: 'Products file not found' }, { status: 404 });
        }

        const products = JSON.parse(readFileSync(productsPath, 'utf8'));

        const { db } = getFirebaseAdmin();
        const existingSnapshot = await db
            .collection('master_products')
            .where('sourcePlatform', '==', 'asia_express')
            .get();

        return NextResponse.json({
            totalProducts: products.length,
            existingInFirestore: existingSnapshot.size,
            remaining: products.length - existingSnapshot.size
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
