import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { formatCurrency } from '@/lib/utils/currency';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

/**
 * PARTIAL REFUND API
 * 
 * Handles partial refunds for orders with unavailable items.
 * Calculates refund amount from unavailable items and issues a Stripe partial refund.
 * Records refund in platform_transactions for accounting.
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            orderId,
            unavailableItems, // [{positionNumber, productName, quantity, price}]
        } = body;

        if (!orderId || !unavailableItems || unavailableItems.length === 0) {
            return NextResponse.json(
                { error: 'orderId and unavailableItems are required' },
                { status: 400 }
            );
        }

        // Get order from Firestore (meat_orders)
        const orderDoc = await getDoc(doc(db, 'meat_orders', orderId));
        if (!orderDoc.exists()) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        const orderData = orderDoc.data();

        // Check if payment was made by card
        if (orderData.paymentStatus !== 'paid' || orderData.paymentMethod !== 'card') {
            return NextResponse.json({
                success: true,
                refunded: false,
                message: 'No card payment to refund for this order.',
            });
        }

        // Get PaymentIntent ID
        const piId = orderData.stripePaymentIntentId;
        if (!piId) {
            console.error(`[Partial Refund] No stripePaymentIntentId found for order ${orderId}`);
            return NextResponse.json({
                success: true,
                refunded: false,
                message: 'No Stripe payment intent found for this order.',
            });
        }

        // Calculate refund amount from unavailable items
        const refundAmount = unavailableItems.reduce(
            (sum: number, item: { price: number; quantity: number }) => sum + (item.price * item.quantity),
            0
        );

        if (refundAmount <= 0) {
            return NextResponse.json({
                success: true,
                refunded: false,
                message: 'Nothing to refund.',
            });
        }

        // Convert to cents for Stripe
        const refundAmountCents = Math.round(refundAmount * 100);

        console.log(`[Partial Refund] Processing ${formatCurrency(refundAmount, orderData.currency)} refund for order ${orderId}, PI: ${piId}`);

        // Create partial refund via Stripe
        const refund = await stripe.refunds.create({
            payment_intent: piId,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
                orderId,
                type: 'partial_unavailable_items',
                unavailableCount: String(unavailableItems.length),
                refundedAt: new Date().toISOString(),
            },
        });

        console.log(`[Partial Refund] Created refund: ${refund.id}, status: ${refund.status}, amount: ${formatCurrency(refund.amount / 100, orderData.currency)}`);

        // Update order with refund info
        await updateDoc(doc(db, 'meat_orders', orderId), {
            partialRefundId: refund.id,
            partialRefundStatus: refund.status,
            partialRefundAmount: refund.amount / 100,
            partialRefundedAt: new Date(),
        });

        // Record in platform_transactions
        try {
            await addDoc(collection(db, 'platform_transactions'), {
                type: 'partial_refund',
                paymentIntentId: piId,
                refundId: refund.id,
                orderId,
                amount: refund.amount / 100,
                status: refund.status,
                reason: 'unavailable_items',
                unavailableItems,
                createdAt: new Date().toISOString(),
                businessId: orderData.businessId || orderData.butcherId,
            });
            console.log('[LOKMA Accounting] Partial refund transaction recorded');
        } catch (accountingError) {
            console.error('[LOKMA Accounting] Failed to record partial refund:', accountingError);
        }

        return NextResponse.json({
            success: true,
            refunded: true,
            refundId: refund.id,
            refundStatus: refund.status,
            refundAmount: refund.amount / 100,
            message: `${formatCurrency(refund.amount / 100, orderData.currency)} kısmi iade başarıyla işlendi.`,
        });

    } catch (error: any) {
        console.error('[Partial Refund] Error:', error);

        if (error.type === 'StripeInvalidRequestError') {
            return NextResponse.json(
                { error: 'This payment cannot be partially refunded', message: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Partial refund failed' },
            { status: 500 }
        );
    }
}
