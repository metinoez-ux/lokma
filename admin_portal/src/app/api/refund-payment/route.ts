import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

/**
 * STRIPE REFUND API
 * 
 * Handles full refunds for cancelled orders.
 * Records refund in platform_transactions for accounting.
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            orderId,          // Order document ID in kermes_orders
            paymentIntentId,  // Stripe PaymentIntent ID
            reason,           // Refund reason
        } = body;

        if (!orderId) {
            return NextResponse.json(
                { error: 'orderId is required' },
                { status: 400 }
            );
        }

        // Get order from Firestore
        const orderDoc = await getDoc(doc(db, 'kermes_orders', orderId));
        if (!orderDoc.exists()) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        const orderData = orderDoc.data();

        // Check if order is eligible for refund
        if (orderData.status !== 'pending') {
            return NextResponse.json(
                {
                    error: 'Order cannot be cancelled',
                    message: 'Siparişiniz hazırlanmaya başladığı için iptal edilemiyor.',
                    status: orderData.status
                },
                { status: 400 }
            );
        }

        // Check if payment was made
        if (!orderData.isPaid || orderData.paymentMethod !== 'card') {
            // No payment to refund, just cancel the order
            await updateDoc(doc(db, 'kermes_orders', orderId), {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancellationReason: reason || 'customer_request',
            });

            return NextResponse.json({
                success: true,
                refunded: false,
                message: 'Sipariş başarıyla iptal edildi.',
            });
        }

        // Get PaymentIntent ID from order or parameter
        const piId = paymentIntentId || orderData.stripePaymentIntentId;

        if (!piId) {
            return NextResponse.json(
                { error: 'No payment found for this order' },
                { status: 400 }
            );
        }

        // Create refund via Stripe
        console.log(`[Refund] Processing refund for PaymentIntent: ${piId}`);

        const refund = await stripe.refunds.create({
            payment_intent: piId,
            reason: 'requested_by_customer',
            metadata: {
                orderId,
                cancelledAt: new Date().toISOString(),
                cancellationReason: reason || 'customer_request',
            },
        });

        console.log(`[Refund] Created refund: ${refund.id}, status: ${refund.status}`);

        // Update order status
        await updateDoc(doc(db, 'kermes_orders', orderId), {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancellationReason: reason || 'customer_request',
            refundId: refund.id,
            refundStatus: refund.status,
            refundAmount: refund.amount / 100, // Convert cents to EUR
        });

        // Record refund in platform_transactions
        try {
            await addDoc(collection(db, 'platform_transactions'), {
                type: 'refund',
                paymentIntentId: piId,
                refundId: refund.id,
                orderId,
                amount: refund.amount / 100,
                status: refund.status,
                createdAt: new Date().toISOString(),
                businessId: orderData.kermesId,
                reason: reason || 'customer_request',
            });
            console.log('[LOKMA Accounting] Refund transaction recorded');
        } catch (accountingError) {
            console.error('[LOKMA Accounting] Failed to record refund:', accountingError);
        }

        return NextResponse.json({
            success: true,
            refunded: true,
            refundId: refund.id,
            refundStatus: refund.status,
            refundAmount: refund.amount / 100,
            message: 'Sipariş iptal edildi ve ödemeniz iade edildi. İade 2-3 iş günü içinde hesabınıza yansıyacaktır.',
        });

    } catch (error: any) {
        console.error('[Refund] Error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return NextResponse.json(
                { error: 'This payment cannot be refunded', message: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Refund failed' },
            { status: 500 }
        );
    }
}
