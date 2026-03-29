import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Stripe Terminal Payment Intent (Tap to Pay / card_present)
 * Normal payment intent'ten farklı olarak:
 * - payment_method_types: ['card_present'] — fiziksel NFC kart okuma
 * - capture_method: 'automatic' — onay sonrası otomatik capture
 */
export async function POST(request: NextRequest) {
    try {
        const { amount, businessId, orderId, courierId, description } = await request.json();

        if (!amount || !businessId) {
            return NextResponse.json({ error: 'amount and businessId are required' }, { status: 400 });
        }

        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        const businessData = businessDoc.data();
        const amountCents = Math.round(amount * 100);
        const connectedAccountId = businessData.stripeAccountId;

        const paymentIntentParams: any = {
            amount: amountCents,
            currency: 'eur',
            payment_method_types: ['card_present'],
            capture_method: 'automatic',
            description: description || `LOKMA Kapıda Ödeme - Sipariş #${orderId}`,
            metadata: {
                orderId: orderId || '',
                businessId,
                businessName: businessData.companyName || businessData.brand || '',
                courierId: courierId || '',
                paymentChannel: 'tap_to_pay',
            },
        };

        // Stripe Connect varsa destination charge
        if (connectedAccountId) {
            const commissionRate = businessData.commissionRate || 5;
            const commissionCents = Math.round(amountCents * (commissionRate / 100));
            paymentIntentParams.transfer_data = {
                destination: connectedAccountId,
                amount: amountCents - commissionCents,
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        console.log(`[Terminal] Payment intent created: ${paymentIntent.id} for €${amount}`);

        return NextResponse.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error: any) {
        console.error('[Terminal] Payment intent error:', error);
        return NextResponse.json(
            { error: error.message || 'Terminal payment creation failed' },
            { status: 500 }
        );
    }
}
