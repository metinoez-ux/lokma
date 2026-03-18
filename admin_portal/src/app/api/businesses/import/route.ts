import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

/**
 * POST /api/businesses/import
 * JSON-Import: Betriebe mit Kategorien und Produkten aus einer exportierten Datei importieren.
 * Bestehende Betriebe (per googlePlaceId oder companyName) werden uebersprungen.
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

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const importBusinesses: any[] = body.businesses || [];
    if (importBusinesses.length === 0) {
        return NextResponse.json({ error: 'Keine Betriebe in der Importdatei gefunden' }, { status: 400 });
    }

    // Bestehende Betriebe laden (googlePlaceId + companyName)
    const existingSnap = await adminDb.collection('businesses').get();
    const existingPlaceIds = new Set<string>();
    const existingNames = new Set<string>();
    existingSnap.docs.forEach(d => {
        const data = d.data();
        if (data.googlePlaceId) existingPlaceIds.add(data.googlePlaceId);
        if (data.companyName) existingNames.add(data.companyName.toLowerCase());
    });

    const stats = {
        imported: 0,
        skipped: 0,
        categoriesCreated: 0,
        productsCreated: 0,
        errors: [] as string[],
    };

    for (const biz of importBusinesses) {
        try {
            // Duplikat-Check
            if (biz.googlePlaceId && existingPlaceIds.has(biz.googlePlaceId)) {
                stats.skipped++;
                continue;
            }
            if (biz.companyName && existingNames.has(biz.companyName.toLowerCase())) {
                stats.skipped++;
                continue;
            }

            // Business-Daten vorbereiten (id, categories, products entfernen)
            const { id: _id, categories, products, ...bizData } = biz;

            // Timestamps konvertieren (ISO strings -> Date)
            const convertDates = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(obj)) {
                    return new Date(obj);
                }
                if (Array.isArray(obj)) {
                    return obj.map(convertDates);
                }
                if (typeof obj === 'object') {
                    const result: any = {};
                    for (const key of Object.keys(obj)) {
                        result[key] = convertDates(obj[key]);
                    }
                    return result;
                }
                return obj;
            };

            const cleanBizData = convertDates(bizData);
            cleanBizData.importedAt = new Date();
            cleanBizData.updatedAt = new Date();

            const bizRef = adminDb.collection('businesses').doc();
            await bizRef.set(cleanBizData);

            // Kategorien importieren
            if (Array.isArray(categories)) {
                for (const cat of categories) {
                    const { id: _catId, ...catData } = cat;
                    const cleanCatData = convertDates(catData);
                    await bizRef.collection('categories').doc().set(cleanCatData);
                    stats.categoriesCreated++;
                }
            }

            // Produkte importieren
            if (Array.isArray(products)) {
                for (const prod of products) {
                    const { id: _prodId, ...prodData } = prod;
                    const cleanProdData = convertDates(prodData);
                    await bizRef.collection('products').doc().set(cleanProdData);
                    stats.productsCreated++;
                }
            }

            stats.imported++;
            // Track gegen Duplikate
            if (cleanBizData.googlePlaceId) existingPlaceIds.add(cleanBizData.googlePlaceId);
            if (cleanBizData.companyName) existingNames.add(cleanBizData.companyName.toLowerCase());

        } catch (e: any) {
            stats.errors.push(`Import error for "${biz.companyName || biz.id}": ${e.message}`);
        }
    }

    return NextResponse.json({ success: true, stats });
}
