import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import {
    DEMO_CENTER,
    DEMO_RADIUS,
    DEMO_SEARCH_QUERIES,
    MENU_TEMPLATES,
    detectBusinessType,
    detectCuisineTypes,
    getDefaultBusinessSettings,
} from '@/lib/demoBusinessData';
import { normalizeTimeString } from '@/utils/timeUtils';

/**
 * Google Places weekday_text satirindaki saatleri 24h formatina donusturur.
 */
function normalizeGoogleHoursLine(line: string): string {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return line;
    const dayPart = line.substring(0, colonIdx).trim();
    const timePart = line.substring(colonIdx + 1).trim();
    const lower = timePart.toLowerCase();
    if (lower.includes('closed') || lower.includes('open 24')) return line;
    const separator = timePart.includes('\u2013') ? '\u2013' : '-';
    const parts = timePart.split(separator).map(p => p.trim());
    if (parts.length >= 2) {
        const start = normalizeTimeString(parts[0]);
        const end = normalizeTimeString(parts[1]);
        return `${dayPart}: ${start} - ${end}`;
    }
    return line;
}

/**
 * POST /api/demo-data/seed
 * Google Places ile PLZ 41836 etrafindaki 20-30 isletmeyi bulur ve Firestore'a ekler.
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

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing Google API Key' }, { status: 500 });
    }

    // 2. Onceki demo isletmeleri kontrol et
    const existingDemos = await adminDb.collection('businesses').where('isDemo', '==', true).get();
    if (!existingDemos.empty) {
        return NextResponse.json({
            error: `Bereits ${existingDemos.size} Demo-Betriebe vorhanden. Bitte zuerst löschen.`,
            existingCount: existingDemos.size,
        }, { status: 409 });
    }

    const allPlaceIds = new Set<string>();
    const results: any[] = [];
    const errors: string[] = [];

    // 3. Her sorgu icin Google Places'ten arama yap
    for (const sq of DEMO_SEARCH_QUERIES) {
        try {
            // nearbysearch degil, textsearch kullaniyoruz, daha iyi sonuc veriyor
            const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(sq.query)}&location=${DEMO_CENTER.lat},${DEMO_CENTER.lng}&radius=${DEMO_RADIUS}&type=${sq.googleType}&language=de&key=${apiKey}`;

            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (searchData.status !== 'OK' || !searchData.results) continue;

            // En fazla 4 sonuc al (toplam 30-40 civarinda olacak, sonra limitliyoruz)
            const places = searchData.results.slice(0, 4);

            for (const place of places) {
                if (allPlaceIds.has(place.place_id)) continue; // Tekrar kontrolu
                if (results.length >= 30) break; // Max 30 isletme

                allPlaceIds.add(place.place_id);

                try {
                    // Place Details aliyoruz
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${apiKey}&fields=name,photos,opening_hours,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry&language=de`;
                    const detailsRes = await fetch(detailsUrl);
                    const detailsData = await detailsRes.json();

                    if (detailsData.status !== 'OK' || !detailsData.result) continue;

                    const d = detailsData.result;

                    // Adres parse
                    const getComp = (type: string) => d.address_components?.find((c: any) => c.types.includes(type))?.long_name || '';
                    const street = `${getComp('route')} ${getComp('street_number')}`.trim();
                    const postalCode = getComp('postal_code');
                    const city = getComp('locality') || getComp('postal_town') || 'Hückelhoven';
                    const country = d.address_components?.find((c: any) => c.types.includes('country'))?.short_name || 'DE';

                    // Isletme turu tespiti
                    const businessType = detectBusinessType(d.name || place.name, place.types || []);
                    const cuisineTypes = detectCuisineTypes(d.name || place.name);

                    // Kapak resmi
                    let coverImageUrl = '';
                    if (d.photos && d.photos.length > 0) {
                        const photoRef = d.photos[0].photo_reference;
                        coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${apiKey}`;
                    }

                    // Acilis saatleri
                    let openingHours: string[] = [];
                    if (d.opening_hours?.weekday_text) {
                        openingHours = d.opening_hours.weekday_text.map((line: string) => normalizeGoogleHoursLine(line));
                    }

                    // Default settings
                    const defaults = getDefaultBusinessSettings(businessType);

                    // Firestore'a kaydet
                    const businessRef = adminDb.collection('businesses').doc();
                    const businessData = {
                        companyName: d.name || place.name,
                        businessType,
                        types: [businessType],
                        street,
                        postalCode,
                        city,
                        country,
                        lat: d.geometry?.location?.lat || place.geometry?.location?.lat || 0,
                        lng: d.geometry?.location?.lng || place.geometry?.location?.lng || 0,
                        phone: d.formatted_phone_number || '',
                        email: '',
                        website: d.website || '',
                        coverImageUrl,
                        openingHours,
                        cuisineTypes,
                        googlePlaceId: place.place_id,
                        googleRating: d.rating || null,
                        googleReviewCount: d.user_ratings_total || null,
                        ...defaults,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };

                    await businessRef.set(businessData);

                    // Menu olustur (categories + products sub-collections)
                    const menuTemplate = MENU_TEMPLATES[businessType] || MENU_TEMPLATES['restoran'];
                    let catCount = 0;
                    let prodCount = 0;

                    for (let i = 0; i < menuTemplate.length; i++) {
                        const cat = menuTemplate[i];
                        const catRef = businessRef.collection('categories').doc();
                        await catRef.set({
                            name: { de: cat.name, tr: cat.name },
                            icon: cat.icon,
                            isActive: true,
                            order: i,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                        catCount++;

                        // Urunler
                        for (const prod of cat.products) {
                            const prodRef = businessRef.collection('products').doc();
                            await prodRef.set({
                                name: { de: prod.name, tr: prod.name },
                                price: prod.price,
                                sellingPrice: prod.price,
                                description: prod.description ? { de: prod.description, tr: prod.description } : { de: '', tr: '' },
                                category: cat.name,
                                categories: [cat.name],
                                unit: prod.unit || 'stueck',
                                defaultUnit: prod.unit || 'stueck',
                                isActive: true,
                                isAvailable: true,
                                isCustom: true,
                                outOfStock: false,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            });
                            prodCount++;
                        }
                    }

                    results.push({
                        id: businessRef.id,
                        name: businessData.companyName,
                        type: businessType,
                        city,
                        street,
                        postalCode,
                        categories: catCount,
                        products: prodCount,
                        coverImageUrl: coverImageUrl ? true : false,
                    });

                } catch (placeErr: any) {
                    errors.push(`Details error for ${place.name}: ${placeErr.message}`);
                }
            }

            if (results.length >= 30) break;

        } catch (searchErr: any) {
            errors.push(`Search error for "${sq.query}": ${searchErr.message}`);
        }
    }

    return NextResponse.json({
        success: true,
        created: results.length,
        businesses: results,
        errors,
    });
}
