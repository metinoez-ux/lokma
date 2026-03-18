import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

/**
 * POST /api/businesses/export
 * Alle Betriebe mit Kategorien, Produkten und allen Feldern als JSON exportieren.
 * Super Admin Berechtigung erforderlich.
 */
export async function POST(req: NextRequest) {
    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();

    // Auth
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

    try {
        const bizSnap = await adminDb.collection('businesses').get();
        const businesses: any[] = [];

        for (const bizDoc of bizSnap.docs) {
            const bizData = bizDoc.data();

            // Timestamps zu ISO-Strings konvertieren
            const serializeTimestamps = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (obj.toDate && typeof obj.toDate === 'function') {
                    return obj.toDate().toISOString();
                }
                if (obj instanceof Date) {
                    return obj.toISOString();
                }
                if (Array.isArray(obj)) {
                    return obj.map(serializeTimestamps);
                }
                if (typeof obj === 'object') {
                    const result: any = {};
                    for (const key of Object.keys(obj)) {
                        result[key] = serializeTimestamps(obj[key]);
                    }
                    return result;
                }
                return obj;
            };

            // Kategorien laden
            const catsSnap = await bizDoc.ref.collection('categories').get();
            const categories = catsSnap.docs.map(d => ({
                id: d.id,
                ...serializeTimestamps(d.data()),
            }));

            // Produkte laden
            const prodsSnap = await bizDoc.ref.collection('products').get();
            const products = prodsSnap.docs.map(d => ({
                id: d.id,
                ...serializeTimestamps(d.data()),
            }));

            businesses.push({
                id: bizDoc.id,
                ...serializeTimestamps(bizData),
                categories,
                products,
            });
        }

        const exportData = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            businessCount: businesses.length,
            businesses,
        };

        return NextResponse.json(exportData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
