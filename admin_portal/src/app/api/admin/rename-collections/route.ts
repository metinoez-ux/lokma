/**
 * Migration API: Rename butcher_orders → orders, butcher_products → products
 * 
 * POST /api/admin/rename-collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.MIGRATION_ADMIN_KEY || 'migrate-2026';

    if (adminKey !== expectedKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { db } = getFirebaseAdmin();
        const results: Record<string, any> = {};

        // Migration 1: butcher_orders → orders
        console.log('🚀 Migrating butcher_orders → orders...');
        const ordersSnapshot = await db.collection('orders').get();

        if (!ordersSnapshot.empty) {
            const batchSize = 500;
            let batch = db.batch();
            let count = 0;

            for (const doc of ordersSnapshot.docs) {
                const data = doc.data();
                // Add businessId if only butcherId exists
                const updatedData = {
                    ...data,
                    businessId: data.businessId || data.butcherId,
                };

                batch.set(db.collection('orders').doc(doc.id), updatedData);
                count++;

                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = db.batch();
                }
            }

            if (count % batchSize !== 0) {
                await batch.commit();
            }

            results.orders = { migrated: count };
        } else {
            results.orders = { migrated: 0, message: 'No documents in butcher_orders' };
        }

        // Migration 2: butcher_products → products (top-level collection)
        console.log('🚀 Migrating butcher_products → products...');
        const productsSnapshot = await db.collection('products').get();

        if (!productsSnapshot.empty) {
            const batchSize = 500;
            let batch = db.batch();
            let count = 0;

            for (const doc of productsSnapshot.docs) {
                const data = doc.data();
                const updatedData = {
                    ...data,
                    businessId: data.businessId || data.butcherId,
                };

                batch.set(db.collection('products').doc(doc.id), updatedData);
                count++;

                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = db.batch();
                }
            }

            if (count % batchSize !== 0) {
                await batch.commit();
            }

            results.products = { migrated: count };
        } else {
            results.products = { migrated: 0, message: 'No documents in butcher_products' };
        }

        // Verify
        const ordersCount = (await db.collection('orders').count().get()).data().count;
        const productsCount = (await db.collection('products').count().get()).data().count;

        results.verification = {
            ordersInNewCollection: ordersCount,
            productsInNewCollection: productsCount,
        };

        console.log('🎉 Migration complete!', results);
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const { db } = getFirebaseAdmin();

        const butcherOrdersCount = (await db.collection('orders').count().get()).data().count;
        const ordersCount = (await db.collection('orders').count().get()).data().count;
        const butcherProductsCount = (await db.collection('products').count().get()).data().count;
        const productsCount = (await db.collection('products').count().get()).data().count;

        return NextResponse.json({
            collections: {
                butcher_orders: butcherOrdersCount,
                orders: ordersCount,
                butcher_products: butcherProductsCount,
                products: productsCount,
            },
            migrationNeeded: butcherOrdersCount > ordersCount || butcherProductsCount > productsCount,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
