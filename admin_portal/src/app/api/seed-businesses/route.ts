
import { NextResponse } from 'next/server';

// List from user's provided context/image
const BUTCHERS = [
    { name: 'TUNA Metzgerei', city: 'Hückelhoven' },
    { name: 'TUNA Metzgerei', city: 'Duisburg Hochfeld' },
    { name: 'TUNA Metzgerei', city: 'Duisburg Bruckhausen' },
    { name: 'TUNA Metzgerei', city: 'München' },
    { name: 'TUNA Metzgerei', city: 'Herne' },
    { name: 'TUNA Metzgerei', city: 'Dortmund' },
    { name: 'TUNA Metzgerei', city: 'Hamm' },
    { name: 'Tuna Metzgerei', city: 'Neu-Ulm' },
    { name: 'Tuna Hamburg', city: 'Hamburg' },
    { name: 'Fleischwaren Thönissen', city: 'Erkelenz' }, // The non-Tuna butcher
];

export async function GET() {
    try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
        }

        const results = [];

        for (const b of BUTCHERS) {
            try {
                // 1. Find Place ID
                const query = `${b.name} ${b.city}`;
                const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,geometry,name&key=${apiKey}`;

                const searchRes = await fetch(searchUrl).then(r => r.json());

                if (!searchRes.candidates || searchRes.candidates.length === 0) {
                    results.push({ ...b, status: 'Not Found' });
                    continue;
                }

                const placeId = searchRes.candidates[0].place_id;

                // 2. Get Details
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,opening_hours,formatted_phone_number,rating,user_ratings_total,photos,place_id,address_components&language=tr&key=${apiKey}`;
                const detailsRes = await fetch(detailsUrl).then(r => r.json());
                const details = detailsRes.result;

                if (!details) {
                    results.push({ ...b, status: 'No Details' });
                    continue;
                }

                // 3. Construct Data (Schema Compatible)
                const lat = details.geometry?.location?.lat || 0;
                const lng = details.geometry?.location?.lng || 0;

                let street = '';
                let route = '';
                let streetNumber = '';
                let postalCode = '';
                let city = '';
                let country = 'DE';

                if (details.address_components) {
                    details.address_components.forEach((c: any) => {
                        if (c.types.includes('route')) route = c.long_name;
                        if (c.types.includes('street_number')) streetNumber = c.long_name;
                        if (c.types.includes('postal_code')) postalCode = c.long_name;
                        if (c.types.includes('locality')) city = c.long_name;
                        if (c.types.includes('country')) country = c.short_name;
                    });
                    street = `${route} ${streetNumber}`.trim();
                }

                const fullAddress = details.formatted_address || '';
                if (!street) street = fullAddress.split(',')[0] || '';
                if (!city) city = b.city;

                let imageUrl = '';
                if (details.photos && details.photos.length > 0) {
                    const ref = details.photos[0].photo_reference;
                    imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${apiKey}`;
                }

                const hours: Record<string, string> = {};
                if (details.opening_hours?.weekday_text) {
                    details.opening_hours.weekday_text.forEach((text: string) => {
                        const parts = text.split(': ');
                        if (parts.length > 1) {
                            const day = parts[0].toLowerCase();
                            hours[day] = parts.slice(1).join(': ');
                        }
                    });
                }

                // Return raw data for frontend to save
                results.push({
                    placeId,
                    name: details.name || b.name,
                    originalCity: b.city,
                    street,
                    postalCode,
                    city,
                    country,
                    fullAddress,
                    lat,
                    lng,
                    phone: details.formatted_phone_number,
                    rating: details.rating,
                    reviewCount: details.user_ratings_total,
                    hours,
                    imageUrl,
                    googleMapsUrl: details.url || `https://maps.google.com/?q=place_id:${placeId}`
                });

            } catch (err: any) {
                console.error(`Error processing ${b.name} ${b.city}:`, err);
            }
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
