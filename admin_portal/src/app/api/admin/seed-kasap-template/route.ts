import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { MASTER_PRODUCTS } from '@/lib/master_products';

/**
 * POST /api/admin/seed-kasap-template
 * 
 * Kasap (Butcher) şablon verilerini Firestore'a seed eder:
 * 1. defaultMenuTemplates/kasap → 5 Kategori şablonu (multilingual)
 * 2. master_products koleksiyonu → kasap ürünleri
 */
export async function POST() {
    try {
        const { db: adminDb } = getFirebaseAdmin();
        const batch = adminDb.batch();

        // ═══════════════════════════════════════════════════════
        // 1. DEFAULT MENU TEMPLATE (5 Kategori Şablonu — Multilingual)
        // ═══════════════════════════════════════════════════════
        const templateRef = adminDb.collection('defaultMenuTemplates').doc('kasap');
        batch.set(templateRef, {
            name: 'Kasap Şablonu',
            description: 'Kasap ana kategorileri: Dana Eti, Kuzu Eti, Tavuk Ürünleri, Feinkost, Dondurulmuş',
            updatedAt: new Date().toISOString(),
            categories: [
                {
                    name: { tr: 'Dana Eti', de: 'Rindfleisch', en: 'Beef' },
                    icon: '🐄',
                    order: 0,
                },
                {
                    name: { tr: 'Kuzu Eti', de: 'Lammfleisch', en: 'Lamb' },
                    icon: '🐑',
                    order: 1,
                },
                {
                    name: { tr: 'Tavuk Ürünleri', de: 'Geflügel', en: 'Poultry' },
                    icon: '🐔',
                    order: 2,
                },
                {
                    name: { tr: 'Feinkost Ürünleri', de: 'Feinkostprodukte', en: 'Delicatessen' },
                    icon: '🧀',
                    order: 3,
                },
                {
                    name: { tr: 'Dondurulmuş Ürünler', de: 'Tiefkühlprodukte', en: 'Frozen Products' },
                    icon: '🧊',
                    order: 4,
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
                images: product.imageUrl ? [product.imageUrl] : [],
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }

        await batch.commit();

        const breakdown = {
            dana: kasapProducts.filter(p => p.category === 'dana').length,
            kuzu: kasapProducts.filter(p => p.category === 'kuzu').length,
            tavuk: kasapProducts.filter(p => p.category === 'tavuk').length,
            feinkost: kasapProducts.filter(p => ['wurstchen', 'wurst', 'sucuk', 'pastirma', 'kavurma'].includes(p.category)).length,
            dondurulmus: kasapProducts.filter(p => p.category === 'dondurulmus').length,
        };

        return NextResponse.json({
            success: true,
            message: `Kasap şablonu ve ${kasapProducts.length} ürün başarıyla seed edildi.`,
            template: {
                categories: 5,
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
