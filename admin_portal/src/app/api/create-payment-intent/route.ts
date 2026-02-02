import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

/**
 * GERMAN TAX-COMPLIANT PAYMENT PROCESSING
 * 
 * Complete financial breakdown for each transaction:
 * - Customer payment amount
 * - Stripe processing fees (EU: 1.4% + 0.25€)
 * - Platform commission (configurable per business)
 * - VAT on commission (19% German Umsatzsteuer)
 * - Net transfer to merchant
 */

// Stripe fee rates for Germany/EU
const STRIPE_FEE_PERCENT = 1.4; // 1.4%
const STRIPE_FEE_FIXED_CENTS = 25; // 0.25€
const VAT_RATE = 19; // 19% German VAT (Umsatzsteuer)

/**
 * Calculate complete fee breakdown
 */
function calculateFeeBreakdown(amountCents: number, commissionRate: number) {
    // 1. Stripe processing fee (charged by Stripe from total)
    const stripeFee = Math.round((amountCents * STRIPE_FEE_PERCENT / 100) + STRIPE_FEE_FIXED_CENTS);

    // 2. Net after Stripe fee
    const netAfterStripe = amountCents - stripeFee;

    // 3. Platform commission (from gross amount)
    const commissionGross = Math.round(amountCents * (commissionRate / 100));

    // 4. VAT on commission (19%)
    // Netto = Brutto / 1.19
    const commissionNet = Math.round(commissionGross / 1.19);
    const commissionVat = commissionGross - commissionNet;

    // 5. Amount to transfer to merchant
    // For destination charges: we send (total - commission) to merchant
    // Stripe fee is automatically deducted from platform's portion
    const merchantTransfer = amountCents - commissionGross;

    // 6. Platform revenue after Stripe fee
    // Platform gets commission, but pays Stripe fee from it
    const platformNetRevenue = commissionGross - stripeFee;

    return {
        customerPaid: amountCents,
        stripeFee,
        netAfterStripe,
        commissionGross,
        commissionNet,
        commissionVat,
        merchantTransfer,
        platformNetRevenue,
        // Rates used
        stripeFeePercent: STRIPE_FEE_PERCENT,
        stripeFeeFixed: STRIPE_FEE_FIXED_CENTS,
        vatRate: VAT_RATE,
        commissionRate,
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            amount,           // Total amount in EUR (e.g., 100.00)
            businessId,       // Merchant business ID
            orderId,          // Order ID for tracking
            customerEmail,    // Customer email for receipt
        } = body;

        if (!amount || !businessId) {
            return NextResponse.json(
                { error: 'amount and businessId are required' },
                { status: 400 }
            );
        }

        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) {
            return NextResponse.json(
                { error: 'Business not found' },
                { status: 404 }
            );
        }

        const businessData = businessDoc.data();
        const connectedAccountId = businessData.stripeAccountId;
        const commissionRate = businessData.commissionRate || 5;
        const amountCents = Math.round(amount * 100);

        // Calculate complete fee breakdown
        const fees = calculateFeeBreakdown(amountCents, commissionRate);

        console.log(`[Payment] Fee Breakdown for €${amount}:`);
        console.log(`  - Stripe Fee: €${(fees.stripeFee / 100).toFixed(2)}`);
        console.log(`  - Commission (gross): €${(fees.commissionGross / 100).toFixed(2)}`);
        console.log(`  - Commission VAT (19%): €${(fees.commissionVat / 100).toFixed(2)}`);
        console.log(`  - Commission (net): €${(fees.commissionNet / 100).toFixed(2)}`);
        console.log(`  - Merchant Transfer: €${(fees.merchantTransfer / 100).toFixed(2)}`);
        console.log(`  - Platform Net Revenue: €${(fees.platformNetRevenue / 100).toFixed(2)}`);

        // Build metadata with all fee details (for accounting)
        const feeMetadata = {
            orderId: orderId || '',
            businessId,
            businessName: businessData.companyName || businessData.brand || '',
            // All amounts in cents for precision
            customerPaidCents: fees.customerPaid.toString(),
            stripeFeeCents: fees.stripeFee.toString(),
            commissionGrossCents: fees.commissionGross.toString(),
            commissionNetCents: fees.commissionNet.toString(),
            commissionVatCents: fees.commissionVat.toString(),
            merchantTransferCents: fees.merchantTransfer.toString(),
            platformNetRevenueCents: fees.platformNetRevenue.toString(),
            // Rates
            commissionRatePercent: commissionRate.toString(),
            vatRatePercent: VAT_RATE.toString(),
            stripeFeePercent: STRIPE_FEE_PERCENT.toString(),
        };

        if (!connectedAccountId) {
            // Business doesn't have Stripe Connect - platform-only payment
            console.log(`[Payment] Business ${businessId} has no Stripe account - using platform payment`);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountCents,
                currency: 'eur',
                automatic_payment_methods: { enabled: true },
                metadata: {
                    ...feeMetadata,
                    paymentType: 'platform_only',
                },
                receipt_email: customerEmail,
            });

            return NextResponse.json({
                success: true,
                paymentIntentId: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
                paymentType: 'platform_only',
                // Return fee breakdown for order record
                feeBreakdown: {
                    customerPaid: fees.customerPaid / 100,
                    stripeFee: fees.stripeFee / 100,
                    commissionGross: fees.commissionGross / 100,
                    commissionNet: fees.commissionNet / 100,
                    commissionVat: fees.commissionVat / 100,
                    merchantTransfer: fees.merchantTransfer / 100,
                    platformNetRevenue: fees.platformNetRevenue / 100,
                    commissionRate,
                    vatRate: VAT_RATE,
                },
            });
        }

        // Business has Stripe Connect - use destination charge
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'eur',
            automatic_payment_methods: { enabled: true },
            transfer_data: {
                destination: connectedAccountId,
                amount: fees.merchantTransfer,
            },
            metadata: {
                ...feeMetadata,
                paymentType: 'destination_charge',
                connectedAccountId,
            },
            receipt_email: customerEmail,
        });

        // ===== LOKMA MUHASEBE KAYDI =====
        // Save to platform_transactions for LOKMA bookkeeping
        try {
            await addDoc(collection(db, 'platform_transactions'), {
                // Transaction identifiers
                paymentIntentId: paymentIntent.id,
                orderId: orderId || null,
                type: 'customer_payment',
                createdAt: new Date().toISOString(),

                // Business info
                businessId,
                businessName: businessData.companyName || businessData.brand || '',
                connectedAccountId,

                // Amounts (in EUR for readability)
                customerPaid: fees.customerPaid / 100,
                stripeFee: fees.stripeFee / 100,
                commissionGross: fees.commissionGross / 100,
                commissionNet: fees.commissionNet / 100,
                commissionVat: fees.commissionVat / 100,
                merchantTransfer: fees.merchantTransfer / 100,
                platformNetRevenue: fees.platformNetRevenue / 100,

                // Rates used
                commissionRate,
                vatRate: VAT_RATE,
                stripeFeePercent: STRIPE_FEE_PERCENT,

                // Status
                status: 'pending', // Will be updated to 'completed' via webhook
            });
            console.log('[LOKMA Accounting] Transaction recorded');
        } catch (accountingError) {
            console.error('[LOKMA Accounting] Failed to record transaction:', accountingError);
            // Don't fail the payment if accounting record fails
        }

        return NextResponse.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            paymentType: 'destination_charge',
            connectedAccountId,
            // Return complete fee breakdown for order record
            feeBreakdown: {
                customerPaid: fees.customerPaid / 100,
                stripeFee: fees.stripeFee / 100,
                commissionGross: fees.commissionGross / 100,
                commissionNet: fees.commissionNet / 100,
                commissionVat: fees.commissionVat / 100,
                merchantTransfer: fees.merchantTransfer / 100,
                platformNetRevenue: fees.platformNetRevenue / 100,
                commissionRate,
                vatRate: VAT_RATE,
            },
        });

    } catch (error: any) {
        console.error('[Payment Intent] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Payment creation failed' },
            { status: 500 }
        );
    }
}
