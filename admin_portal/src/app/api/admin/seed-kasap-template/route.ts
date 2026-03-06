import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { MASTER_PRODUCTS } from '@/lib/master_products';

// 5 Ana Kasap Kategorisi (Multilingual)
const KASAP_CATEGORIES = [
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
];

/**
 * POST /api/admin/seed-kasap-template
 * 
 * Kasap (Butcher) şablon verilerini Firestore'a seed eder:
 * 1. defaultMenuTemplates/kasap → 5 Kategori şablonu (multilingual)
 * 2. master_products koleksiyonu → kasap ürünleri (imageUrl + images[])
 * 
 * Query params:
 * - businessId: Belirli bir işletmeye kategorileri uygula
 * - applyToAll: 'true' ise tüm kasap işletmelerine kategorileri uygula
 */
export async function POST(request: NextRequest) {
    try {
        const { db: adminDb } = getFirebaseAdmin();
        const { searchParams } = new URL(request.url);
        const businessId = searchParams.get('businessId');
        const applyToAll = searchParams.get('applyToAll') === 'true';

        const batch = adminDb.batch();

        // ═══════════════════════════════════════════════════════
        // 1. DEFAULT MENU TEMPLATE (5 Kategori Şablonu — Multilingual)
        // ═══════════════════════════════════════════════════════
        const templateRef = adminDb.collection('defaultMenuTemplates').doc('kasap');
        batch.set(templateRef, {
            name: 'Kasap Şablonu',
            description: 'Kasap ana kategorileri: Dana Eti, Kuzu Eti, Tavuk Ürünleri, Feinkost, Dondurulmuş',
            updatedAt: new Date().toISOString(),
            categories: KASAP_CATEGORIES,
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

        // ═══════════════════════════════════════════════════════
        // 3. İŞLETMELERE KATEGORİ UYGULA (Opsiyonel)
        // ═══════════════════════════════════════════════════════
        let appliedBusinesses: string[] = [];

        // Belirli bir işletmeye uygula
        if (businessId) {
            await applyCategoriesToBusiness(adminDb, businessId);
            appliedBusinesses.push(businessId);
        }

        // Tüm kasap işletmelerine uygula
        if (applyToAll) {
            const businessesSnapshot = await adminDb.collection('businesses')
                .where('type', '==', 'kasap')
                .get();

            for (const bizDoc of businessesSnapshot.docs) {
                await applyCategoriesToBusiness(adminDb, bizDoc.id);
                appliedBusinesses.push(bizDoc.id);
            }
        }

        const breakdown = {
            dana: kasapProducts.filter(p => p.category === 'dana').length,
            kuzu: kasapProducts.filter(p => p.category === 'kuzu').length,
            tavuk: kasapProducts.filter(p => p.category === 'tavuk').length,
            feinkost: kasapProducts.filter(p => ['wurstchen', 'wurst', 'sucuk', 'pastirma', 'kavurma'].includes(p.category)).length,
            dondurulmus: kasapProducts.filter(p => p.category === 'dondurulmus').length,
        };

        return NextResponse.json({
            success: true,
            message: `Kasap şablonu ve ${kasapProducts.length} ürün başarıyla seed edildi.${appliedBusinesses.length > 0 ? ` ${appliedBusinesses.length} işletmeye kategoriler uygulandı.` : ''}`,
            template: {
                categories: 5,
                path: 'defaultMenuTemplates/kasap',
            },
            products: {
                count: kasapProducts.length,
                collection: 'master_products',
                breakdown,
            },
            appliedBusinesses: appliedBusinesses.length > 0 ? appliedBusinesses : undefined,
        });
    } catch (error: any) {
        console.error('Seed kasap template error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Seed işlemi başarısız' },
            { status: 500 }
        );
    }
}

/**
 * İşletmenin mevcut kategorilerini silip, 5 doğru kategoriyi yazar
 */
async function applyCategoriesToBusiness(adminDb: FirebaseFirestore.Firestore, businessId: string) {
    const categoriesRef = adminDb.collection(`businesses/${businessId}/categories`);

    // Mevcut kategorileri sil
    const existingCategories = await categoriesRef.get();
    const deleteBatch = adminDb.batch();
    for (const doc of existingCategories.docs) {
        deleteBatch.delete(doc.ref);
    }
    await deleteBatch.commit();

    // 5 yeni kategoriyi ekle
    const addBatch = adminDb.batch();
    for (const cat of KASAP_CATEGORIES) {
        const newCatRef = categoriesRef.doc();
        addBatch.set(newCatRef, {
            ...cat,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    await addBatch.commit();
}
