import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import {
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
 * PLZ -> geo koordinatlari almak icin Google Geocoding API
 */
async function geocodePLZ(plz: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(plz + ' Deutschland')}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch {}
    return null;
}

/**
 * POST /api/demo-data/seed
 * 
 * mode=search: Google Places'ten isletmeleri arar, listeyi dondurur (Firestore'a kaydetmez)
 * mode=save: Secilen isletmeleri (placeIds) Firestore'a kaydeder
 * 
 * Body params:
 *   mode: 'search' | 'save'
 *   postalCode: string (default: '41836')
 *   maxResults: number (default: 20, max: 50)
 *   placeIds: string[] (mode=save icin, kaydetilecek place_id'ler)
 *   places: Place[] (mode=save icin, kaydetilecek place detaylari)
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

    let body: any;
    try {
        body = await req.json();
    } catch {
        body = {};
    }

    // Frontend dryRun=true -> search, dryRun=false -> save
    const mode = body.mode || (body.dryRun === false ? 'save' : 'search');
    const postalCode = body.postalCode || '41836';
    const maxResults = Math.min(Math.max(body.maxResults || body.maxBusinesses || 20, 1), 50);

    // Zaten kayitli isletmelerin googlePlaceId'lerini al
    const existingSnap = await adminDb.collection('businesses')
        .where('googlePlaceId', '!=', null).get();
    const existingPlaceIds = new Set<string>();
    existingSnap.docs.forEach(d => {
        const gpi = d.data().googlePlaceId;
        if (gpi) existingPlaceIds.add(gpi);
    });

    // ==========================================
    // MODE: SEARCH -- Sadece bul ve listele
    // ==========================================
    if (mode === 'search') {
        // PLZ'den koordinat al
        const center = await geocodePLZ(postalCode, apiKey);
        if (!center) {
            return NextResponse.json({ error: `PLZ ${postalCode} konnte nicht geocodiert werden` }, { status: 400 });
        }

        const allPlaceIds = new Set<string>();
        const foundPlaces: any[] = [];
        const errors: string[] = [];
        const radius = 5000;

        // Arama sorgulari -- PLZ=41836 yerine dinamik sehir adi
        // Once PLZ'nin sehir adini geocode'dan cikarmaya calisiyoruz
        let cityName = postalCode;
        try {
            const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postalCode + ' Deutschland')}&key=${apiKey}`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            if (geoData.status === 'OK' && geoData.results?.[0]) {
                const comps = geoData.results[0].address_components;
                const locality = comps?.find((c: any) => c.types.includes('locality'));
                if (locality) cityName = locality.long_name;
            }
        } catch {}

        // Dinamik arama sorgulari olustur (Huckelhoven yerine sehir adi)
        const searchQueries = DEMO_SEARCH_QUERIES.map(sq => ({
            ...sq,
            query: sq.query.replace(/Hückelhoven/gi, cityName),
        }));

        for (const sq of searchQueries) {
            if (foundPlaces.length >= maxResults) break;

            try {
                const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(sq.query)}&location=${center.lat},${center.lng}&radius=${radius}&type=${sq.googleType}&language=de&key=${apiKey}`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                if (searchData.status !== 'OK' || !searchData.results) continue;

                const perQuery = Math.max(2, Math.ceil(maxResults / searchQueries.length));
                const places = searchData.results.slice(0, perQuery);

                for (const place of places) {
                    if (allPlaceIds.has(place.place_id)) continue;
                    if (foundPlaces.length >= maxResults) break;
                    allPlaceIds.add(place.place_id);

                    // Temel bilgiler (details API'yi aramadan)
                    const businessType = detectBusinessType(place.name, place.types || []);
                    const alreadyAdded = existingPlaceIds.has(place.place_id);

                    foundPlaces.push({
                        placeId: place.place_id,
                        name: place.name,
                        address: place.formatted_address || '',
                        businessType,
                        rating: place.rating || null,
                        userRatingsTotal: place.user_ratings_total || null,
                        alreadyAdded,
                        lat: place.geometry?.location?.lat,
                        lng: place.geometry?.location?.lng,
                    });
                }
            } catch (e: any) {
                errors.push(`Search error for "${sq.query}": ${e.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            mode: 'search',
            postalCode,
            cityName,
            center,
            foundPlaces,
            existingCount: existingPlaceIds.size,
            errors,
        });
    }

    // ==========================================
    // MODE: SAVE -- Secilen isletmeleri kaydet
    // ==========================================
    if (mode === 'save') {
        const selectedPlaceIds: string[] = body.placeIds || body.selectedPlaceIds || [];
        if (selectedPlaceIds.length === 0) {
            return NextResponse.json({ error: 'Keine Betriebe ausgewählt' }, { status: 400 });
        }

        // Zaten eklenenleri cikar
        const toSave = selectedPlaceIds.filter(pid => !existingPlaceIds.has(pid));
        if (toSave.length === 0) {
            return NextResponse.json({ error: 'Alle ausgewählten Betriebe sind bereits vorhanden' }, { status: 409 });
        }

        const results: any[] = [];
        const errors: string[] = [];

        for (const placeId of toSave) {
            try {
                // Place Details
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=name,photos,opening_hours,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry&language=de`;
                const detailsRes = await fetch(detailsUrl);
                const detailsData = await detailsRes.json();
                if (detailsData.status !== 'OK' || !detailsData.result) {
                    errors.push(`Details error for ${placeId}: ${detailsData.status}`);
                    continue;
                }

                const d = detailsData.result;
                const getComp = (type: string) => d.address_components?.find((c: any) => c.types.includes(type))?.long_name || '';
                const street = `${getComp('route')} ${getComp('street_number')}`.trim();
                const plzFromGoogle = getComp('postal_code');
                const city = getComp('locality') || getComp('postal_town') || '';
                const country = d.address_components?.find((c: any) => c.types.includes('country'))?.short_name || 'DE';

                const businessType = detectBusinessType(d.name || '', d.types || []);
                const cuisineTypes = detectCuisineTypes(d.name || '');

                let coverImageUrl = '';
                if (d.photos && d.photos.length > 0) {
                    const photoRef = d.photos[0].photo_reference;
                    coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${apiKey}`;
                }

                let openingHours: string[] = [];
                if (d.opening_hours?.weekday_text) {
                    openingHours = d.opening_hours.weekday_text.map((line: string) => normalizeGoogleHoursLine(line));
                }

                const defaults = getDefaultBusinessSettings(businessType);

                const businessRef = adminDb.collection('businesses').doc();
                const businessData = {
                    companyName: d.name || '',
                    businessType,
                    types: [businessType],
                    street,
                    postalCode: plzFromGoogle,
                    city,
                    country,
                    lat: d.geometry?.location?.lat || 0,
                    lng: d.geometry?.location?.lng || 0,
                    phone: d.formatted_phone_number || '',
                    email: '',
                    website: d.website || '',
                    coverImageUrl,
                    openingHours,
                    cuisineTypes,
                    googlePlaceId: placeId,
                    googleRating: d.rating || null,
                    googleReviewCount: d.user_ratings_total || null,
                    ...defaults,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                await businessRef.set(businessData);

                // Menu olustur
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
                    postalCode: plzFromGoogle,
                    categories: catCount,
                    products: prodCount,
                    coverImageUrl: coverImageUrl ? true : false,
                });
            } catch (placeErr: any) {
                errors.push(`Save error for ${placeId}: ${placeErr.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            mode: 'save',
            created: results.length,
            skipped: selectedPlaceIds.length - toSave.length,
            businesses: results,
            errors,
        });
    }

    return NextResponse.json({ error: 'Invalid mode. Use "search" or "save".' }, { status: 400 });
}
