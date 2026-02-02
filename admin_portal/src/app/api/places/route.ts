import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCPQZxB0Tt5c4dhh_q2IejHGTd-layUFQE';

// Google Places Autocomplete Proxy - bypasses CORS restrictions
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const input = searchParams.get('input');
    const type = searchParams.get('type') || 'autocomplete'; // autocomplete or details
    const placeId = searchParams.get('place_id');

    if (type === 'autocomplete' || type === 'cities') {
        if (!input || input.length < 2) {
            return NextResponse.json({ predictions: [], status: 'ZERO_RESULTS' });
        }

        try {
            // Use (cities) type filter for city search, 'address' for street search
            const typesParam = type === 'cities' ? '(cities)' : 'address';
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&language=tr&types=${typesParam}`;
            const response = await fetch(url);
            const data = await response.json();
            return NextResponse.json(data);
        } catch (error) {
            console.error('Places Autocomplete Error:', error);
            return NextResponse.json({ predictions: [], status: 'ERROR', error: String(error) }, { status: 500 });
        }
    } else if (type === 'details') {
        if (!placeId) {
            return NextResponse.json({ result: null, status: 'INVALID_REQUEST' });
        }

        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&fields=address_components,formatted_address,geometry`;
            const response = await fetch(url);
            const data = await response.json();
            return NextResponse.json(data);
        } catch (error) {
            console.error('Place Details Error:', error);
            return NextResponse.json({ result: null, status: 'ERROR', error: String(error) }, { status: 500 });
        }
    }

    return NextResponse.json({ status: 'INVALID_REQUEST' });
}
