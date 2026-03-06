import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { MASTER_PRODUCTS } from '@/lib/master_products';

/**
 * POST /api/admin/seed-kasap-template
 * 
 * Kasap (Butcher) şablon verilerini Firestore'a seed eder:
 * 1. defaultMenuTemplates/kasap → 8 Kategori şablonu
 * 2. master_products koleksiyonu → 66 ürün
 */
export async function POST() {
    try {
        const { db: adminDb } = getFirebaseAdmin();
        const batch = adminDb.batch();

        // ═══════════════════════════════════════════════════════
        // 1. DEFAULT MENU TEMPLATE (8 Kategori Şablonu)
        // ═══════════════════════════════════════════════════════
        const templateRef = adminDb.collection('defaultMenuTemplates').doc('kasap');
        batch.set(templateRef, {
            name: 'Kasap Şablonu',
            description: 'Tam kasap kategorileri: Tavuk, Et, Dondurulmuş, Sosis, Salam, Sucuk, Pastırma, Kavurma',
            updatedAt: new Date().toISOString(),
            categories: [
                {
                    name: { tr: 'Tavuk Ürünleri', de: 'Geflügel Produkte' },
                    icon: '🐔',
                    order: 0,
                },
                {
                    name: { tr: 'Et Ürünleri', de: 'Fleisch Produkte' },
                    icon: '🥩',
                    order: 1,
                },
                {
                    name: { tr: 'Dondurulmuş Ürünler', de: 'Tiefkühl Produkte' },
                    icon: '🧊',
                    order: 2,
                },
                {
                    name: { tr: 'Sosis', de: 'Würstchen' },
                    icon: '🌭',
                    order: 3,
                },
                {
                    name: { tr: 'Salam', de: 'Wurst' },
                    icon: '🥓',
                    order: 4,
                },
                {
                    name: { tr: 'Sucuk', de: 'Sucuk' },
                    icon: '🧄',
                    order: 5,
                },
                {
                    name: { tr: 'Pastırma', de: 'Rinderrohschinken' },
                    icon: '🥓',
                    order: 6,
                },
                {
                    name: { tr: 'Kavurma', de: 'Braten' },
                    icon: '🍖',
                    order: 7,
                },
            ],
        });

        // ═══════════════════════════════════════════════════════
        // 2. MASTER PRODUCTS (from master_products.ts)
        // ═══════════════════════════════════════════════════════
        const kasapProducts = MASTER_PRODUCTS.filter(p =>
            p.allowedBusinessTypes?.includes('kasap')
        );

        for (const product of kasapProducts) {
            const productRef = adminDb.collection('master_products').doc(product.id);
            batch.set(productRef, {
                ...product,
                categories: [product.category],
                unit: product.defaultUnit,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }

        await batch.commit();

        const breakdown = {
            tavuk: kasapProducts.filter(p => p.category === 'tavuk').length,
            et: kasapProducts.filter(p => p.category === 'et').length,
            dondurulmus: kasapProducts.filter(p => p.category === 'dondurulmus').length,
            wurstchen: kasapProducts.filter(p => p.category === 'wurstchen').length,
            wurst: kasapProducts.filter(p => p.category === 'wurst').length,
            sucuk: kasapProducts.filter(p => p.category === 'sucuk').length,
            pastirma: kasapProducts.filter(p => p.category === 'pastirma').length,
            kavurma: kasapProducts.filter(p => p.category === 'kavurma').length,
        };

        return NextResponse.json({
            success: true,
            message: `Kasap şablonu ve ${kasapProducts.length} ürün başarıyla seed edildi.`,
            template: {
                categories: 8,
                path: 'defaultMenuTemplates/kasap',
            },
            products: {
                count: kasapProducts.length,
                collection: 'master_products',
                breakdown,
            },
        });
    } catch (error: any) {
        console.error('Seed kasap template error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Seed işlemi başarısız' },
            { status: 500 }
        );
    }
}
