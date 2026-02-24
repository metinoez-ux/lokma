import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Singleton)
if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccount) {
        try {
            initializeApp({
                credential: cert(JSON.parse(serviceAccount)),
            });
        } catch (error) {
            console.error('Firebase Admin initialization error:', error);
        }
    }
}

// Initialize Stripe from our central lib (which handles test/live mode)
import { stripe, STRIPE_WEBHOOK_SECRET as endpointSecret } from '@/lib/stripe';

// Super Admin email for payment failure notifications
const SUPER_ADMIN_EMAIL = 'info@lokma.shop';

/**
 * Send failed payment notification emails to business owner and super admin
 */
async function sendFailedPaymentNotification(
    invoiceNumber: string,
    businessName: string,
    businessEmail: string | null,
    amount: number,
    failureReason: string
): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);

    const dateStr = new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Email to business owner
    if (businessEmail) {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_URL || 'https://lokma.shop'}/api/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: businessEmail,
                    subject: `⚠️ Zahlungsfehler - Rechnung ${invoiceNumber}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                                <h1 style="margin: 0;">⚠️ Zahlung fehlgeschlagen</h1>
                            </div>
                            <div style="padding: 30px; background: #fff;">
                                <p>Sehr geehrte/r Geschäftsinhaber/in,</p>
                                <p>Die automatische Abbuchung für folgende Rechnung ist leider fehlgeschlagen:</p>
                                <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p><strong>Rechnungsnummer:</strong> ${invoiceNumber}</p>
                                    <p><strong>Betrag:</strong> ${formattedAmount}</p>
                                    <p><strong>Grund:</strong> ${failureReason}</p>
                                    <p><strong>Datum:</strong> ${dateStr}</p>
                                </div>
                                <p><strong>Was müssen Sie tun?</strong></p>
                                <ul>
                                    <li>Bitte prüfen Sie Ihre hinterlegte Zahlungsmethode</li>
                                    <li>Stellen Sie sicher, dass ausreichend Deckung vorhanden ist</li>
                                    <li>Aktualisieren Sie gegebenenfalls Ihre Zahlungsdaten in Ihrem Konto</li>
                                </ul>
                                <p>Wir werden in 48 Stunden einen erneuten Abbuchungsversuch starten.</p>
                                <p>Bei Fragen kontaktieren Sie uns unter: <a href="mailto:info@lokma.shop">info@lokma.shop</a></p>
                            </div>
                            <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
                                LOKMA GmbH | Schulte-Braucks-Str. 1, 41836 Hückelhoven
                            </div>
                        </div>
                    `
                })
            });
            console.log(`[Payment Failed] Email sent to business: ${businessEmail}`);
        } catch (error) {
            console.error('[Payment Failed] Failed to send email to business:', error);
        }
    }

    // Email to Super Admin
    try {
        await fetch(`${process.env.NEXT_PUBLIC_URL || 'https://lokma.shop'}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: SUPER_ADMIN_EMAIL,
                subject: `🚨 ÖDEME BAŞARISIZ: ${businessName} - ${invoiceNumber}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #7c3aed; color: white; padding: 20px; text-align: center;">
                            <h1 style="margin: 0;">🚨 Ödeme Tahsilat Hatası</h1>
                        </div>
                        <div style="padding: 30px; background: #fff;">
                            <h2 style="color: #dc2626;">Dikkat: Aşağıdaki fatura ödemesi alınamadı!</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 10px 0;"><strong>İşletme:</strong></td>
                                    <td style="padding: 10px 0;">${businessName}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 10px 0;"><strong>E-posta:</strong></td>
                                    <td style="padding: 10px 0;">${businessEmail || 'Bilinmiyor'}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 10px 0;"><strong>Fatura No:</strong></td>
                                    <td style="padding: 10px 0;">${invoiceNumber}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 10px 0;"><strong>Tutar:</strong></td>
                                    <td style="padding: 10px 0; color: #dc2626; font-weight: bold;">${formattedAmount}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 10px 0;"><strong>Hata Sebebi:</strong></td>
                                    <td style="padding: 10px 0;">${failureReason}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0;"><strong>Tarih:</strong></td>
                                    <td style="padding: 10px 0;">${dateStr}</td>
                                </tr>
                            </table>
                            <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 8px;">
                                <strong>⚠️ Yapılması Gereken:</strong>
                                <p>Bu fatura "Ödenmemiş Hesaplar" bölümünde görünecektir. İşletme ile iletişime geçip ödeme durumunu takip edin.</p>
                            </div>
                        </div>
                    </div>
                `
            })
        });
        console.log(`[Payment Failed] Email sent to super admin: ${SUPER_ADMIN_EMAIL}`);
    } catch (error) {
        console.error('[Payment Failed] Failed to send email to super admin:', error);
    }
}

/**
 * Stripe Webhook Handler
 * Handles payment events and updates invoice status in Firestore
 */
export async function POST(request: NextRequest) {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
        console.error('[Stripe Webhook] No signature provided');
        return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Stripe Webhook] Signature verification failed: ${message}`);
        return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    // Log the event
    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    try {
        const db = getFirestore();

        switch (event.type) {
            // =============================================================
            // INVOICE EVENTS
            // =============================================================
            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                console.log(`[Stripe Webhook] Invoice paid: ${invoice.id}`);

                // Find invoice in Firestore by Stripe Invoice ID or number
                const invoicesRef = db.collection('invoices');

                // Try to find by stripeInvoiceId first
                let querySnapshot = await invoicesRef
                    .where('stripeInvoiceId', '==', invoice.id)
                    .limit(1)
                    .get();

                // If not found, try by invoice number
                if (querySnapshot.empty && invoice.number) {
                    querySnapshot = await invoicesRef
                        .where('invoiceNumber', '==', invoice.number)
                        .limit(1)
                        .get();
                }

                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    await doc.ref.update({
                        status: 'paid',
                        paymentStatus: 'paid',
                        paidAt: new Date(),
                        paidAmount: (invoice.amount_paid || 0) / 100, // Convert from cents
                        stripePaymentIntentId: (invoice as any).payment_intent || null,
                        updatedAt: new Date(),
                    });
                    console.log(`[Stripe Webhook] Updated invoice ${doc.id} to PAID`);
                } else {
                    console.log(`[Stripe Webhook] Invoice not found for Stripe ID: ${invoice.id}`);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                console.log(`[Stripe Webhook] Invoice payment failed: ${invoice.id}`);

                const invoicesRef = db.collection('invoices');
                let querySnapshot = await invoicesRef
                    .where('stripeInvoiceId', '==', invoice.id)
                    .limit(1)
                    .get();

                if (querySnapshot.empty && invoice.number) {
                    querySnapshot = await invoicesRef
                        .where('invoiceNumber', '==', invoice.number)
                        .limit(1)
                        .get();
                }

                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    const invoiceData = doc.data();
                    const failureReason = invoice.last_finalization_error?.message || 'Ödeme alınamadı';

                    await doc.ref.update({
                        status: 'failed',
                        paymentStatus: 'failed',
                        failedAt: new Date(),
                        failureReason: failureReason,
                        updatedAt: new Date(),
                    });
                    console.log(`[Stripe Webhook] Updated invoice ${doc.id} to FAILED`);

                    // Get business info for notification
                    const businessId = invoiceData.businessId || invoiceData.butcherId;
                    let businessName = invoiceData.butcherName || 'Unbekannt';
                    let businessEmail: string | null = null;

                    if (businessId) {
                        const businessDoc = await db.collection('businesses').doc(businessId).get();
                        if (businessDoc.exists) {
                            const businessData = businessDoc.data();
                            businessName = businessData?.companyName || businessData?.brand || businessName;
                            businessEmail = businessData?.email || businessData?.contactEmail || null;
                        }
                    }

                    // Send notification emails to business owner and super admin
                    const amount = (invoice.amount_due || 0) / 100;
                    await sendFailedPaymentNotification(
                        invoiceData.invoiceNumber || invoice.number || '',
                        businessName,
                        businessEmail,
                        amount,
                        failureReason
                    );
                }
                break;
            }

            case 'invoice.overdue': {
                const invoice = event.data.object as Stripe.Invoice;
                console.log(`[Stripe Webhook] Invoice overdue: ${invoice.id}`);

                const invoicesRef = db.collection('invoices');
                const querySnapshot = await invoicesRef
                    .where('stripeInvoiceId', '==', invoice.id)
                    .limit(1)
                    .get();

                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    await doc.ref.update({
                        status: 'overdue',
                        updatedAt: new Date(),
                    });
                    console.log(`[Stripe Webhook] Updated invoice ${doc.id} to OVERDUE`);
                }
                break;
            }

            // =============================================================
            // PAYMENT INTENT EVENTS (Direct Payments)
            // =============================================================
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`[Stripe Webhook] Payment intent succeeded: ${paymentIntent.id}`);

                // If metadata contains invoiceId, update that invoice
                const invoiceId = paymentIntent.metadata?.invoiceId;
                if (invoiceId) {
                    const invoiceRef = db.collection('invoices').doc(invoiceId);
                    const invoiceDoc = await invoiceRef.get();

                    if (invoiceDoc.exists) {
                        await invoiceRef.update({
                            status: 'paid',
                            paymentStatus: 'paid',
                            paidAt: new Date(),
                            paidAmount: paymentIntent.amount / 100,
                            stripePaymentIntentId: paymentIntent.id,
                            updatedAt: new Date(),
                        });
                        console.log(`[Stripe Webhook] Updated invoice ${invoiceId} via PaymentIntent`);
                    }
                }
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`[Stripe Webhook] Payment intent failed: ${paymentIntent.id}`);

                const invoiceId = paymentIntent.metadata?.invoiceId;
                if (invoiceId) {
                    const invoiceRef = db.collection('invoices').doc(invoiceId);
                    await invoiceRef.update({
                        status: 'failed',
                        paymentStatus: 'failed',
                        failedAt: new Date(),
                        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
                        updatedAt: new Date(),
                    });
                }
                break;
            }

            // =============================================================
            // SUBSCRIPTION EVENTS
            // =============================================================
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}`);

                // Update business subscription status
                const businessesRef = db.collection('businesses');
                const querySnapshot = await businessesRef
                    .where('subscriptionId', '==', subscription.id)
                    .limit(1)
                    .get();

                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    await doc.ref.update({
                        subscriptionStatus: subscription.status,
                        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                        updatedAt: new Date(),
                    });
                    console.log(`[Stripe Webhook] Updated business ${doc.id} subscription status`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`[Stripe Webhook] Subscription cancelled: ${subscription.id}`);

                const businessesRef = db.collection('businesses');
                const querySnapshot = await businessesRef
                    .where('subscriptionId', '==', subscription.id)
                    .limit(1)
                    .get();

                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    await doc.ref.update({
                        subscriptionStatus: 'cancelled',
                        subscriptionId: null,
                        updatedAt: new Date(),
                    });
                    console.log(`[Stripe Webhook] Marked business ${doc.id} subscription as cancelled`);
                }
                break;
            }

            // =============================================================
            // STRIPE CONNECT EVENTS (Merchant Payouts)
            // =============================================================
            case 'payout.paid': {
                const payout = event.data.object as Stripe.Payout;
                console.log(`[Stripe Webhook] Payout completed: ${payout.id}`);
                // Log payout for reconciliation
                await db.collection('stripe_payouts').add({
                    payoutId: payout.id,
                    amount: payout.amount / 100,
                    currency: payout.currency,
                    status: 'paid',
                    arrivalDate: new Date(payout.arrival_date * 1000),
                    createdAt: new Date(),
                });
                break;
            }

            case 'payout.failed': {
                const payout = event.data.object as Stripe.Payout;
                console.error(`[Stripe Webhook] Payout FAILED: ${payout.id}`);
                await db.collection('stripe_payouts').add({
                    payoutId: payout.id,
                    amount: payout.amount / 100,
                    currency: payout.currency,
                    status: 'failed',
                    failureCode: payout.failure_code,
                    failureMessage: payout.failure_message,
                    createdAt: new Date(),
                });
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Stripe Webhook] Processing error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

// Note: In Next.js 13+ App Router, body parsing is handled automatically
// Raw body is accessed via request.text()
