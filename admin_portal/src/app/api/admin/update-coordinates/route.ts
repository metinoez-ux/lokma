import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
    try {
        const { db } = getFirebaseAdmin();
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Google API Key not configured" }, { status: 500 });
        }

        // Get all businesses from Firestore
        const businessesRef = db.collection("businesses");
        const snapshot = await businessesRef.get();

        const results: Array<{
            id: string;
            name: string;
            status: string;
            lat?: number;
            lng?: number;
            error?: string;
        }> = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const businessName = data.companyName || data.name || doc.id;

            // Check if already has coordinates
            const existingLat = data.lat || data.address?.lat;
            const existingLng = data.lng || data.address?.lng;

            if (existingLat && existingLng) {
                results.push({
                    id: doc.id,
                    name: businessName,
                    status: "skipped",
                    lat: existingLat,
                    lng: existingLng
                });
                continue;
            }

            // Try to get coordinates from Google Places
            const googlePlaceId = data.googlePlaceId;

            if (!googlePlaceId) {
                // Try to find by business name and address
                const searchQuery = `${businessName} ${data.address?.city || ''} ${data.address?.country || 'Germany'}`.trim();

                try {
                    // First, find the place
                    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,geometry&key=${apiKey}`;
                    const findRes = await fetch(findUrl);
                    const findData = await findRes.json();

                    if (findData.candidates && findData.candidates.length > 0) {
                        const candidate = findData.candidates[0];
                        const lat = candidate.geometry?.location?.lat;
                        const lng = candidate.geometry?.location?.lng;

                        if (lat && lng) {
                            // Update Firestore with coordinates
                            await businessesRef.doc(doc.id).update({
                                lat: lat,
                                lng: lng,
                                googlePlaceId: candidate.place_id,
                                "address.lat": lat,
                                "address.lng": lng,
                                coordinatesUpdatedAt: new Date().toISOString()
                            });

                            results.push({
                                id: doc.id,
                                name: businessName,
                                status: "updated_by_search",
                                lat: lat,
                                lng: lng
                            });
                        } else {
                            results.push({
                                id: doc.id,
                                name: businessName,
                                status: "no_geometry",
                                error: "Place found but no geometry"
                            });
                        }
                    } else {
                        results.push({
                            id: doc.id,
                            name: businessName,
                            status: "not_found",
                            error: "No place found for search query"
                        });
                    }
                } catch (searchError) {
                    results.push({
                        id: doc.id,
                        name: businessName,
                        status: "search_error",
                        error: String(searchError)
                    });
                }
            } else {
                // Has googlePlaceId, get details
                try {
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=geometry&key=${apiKey}`;
                    const detailsRes = await fetch(detailsUrl);
                    const detailsData = await detailsRes.json();

                    if (detailsData.status === "OK" && detailsData.result?.geometry?.location) {
                        const lat = detailsData.result.geometry.location.lat;
                        const lng = detailsData.result.geometry.location.lng;

                        // Update Firestore
                        await businessesRef.doc(doc.id).update({
                            lat: lat,
                            lng: lng,
                            "address.lat": lat,
                            "address.lng": lng,
                            coordinatesUpdatedAt: new Date().toISOString()
                        });

                        results.push({
                            id: doc.id,
                            name: businessName,
                            status: "updated_by_placeid",
                            lat: lat,
                            lng: lng
                        });
                    } else {
                        results.push({
                            id: doc.id,
                            name: businessName,
                            status: "placeid_error",
                            error: `Google API returned: ${detailsData.status}`
                        });
                    }
                } catch (detailsError) {
                    results.push({
                        id: doc.id,
                        name: businessName,
                        status: "details_error",
                        error: String(detailsError)
                    });
                }
            }

            // Rate limiting - wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Summary
        const updated = results.filter(r => r.status.startsWith("updated")).length;
        const skipped = results.filter(r => r.status === "skipped").length;
        const failed = results.filter(r => !r.status.startsWith("updated") && r.status !== "skipped").length;

        return NextResponse.json({
            success: true,
            summary: {
                total: results.length,
                updated: updated,
                skipped: skipped,
                failed: failed
            },
            results: results
        });

    } catch (error) {
        console.error("Update coordinates error:", error);
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
