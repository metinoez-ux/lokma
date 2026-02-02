
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action"); // 'search' or 'details' (default)
        const placeId = searchParams.get("placeId");
        const query = searchParams.get("query");

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server API Key configuration error" }, { status: 500 });
        }

        // --- MODE 1: SEARCH (AUTOCOMPLETE / TEXTSEARCH for multiple results) ---
        if (action === 'search' && query) {
            // Use textsearch instead of findplacefromtext to get multiple results
            const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (searchData.status === 'OK' && searchData.results) {
                // Return up to 10 results with rating info
                const candidates = searchData.results.slice(0, 10).map((r: any) => ({
                    place_id: r.place_id,
                    name: r.name,
                    formatted_address: r.formatted_address,
                    rating: r.rating,
                    user_ratings_total: r.user_ratings_total,
                }));
                return NextResponse.json({ candidates });
            } else {
                return NextResponse.json({ candidates: [] });
            }
        }

        // --- MODE 2: DETAILS (Original Logic) ---
        // If we have a query but no placeId, try to resolve it to an ID first (Legacy support or "I'm Feeling Lucky")
        let finalPlaceId = placeId;

        // If no placeId provided, check if we have a query to resolve
        if (!finalPlaceId && query) {
            const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
            const findRes = await fetch(findUrl);
            const findData = await findRes.json();
            if (findData.candidates && findData.candidates.length > 0) {
                finalPlaceId = findData.candidates[0].place_id;
            }
        }

        if (!finalPlaceId) {
            return NextResponse.json({ error: "Place ID or Query is required" }, { status: 400 });
        }

        // Smart Detection for Legacy calls passing query as placeId
        // ... (Existing logic mostly replaced by the above, but keeping safety check)
        if ((finalPlaceId.includes(' ') || !finalPlaceId.startsWith('ChIJ'))) {
            // It's a raw query passed as ID
            const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(finalPlaceId)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
            const findRes = await fetch(findUrl);
            const findData = await findRes.json();
            if (findData.candidates && findData.candidates.length > 0) {
                finalPlaceId = findData.candidates[0].place_id;
            } else {
                return NextResponse.json({ error: `Yer bulunamadı: "${finalPlaceId}"` }, { status: 404 });
            }
        }


        const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${finalPlaceId}&key=${apiKey}&fields=name,photos,opening_hours,formatted_phone_number,website,rating,user_ratings_total,reviews,address_components,geometry&reviews_no_translations=true`;

        const response = await fetch(googleUrl);
        const data = await response.json();

        if (data.status !== "OK") {
            console.error("Google API Error:", data.status, data.error_message);
            return NextResponse.json({ error: `Google API Error: ${data.status}` }, { status: 400 });
        }

        const place = data.result;
        const result: any = {};

        // 2. Format Opening Hours
        if (place.opening_hours?.weekday_text) {
            // Return raw array for structured editing
            result.openingHours = place.opening_hours.weekday_text;
        }

        // 3. Format Phone
        if (place.formatted_phone_number) {
            result.shopPhone = place.formatted_phone_number;
        }

        // 4. Format Photo URL
        if (place.photos && place.photos.length > 0) {
            const photoRef = place.photos[0].photo_reference;
            result.photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${apiKey}`;
        }

        // 5. Ratings & ID
        result.googlePlaceId = finalPlaceId;
        if (place.rating) result.rating = place.rating;
        if (place.user_ratings_total) result.userRatingsTotal = place.user_ratings_total;

        // 6. Reviews (Mapped)
        if (place.reviews && Array.isArray(place.reviews)) {
            result.reviews = place.reviews.map((r: any) => ({
                author_name: r.author_name,
                author_url: r.author_url,
                language: r.language,
                original_language: r.original_language,
                profile_photo_url: r.profile_photo_url,
                rating: r.rating,
                relative_time_description: r.relative_time_description,
                text: r.text,
                time: r.time,
                translated: r.translated
            }));
        }

        // 7. Other fields
        if (place.name) result.name = place.name;
        if (place.website) result.website = place.website;

        // 8. Address Components (Parse street, city, etc.)
        if (place.address_components) {
            const getComponent = (type: string) => place.address_components.find((c: any) => c.types.includes(type))?.long_name || '';

            result.address = {
                street: `${getComponent('route')} ${getComponent('street_number')}`.trim(),
                postalCode: getComponent('postal_code'),
                city: getComponent('locality') || getComponent('postal_town'),
                country: getComponent('country') || 'DE', // Default to DE
                state: getComponent('administrative_area_level_1')
            };
        }

        // 9. Geometry
        if (place.geometry && place.geometry.location) {
            result.lat = place.geometry.location.lat;
            result.lng = place.geometry.location.lng;
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Server API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
