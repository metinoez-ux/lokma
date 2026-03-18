import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

/**
 * POST /api/demo-data/cleanup
 * isDemo: true olan tum isletmeleri ve onlarin sub-collection'larini siler.
 * Super admin yetkisi gerektirir.
 */
export async function POST(req: NextRequest) {
    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();

    // 1. Auth kontrolu
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const callerDoc = await adminDb.collection('admins').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.adminType !== 'super') {
            return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const stats = {
        businessesDeleted: 0,
        categoriesDeleted: 0,
        productsDeleted: 0,
        errors: [] as string[],
    };

    try {
        // 2. isDemo === true olan isletmeleri bul
        const demoBizSnap = await adminDb.collection('businesses').where('isDemo', '==', true).get();

        if (demoBizSnap.empty) {
            return NextResponse.json({
                success: true,
                message: 'Keine Demo-Betriebe gefunden.',
                stats,
            });
        }

        // 3. Her isletmenin sub-collection'larini sil, sonra isletmeyi sil
        for (const bizDoc of demoBizSnap.docs) {
            try {
                // categories sub-collection sil
                const catsSnap = await bizDoc.ref.collection('categories').get();
                if (!catsSnap.empty) {
                    const batch = adminDb.batch();
                    catsSnap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    stats.categoriesDeleted += catsSnap.size;
                }

                // products sub-collection sil
                const prodsSnap = await bizDoc.ref.collection('products').get();
                if (!prodsSnap.empty) {
                    // Batch limit 500
                    const chunks = [];
                    for (let i = 0; i < prodsSnap.docs.length; i += 400) {
                        chunks.push(prodsSnap.docs.slice(i, i + 400));
                    }
                    for (const chunk of chunks) {
                        const batch = adminDb.batch();
                        chunk.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                    stats.productsDeleted += prodsSnap.size;
                }

                // Business dokumani sil
                await bizDoc.ref.delete();
                stats.businessesDeleted++;

            } catch (err: any) {
                stats.errors.push(`Error deleting ${bizDoc.id}: ${err.message}`);
            }
        }

        return NextResponse.json({ success: true, stats });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stats }, { status: 500 });
    }
}
