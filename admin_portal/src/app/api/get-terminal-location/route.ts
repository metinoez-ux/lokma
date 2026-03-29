export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Stripe Terminal Location — Get or Create
 * Her işletme için bir Terminal Location oluşturur veya mevcut olanı döndürür.
 * Location ID, Firestore'daki business belgesinde saklanır.
 */
export async function POST(request: NextRequest) {
    try {
        const { businessId } = await request.json();

        if (!businessId) {
            return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
        }

        // 1. İşletmenin mevcut location ID'sini kontrol et
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        const businessData = businessDoc.data();
        const existingLocationId = businessData.stripeTerminalLocationId;

        // Zaten varsa direkt döndür
        if (existingLocationId) {
            try {
                // Stripe'da hâlâ geçerli mi doğrula
                const location = await stripe.terminal.locations.retrieve(existingLocationId);
                if ('deleted' in location && location.deleted) {
                    throw new Error('Location deleted');
                }
                return NextResponse.json({
                    success: true,
                    locationId: location.id,
                    displayName: (location as any).display_name ?? '',
                });
            } catch {
                // Location silinmişse yeniden oluştur — aşağıya düş
                console.log(`[Terminal] Existing location ${existingLocationId} invalid, recreating...`);
            }
        }

        // 2. Yeni Stripe Terminal Location oluştur
        const displayName = businessData.companyName || businessData.brand || businessData.businessName || 'LOKMA İşletme';
        const street = businessData.street || businessData.address || '';
        const city = businessData.city || '';
        const postalCode = businessData.postalCode || businessData.plz || '';
        const country = businessData.country || 'DE';

        const location = await stripe.terminal.locations.create({
            display_name: `LOKMA — ${displayName}`,
            address: {
                line1: street || 'Adres girilmemiş',
                city: city || 'Berlin',
                postal_code: postalCode || '10115',
                country: country,
            },
        });

        // 3. Location ID'yi Firestore'a kaydet
        await setDoc(doc(db, 'businesses', businessId), {
            stripeTerminalLocationId: location.id,
        }, { merge: true });

        console.log(`[Terminal] Location created: ${location.id} for ${displayName}`);

        return NextResponse.json({
            success: true,
            locationId: location.id,
            displayName: location.display_name,
        });

    } catch (error: any) {
        console.error('[Terminal] Location error:', error);
        return NextResponse.json(
            { error: error.message || 'Terminal location creation failed' },
            { status: 500 }
        );
    }
}
