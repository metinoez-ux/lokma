import { NextRequest, NextResponse } from 'next/server';

/**
 * Google Directions API - ETA & Route Calculation
 * 
 * Endpoints:
 * GET /api/directions?origin=lat,lng&destination=lat,lng&mode=driving
 * 
 * Features:
 * - Real-time traffic data (departure_time=now)
 * - Duration in traffic
 * - Distance
 * - Polyline for route drawing
 */

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const origin = searchParams.get('origin'); // lat,lng
    const destination = searchParams.get('destination'); // lat,lng
    const mode = searchParams.get('mode') || 'driving'; // driving, walking, bicycling, transit

    if (!origin || !destination) {
        return NextResponse.json(
            { error: 'origin and destination are required (format: lat,lng)' },
            { status: 400 }
        );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: 'Google Maps API key not configured' },
            { status: 500 }
        );
    }

    try {
        // Google Directions API with traffic
        const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
        directionsUrl.searchParams.set('origin', origin);
        directionsUrl.searchParams.set('destination', destination);
        directionsUrl.searchParams.set('mode', mode);
        directionsUrl.searchParams.set('departure_time', 'now'); // Enable traffic data
        directionsUrl.searchParams.set('traffic_model', 'best_guess'); // best_guess, pessimistic, optimistic
        directionsUrl.searchParams.set('language', 'de'); // German
        directionsUrl.searchParams.set('key', apiKey);

        const response = await fetch(directionsUrl.toString());
        const data = await response.json();

        if (data.status !== 'OK') {
            console.error('Directions API Error:', data.status, data.error_message);
            return NextResponse.json(
                { error: `Directions API Error: ${data.status}`, details: data.error_message },
                { status: 400 }
            );
        }

        const route = data.routes[0];
        const leg = route.legs[0];

        // Calculate ETA
        const now = new Date();
        const durationSeconds = leg.duration_in_traffic?.value || leg.duration.value;
        const etaDate = new Date(now.getTime() + durationSeconds * 1000);

        const result = {
            // Basic info
            origin: {
                address: leg.start_address,
                lat: leg.start_location.lat,
                lng: leg.start_location.lng,
            },
            destination: {
                address: leg.end_address,
                lat: leg.end_location.lat,
                lng: leg.end_location.lng,
            },

            // Distance
            distance: {
                text: leg.distance.text, // "5.2 km"
                meters: leg.distance.value, // 5200
            },

            // Duration (without traffic)
            duration: {
                text: leg.duration.text, // "12 min"
                seconds: leg.duration.value, // 720
            },

            // Duration IN TRAFFIC (Premium feature)
            durationInTraffic: leg.duration_in_traffic ? {
                text: leg.duration_in_traffic.text, // "15 min"
                seconds: leg.duration_in_traffic.value, // 900
            } : null,

            // ETA
            eta: {
                timestamp: etaDate.toISOString(),
                formatted: etaDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                minutesRemaining: Math.round(durationSeconds / 60),
            },

            // Polyline for map drawing
            polyline: route.overview_polyline?.points || null,

            // Traffic conditions
            trafficCondition: _getTrafficCondition(leg.duration, leg.duration_in_traffic),

            // Summary
            summary: route.summary, // "A4" (highway name)

            // Warnings
            warnings: route.warnings || [],
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('Directions API Error:', error);
        return NextResponse.json(
            { error: 'Failed to calculate route' },
            { status: 500 }
        );
    }
}

function _getTrafficCondition(
    normalDuration: { value: number },
    trafficDuration?: { value: number }
): string {
    if (!trafficDuration) return 'unknown';

    const ratio = trafficDuration.value / normalDuration.value;

    if (ratio <= 1.1) return 'light'; // ≤10% slower
    if (ratio <= 1.3) return 'moderate'; // 10-30% slower
    if (ratio <= 1.5) return 'heavy'; // 30-50% slower
    return 'severe'; // >50% slower
}
