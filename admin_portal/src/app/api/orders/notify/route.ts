// Order Notification API - Sends email and push notifications for orders
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend, OrderEmailTemplates } from '@/lib/resend-email';
import { getFirebaseMessaging } from '@/lib/firebase-admin';

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
        console.log('✅ FCM Push sent successfully to token:', fcmToken.substring(0, 20) + '...');
        return { success: true };
    } catch (error) {
        console.error('❌ FCM Error:', error);
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
        } = body;

        if (!orderId || !type) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: orderId, type' },
                { status: 400 }
            );
        }

        const results: { email?: { success: boolean; error?: string }; push?: { success: boolean; error?: string } } = {};

        // Normalize scheduled date (mobile app sends scheduledDateTime)
        const normalizedScheduledDate = scheduledDate || scheduledDateTime || 'Belirtilmedi';

        // Handle different notification types
        // 'order_created' from mobile app is same as 'new_order'
        switch (type) {
            case 'new_order':
            case 'order_created':
                // Send email to customer if enabled
                if (customerEmail) {
                    const customerTemplate = OrderEmailTemplates.orderConfirmationCustomer({
                        orderId,
                        customerName: customerName || 'Değerli Müşteri',
                        butcherName: butcherName || 'Kasap',
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
                        '✅ Siparişiniz Alındı!',
                        `${butcherName || 'Kasap'} siparişinizi hazırlıyor.`,
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
                        customerName: customerName || 'Değerli Müşteri',
                        butcherName: butcherName || 'Kasap',
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
                        '👨‍🍳 Siparişiniz Hazırlanıyor!',
                        `${butcherName || 'Kasap'} siparişinizi hazırlamaya başladı.`,
                        { orderId, type: 'order_preparing' }
                    );
                }
                break;

            case 'order_ready':
                // Send email to customer
                if (customerEmail) {
                    const readyTemplate = OrderEmailTemplates.orderReadyCustomer({
                        orderId,
                        customerName: customerName || 'Değerli Müşteri',
                        butcherName: butcherName || 'Kasap',
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

                    let readyTitle = '🎉 Siparişiniz Hazır!';
                    let readyBody = `${butcherName || 'Kasap'} siparişinizi hazırladı. Şimdi alabilirsiniz!`;

                    if (isDineIn) {
                        if (hasTableService) {
                            readyTitle = '🍽️ Siparişiniz Geliyor!';
                            readyBody = `${butcherName || 'Kasap'} siparişiniz masanıza geliyor. Afiyet olsun!`;
                        } else {
                            readyTitle = '✅ Siparişiniz Hazır!';
                            readyBody = `${butcherName || 'Kasap'} siparişiniz hazır. Gelip alabilirsiniz!`;
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

            case 'order_cancelled':
                // Send cancellation notification with reason
                const cancellationReason = body.cancellationReason || '';
                if (customerEmail) {
                    // TODO: Add cancellation email template
                    console.log('Order cancellation - email not implemented yet');
                }
                if (customerFcmToken) {
                    const cancelBody = cancellationReason
                        ? `Maalesef siparişiniz iptal edildi. Sebep: ${cancellationReason}. Anlayışınız için teşekkür ederiz. 🙏`
                        : `Maalesef siparişiniz iptal edildi. Anlayışınız için teşekkür ederiz. 🙏`;
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        '❌ Sipariş İptal Edildi',
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
                        '✅ Siparişiniz Teslim Edildi!',
                        `${butcherName || 'Kasap'} siparişiniz başarıyla teslim edildi. Afiyet olsun!`,
                        { orderId, type: 'order_completed' }
                    );
                }
                break;

            case 'delivery_available':
                // Notify staff that a delivery is available for claim
                if (customerFcmToken) { // This is actually staff's FCM token
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        '📦 Yeni Dağıtım Var!',
                        `${butcherName || 'Kasap'} - ${body.customerName || 'Müşteri'} siparişi hazır. İlk kabul eden götürür!`,
                        { orderId, type: 'delivery_available' }
                    );
                }
                break;

            case 'order_in_transit':
                // Send notification when courier is on the way
                if (customerFcmToken) {
                    const courierName = body.courierName || 'Kurye';
                    results.push = await sendPushNotification(
                        customerFcmToken,
                        '🚚 Siparişiniz Yolda!',
                        `${courierName} siparişinizi teslim etmek için yola çıktı. Canlı takip edebilirsiniz!`,
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

