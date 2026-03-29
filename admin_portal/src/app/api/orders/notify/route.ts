export const dynamic = "force-dynamic";
// Order Notification API - Sends email and push notifications for orders
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend, OrderEmailTemplates } from '@/lib/resend-email';
import { getFirebaseMessaging } from '@/lib/firebase-admin';
import { nt, resolveLocale } from '@/lib/notification-i18n';

/**
 * Send FCM push notification
 */
async function sendPushNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
    if (!fcmToken) return { success: false, error: 'No FCM token' };

    try {
        const messaging = getFirebaseMessaging();
        await messaging.send({
            token: fcmToken,
            notification: { title, body },
            data: data || {},
            apns: {
                payload: {
                    aps: { sound: 'default', badge: 1 },
                },
            },
            android: {
                priority: 'high',
                notification: { sound: 'default' },
            },
        });
        console.log('FCM Push sent successfully to token:', fcmToken.substring(0, 20) + '...');
        return { success: true };
    } catch (error) {
        console.error('FCM Error:', error);
        return { success: false, error: String(error) };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            orderId,
            type, // 'new_order' | 'order_created' | 'order_ready' | 'order_cancelled'
            customerName,
            customerEmail,
            customerPhone,
            customerFcmToken,
            butcherName,
            butcherEmail,
            butcherAddress,
            items,
            totalAmount,
            deliveryType,
            scheduledDate,
            scheduledDateTime, // Alternative field name from mobile app
            paymentMethod,
            locale: rawLocale, // Customer's locale from mobile app
        } = body;

        if (!orderId || !type) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: orderId, type' },
                { status: 400 }
            );
        }

        const locale = resolveLocale(rawLocale);
        const results: { email?: { success: boolean; error?: string }; push?: { success: boolean; error?: string } } = {};

        // Normalize scheduled date (mobile app sends scheduledDateTime)
        const normalizedScheduledDate = scheduledDate || scheduledDateTime || nt(locale, 'common.notSpecified');
        const businessName = butcherName || nt(locale, 'common.defaultBusiness');

        // Handle different notification types
        // 'order_created' from mobile app is same as 'new_order'
        switch (type) {
            case 'new_order':
            case 'order_created':
                // Send email to customer if enabled
                if (customerEmail) {
                    const customerTemplate = OrderEmailTemplates.orderConfirmationCustomer({
                        orderId,
                        customerName: customerName || nt(locale, 'common.defaultCustomer'),
                        butcherName: businessName,
                        scheduledDate: normalizedScheduledDate,
                        deliveryType: deliveryType || 'pickup',
                        paymentMethod: paymentMethod || 'cash',
                        totalAmount: totalAmount,
                    });

                    results.email = await sendEmailWithResend({
                        to: customerEmail,
                        subject: customerTemplate.subject,
                        html: customerTemplate.html,
                    });
                    console.log('Order confirmation email sent to:', customerEmail);
                }

                // Send push notification to customer if FCM token provided
                console.log('FCM Token received:', customerFcmToken ? `${customerFcmToken.substring(0, 30)}...` : 'NONE');
                if (customerFcmToken) {
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        nt(locale, 'order.received.title'),
                        nt(locale, 'order.received.body', { business: businessName }),
                        { orderId, type: 'order_created' }
                    );
                    console.log('Order push notification result:', results.push);
                }
                break;

            case 'order_preparing':
                // Send email to customer when order preparation starts
                if (customerEmail) {
                    const preparingTemplate = OrderEmailTemplates.orderPreparingCustomer({
                        orderId,
                        customerName: customerName || nt(locale, 'common.defaultCustomer'),
                        butcherName: businessName,
                    });

                    results.email = await sendEmailWithResend({
                        to: customerEmail,
                        subject: preparingTemplate.subject,
                        html: preparingTemplate.html,
                    });
                    console.log('Order preparing email sent to:', customerEmail);
                }

                // Send push notification
                if (customerFcmToken) {
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        nt(locale, 'order.preparing.title'),
                        nt(locale, 'order.preparing.body', { business: businessName }),
                        { orderId, type: 'order_preparing' }
                    );
                }
                break;

            case 'order_ready':
                // Send email to customer
                if (customerEmail) {
                    const readyTemplate = OrderEmailTemplates.orderReadyCustomer({
                        orderId,
                        customerName: customerName || nt(locale, 'common.defaultCustomer'),
                        butcherName: businessName,
                        butcherAddress,
                    });

                    results.email = await sendEmailWithResend({
                        to: customerEmail,
                        subject: readyTemplate.subject,
                        html: readyTemplate.html,
                    });
                    console.log('Order ready email sent to:', customerEmail);
                }

                // Send push notification with dynamic message based on table service
                if (customerFcmToken) {
                    const hasTableService = body.hasTableService || false;
                    const isDineIn = body.isDineIn || false;

                    let readyTitle = nt(locale, 'order.ready.title');
                    let readyBody = nt(locale, 'order.ready.body', { business: businessName });

                    if (isDineIn) {
                        if (hasTableService) {
                            readyTitle = nt(locale, 'order.ready.dineIn.title');
                            readyBody = nt(locale, 'order.ready.dineIn.body', { business: businessName });
                        } else {
                            readyTitle = nt(locale, 'order.ready.pickup.title');
                            readyBody = nt(locale, 'order.ready.pickup.body', { business: businessName });
                        }
                    }

                    results.push = await sendPushNotification(
                        customerFcmToken,
                        readyTitle,
                        readyBody,
                        { orderId, type: 'order_ready' }
                    );
                }
                break;

            case 'order_accepted_with_unavailable':
                // Send notification about unavailable items (with optional refund info)
                const unavailableItemsStr = body.unavailableItems || '';
                const refundAmount = body.refundAmount || 0;
                if (customerFcmToken) {
                    let notifBody = nt(locale, 'order.accepted.body', { business: businessName, items: unavailableItemsStr });
                    if (refundAmount > 0) {
                        notifBody += nt(locale, 'order.accepted.refund', { amount: `€${refundAmount.toFixed(2)}` });
                    }
                    notifBody += nt(locale, 'order.accepted.thanks');
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        refundAmount > 0
                            ? nt(locale, 'order.accepted.partial.title')
                            : nt(locale, 'order.accepted.unavailable.title'),
                        notifBody,
                        { orderId, type: 'order_accepted_with_unavailable', unavailableItems: unavailableItemsStr, refundAmount: String(refundAmount) }
                    );
                }
                break;

            case 'order_cancelled':
                // Send cancellation notification with reason
                const cancellationReason = body.cancellationReason || '';
                if (customerEmail) {
                    // TODO: Add cancellation email template
                    console.log('Order cancellation - email not implemented yet');
                }
                if (customerFcmToken) {
                    const cancelBody = cancellationReason
                        ? nt(locale, 'order.cancelled.body', { reason: cancellationReason })
                        : nt(locale, 'order.cancelled.bodyNoReason');
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        nt(locale, 'order.cancelled.title'),
                        cancelBody,
                        { orderId, type: 'order_cancelled', cancellationReason }
                    );
                }
                break;

            case 'order_completed':
                // Send notification when order is delivered/completed
                if (customerFcmToken) {
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        nt(locale, 'order.completed.title'),
                        nt(locale, 'order.completed.body', { business: businessName }),
                        { orderId, type: 'order_completed' }
                    );
                }
                break;

            case 'delivery_available':
                // Notify staff that a delivery is available for claim
                if (customerFcmToken) { // This is actually staff's FCM token
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        nt(locale, 'order.delivery.title'),
                        nt(locale, 'order.delivery.body', {
                            business: businessName,
                            customer: body.customerName || nt(locale, 'common.defaultCustomer'),
                        }),
                        { orderId, type: 'delivery_available' }
                    );
                }
                break;

            case 'order_in_transit':
                // Send notification when courier is on the way
                if (customerFcmToken) {
                    const courierName = body.courierName || nt(locale, 'common.defaultCourier');
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        nt(locale, 'order.inTransit.title'),
                        nt(locale, 'order.inTransit.body', { courier: courierName }),
                        { orderId, type: 'order_in_transit' }
                    );
                }
                break;

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown notification type: ${type}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            results,
        });

    } catch (error) {
        console.error('Order notification error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

