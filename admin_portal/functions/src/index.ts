import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineBoolean } from "firebase-functions/params";
import Stripe from "stripe";
import { Resend } from "resend";
import { generateInvoicePDF } from "./invoicePdf";
import { createLexwareInvoice, buildMonthlyInvoicePayload, downloadLexwareInvoicePDF, classifyTaxType } from "./services/lexwareService";
import { collectMonthlyBillingData } from "./services/billingDataCollector";
import { iotApp } from "./iot-gateway";
import { getPushTranslations, getUserLanguage, getDayNames, getDateLabel } from "./utils/translation";

// Define secrets for secure key management
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeTestSecretKey = defineSecret("STRIPE_TEST_SECRET_KEY");
const useStripeTestMode = defineBoolean("NEXT_PUBLIC_USE_STRIPE_TEST_MODE", { default: false });
const resendApiKey = defineSecret("RESEND_API_KEY");
const lexwareApiKey = defineSecret("LEXWARE_API_KEY");

admin.initializeApp();

const messaging = admin.messaging();
const db = admin.firestore();

// ── Notification Sound Helper ──────────────────────────────────────────────
// Cache the active notification sound per function invocation
let _cachedNotifSound = "";
async function getActiveNotificationSound(): Promise<string> {
    if (_cachedNotifSound) return _cachedNotifSound;
    try {
        const soundDoc = await db.doc("platform_config/notification_sound").get();
        _cachedNotifSound = soundDoc.data()?.activeSound || "lokma_order_bell.caf";
    } catch (e) {
        _cachedNotifSound = "lokma_order_bell.caf";
    }
    return _cachedNotifSound;
}

function buildSoundConfig(soundName: string) {
    return {
        apns: {
            payload: { aps: { sound: "default" } },
        },
        android: {
            notification: { sound: "default", channelId: "lokma_orders" },
        },
    };
}


/**
 * When a new order is created, send push notification to butcher admin
 */
export const onNewOrder = onDocumentCreated(
    "meat_orders/{orderId}",
    async (event) => {
        const order = event.data?.data();
        if (!order) return;

        const butcherId = order.butcherId;
        const rawOrderNum = order.orderNumber;

        let lang = "de";
        if (order.userId) {
            lang = await getUserLanguage(order.userId);
        } else if (order.customerId) {
            lang = await getUserLanguage(order.customerId);
        }

        const trans = await getPushTranslations(lang);
        const orderPrefix = trans.orderPrefix || "Bestellung";
        const orderNumber = rawOrderNum ? `${orderPrefix} #${rawOrderNum}` : (trans.newOrderTitle || "🔔 Neue Bestellung!");
        const totalAmount = order.totalAmount || 0;
        const customerName = order.customerName || (trans.customer || "Kunde");

        // ── Pre-Order Detection ──────────────────────────────────────────────
        const isPickupOrder = order.deliveryMethod === "pickup";
        const isDeliveryOrder = order.deliveryMethod === "delivery";
        const pickupTimestamp = order.pickupTime; // Firestore Timestamp (Gel Al)
        const scheduledDeliveryTimestamp = order.scheduledDeliveryTime || order.scheduledDateTime; // Kurye scheduled
        const isScheduledOrder = order.isScheduledOrder === true;
        let isPreOrder = false;
        let pickupTimeStr = "";
        let pickupDate: Date | null = null;

        // Helper to format a date nicely in Europe/Berlin timezone
        // Cloud Functions runs in UTC — must convert to local Berlin time
        const formatScheduledDate = (d: Date): string => {
            const tz = "Europe/Berlin";
            const timeFmt = new Intl.DateTimeFormat("de-DE", {
                timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
            });
            const parts = timeFmt.formatToParts(d);
            const hours = (parts.find(p => p.type === "hour")?.value ?? "00").padStart(2, "0");
            const minutes = (parts.find(p => p.type === "minute")?.value ?? "00").padStart(2, "0");

            // Compare dates in Berlin timezone (YYYY-MM-DD format)
            const dateFmt = (dt: Date) => new Intl.DateTimeFormat("en-CA", {
                timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
            }).format(dt);
            const dDateStr = dateFmt(d);
            const todayStr = dateFmt(new Date());
            const tomorrowStr = dateFmt(new Date(Date.now() + 86400000));

            if (dDateStr === todayStr) {
                return `${getDateLabel(lang, 'today')} ${hours}:${minutes}`;
            } else if (dDateStr === tomorrowStr) {
                return `${getDateLabel(lang, 'tomorrow')} ${hours}:${minutes}`;
            } else {
                const dayNames = getDayNames(lang);
                const dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
                const dowShort = dowFmt.format(d);
                const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
                const dayIdx = dowMap[dowShort] ?? d.getDay();
                return `${dayNames[dayIdx]} ${hours}:${minutes}`;
            }
        };

        // Case 1: Gel Al (pickup) pre-order
        if (isPickupOrder && pickupTimestamp) {
            const pd = pickupTimestamp.toDate();
            pickupDate = pd;
            const now = new Date();
            isPreOrder = (pd.getTime() - now.getTime()) > 30 * 60 * 1000;
            pickupTimeStr = formatScheduledDate(pd);
        }

        // Case 2: Kurye (delivery) scheduled/pre-order
        if (isDeliveryOrder && (isScheduledOrder || scheduledDeliveryTimestamp)) {
            const sd = scheduledDeliveryTimestamp ? scheduledDeliveryTimestamp.toDate() : null;
            if (sd) {
                pickupDate = sd;
                const now = new Date();
                isPreOrder = (sd.getTime() - now.getTime()) > 30 * 60 * 1000;
                pickupTimeStr = formatScheduledDate(sd);
            }
        }

        // Get notification sound once for all push notifications
        const notifSound = await getActiveNotificationSound();

        // Get butcher admin FCM tokens (mobile)
        try {
            const butcherDoc = await admin.firestore()
                .collection("butcher_admins")
                .doc(butcherId)
                .get();

            const butcherData = butcherDoc.data();
            const fcmTokens: string[] = butcherData?.fcmTokens || [];

            if (fcmTokens.length > 0) {
                const notifTitle = isPreOrder
                    ? (trans.preOrderTitle || `📋 Vorbestellung (Abholung)!`)
                    : (trans.newOrderTitle || "🔔 Neue Bestellung!");
                const notifBody = isPreOrder && pickupTimeStr
                    ? `${orderNumber} - ${customerName} - ${totalAmount.toFixed(2)}€ — ${trans.delivery || "Lieferung"}: ${pickupTimeStr}`
                    : `${orderNumber} - ${customerName} - ${totalAmount.toFixed(2)}€`;

                const message = {
                    notification: {
                        title: notifTitle,
                        body: notifBody,
                    },
                    data: {
                        type: isPreOrder ? "pre_order" : "new_order",
                        orderId: event.params.orderId,
                        orderNumber: orderNumber,
                        ...(isPreOrder && pickupTimeStr ? { pickupTime: pickupTimeStr } : {}),
                    },
                    ...buildSoundConfig(notifSound),
                    tokens: fcmTokens,
                };

                const response = await messaging.sendEachForMulticast(message);
                console.log(`[Mobile] Sent to ${response.successCount}/${fcmTokens.length} devices`);
            } else {
                console.log(`No mobile FCM tokens for butcher ${butcherId}`);
            }
        } catch (error) {
            console.error("Error sending mobile notification to butcher:", error);
        }

        // ── Web Push to Admin Portal (desktop browser) ──────────────────────
        try {
            // Find admins linked to this business (by butcherId or businessId)
            const adminsSnapshot = await db.collection("admins")
                .where("butcherId", "==", butcherId)
                .get();

            // Also query by businessId
            const adminsSnapshot2 = await db.collection("admins")
                .where("businessId", "==", butcherId)
                .get();

            const webTokens: string[] = [];
            const processedIds = new Set<string>();

            const processDoc = (doc: admin.firestore.QueryDocumentSnapshot) => {
                if (processedIds.has(doc.id)) return;
                processedIds.add(doc.id);
                const data = doc.data();
                if (data.webFcmTokens && Array.isArray(data.webFcmTokens)) {
                    webTokens.push(...data.webFcmTokens);
                }
            };

            adminsSnapshot.docs.forEach(processDoc);
            adminsSnapshot2.docs.forEach(processDoc);

            // Also send to super admins
            const superSnapshot = await db.collection("admins")
                .where("adminType", "==", "super")
                .get();
            superSnapshot.docs.forEach(processDoc);

            if (webTokens.length > 0) {
                const webNotifTitle = isPreOrder
                    ? (trans.preOrderTitle || `📋 Vorbestellung (Abholung)!`)
                    : (trans.newOrderTitle || "🔔 Neue Bestellung!");
                const webNotifBody = isPreOrder && pickupTimeStr
                    ? `${orderNumber} - ${customerName} - ${totalAmount.toFixed(2)}€ — ${trans.delivery || "Lieferung"}: ${pickupTimeStr}`
                    : `${orderNumber} - ${customerName} - ${totalAmount.toFixed(2)}€`;

                const webMessage = {
                    notification: {
                        title: webNotifTitle,
                        body: webNotifBody,
                    },
                    data: {
                        type: isPreOrder ? "pre_order" : "new_order",
                        orderId: event.params.orderId,
                        orderNumber: orderNumber,
                        ...(isPreOrder && pickupTimeStr ? { pickupTime: pickupTimeStr } : {}),
                    },
                    ...buildSoundConfig(notifSound),
                    tokens: webTokens,
                };

                const webResponse = await messaging.sendEachForMulticast(webMessage);
                console.log(`[Web Push] Sent to ${webResponse.successCount}/${webTokens.length} browsers`);

                // Clean up invalid tokens
                if (webResponse.failureCount > 0) {
                    const invalidTokens: string[] = [];
                    webResponse.responses.forEach((resp, idx) => {
                        if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
                            invalidTokens.push(webTokens[idx]);
                        }
                    });
                    // TODO: Remove invalid tokens from Firestore
                    if (invalidTokens.length > 0) {
                        console.log(`[Web Push] ${invalidTokens.length} invalid tokens detected`);
                    }
                }
            } else {
                console.log(`No web FCM tokens for business ${butcherId}`);
            }
        } catch (webError) {
            console.error("[Web Push] Error:", webError);
        }

        // ── IoT Gateway Notification (Alexa + LED) ──────────────────────────
        try {
            const businessDoc = await db.collection("businesses").doc(butcherId).get();
            const smartConfig = businessDoc.data()?.smartNotifications;

            if (smartConfig?.enabled && smartConfig?.gatewayUrl) {
                const gatewayPayload = {
                    businessId: butcherId,
                    event: "new_order",
                    orderNumber: rawOrderNum || event.params.orderId.substring(0, 6).toUpperCase(),
                    amount: totalAmount,
                    items: order.items?.length || 0,
                    language: smartConfig.alexaLanguage || "de-DE",
                    currency: businessDoc.data()?.currency || "EUR",
                    alexaEnabled: smartConfig.alexaEnabled !== false,
                    ledEnabled: smartConfig.ledEnabled !== false,
                    hueEnabled: smartConfig.hueEnabled === true,
                };

                // Fire and forget — don't block the function
                fetch(smartConfig.gatewayUrl + "/notify", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": smartConfig.gatewayApiKey || "",
                    },
                    body: JSON.stringify(gatewayPayload),
                }).catch((err: any) => console.error("[IoT Gateway] Error:", err.message));

                console.log(`[IoT Gateway] Notification sent for order ${rawOrderNum} → ${smartConfig.gatewayUrl}`);
            }
        } catch (iotError) {
            console.error("[IoT Gateway] Error:", iotError);
        }

        // ── Save "pending" notification to customer's notification history ────
        // This ensures the notification timeline starts from order placement
        const customerId = order.userId || order.customerId;
        if (customerId) {
            try {
                const businessName2 = order.butcherName || order.businessName || (trans.business || "Geschäft");
                const pendingTitle = `⏳ ${orderNumber}`;
                const deliveryLabel = isPickupOrder ? (trans.pickupLabel || "Abholung") : (trans.deliveryLabel || "Lieferung");
                const pendingBody = isPreOrder && pickupTimeStr
                    ? `${trans.orderAcceptedBody || "Ihre Vorbestellung wurde aufgenommen"} — ${deliveryLabel}: ${pickupTimeStr}`
                    : `${trans.orderPendingBody || "Ihre Bestellung wurde aufgenommen"} — ${businessName2}`;

                // Fetch business address info
                let businessCity = "";
                let businessPostalCode = "";
                try {
                    const bDoc = await db.collection("butcher_admins").doc(butcherId).get();
                    const bData = bDoc.data();
                    if (bData) {
                        businessCity = bData.city || bData.ort || "";
                        businessPostalCode = bData.postalCode || bData.plz || "";
                    }
                } catch (e) { /* ignore */ }

                const notificationData: Record<string, any> = {
                    title: pendingTitle,
                    body: pendingBody,
                    type: "order_status",
                    orderId: event.params.orderId,
                    status: "pending",
                    rawOrderNumber: rawOrderNum || event.params.orderId.substring(0, 6).toUpperCase(),
                    businessName: businessName2,
                    totalAmount: totalAmount,
                    businessCity: businessCity,
                    businessPostalCode: businessPostalCode,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                };

                // Include scheduled delivery info for pre-orders
                if (isPreOrder && pickupTimeStr) {
                    notificationData.isPreOrder = true;
                    notificationData.pickupTimeStr = pickupTimeStr;
                }

                await db.collection("users").doc(customerId).collection("notifications").add(notificationData);
                console.log(`[Customer Notify] Saved pending notification for user ${customerId}, order ${rawOrderNum}${isPreOrder ? " (pre-order)" : ""}`);

                // ── Send FCM Push to Customer Device ────────────────────────
                // Get the customer's FCM token from the order or from user doc
                const customerFcmTokens: string[] = [];
                if (order.fcmToken) customerFcmTokens.push(order.fcmToken);
                if (order.customerFcmToken) customerFcmTokens.push(order.customerFcmToken);

                // Also check user doc for additional tokens
                try {
                    const userDoc = await db.collection("users").doc(customerId).get();
                    const userData = userDoc.data();
                    if (userData?.fcmToken && !customerFcmTokens.includes(userData.fcmToken)) {
                        customerFcmTokens.push(userData.fcmToken);
                    }
                    if (userData?.fcmTokens && Array.isArray(userData.fcmTokens)) {
                        userData.fcmTokens.forEach((t: string) => {
                            if (t && !customerFcmTokens.includes(t)) customerFcmTokens.push(t);
                        });
                    }
                } catch (e) { /* ignore */ }

                if (customerFcmTokens.length > 0) {
                    try {
                        const customerPush = {
                            notification: {
                                title: pendingTitle,
                                body: pendingBody,
                            },
                            data: {
                                type: "order_status",
                                orderId: event.params.orderId,
                                status: "pending",
                                ...(isPreOrder && pickupTimeStr ? { pickupTime: pickupTimeStr } : {}),
                            },
                            ...buildSoundConfig(notifSound),
                            tokens: customerFcmTokens,
                        };
                        const pushResponse = await messaging.sendEachForMulticast(customerPush);
                        console.log(`[Customer Push] Sent order confirmation to ${pushResponse.successCount}/${customerFcmTokens.length} customer devices`);
                    } catch (pushErr) {
                        console.error("[Customer Push] Error sending FCM to customer:", pushErr);
                    }
                } else {
                    console.log(`[Customer Push] No FCM tokens found for customer ${customerId}`);
                }
            } catch (notifError) {
                console.error("[Customer Notify] Error saving pending notification:", notifError);
            }
        }

        // ── Schedule Pre-Order Reminder (20 min before pickup) ───────────────
        if (isPreOrder && pickupDate) {
            try {
                const reminderTime = new Date(pickupDate.getTime() - 20 * 60 * 1000);
                // Only schedule if reminder time is in the future
                if (reminderTime.getTime() > Date.now()) {
                    await db.collection("scheduled_notifications").add({
                        type: "pre_order_reminder",
                        orderId: event.params.orderId,
                        orderNumber: rawOrderNum || null,
                        businessId: butcherId,
                        customerName,
                        totalAmount,
                        pickupTime: admin.firestore.Timestamp.fromDate(pickupDate),
                        pickupTimeStr,
                        sendAt: admin.firestore.Timestamp.fromDate(reminderTime),
                        sent: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    console.log(`[Pre-Order] Scheduled reminder for order ${rawOrderNum} at ${reminderTime.toISOString()} (pickup: ${pickupDate.toISOString()})`);
                } else {
                    console.log(`[Pre-Order] Reminder time already passed for order ${rawOrderNum}, skipping`);
                }
            } catch (reminderErr) {
                console.error("[Pre-Order] Error scheduling reminder:", reminderErr);
            }
        }
    }
);

/**
 * Create commission record when an order is delivered/completed
 */
async function createCommissionRecord(orderId: string, orderData: any) {
    try {
        // Prevent duplicate records
        const existingRecord = await db.collection("commission_records")
            .where("orderId", "==", orderId)
            .limit(1)
            .get();
        if (!existingRecord.empty) {
            console.log(`[Commission] Record already exists for order ${orderId}, skipping`);
            return;
        }

        const businessId = orderData.butcherId || orderData.businessId;
        if (!businessId) {
            console.error(`[Commission] No businessId found for order ${orderId}`);
            return;
        }

        // Get business doc to find their plan
        const businessDoc = await db.collection("businesses").doc(businessId).get();
        if (!businessDoc.exists) {
            console.error(`[Commission] Business ${businessId} not found`);
            return;
        }
        const businessData = businessDoc.data()!;
        const businessName = businessData.companyName || businessData.name || businessData.businessName || businessData.brand || orderData.butcherName || "Geschäft";
        const planId = businessData.subscriptionPlan || businessData.plan || "free";

        // Get the plan from subscription_plans collection
        let plan: any = null;
        const plansSnapshot = await db.collection("subscription_plans").doc(planId).get();
        if (plansSnapshot.exists) {
            plan = plansSnapshot.data();
        } else {
            // Try matching by code field
            const plansByCode = await db.collection("subscription_plans")
                .where("code", "==", planId)
                .limit(1)
                .get();
            if (!plansByCode.empty) {
                plan = plansByCode.docs[0].data();
            }
        }

        if (!plan) {
            console.error(`[Commission] Plan '${planId}' not found for business ${businessId}`);
            return;
        }

        // Determine courier type from order
        const orderType = orderData.orderType || orderData.deliveryMethod || "click_collect";
        let courierType = "click_collect";
        if (orderType === "delivery") {
            const courierId = orderData.courierId || orderData.assignedCourierId;
            if (courierId) {
                // Look up the courier's driverType from their admin record
                try {
                    const courierDoc = await db.collection("admins").doc(courierId).get();
                    const courierData = courierDoc.exists ? courierDoc.data() : null;
                    if (courierData?.driverType === "lokma") {
                        courierType = "lokma_courier";
                    } else if (courierData?.driverType === "business") {
                        courierType = "own_courier";
                    } else {
                        // Fallback: check if courier belongs to the same business
                        courierType = (courierData?.businessId === businessId) ? "own_courier" : "lokma_courier";
                    }
                } catch (courierLookupErr) {
                    console.warn(`[Commission] Could not look up courier ${courierId}, using fallback`);
                    courierType = businessData.hasOwnCourier ? "own_courier" : "lokma_courier";
                }
            } else {
                // No courier assigned yet — use business preference
                courierType = businessData.hasOwnCourier ? "own_courier" : "lokma_courier";
            }
            console.log(`[Commission] Resolved courierType=${courierType} for order ${orderId} (courierId=${courierId || "none"})`);
        }

        // Get commission rate based on courier type
        let commissionRate = 5; // Default
        switch (courierType) {
            case "click_collect":
                commissionRate = plan.commissionClickCollect || 5;
                break;
            case "own_courier":
                commissionRate = plan.commissionOwnCourier || 4;
                break;
            case "lokma_courier":
                commissionRate = plan.commissionLokmaCourier || 7;
                break;
        }

        // Check for free orders
        const currentMonth = new Date().toISOString().slice(0, 7); // "2026-02"
        const monthlyOrders = businessData.usage?.orders?.[currentMonth] || 0;
        const freeOrderCount = plan.freeOrderCount || 0;
        const isFreeOrder = monthlyOrders < freeOrderCount;

        const orderTotal = orderData.totalAmount || 0;
        let commissionAmount = 0;
        if (!isFreeOrder && orderTotal > 0) {
            commissionAmount = Math.round(orderTotal * (commissionRate / 100) * 100) / 100;
        }

        // Per-order fee
        let perOrderFee = 0;
        if (!isFreeOrder && plan.perOrderFeeType !== "none") {
            if (plan.perOrderFeeType === "percentage") {
                perOrderFee = Math.round(orderTotal * (plan.perOrderFeeAmount / 100) * 100) / 100;
            } else if (plan.perOrderFeeType === "fixed") {
                perOrderFee = plan.perOrderFeeAmount || 0;
            }
        }

        const totalCommission = Math.round((commissionAmount + perOrderFee) * 100) / 100;
        const vatRate = 19; // Germany
        const netCommission = Math.round((totalCommission / 1.19) * 100) / 100;
        const vatAmount = Math.round((totalCommission - netCommission) * 100) / 100;

        // Payment method
        const paymentMethod = orderData.paymentMethod || "cash";
        const isCardPayment = paymentMethod === "card" || paymentMethod === "stripe";

        // Collection status: card payments are auto-collected via Stripe Connect
        const collectionStatus = isCardPayment ? "auto_collected" : "pending";

        // Write commission record
        const commissionRecord = {
            orderId,
            orderNumber: orderData.orderNumber || null,
            businessId,
            businessName,
            planId,
            planName: plan.name || planId,
            orderTotal,
            courierType,
            commissionRate,
            commissionAmount,
            perOrderFee,
            totalCommission,
            netCommission,
            vatRate,
            vatAmount,
            paymentMethod,
            collectionStatus,
            invoiceId: null,
            isFreeOrder,
            sponsoredFee: 0, // Will be updated below if applicable
            currency: businessData.currency || "EUR",
            period: currentMonth,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const commRecordRef = await db.collection("commission_records").add(commissionRecord);
        console.log(`[Commission] Created record: ${orderId} | ${businessName} | ${totalCommission}€ (${collectionStatus})`);

        // =====================================================================
        // SPONSORED PRODUCT CONVERSION BILLING
        // =====================================================================
        let sponsoredFee = 0;
        if (orderData.hasSponsoredItems && Array.isArray(orderData.sponsoredItemIds) && orderData.sponsoredItemIds.length > 0) {
            try {
                // Read global sponsored settings (for enabled flag and fallback fee)
                const sponsoredSettingsDoc = await db.collection("platformSettings").doc("sponsored").get();
                const sponsoredSettings = sponsoredSettingsDoc.exists ? sponsoredSettingsDoc.data() : null;
                const sponsoredEnabled = sponsoredSettings?.enabled ?? true;

                // Per-plan fee takes priority over global setting
                const feePerConversion = (plan?.sponsoredFeePerConversion !== undefined && plan?.sponsoredFeePerConversion !== null)
                    ? plan.sponsoredFeePerConversion
                    : (sponsoredSettings?.feePerConversion ?? 0.40);

                if (sponsoredEnabled && feePerConversion > 0) {
                    const sponsoredItemCount = orderData.sponsoredItemIds.length;
                    sponsoredFee = Math.round(sponsoredItemCount * feePerConversion * 100) / 100;

                    // Create sponsored conversion record
                    await db.collection("sponsored_conversions").add({
                        orderId,
                        orderNumber: orderData.orderNumber || null,
                        businessId,
                        businessName,
                        sponsoredItemIds: orderData.sponsoredItemIds,
                        sponsoredItemCount,
                        feePerConversion,
                        totalFee: sponsoredFee,
                        period: currentMonth,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    // Update commission record with sponsored fee
                    await commRecordRef.update({ sponsoredFee });

                    console.log(`[Sponsored] Created conversion: ${orderId} | ${businessName} | ${sponsoredItemCount} items × €${feePerConversion} = €${sponsoredFee}`);
                }
            } catch (sponsoredError) {
                console.error(`[Sponsored] Error tracking conversion for order ${orderId}:`, sponsoredError);
            }
        }

        // Update business usage counters
        const usageUpdate: any = {
            [`usage.orders.${currentMonth}`]: admin.firestore.FieldValue.increment(1),
            [`usage.totalCommission.${currentMonth}`]: admin.firestore.FieldValue.increment(totalCommission),
            "usage.lastOrderAt": admin.firestore.FieldValue.serverTimestamp(),
        };

        // Add sponsored fee to usage tracking
        if (sponsoredFee > 0) {
            usageUpdate[`usage.sponsoredFee.${currentMonth}`] = admin.firestore.FieldValue.increment(sponsoredFee);
        }

        // For cash orders: accumulate balance owed to LOKMA (include sponsored fee)
        const totalOwed = totalCommission + sponsoredFee;
        if (!isCardPayment && totalOwed > 0) {
            usageUpdate.accountBalance = admin.firestore.FieldValue.increment(totalOwed);
        }

        await db.collection("businesses").doc(businessId).update(usageUpdate);
        console.log(`[Commission] Updated usage for ${businessName}: +1 order, +${totalCommission}€ commission${sponsoredFee > 0 ? `, +${sponsoredFee}€ sponsored fee` : ""}`);

    } catch (error) {
        console.error(`[Commission] Error creating record for order ${orderId}:`, error);
    }
}

/**
 * When order status changes, send push notification to customer
 */
export const onOrderStatusChange = onDocumentUpdated(
    "meat_orders/{orderId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) return;

        // Only process if status changed
        if (before.status === after.status) return;

        // Get notification sound for push notifications
        const notifSound = await getActiveNotificationSound();

        // Gather all possible FCM tokens for the customer(s)
        const tokenSet = new Set<string>();
        if (after.fcmToken) tokenSet.add(after.fcmToken);
        if (after.customerFcmToken) tokenSet.add(after.customerFcmToken);
        if (after.fcmTokens && Array.isArray(after.fcmTokens)) {
            after.fcmTokens.forEach((t: any) => {
                if (typeof t === "string" && t) tokenSet.add(t);
            });
        }

        const customerTokens = Array.from(tokenSet);
        const hasCustomerToken = customerTokens.length > 0;

        if (!hasCustomerToken) {
            console.log("No customer FCM token found, will skip customer notification but continue for driver notifications");
        }

        // UOIP: Fallback to First-6-Digit standard from doc ID if orderNumber not on document
        const rawOrderNumber = after.orderNumber || event.params.orderId.substring(0, 6).toUpperCase();

        // Fetch user language and translation mappings
        let lang = "de";
        if (hasCustomerToken && after.userId) {
            lang = await getUserLanguage(after.userId);
        } else if (hasCustomerToken && after.customerId) {
            lang = await getUserLanguage(after.customerId);
        }
        const trans = await getPushTranslations(lang);
        const orderPrefix = trans.orderPrefix || "Bestellung";
        const orderNumber = rawOrderNumber ? `${orderPrefix} #${rawOrderNumber}` : orderPrefix;
        const orderTag = rawOrderNumber ? ` (#${rawOrderNumber})` : "";
        const totalAmount = after.totalAmount || 0;
        const businessName = after.butcherName || after.businessName || (trans.business || "Geschäft");
        const newStatus = after.status;

        let title = "";
        let body = "";

        switch (newStatus) {
            case "pending":
                title = `${trans.orderPendingTitle || (orderPrefix + " aktualisiert")}${orderTag}`;
                body = `${orderNumber} - ${trans.orderPendingBody || "Ihre Bestellung ist wieder im Wartestatus."}`;
                break;
            case "accepted":
                title = `${trans.orderAcceptedTitle}${orderTag}`;
                body = `${orderNumber} - ${businessName} ${trans.orderAcceptedBody.toLowerCase()}`;
                break;
            case "preparing":
                title = `${trans.orderPreparingTitle}${orderTag}`;
                body = `${orderNumber} - ${trans.orderPreparingBody}`;
                break;
            case "ready":
                // Check if delivery order or pickup
                const isDeliveryOrder = after.orderType === "delivery" || after.deliveryType === "delivery" || after.deliveryMethod === "delivery";

                if (isDeliveryOrder) {
                    // Delivery order: ready but waiting for courier to claim
                    title = `${trans.orderReadyDeliveryTitle}${orderTag}`;
                    body = `${orderNumber} - ${trans.orderReadyDeliveryBody}`;
                } else {
                    // Check if dine-in
                    const isDineInReady = after.orderType === "dine-in" || after.orderType === "masa" || after.tableNumber != null;
                    if (isDineInReady && after.tableNumber != null) {
                        title = `${trans.orderReadyDineInTitle}${orderTag}`;
                        body = `${orderNumber} - ${trans.table || "Tisch"} ${after.tableNumber}: ${trans.orderReadyDineInBody}`;
                    } else {
                        // Pickup order: customer should come pick it up
                        title = `${trans.orderReadyPickupTitle}${orderTag}`;
                        body = `${orderNumber} - ${trans.orderReadyPickupBody}`;
                    }
                }

                // If delivery order, also notify staff about pending delivery
                if (isDeliveryOrder) {
                    const butcherId = after.butcherId || after.businessId;
                    const deliveryAddress = after.deliveryAddress || "";

                    // Fetch business doc for lokmaDriverEnabled + deliveryPreference
                    let lokmaDriverEnabled = true; // Default: LOKMA drivers receive notifications
                    let deliveryPreference = "hybrid"; // Default: notify both own staff and LOKMA
                    try {
                        const bizDoc = await db.collection("businesses").doc(butcherId).get();
                        if (bizDoc.exists) {
                            const bizData = bizDoc.data()!;
                            lokmaDriverEnabled = bizData.lokmaDriverEnabled !== false; // opt-out model
                            deliveryPreference = bizData.deliveryPreference || "hybrid";
                        }
                    } catch (bizErr) {
                        console.warn(`[Driver Gate] Could not fetch business ${butcherId} for driver preferences`);
                    }

                    // Determine which driver groups to notify based on preference
                    const notifyOwnStaff = deliveryPreference !== "lokma_only";
                    const notifyLokmaDrivers = lokmaDriverEnabled && deliveryPreference !== "own_only";

                    console.log(`[Driver Gate] Business ${butcherId}: lokmaDriverEnabled=${lokmaDriverEnabled}, deliveryPreference=${deliveryPreference}, notifyOwn=${notifyOwnStaff}, notifyLokma=${notifyLokmaDrivers}`);

                    // SHIFT GATING: Only notify staff who are on an active shift
                    try {
                        const staffTokens: string[] = [];
                        const processedIds = new Set<string>();
                        let skippedPaused = 0;

                        const collectTokens = (doc: admin.firestore.QueryDocumentSnapshot) => {
                            if (processedIds.has(doc.id)) return;
                            processedIds.add(doc.id);

                            const data = doc.data();

                            // Skip staff on break (paused shift)
                            if (data.shiftStatus === "paused") {
                                skippedPaused++;
                                return;
                            }

                            if (data.fcmToken) staffTokens.push(data.fcmToken);
                            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                                staffTokens.push(...data.fcmTokens);
                            }
                        };

                        // Query 1: Own staff with direct businessId match + on shift
                        if (notifyOwnStaff) {
                            const staffSnapshot = await db.collection("admins")
                                .where("businessId", "==", butcherId)
                                .where("isOnShift", "==", true)
                                .get();
                            staffSnapshot.docs.forEach(doc => collectTokens(doc));
                        }

                        // Query 2: LOKMA/external drivers assigned via assignedBusinesses array + on shift
                        if (notifyLokmaDrivers) {
                            const driversSnapshot = await db.collection("admins")
                                .where("isDriver", "==", true)
                                .where("assignedBusinesses", "array-contains", butcherId)
                                .where("isOnShift", "==", true)
                                .get();
                            driversSnapshot.docs.forEach(doc => collectTokens(doc));
                        }

                        if (skippedPaused > 0) {
                            console.log(`[Shift Gate] Skipped ${skippedPaused} paused staff for business ${butcherId}`);
                        }

                        if (staffTokens.length > 0) {
                            const staffMessage = {
                                notification: {
                                    title: trans.deliveryPendingTitle || "🚚 Lieferung ausstehend!",
                                    body: `${orderNumber} - ${deliveryAddress.substring(0, 50)}${deliveryAddress.length > 50 ? "..." : ""}`,
                                },
                                data: {
                                    type: "delivery_ready",
                                    orderId: event.params.orderId,
                                    businessId: butcherId,
                                },
                                tokens: staffTokens,
                            };
                            const response = await messaging.sendEachForMulticast({...staffMessage, ...buildSoundConfig(notifSound)});
                            console.log(`[Shift Gate] Sent delivery notification to ${response.successCount}/${staffTokens.length} on-shift drivers/staff`);
                        } else {
                            console.log(`[Shift Gate] No on-shift driver tokens found for business ${butcherId} (${processedIds.size} total staff, ${skippedPaused} paused)`);
                        }
                    } catch (staffErr) {
                        console.error("Error notifying drivers:", staffErr);
                    }
                }

                // If dine-in (table) order, notify assigned waiters
                const isDineIn = after.orderType === "dine-in" || after.orderType === "masa" || after.tableNumber != null;
                console.log(`[Waiter Debug] isDineIn=${isDineIn}, orderType=${after.orderType}, tableNumber=${after.tableNumber}`);
                if (isDineIn && after.tableNumber != null) {
                    const butcherId = after.butcherId || after.businessId;
                    const tableNum = after.tableNumber;
                    console.log(`[Waiter Debug] Looking for on-shift staff at businessId=${butcherId} for table ${tableNum}`);

                    try {
                        const waiterTokens: string[] = [];
                        const processedWaiterIds = new Set<string>();

                        // Query active staff at this business (include those who never started shift system)
                        const waiterSnapshot = await db.collection("admins")
                            .where("businessId", "==", butcherId)
                            .where("isActive", "!=", false)
                            .get();
                        console.log(`[Waiter Debug] Found ${waiterSnapshot.docs.length} active staff for business ${butcherId}`);

                        waiterSnapshot.docs.forEach(doc => {
                            if (processedWaiterIds.has(doc.id)) return;
                            const data = doc.data();

                            // Skip if explicitly off-shift (isOnShift === false means shift ended)
                            // Allow if isOnShift is true OR undefined (never used shift system)
                            if (data.isOnShift === false) {
                                console.log(`[Waiter Debug] Skipping ${doc.id} - explicitly off-shift`);
                                return;
                            }

                            // Skip if on break (paused shift)
                            if (data.shiftStatus === "paused") return;

                            // Check if this staff has the table assigned
                            const assignedTables = data.assignedTables as number[] | undefined;
                            if (assignedTables && Array.isArray(assignedTables) && assignedTables.length > 0) {
                                const tableNumInt = typeof tableNum === "number" ? tableNum : parseInt(tableNum, 10);
                                if (!assignedTables.includes(tableNumInt)) return;
                            }
                            // If no assignedTables field, treat as responsible for ALL tables

                            processedWaiterIds.add(doc.id);
                            if (data.fcmToken) waiterTokens.push(data.fcmToken);
                            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                                waiterTokens.push(...data.fcmTokens);
                            }
                        });

                        if (waiterTokens.length > 0) {
                            const waiterMessage = {
                                notification: {
                                    title: `${trans.tableOrderTitle || "🍽️ Tischbestellung fertig!"} (${trans.table || "Tisch"} ${tableNum})`,
                                    body: `${orderNumber} - ${trans.orderReadyDineInBody || "Wartet auf Tischservice"}`,
                                },
                                data: {
                                    type: "table_order_ready",
                                    orderId: event.params.orderId,
                                    businessId: butcherId,
                                    tableNumber: String(tableNum),
                                },
                                tokens: waiterTokens,
                            };
                            const response = await messaging.sendEachForMulticast({...waiterMessage, ...buildSoundConfig(notifSound)});
                            console.log(`[Waiter Gate] Sent table-ready notification to ${response.successCount}/${waiterTokens.length} assigned waiters for table ${tableNum}`);
                        } else {
                            console.log(`[Waiter Gate] No assigned waiters found for table ${tableNum} at business ${butcherId}`);
                        }
                    } catch (waiterErr) {
                        console.error("Error notifying waiters:", waiterErr);
                    }
                }
                break;
            case "served": {
                // Dine-in order served at the table
                const isDineInServed = after.orderType === "dine-in" || after.orderType === "masa" || after.tableNumber != null;
                const servedByName = after.servedByName || "";
                if (isDineInServed && after.tableNumber != null) {
                    title = `${trans.orderServedTitle || trans.orderDeliveredTitle}${orderTag}`;
                    body = `${orderNumber} - ${trans.orderServedBody || trans.orderDeliveredBody}`;
                } else {
                    title = `${trans.orderServedTitle || trans.orderDeliveredTitle}${orderTag}`;
                    body = `${orderNumber} - ${trans.orderServedBody || trans.orderDeliveredBody}`;
                }
                // Schedule feedback request for dine-in served orders
                const servedFeedbackSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                await db.collection("meat_orders").doc(event.params.orderId).update({
                    feedbackSendAt: admin.firestore.Timestamp.fromDate(servedFeedbackSendAt),
                    feedbackSent: false,
                });
                break;
            }
            case "onTheWay":
                // Courier has claimed and started delivery
                const courierName = after.courierName || "";
                title = `${trans.deliveryPickedUpTitle}${orderTag}`;
                body = `${orderNumber} - ${courierName} ${trans.deliveryPickedUpBody.toLowerCase()}`;
                break;
            case "delivered":
                title = `${trans.orderDeliveredTitle}${orderTag}`;
                body = `${orderNumber} - ${trans.orderDeliveredBody}`;
                // Schedule feedback request for 24 hours later
                const feedbackSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                await db.collection("meat_orders").doc(event.params.orderId).update({
                    feedbackSendAt: admin.firestore.Timestamp.fromDate(feedbackSendAt),
                    feedbackSent: false,
                });
                console.log(`[Feedback] Scheduled feedback request for ${orderNumber} at ${feedbackSendAt.toISOString()}`);
                // Create commission record on delivery
                await createCommissionRecord(event.params.orderId, after);

                // =====================================================================
                // PROMOTION SYSTEM: Increment Order Count & Process Referral Reward
                // =====================================================================
                const deliveredUserId = after.userId || after.customerId;
                if (deliveredUserId) {
                    try {
                        // 1. Increment completedOrderCount for first-order discount tier progression
                        await db.collection("users").doc(deliveredUserId).set({
                            completedOrderCount: admin.firestore.FieldValue.increment(1),
                        }, { merge: true });
                        console.log(`[Promo] Incremented completedOrderCount for user ${deliveredUserId}`);

                        // 2. Process referral reward on first completed order
                        const userDoc = await db.collection("users").doc(deliveredUserId).get();
                        const userData = userDoc.data();
                        const newCount = (userData?.completedOrderCount as number) || 1;

                        if (newCount === 1 && userData?.referredBy && !userData?.referralRewardProcessed) {
                            const referrerId = userData.referredBy as string;
                            const referrerReward = 5.0; // €5 for referrer
                            const refereeReward = 3.0;  // €3 for referee

                            const rewardBatch = db.batch();

                            // Credit referrer wallet
                            const referrerRef = db.collection("users").doc(referrerId);
                            rewardBatch.set(referrerRef, {
                                walletBalance: admin.firestore.FieldValue.increment(referrerReward),
                            }, { merge: true });

                            // Credit referrer wallet transaction
                            const referrerTxRef = db.collection("users").doc(referrerId).collection("wallet_transactions").doc();
                            rewardBatch.set(referrerTxRef, {
                                type: "referral_reward",
                                amount: referrerReward,
                                description: "Empfehlungsbonus",
                                referredUserId: deliveredUserId,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            });

                            // Credit referee wallet
                            const refereeRef = db.collection("users").doc(deliveredUserId);
                            rewardBatch.set(refereeRef, {
                                walletBalance: admin.firestore.FieldValue.increment(refereeReward),
                                referralRewardProcessed: true,
                            }, { merge: true });

                            // Credit referee wallet transaction
                            const refereeTxRef = db.collection("users").doc(deliveredUserId).collection("wallet_transactions").doc();
                            rewardBatch.set(refereeTxRef, {
                                type: "referral_welcome",
                                amount: refereeReward,
                                description: "Willkommensbonus",
                                referrerId: referrerId,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            });

                            // Update referral stats
                            const referralRef = db.collection("users").doc(referrerId).collection("referrals").doc(deliveredUserId);
                            rewardBatch.set(referralRef, {
                                status: "completed",
                                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                                rewardAmount: referrerReward,
                            }, { merge: true });

                            await rewardBatch.commit();
                            console.log(`[Promo] Processed referral reward: referrer=${referrerId} (+€${referrerReward}), referee=${deliveredUserId} (+€${refereeReward})`);
                        }
                    } catch (promoError) {
                        console.error(`[Promo] Error processing promotion hooks for user ${deliveredUserId}:`, promoError);
                    }
                }
                break;
            case "completed":
                title = `${trans.orderDeliveredTitle}${orderTag}`;
                body = `${orderNumber} - ${trans.orderDeliveredBody}`;
                // Also create commission record for completed orders (if not already created at delivered)
                await createCommissionRecord(event.params.orderId, after);
                break;
            case "rejected":
                const reason = after.rejectionReason || "";
                const butcherPhone = after.butcherPhone || "";
                title = `${trans.orderRejectedTitle || "❌ Bestellung konnte nicht bestätigt werden"}${orderTag}`;
                body = `${orderNumber}${reason ? " - " + reason : ""}${butcherPhone ? ` Tel: ${butcherPhone}` : ""}`;
                break;
            case "cancelled":
                const cancellationReason = after.cancellationReason || "";
                const paymentStatus = after.paymentStatus;
                const paymentMethod = after.paymentMethod;

                title = `${trans.orderCancelledTitle}${orderTag}`;

                // Build message with reason and refund info
                let cancelMsg = `${orderNumber}${cancellationReason ? " - " + cancellationReason : ""}`;

                // If payment was made (paid/completed), mention refund
                if (paymentStatus === "paid" || paymentStatus === "completed") {
                    if (paymentMethod === "card" || paymentMethod === "stripe") {
                        cancelMsg += ". 💳 Ihre Zahlung wird automatisch auf Ihre Karte zurückerstattet.";
                    } else {
                        cancelMsg += ". Ihre Zahlung wird erstattet.";
                    }
                }

                // Add apology
                cancelMsg += " Wir entschuldigen uns für die Unannehmlichkeiten. 🙏";
                body = cancelMsg;
                break;
            default:
                return; // Don't send notification for other statuses
        }

        // Only send customer notification if we have a token or valid users
        if ((hasCustomerToken || after.userId) && title && body) {
            try {
                const messagePayload = {
                    notification: { title, body },
                    data: {
                        type: "order_status",
                        orderId: event.params.orderId,
                        status: newStatus,
                    },
                };

                // Save to Firestore History
                const userIds = new Set<string>();
                if (after.userId) userIds.add(after.userId);

                if (after.isGroupOrder && after.groupSessionId) {
                    const sessionSnap = await db.collection("table_group_sessions").doc(after.groupSessionId).get();
                    if (sessionSnap.exists) {
                        const sessionData = sessionSnap.data();
                        let sessionChanged = false;

                        if (sessionData && Array.isArray(sessionData.participants)) {
                            sessionData.participants.forEach((p: any) => {
                                if (p.userId) userIds.add(p.userId);

                                // FIX 12: Sync order status back to session items for real-time UI updates
                                if (Array.isArray(p.items)) {
                                    p.items.forEach((item: any) => {
                                        if (item.orderId === event.params.orderId && item.orderStatus !== newStatus) {
                                            item.orderStatus = newStatus;
                                            sessionChanged = true;
                                        }
                                    });
                                }
                            });

                            // Write back the updated participant array if statuses changed
                            if (sessionChanged) {
                                await db.collection("table_group_sessions").doc(after.groupSessionId).update({
                                    participants: sessionData.participants,
                                });
                                console.log(`[Status Sync] Updated orderStatus to ${newStatus} in session ${after.groupSessionId}`);
                            }
                        }
                    }
                }

                if (userIds.size > 0) {
                    const batch = db.batch();
                    const notificationData: Record<string, any> = {
                        title,
                        body,
                        type: "order_status",
                        orderId: event.params.orderId,
                        status: newStatus,
                        rawOrderNumber,
                        businessName,
                        deliveryMethod: after.orderType || after.deliveryMethod || '',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    };

                    // Add cancellation reason for cancelled/rejected orders
                    if (newStatus === 'cancelled') {
                        notificationData.cancellationReason = after.cancellationReason || '';
                    } else if (newStatus === 'rejected') {
                        notificationData.cancellationReason = after.rejectionReason || '';
                    }

                    // Add totalAmount if available
                    if (after.totalAmount) {
                        notificationData.totalAmount = after.totalAmount;
                    }

                    userIds.forEach(uid => {
                        const ref = db.collection("users").doc(uid).collection("notifications").doc();
                        batch.set(ref, notificationData);
                    });
                    await batch.commit();
                    console.log(`Saved notification history for ${userIds.size} users`);
                }

                // Send FCM via Messaging
                if (hasCustomerToken) {
                    if (customerTokens.length === 1) {
                        await messaging.send({
                            ...messagePayload,
                            ...buildSoundConfig(notifSound),
                            token: customerTokens[0],
                        });
                        console.log(`Sent ${newStatus} notification to customer (single device)`);
                    } else {
                        const response = await messaging.sendEachForMulticast({
                            ...messagePayload,
                            ...buildSoundConfig(notifSound),
                            tokens: customerTokens,
                        });
                        console.log(`Sent ${newStatus} notification to ${response.successCount}/${customerTokens.length} customer devices`);
                    }
                }
            } catch (error) {
                console.error("Error saving/sending notification to customer(s):", error);
            }
        } else if (!hasCustomerToken && !after.userId) {
            console.log(`Skipped customer notification for ${newStatus} - no FCM token(s) or userId`);
        }
    }
);

// =============================================================================
// MONTHLY AUTOMATIC INVOICING (Cron Job)
// Runs on the 1st of every month at 02:00 Berlin time
// =============================================================================

/**
 * GoBD-Compliant Invoice Number Generator
 * Format: RE-{YEAR}-{SEQUENCE} (e.g., RE-2026-00001)
 */
async function getNextInvoiceNumber(): Promise<string> {
    const counterRef = db.collection("system_counters").doc("invoices");
    const year = new Date().getFullYear();

    return db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let sequence = 1;

        if (counterDoc.exists) {
            const data = counterDoc.data();
            const storedYear = data?.year || year;

            if (storedYear === year) {
                sequence = (data?.sequence || 0) + 1;
            }
            // If year changed, reset to 1
        }

        transaction.set(counterRef, { year, sequence }, { merge: true });

        return `RE-${year}-${String(sequence).padStart(5, "0")}`;
    });
}

/**
 * Syncs a Firestore invoice to Stripe for automatic collection
 * Creates a Stripe Invoice and sends it to the customer
 */
async function syncInvoiceToStripe(
    invoiceId: string,
    businessId: string,
    invoiceNumber: string,
    description: string,
    grossAmount: number,
    currency: string,
    dueDate: Date,
    stripeKey: string
): Promise<{ stripeInvoiceId: string | null; stripeInvoiceUrl: string | null }> {
    try {
        // Get business Stripe customer ID
        const businessDoc = await db.collection("butcher_partners").doc(businessId).get();
        const business = businessDoc.data();

        if (!business?.stripeCustomerId) {
            console.log(`[Stripe Sync] No Stripe customer ID for business ${businessId}`);
            return { stripeInvoiceId: null, stripeInvoiceUrl: null };
        }

        // Initialize Stripe with the secret key
        const stripe = new Stripe(stripeKey);

        // Create Stripe invoice with automatic charge
        // Auto-charge after 2 days (gives customer time to see the invoice)
        const stripeInvoice = await stripe.invoices.create({
            customer: business.stripeCustomerId,
            collection_method: "charge_automatically", // Auto-charge from saved payment method
            pending_invoice_items_behavior: "include",
            auto_advance: true,
            // Custom fields for German compliance
            custom_fields: [
                { name: "Rechnungsnummer", value: invoiceNumber },
                { name: "USt-IdNr", value: "DE123456789" }
            ],
            metadata: {
                merchantInvoiceId: invoiceId,
                invoiceNumber: invoiceNumber,
                source: "monthly_cron"
            }
        });

        // Add invoice line item
        await stripe.invoiceItems.create({
            customer: business.stripeCustomerId,
            invoice: stripeInvoice.id,
            amount: Math.round(grossAmount * 100), // Cents
            currency: currency.toLowerCase(),
            description: description
        });

        // Finalize the invoice (this triggers auto-charge in 1-2 days)
        const invoiceIdStr = stripeInvoice.id!;
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoiceIdStr);

        // Calculate payment date (2 days from now)
        const paymentDate = new Date();
        paymentDate.setDate(paymentDate.getDate() + 2);
        const paymentDateStr = paymentDate.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });

        console.log(`[Stripe Sync] Created Stripe invoice ${invoiceIdStr} for ${invoiceNumber} - payment will be collected on ${paymentDateStr}`);

        // Update Firestore invoice with Stripe info
        await db.collection("invoices").doc(invoiceId).update({
            stripeInvoiceId: invoiceIdStr,
            stripeInvoiceUrl: finalizedInvoice.hosted_invoice_url || null,
            stripeInvoiceStatus: "open",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            stripeInvoiceId: invoiceIdStr,
            stripeInvoiceUrl: finalizedInvoice.hosted_invoice_url || null
        };

    } catch (error) {
        console.error(`[Stripe Sync] Error syncing invoice ${invoiceId}:`, error);
        return { stripeInvoiceId: null, stripeInvoiceUrl: null };
    }
}

/**
 * Monthly Subscription & Commission Invoicing (Lexware + Stripe SEPA Hybrid)
 * Creates GoBD-compliant invoices via Lexware API, then collects payment via Stripe.
 * Lexware handles: invoice numbering, PDF, DATEV export, XRechnung
 * Stripe handles: SEPA payment collection
 */
export const onScheduledMonthlyInvoicing = onSchedule(
    {
        schedule: "0 2 1 * *", // 1st of every month at 02:00
        timeZone: "Europe/Berlin",
        memory: "1GiB",
        timeoutSeconds: 540, // 9 minutes
        secrets: [stripeSecretKey, stripeTestSecretKey, resendApiKey, lexwareApiKey],
    },
    async () => {
        console.log("[Monthly Invoicing] Starting Lexware + Stripe SEPA hybrid invoicing...");

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed, current month

        // Calculate period (previous month)
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0); // Last day of previous month
        const periodString = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;

        // Due date: 14 days from now
        const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const stats = {
            total: 0,
            lexwareCreated: 0,
            lexwareFailed: 0,
            stripeCharged: 0,
            stripeFailed: 0,
            emailsSent: 0,
            emailsFailed: 0,
            skipped: 0,
            totalAmount: 0,
        };

        // Initialize services
        const resend = new Resend(resendApiKey.value());
        const lxKey = lexwareApiKey.value();
        const stripeKey = useStripeTestMode.value() ? stripeTestSecretKey.value() : stripeSecretKey.value();

        // Helper: Send invoice email with Lexware PDF
        const sendInvoiceEmail = async (
            recipientEmail: string,
            invoiceNumber: string,
            period: string,
            grandTotal: number,
            taxAmount: number,
            taxRate: number,
            pdfBuffer: Buffer | null
        ) => {
            try {
                const attachments: any[] = [];
                if (pdfBuffer) {
                    attachments.push({
                        filename: `Rechnung_${invoiceNumber}.pdf`,
                        content: pdfBuffer.toString("base64"),
                    });
                }

                await resend.emails.send({
                    from: "LOKMA Marketplace <noreply@lokma.shop>",
                    to: recipientEmail,
                    subject: `Rechnung ${invoiceNumber} – ${period}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background: #1a1a1a; color: #ffffff; padding: 30px;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <div style="background: #E65100; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                                    <h1 style="margin: 0; color: white; font-size: 24px;">LOKMA</h1>
                                    <p style="margin: 5px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Rechnung</p>
                                </div>
                                <div style="background: #2a2a2a; padding: 25px; border-radius: 0 0 8px 8px;">
                                    <p style="color: #ccc; margin: 0 0 15px;">Sehr geehrte/r Geschäftspartner/in,</p>
                                    <p style="color: #ccc; margin: 0 0 20px;">anbei erhalten Sie Ihre Rechnung <strong style="color: #E65100;">${invoiceNumber}</strong> für den Zeitraum <strong>${period}</strong>.</p>
                                    <div style="background: #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                                        <table style="width: 100%; color: #ccc; font-size: 14px;">
                                            <tr><td>Rechnungsbetrag:</td><td style="text-align: right; font-weight: bold; color: #E65100; font-size: 18px;">€${grandTotal.toFixed(2)}</td></tr>
                                            <tr><td style="color: #999;">${taxRate > 0 ? `davon USt. ${taxRate}%:` : "Netto (steuerfrei):"}</td><td style="text-align: right; color: #999;">€${taxAmount.toFixed(2)}</td></tr>
                                            <tr><td style="color: #999;">Fällig am:</td><td style="text-align: right; color: #ff9800;">${dueDate.toLocaleDateString("de-DE")}</td></tr>
                                            <tr><td style="color: #999;">Zahlung:</td><td style="text-align: right; color: #4CAF50;">SEPA-Lastschrift</td></tr>
                                        </table>
                                    </div>
                                    <p style="color: #999; font-size: 12px; margin: 20px 0 0;">Die Rechnung finden Sie als PDF im Anhang.</p>
                                </div>
                                <p style="color: #666; font-size: 11px; text-align: center; margin-top: 15px;">LOKMA Marketplace GmbH · noreply@lokma.shop</p>
                            </div>
                        </div>
                    `,
                    attachments,
                });

                stats.emailsSent++;
                console.log(`[Monthly Invoicing] Email sent to ${recipientEmail} for ${invoiceNumber}`);
            } catch (emailError) {
                stats.emailsFailed++;
                console.error(`[Monthly Invoicing] Email failed for ${invoiceNumber}:`, emailError);
            }
        };

        try {
            // =================================================================
            // COLLECT BILLING DATA FOR ALL BUSINESSES
            // =================================================================
            const businessesSnapshot = await db.collection("butcher_partners")
                .where("subscriptionStatus", "==", "active")
                .get();

            console.log(`[Monthly Invoicing] Found ${businessesSnapshot.size} active businesses`);

            for (const businessDoc of businessesSnapshot.docs) {
                const businessId = businessDoc.id;
                stats.total++;

                try {
                    // Collect all billing data for this business
                    const billingData = await collectMonthlyBillingData(businessId, periodStart, periodEnd);

                    // Skip if nothing to charge
                    if (!billingData.hasChargeableItems) {
                        console.log(`[Monthly Invoicing] Skipping ${billingData.businessName} - no chargeable items`);
                        stats.skipped++;
                        continue;
                    }

                    // Check for existing invoice this period
                    const existingInvoice = await db.collection("invoices")
                        .where("businessId", "==", businessId)
                        .where("period", "==", periodString)
                        .limit(1)
                        .get();

                    if (!existingInvoice.empty) {
                        console.log(`[Monthly Invoicing] Invoice already exists for ${billingData.businessName} period ${periodString}`);
                        stats.skipped++;
                        continue;
                    }

                    // =============================================================
                    // STEP 0: Classify VAT (DE/EU/Drittland)
                    // =============================================================
                    const vatClassification = await classifyTaxType({
                        countryCode: billingData.businessAddress.countryCode,
                        vatId: billingData.vatId || undefined,
                    });

                    console.log(`[Monthly Invoicing] VAT classification for ${billingData.businessName}: ` +
                        `country=${billingData.businessAddress.countryCode}, ` +
                        `taxType=${vatClassification.taxType}, ` +
                        `rate=${vatClassification.taxRatePercentage}%, ` +
                        `reverseCharge=${vatClassification.reverseCharge}`);

                    // =============================================================
                    // STEP 1: Create Lexware Invoice
                    // =============================================================
                    const lexwarePayload = buildMonthlyInvoicePayload({
                        businessName: billingData.businessName,
                        businessAddress: billingData.businessAddress,
                        vatId: billingData.vatId,
                        periodStart,
                        periodEnd,
                        subscriptionPlanName: billingData.subscriptionPlanName,
                        subscriptionFee: billingData.subscriptionFee,
                        commissionAmount: billingData.commissionAmount,
                        commissionDetails: billingData.commissionDetails,
                        activeModules: billingData.activeModules,
                        sponsoredFee: billingData.sponsoredFee,
                        sponsoredConversions: billingData.sponsoredConversions,
                        vatClassification,
                    });

                    const lexwareResult = await createLexwareInvoice(lxKey, lexwarePayload, true);

                    if (!lexwareResult.success) {
                        console.error(`[Monthly Invoicing] Lexware failed for ${billingData.businessName}: ${lexwareResult.error}`);
                        stats.lexwareFailed++;

                        // Fallback: create invoice in Firestore only (without Lexware)
                        const fallbackNumber = await getNextInvoiceNumber();
                        await db.collection("invoices").add({
                            invoiceNumber: fallbackNumber,
                            type: "combined",
                            status: "pending",
                            businessId,
                            butcherName: billingData.businessName,
                            period: periodString,
                            periodStart: admin.firestore.Timestamp.fromDate(periodStart),
                            periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
                            grandTotal: billingData.totalGrossAmount,
                            source: "fallback_no_lexware",
                            error: lexwareResult.error,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        continue;
                    }

                    stats.lexwareCreated++;
                    const invoiceNumber = lexwareResult.voucherNumber || "UNKNOWN";
                    const grandTotal = lexwareResult.totalGross || billingData.totalGrossAmount;
                    const actualTaxRate = vatClassification.taxRatePercentage;
                    const taxAmount = lexwareResult.totalTax || (actualTaxRate > 0
                        ? Math.round((grandTotal - grandTotal / (1 + actualTaxRate / 100)) * 100) / 100
                        : 0);

                    console.log(`[Monthly Invoicing] Lexware invoice ${invoiceNumber} created for ${billingData.businessName} - €${grandTotal.toFixed(2)} (${actualTaxRate}% MwSt)`);

                    // =============================================================
                    // STEP 2: Save to Firestore
                    // =============================================================
                    const invoiceData = {
                        invoiceNumber,
                        type: "combined",
                        status: "pending",

                        // Business
                        businessId,
                        butcherName: billingData.businessName,
                        butcherAddress: `${billingData.businessAddress.street}, ${billingData.businessAddress.zip} ${billingData.businessAddress.city}`,
                        countryCode: billingData.businessAddress.countryCode,
                        vatId: billingData.vatId || null,

                        // Period
                        period: periodString,
                        periodStart: admin.firestore.Timestamp.fromDate(periodStart),
                        periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),

                        // Breakdown
                        subscriptionFee: billingData.subscriptionFee,
                        subscriptionPlanName: billingData.subscriptionPlanName,
                        commissionAmount: billingData.commissionAmount,
                        commissionDetails: billingData.commissionDetails,
                        activeModules: billingData.activeModules,
                        sponsoredFee: billingData.sponsoredFee,
                        sponsoredConversions: billingData.sponsoredConversions,

                        // Totals (dynamic tax rate)
                        subtotal: lexwareResult.totalNet || (actualTaxRate > 0
                            ? Math.round((grandTotal / (1 + actualTaxRate / 100)) * 100) / 100
                            : grandTotal),
                        taxRate: actualTaxRate,
                        taxAmount,
                        grandTotal,
                        currency: "EUR",

                        // VAT Classification (audit trail for §13b/Finanzamt)
                        vatClassification: {
                            taxType: vatClassification.taxType,
                            taxRatePercentage: vatClassification.taxRatePercentage,
                            reverseCharge: vatClassification.reverseCharge,
                            legalNote: vatClassification.legalNote || null,
                            vatIdValid: vatClassification.vatIdValid ?? null,
                            vatIdCheckedAt: vatClassification.vatIdCheckedAt || null,
                        },

                        // Lexware
                        lexwareId: lexwareResult.lexwareId,
                        lexwareNumber: invoiceNumber,
                        lexwarePdfFileId: lexwareResult.pdfFileId,
                        source: "lexware",

                        // Dates
                        issueDate: admin.firestore.FieldValue.serverTimestamp(),
                        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

                        generatedBy: "cron_lexware_hybrid",
                        commissionRecordIds: billingData.commissionRecordIds,
                        sponsoredRecordIds: billingData.sponsoredRecordIds,
                    };

                    const invoiceRef = await db.collection("invoices").add(invoiceData);

                    // Mark commission records as invoiced
                    if (billingData.commissionRecordIds.length > 0) {
                        const batch = db.batch();
                        for (const recordId of billingData.commissionRecordIds) {
                            batch.update(db.collection("commission_records").doc(recordId), {
                                collectionStatus: "invoiced",
                                invoiceId: invoiceRef.id,
                                invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        }
                        await batch.commit();
                    }

                    // =============================================================
                    // STEP 3: Stripe SEPA Payment Collection
                    // =============================================================
                    try {
                        const stripeResult = await syncInvoiceToStripe(
                            invoiceRef.id,
                            businessId,
                            invoiceNumber,
                            `LOKMA Plattform-Abrechnung ${periodString}`,
                            grandTotal,
                            "EUR",
                            dueDate,
                            stripeKey
                        );

                        if (stripeResult.stripeInvoiceId) {
                            stats.stripeCharged++;
                            await db.collection("invoices").doc(invoiceRef.id).update({
                                stripeInvoiceId: stripeResult.stripeInvoiceId,
                                stripeInvoiceUrl: stripeResult.stripeInvoiceUrl,
                                paymentStatus: "processing",
                            });
                            console.log(`[Monthly Invoicing] Stripe charge created: ${stripeResult.stripeInvoiceId}`);
                        } else {
                            stats.stripeFailed++;
                            console.log(`[Monthly Invoicing] Stripe sync skipped for ${billingData.businessName} - no Stripe customer`);
                        }
                    } catch (stripeError) {
                        stats.stripeFailed++;
                        console.error(`[Monthly Invoicing] Stripe error for ${billingData.businessName}:`, stripeError);
                    }

                    stats.totalAmount += grandTotal;

                    // =============================================================
                    // STEP 4: Download Lexware PDF & Send Email
                    // =============================================================
                    if (billingData.businessEmail) {
                        let pdfBuffer: Buffer | null = null;
                        try {
                            pdfBuffer = await downloadLexwareInvoicePDF(lxKey, lexwareResult.lexwareId!);
                        } catch (pdfErr) {
                            console.error(`[Monthly Invoicing] Lexware PDF download failed, using fallback:`, pdfErr);
                            // Fallback: generate PDF with our own service
                            pdfBuffer = await generateInvoicePDF(invoiceData as any);
                        }

                        await sendInvoiceEmail(
                            billingData.businessEmail,
                            invoiceNumber,
                            periodString,
                            grandTotal,
                            taxAmount,
                            actualTaxRate,
                            pdfBuffer
                        );
                    }

                    console.log(`[Monthly Invoicing] ✅ ${billingData.businessName}: ${invoiceNumber} → €${grandTotal.toFixed(2)}`);

                } catch (error) {
                    console.error(`[Monthly Invoicing] Error processing business ${businessId}:`, error);
                    stats.lexwareFailed++;
                }
            }

            // =================================================================
            // LOG SUMMARY
            // =================================================================
            console.log("========================================");
            console.log("[Monthly Invoicing] COMPLETED (Lexware + Stripe Hybrid)");
            console.log(`  Total Businesses: ${stats.total}`);
            console.log(`  Lexware Invoices: ${stats.lexwareCreated} created, ${stats.lexwareFailed} failed`);
            console.log(`  Stripe Charges: ${stats.stripeCharged} charged, ${stats.stripeFailed} failed`);
            console.log(`  Emails: ${stats.emailsSent} sent, ${stats.emailsFailed} failed`);
            console.log(`  Skipped: ${stats.skipped}`);
            console.log(`  Total Amount: €${stats.totalAmount.toFixed(2)}`);
            console.log("========================================");

            // Store run log
            await db.collection("system_logs").add({
                type: "monthly_invoicing_lexware",
                runAt: admin.firestore.FieldValue.serverTimestamp(),
                period: periodString,
                stats,
            });

        } catch (error) {
            console.error("[Monthly Invoicing] Critical error:", error);
            throw error;
        }
    }
);

// =============================================================================
// MONTHLY COURIER PAUSE REPORT (E-mail to Admin)
// Runs on the 1st of every month at 09:00 Berlin time
// =============================================================================

/**
 * Monthly Courier Pause Report
 * Collects all delivery pause/resume logs from the previous month
 * and sends a summary email to the platform admin
 */
export const onScheduledMonthlyDeliveryPauseReport = onSchedule(
    {
        schedule: "0 9 1 * *", // 1st of every month at 09:00
        timeZone: "Europe/Berlin",
        memory: "256MiB",
        timeoutSeconds: 300, // 5 minutes
    },
    async () => {
        console.log("[Monthly Delivery Report] Starting monthly delivery pause report...");

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed, current month

        // Calculate period (previous month)
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0); // Last day of previous month
        const periodString = `${periodStart.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`;

        try {
            // Get all businesses with delivery support
            const businessesSnapshot = await db.collection("businesses")
                .where("supportsDelivery", "==", true)
                .get();

            interface BusinessPauseData {
                companyName: string;
                pauseCount: number;
                resumeCount: number;
                totalPausedHours: number;
                avgOrderFulfillmentMins: number; // 🆕 Ortalama sipariş-teslim süresi (dakika)
                orderCount: number;
                logs: Array<{ action: string; timestamp: Date; adminEmail: string }>;
            }

            const reportData: Record<string, BusinessPauseData> = {};
            let totalPauses = 0;
            let totalPausedHours = 0;
            let totalAvgFulfillmentMins = 0;
            let businessesWithOrders = 0;

            for (const businessDoc of businessesSnapshot.docs) {
                const business = businessDoc.data();
                const businessId = businessDoc.id;

                // Get pause logs for this business in the period
                const logsSnapshot = await db.collection("businesses")
                    .doc(businessId)
                    .collection("deliveryPauseLogs")
                    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(periodStart))
                    .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
                    .orderBy("timestamp", "asc")
                    .get();

                if (logsSnapshot.empty) continue;

                const logs = logsSnapshot.docs.map(doc => ({
                    action: doc.data().action,
                    timestamp: doc.data().timestamp?.toDate() || new Date(),
                    adminEmail: doc.data().adminEmail || "unknown",
                }));

                // Calculate stats
                let pauseStart: Date | null = null;
                let pausedMs = 0;
                let pauseCount = 0;
                let resumeCount = 0;

                for (const log of logs) {
                    if (log.action === "paused") {
                        pauseStart = log.timestamp;
                        pauseCount++;
                    } else if (log.action === "resumed" && pauseStart) {
                        pausedMs += log.timestamp.getTime() - pauseStart.getTime();
                        pauseStart = null;
                        resumeCount++;
                    }
                }

                // If still paused at end of period, count until period end
                if (pauseStart) {
                    pausedMs += periodEnd.getTime() - pauseStart.getTime();
                }

                const pausedHours = Math.round(pausedMs / (1000 * 60 * 60));

                // 🆕 Calculate average order fulfillment time for this business
                const ordersSnapshot = await db.collection("orders")
                    .where("businessId", "==", businessId)
                    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(periodStart))
                    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
                    .where("status", "==", "completed")
                    .get();

                let avgFulfillmentMins = 0;
                const orderCount = ordersSnapshot.size;

                if (orderCount > 0) {
                    let totalFulfillmentMs = 0;
                    let validOrders = 0;

                    for (const orderDoc of ordersSnapshot.docs) {
                        const order = orderDoc.data();
                        const createdAt = order.createdAt?.toDate();
                        const completedAt = order.completedAt?.toDate() || order.updatedAt?.toDate();

                        if (createdAt && completedAt) {
                            const fulfillmentMs = completedAt.getTime() - createdAt.getTime();
                            // Only count reasonable times (< 3 hours)
                            if (fulfillmentMs > 0 && fulfillmentMs < 3 * 60 * 60 * 1000) {
                                totalFulfillmentMs += fulfillmentMs;
                                validOrders++;
                            }
                        }
                    }

                    if (validOrders > 0) {
                        avgFulfillmentMins = Math.round(totalFulfillmentMs / validOrders / (1000 * 60));
                        totalAvgFulfillmentMins += avgFulfillmentMins;
                        businessesWithOrders++;
                    }
                }

                reportData[businessId] = {
                    companyName: business.companyName || business.brand || "Unbekanntes Geschäft",
                    pauseCount,
                    resumeCount,
                    totalPausedHours: pausedHours,
                    avgOrderFulfillmentMins: avgFulfillmentMins,
                    orderCount,
                    logs,
                };

                totalPauses += pauseCount;
                totalPausedHours += pausedHours;
            }

            // Build email content
            const businessCount = Object.keys(reportData).length;

            let emailHtml = `
                <h2>📊 LOKMA Geschäfts-Leistungsbericht - ${periodString}</h2>
                <hr/>
                <h3>Zusammenfassung</h3>
                <ul>
                    <li><strong>Gesamtanzahl Geschäfte (mit Pausen):</strong> ${businessCount}</li>
                    <li><strong>Gesamtanzahl Pausen:</strong> ${totalPauses}</li>
                    <li><strong>Gesamte Pausenzeit:</strong> ${totalPausedHours} Stunden</li>
                    <li><strong>Durchschn. Lieferzeit:</strong> ${businessesWithOrders > 0 ? Math.round(totalAvgFulfillmentMins / businessesWithOrders) : 0} Minuten</li>
                </ul>
                <hr/>
                <h3>Geschäftsdetails</h3>
                <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
                    <tr style="background-color: #f0f0f0;">
                        <th>Geschäft</th>
                        <th>Pausen</th>
                        <th>Fortgesetzt</th>
                        <th>Pausenzeit (Std.)</th>
                        <th>Bestellungen</th>
                        <th>Durchschn. Lieferung (Min.)</th>
                    </tr>
            `;

            // Sort by pause count descending
            const sortedBusinesses = Object.entries(reportData)
                .sort((a, b) => b[1].pauseCount - a[1].pauseCount);

            for (const [, data] of sortedBusinesses) {
                const rowColor = data.pauseCount > 5 ? "#fff3cd" : (data.pauseCount > 2 ? "#ffe8e8" : "#ffffff");
                emailHtml += `
                    <tr style="background-color: ${rowColor};">
                        <td>${data.companyName}</td>
                        <td style="text-align: center;">${data.pauseCount}</td>
                        <td style="text-align: center;">${data.resumeCount}</td>
                        <td style="text-align: center;">${data.totalPausedHours}</td>
                        <td style="text-align: center;">${data.orderCount}</td>
                        <td style="text-align: center;">${data.avgOrderFulfillmentMins > 0 ? data.avgOrderFulfillmentMins : "-"}</td>
                    </tr>
                `;
            }

            emailHtml += `
                </table>
                <hr/>
                <p style="color: #666; font-size: 12px;">
                    Dieser Bericht wurde automatisch von der LOKMA-Plattform erstellt.<br/>
                    Berichtszeitraum: ${periodStart.toLocaleDateString("de-DE")} - ${periodEnd.toLocaleDateString("de-DE")}
                </p>
            `;

            // Store report in Firestore
            await db.collection("delivery_pause_reports").add({
                period: periodString,
                periodStart: admin.firestore.Timestamp.fromDate(periodStart),
                periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
                businessCount,
                totalPauses,
                totalPausedHours,
                reportData,
                emailSent: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Send email using Firebase Admin (requires email extension or custom SMTP)
            // For now, we log the report - email sending requires additional setup
            console.log("========================================");
            console.log("[Monthly Delivery Report] COMPLETED");
            console.log(`  Period: ${periodString}`);
            console.log(`  Businesses with pauses: ${businessCount}`);
            console.log(`  Total pauses: ${totalPauses}`);
            console.log(`  Total paused hours: ${totalPausedHours}`);
            console.log("========================================");

            // Store log for manual email or future extension integration
            await db.collection("system_logs").add({
                type: "monthly_delivery_pause_report",
                runAt: admin.firestore.FieldValue.serverTimestamp(),
                period: periodString,
                stats: { businessCount, totalPauses, totalPausedHours },
                emailTo: "metinoez@gmail.com",
                emailHtml, // Store for manual sending if needed
            });

            console.log("[Monthly Delivery Report] Report stored. Email HTML saved to system_logs.");

        } catch (error) {
            console.error("[Monthly Delivery Report] Critical error:", error);
            throw error;
        }
    }
);

// =============================================================================
// HOURLY FEEDBACK REQUEST NOTIFICATIONS
// Sends feedback request 24 hours after order delivery
// =============================================================================

/**
 * Hourly check for orders that need feedback requests
 * Sends push notifications asking customers to rate their experience
 */
export const onScheduledFeedbackRequests = onSchedule(
    {
        schedule: "0 * * * *", // Every hour at minute 0
        timeZone: "Europe/Berlin",
        memory: "256MiB",
        timeoutSeconds: 120,
    },
    async () => {
        console.log("[Feedback Request] Starting hourly feedback check...");

        const now = new Date();
        let sentCount = 0;
        let skipCount = 0;

        try {
            // Find orders where feedbackSendAt has passed and feedbackSent is false
            const pendingFeedback = await db.collection("meat_orders")
                .where("feedbackSent", "==", false)
                .where("feedbackSendAt", "<=", admin.firestore.Timestamp.fromDate(now))
                .limit(50) // Process max 50 per run
                .get();

            console.log(`[Feedback Request] Found ${pendingFeedback.size} orders pending feedback`);

            for (const orderDoc of pendingFeedback.docs) {
                const order = orderDoc.data();
                const orderId = orderDoc.id;

                // Skip if already rated
                if (order.hasRating) {
                    await db.collection("meat_orders").doc(orderId).update({
                        feedbackSent: true,
                    });
                    skipCount++;
                    continue;
                }

                const customerFcmToken = order.customerFcmToken;
                if (!customerFcmToken) {
                    console.log(`[Feedback Request] No FCM token for order ${orderId}`);
                    await db.collection("meat_orders").doc(orderId).update({
                        feedbackSent: true,
                    });
                    skipCount++;
                    continue;
                }
                const butcherName = order.butcherName || "Geschäft";
                const lang = await getUserLanguage(order.userId || order.customerId); // Try to get user language, defaulting to Turkish
                const trans = await getPushTranslations(lang);

                const notifSound = await getActiveNotificationSound();
                try {
                    await messaging.send({
                        notification: {
                            title: trans.feedbackRequestTitle,
                            body: `${butcherName} ${trans.feedbackRequestBody.toLowerCase()}`,
                        },
                        data: {
                            type: "feedback_request",
                            orderId: orderId,
                            businessId: order.butcherId || "",
                            businessName: butcherName,
                        },
                        ...buildSoundConfig(notifSound),
                        token: customerFcmToken,
                    });

                    await db.collection("meat_orders").doc(orderId).update({
                        feedbackSent: true,
                        feedbackSentAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    sentCount++;
                    console.log(`[Feedback Request] Sent to order ${orderId}`);

                } catch (sendError) {
                    console.error(`[Feedback Request] Failed for order ${orderId}:`, sendError);
                    // Mark as sent to avoid retry loop
                    await db.collection("meat_orders").doc(orderId).update({
                        feedbackSent: true,
                        feedbackError: String(sendError),
                    });
                }
            }

            console.log("========================================");
            console.log("[Feedback Request] COMPLETED");
            console.log(`  Sent: ${sentCount}, Skipped: ${skipCount}`);
            console.log("========================================");

        } catch (error) {
            console.error("[Feedback Request] Critical error:", error);
            throw error;
        }
    });

// =============================================================================
// TABLE RESERVATION — STAFF NOTIFICATION ON NEW BOOKING
// Notifies all business staff when a customer submits a reservation
// =============================================================================

/**
 * When a new reservation is created under a business,
 * send push notifications to ALL staff members of that business.
 */
export const onNewReservation = onDocumentCreated(
    "businesses/{businessId}/reservations/{reservationId}",
    async (event) => {
        const reservation = event.data?.data();
        if (!reservation) return;

        const businessId = event.params.businessId;
        const customerName = reservation.userName || reservation.customerName || "Kunde";
        const partySize = reservation.partySize || 0;
        const resDate = reservation.reservationDate?.toDate?.() ?? new Date();
        const dateStr = resDate.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
        const timeStr = resDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

        console.log(`[Reservation] New reservation at business ${businessId} by ${customerName}`);

        try {
            // Collect FCM tokens from all staff assigned to this business
            const staffTokens: string[] = [];
            const processedIds = new Set<string>();

            const collectTokens = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
                if (processedIds.has(doc.id)) return;
                processedIds.add(doc.id);
                const data = doc.data();
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    staffTokens.push(...data.fcmTokens);
                } else if (data.fcmToken) {
                    staffTokens.push(data.fcmToken);
                }
            };

            // 1. Staff with assignedBusinesses array
            const adminsSnap = await db.collection("admins")
                .where("assignedBusinesses", "array-contains", businessId)
                .get();
            adminsSnap.docs.forEach(collectTokens);

            // 2. Staff with businessId field (single business assignment)
            const bizIdSnap = await db.collection("admins")
                .where("businessId", "==", businessId)
                .get();
            bizIdSnap.docs.forEach(collectTokens);

            // 3. Staff with butcherId field (legacy)
            const butcherIdSnap = await db.collection("admins")
                .where("butcherId", "==", businessId)
                .get();
            butcherIdSnap.docs.forEach(collectTokens);

            // 4. Legacy butcher_admins collection
            const legacySnap = await db.collection("butcher_admins")
                .where("butcherId", "==", businessId)
                .get();
            legacySnap.docs.forEach(collectTokens);

            // Remove duplicates
            const uniqueTokens = [...new Set(staffTokens)];

            if (uniqueTokens.length > 0) {
                const notifSound = await getActiveNotificationSound();
                const message = {
                    notification: {
                        title: "🍽️ Yeni Masa Rezervasyonu!",
                        body: `${customerName} – ${partySize} kişi – ${dateStr} ${timeStr}`,
                    },
                    data: {
                        type: "new_reservation",
                        reservationId: event.params.reservationId,
                        businessId: businessId,
                        customerName: customerName,
                    },
                    ...buildSoundConfig(notifSound),
                    tokens: uniqueTokens,
                };

                const response = await messaging.sendEachForMulticast(message);
                console.log(`[Reservation] Notified ${response.successCount}/${uniqueTokens.length} staff devices`);
            } else {
                console.log(`[Reservation] No staff tokens found for business ${businessId}`);
            }

            // ── Persist notification to customer's notification history ──
            const userId = reservation.userId;
            if (userId) {
                const businessName = reservation.businessName || "Restaurant";
                try {
                    await db.collection("users").doc(userId).collection("notifications").add({
                        title: "🍽️ Rezervasyon Alındı",
                        body: `${businessName} – ${dateStr} ${timeStr} – ${partySize} kişi`,
                        type: "reservation_status",
                        reservationId: event.params.reservationId,
                        businessId: businessId,
                        businessName: businessName,
                        status: "pending",
                        partySize: partySize,
                        reservationDate: reservation.reservationDate,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                    console.log(`[Reservation] Saved pending notification for user ${userId}`);
                } catch (notifError) {
                    console.error("[Reservation] Error saving notification history:", notifError);
                }
            }

        } catch (error) {
            console.error("[Reservation] Error notifying staff:", error);
        }
    }
);

// =============================================================================
// TABLE RESERVATION — CUSTOMER NOTIFICATION ON STATUS CHANGE
// Notifies the customer when staff confirms or rejects a reservation
// =============================================================================

/**
 * When a reservation status changes (pending → confirmed/rejected),
 * send push notification to the customer.
 */
export const onReservationStatusChange = onDocumentUpdated(
    {
        document: "businesses/{businessId}/reservations/{reservationId}",
        secrets: [resendApiKey],
    },
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();
        if (!before || !after) return;

        // Only process if status changed
        if (before.status === after.status) return;

        const newStatus = after.status;
        const businessId = event.params.businessId;
        const businessName = after.businessName || "Geschäft";
        const resDate = after.reservationDate?.toDate?.() ?? new Date();
        const dateStr = resDate.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
        const timeStr = resDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const partySize = after.partySize || 0;
        const customerName = after.userName || after.customerName || "Kunde";
        const tableCardNumbers = after.tableCardNumbers || [];

        // ─── Customer-initiated cancellation → notify staff ───
        if (newStatus === "cancelled") {
            console.log(`[Reservation] Customer cancelled reservation ${event.params.reservationId}`);
            try {
                const staffTokens: string[] = [];
                const processedIds = new Set<string>();

                const collectTokens = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
                    if (processedIds.has(doc.id)) return;
                    processedIds.add(doc.id);
                    const data = doc.data();
                    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                        staffTokens.push(...data.fcmTokens);
                    } else if (data.fcmToken) {
                        staffTokens.push(data.fcmToken);
                    }
                };

                // 1. Staff with assignedBusinesses array
                const adminsSnap = await db.collection("admins")
                    .where("assignedBusinesses", "array-contains", businessId)
                    .get();
                adminsSnap.docs.forEach(collectTokens);

                // 2. Staff with businessId field
                const bizIdSnap = await db.collection("admins")
                    .where("businessId", "==", businessId)
                    .get();
                bizIdSnap.docs.forEach(collectTokens);

                // 3. Staff with butcherId field
                const butcherIdSnap = await db.collection("admins")
                    .where("butcherId", "==", businessId)
                    .get();
                butcherIdSnap.docs.forEach(collectTokens);

                // 4. Legacy butcher_admins collection
                const legacySnap = await db.collection("butcher_admins")
                    .where("butcherId", "==", businessId)
                    .get();
                legacySnap.docs.forEach(collectTokens);

                if (staffTokens.length > 0) {
                    const uniqueTokens = [...new Set(staffTokens)];
                    const notifSound = await getActiveNotificationSound();
                    await messaging.sendEachForMulticast({
                        notification: {
                            title: "🚫 Rezervasyon İptal Edildi",
                            body: `${customerName} – ${partySize} kişi – ${dateStr} ${timeStr} iptal etti`,
                        },
                        data: {
                            type: "reservation_cancelled",
                            reservationId: event.params.reservationId,
                            businessId: businessId,
                        },
                        ...buildSoundConfig(notifSound),
                        tokens: uniqueTokens,
                    });
                    console.log(`[Reservation] Notified staff about cancellation`);
                }
            } catch (error) {
                console.error("[Reservation] Error notifying staff about cancellation:", error);
            }

            // Persist cancellation to customer's notification history
            const cancelUserId = after.userId;
            console.log(`[Reservation] Cancel notification: userId=${cancelUserId}`);
            if (cancelUserId) {
                const cancellationReason = after.cancellationReason || "";
                const cancellationNote = after.cancellationNote || "";
                try {
                    await db.collection("users").doc(cancelUserId).collection("notifications").add({
                        title: "Rezervasyon Iptal Edildi",
                        body: `${businessName} – ${dateStr} ${timeStr} – ${partySize} kisi`,
                        type: "reservation_status",
                        reservationId: event.params.reservationId,
                        businessId: businessId,
                        businessName: businessName,
                        status: "cancelled",
                        cancellationReason: cancellationReason,
                        cancellationNote: cancellationNote,
                        partySize: partySize,
                        reservationDate: after.reservationDate,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                    console.log(`[Reservation] Saved cancelled notification for user ${cancelUserId}`);
                } catch (notifError) {
                    console.error("[Reservation] Error saving cancellation notification:", notifError);
                }
            } else {
                console.log(`[Reservation] No userId found, skipping cancel notification persistence`);
            }
            return;
        }

        // ─── Staff-initiated status change → notify customer ───
        if (newStatus !== "confirmed" && newStatus !== "rejected" && newStatus !== "reactivated") return;

        const customerFcmToken = after.customerFcmToken || after.userFcmToken;

        let title = "";
        let body = "";

        if (newStatus === "confirmed") {
            title = "✅ Rezervasyonunuz Onaylandı!";
            body = `${businessName} – ${dateStr} ${timeStr} – ${partySize} kişi. Afiyet olsun!`;
        } else if (newStatus === "reactivated") {
            title = "✅ Rezervasyonunuz Tekrar Aktif!";
            body = `${businessName} – ${dateStr} ${timeStr} – ${partySize} kişi. Rezervasyonunuz tekrar aktif edildi.`;
        } else {
            title = "❌ Rezervasyonunuz Reddedildi";
            body = `${businessName} – ${dateStr} ${timeStr} için rezervasyonunuz maalesef onaylanmadı.`;
        }

        // Send push notification if token available
        if (customerFcmToken) {
            const notifSound = await getActiveNotificationSound();
            try {
                await messaging.send({
                    notification: { title, body },
                    data: {
                        type: "reservation_status",
                        reservationId: event.params.reservationId,
                        businessId: businessId,
                        status: newStatus,
                    },
                    ...buildSoundConfig(notifSound),
                    token: customerFcmToken,
                });
                console.log(`[Reservation] Sent ${newStatus} push notification to customer`);
            } catch (error) {
                console.error(`[Reservation] Error sending ${newStatus} push notification:`, error);
            }
        }

        // ── Persist status change to customer's notification history ──
        const userId = after.userId;
        console.log(`[Reservation] Notification persistence: userId=${userId}, status=${newStatus}`);
        if (userId) {
            try {
                await db.collection("users").doc(userId).collection("notifications").add({
                    title,
                    body,
                    type: "reservation_status",
                    reservationId: event.params.reservationId,
                    businessId: businessId,
                    businessName: businessName,
                    status: newStatus,
                    partySize: partySize,
                    reservationDate: after.reservationDate,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
                console.log(`[Reservation] Saved ${newStatus} notification for user ${userId}`);
            } catch (notifError) {
                console.error(`[Reservation] Error saving ${newStatus} notification:`, notifError);
            }
        } else {
            console.log(`[Reservation] No userId found in reservation document, skipping notification persistence`);
        }

        // ─── Send confirmation email with calendar links ───
        if (newStatus === "confirmed") {
            try {
                const userId = after.userId;
                if (!userId) {
                    console.log("[Reservation] No userId, skipping email");
                    return;
                }

                // Fetch customer email from users collection
                const userDoc = await db.collection("users").doc(userId).get();
                const customerEmail = userDoc.data()?.email;
                if (!customerEmail) {
                    console.log("[Reservation] No customer email found, skipping");
                    return;
                }

                // Build Google Calendar link
                const startDate = new Date(resDate);
                const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours
                const formatGCalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
                const gCalStart = formatGCalDate(startDate);
                const gCalEnd = formatGCalDate(endDate);
                const gCalTitle = encodeURIComponent(`Masa Rezervasyonu – ${businessName}`);
                const gCalDetails = encodeURIComponent(
                    `${partySize} kişilik masa rezervasyonu\n${tableCardNumbers.length > 0 ? `Masa Kart No: ${tableCardNumbers.join(", ")}` : ""}\nLOKMA Marketplace ile rezerve edildi`
                );
                const gCalLocation = encodeURIComponent(businessName);
                const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gCalTitle}&dates=${gCalStart}/${gCalEnd}&details=${gCalDetails}&location=${gCalLocation}`;

                // Build iCal (.ics) content
                const icsContent = [
                    "BEGIN:VCALENDAR",
                    "VERSION:2.0",
                    "PRODID:-//LOKMA Marketplace//Reservation//TR",
                    "BEGIN:VEVENT",
                    `DTSTART:${gCalStart}`,
                    `DTEND:${gCalEnd}`,
                    `SUMMARY:Masa Rezervasyonu – ${businessName}`,
                    `DESCRIPTION:${partySize} kişilik masa rezervasyonu${tableCardNumbers.length > 0 ? `. Masa Kart No: ${tableCardNumbers.join(", ")}` : ""}. LOKMA Marketplace ile rezerve edildi.`,
                    `LOCATION:${businessName}`,
                    "STATUS:CONFIRMED",
                    `ORGANIZER;CN=LOKMA:mailto:noreply@lokma.shop`,
                    "END:VEVENT",
                    "END:VCALENDAR",
                ].join("\r\n");

                const icsBase64 = Buffer.from(icsContent).toString("base64");

                // Table card display
                const tableCardHtml = tableCardNumbers.length > 0
                    ? `<div style="background: #1b3a1b; border: 1px solid #2E7D32; border-radius: 8px; padding: 12px; margin: 15px 0;">
                        <p style="color: #81C784; font-size: 12px; margin: 0 0 8px; font-weight: 600;">IHRE TISCHKARTENUMMER</p>
                        <div style="display: flex; gap: 8px;">
                            ${tableCardNumbers.map((n: number) => `<span style="background: #2E7D32; color: white; padding: 6px 14px; border-radius: 8px; font-size: 18px; font-weight: bold;">${n}</span>`).join("")}
                        </div>
                    </div>`
                    : "";

                // Send email via Resend
                const resend = new Resend(resendApiKey.value());
                await resend.emails.send({
                    from: "LOKMA Marketplace <noreply@lokma.shop>",
                    to: customerEmail,
                    subject: `✅ Ihre Reservierung ist bestätigt – ${businessName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background: #1a1a1a; color: #ffffff; padding: 30px;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <div style="background: #2E7D32; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
                                    <h1 style="margin: 0; color: white; font-size: 22px;">LOKMA</h1>
                                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">Ihre Reservierung ist bestätigt ✓</p>
                                </div>
                                <div style="background: #2a2a2a; padding: 25px; border-radius: 0 0 8px 8px;">
                                    <p style="color: #eee; margin: 0 0 20px; font-size: 15px;">Hallo <strong>${customerName}</strong>,</p>
                                    <p style="color: #ccc; margin: 0 0 20px;">Ihre Tischreservierung wurde bestätigt. Hier sind die Details:</p>
                                    
                                    <div style="background: #333; border-radius: 10px; padding: 18px; margin: 15px 0;">
                                        <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Restaurant</td>
                                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #fff;">${businessName}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Datum</td>
                                                <td style="padding: 6px 0; text-align: right; color: #fff;">${dateStr}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Uhrzeit</td>
                                                <td style="padding: 6px 0; text-align: right; color: #fff;">${timeStr}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Personenanzahl</td>
                                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #4CAF50; font-size: 16px;">${partySize} Personen</td>
                                            </tr>
                                        </table>
                                    </div>

                                    ${tableCardHtml}

                                    <p style="color: #aaa; font-size: 13px; margin: 20px 0 15px; text-align: center;">Reservierung zum Kalender hinzufügen:</p>
                                    
                                    <div style="text-align: center; margin: 15px 0;">
                                        <a href="${googleCalendarUrl}" target="_blank" style="display: inline-block; background: #4285F4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin: 0 6px 10px;">
                                            📅 Zu Google Kalender hinzufügen
                                        </a>
                                    </div>
                                    <p style="color: #777; font-size: 11px; text-align: center; margin: 10px 0 0;">Die iCal-Datei ist im Anhang — mit einem Klick zu Apple Kalender oder Outlook hinzufügen.</p>
                                    
                                    <div style="border-top: 1px solid #444; margin-top: 20px; padding-top: 15px;">
                                        <p style="color: #999; font-size: 12px; margin: 0;">Guten Appetit! 🍽️</p>
                                    </div>
                                </div>
                                <p style="color: #555; font-size: 11px; text-align: center; margin-top: 15px;">LOKMA Marketplace · noreply@lokma.shop</p>
                            </div>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: "reservierung.ics",
                            content: icsBase64,
                        },
                    ],
                });

                console.log(`[Reservation] Confirmation email sent to ${customerEmail}`);
            } catch (emailError) {
                console.error("[Reservation] Error sending confirmation email:", emailError);
            }
        }
    }
);

// =============================================================================
// TABLE RESERVATION — REMINDER NOTIFICATIONS (24h, 2h customer + 30min staff)
// Runs every 15 minutes, checks confirmed reservations and sends reminders
// =============================================================================

/**
 * Scheduled function to send reservation reminders.
 * - 24h before: customer reminder with cancel option
 * - 2h before: customer final reminder
 * - 30min before: STAFF reminder — "Masayı hazırladınız mı?"
 */
export const onScheduledReservationReminders = onSchedule(
    {
        schedule: "*/15 * * * *", // Every 15 minutes
        timeZone: "Europe/Berlin",
        memory: "256MiB",
        timeoutSeconds: 120,
    },
    async () => {
        console.log("[Reservation Reminder] Starting reminder check...");

        const now = new Date();
        let sent24h = 0;
        let sent2h = 0;
        let sentStaff30m = 0;
        let sentCustomer30m = 0;

        try {
            // Window for 24h reminders: reservations between 23-25 hours from now
            const reminder24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
            const reminder24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

            // Window for 2h reminders: reservations between 1.5-2.5 hours from now
            const reminder2hStart = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
            const reminder2hEnd = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

            // Window for 30min staff reminders: reservations between 20-40 minutes from now
            const reminder30mStart = new Date(now.getTime() + 20 * 60 * 1000);
            const reminder30mEnd = new Date(now.getTime() + 40 * 60 * 1000);

            // Get all businesses with reservations enabled
            const businessesSnapshot = await db.collection("businesses")
                .where("hasReservation", "==", true)
                .get();

            for (const businessDoc of businessesSnapshot.docs) {
                const businessId = businessDoc.id;
                const businessName = businessDoc.data().companyName || "Geschäft";

                // ─── 24h Customer Reminders ───
                const upcoming24h = await db.collection("businesses")
                    .doc(businessId)
                    .collection("reservations")
                    .where("status", "==", "confirmed")
                    .where("reminder24hSent", "==", false)
                    .where("reservationDate", ">=", admin.firestore.Timestamp.fromDate(reminder24hStart))
                    .where("reservationDate", "<=", admin.firestore.Timestamp.fromDate(reminder24hEnd))
                    .get();

                for (const resDoc of upcoming24h.docs) {
                    const res = resDoc.data();
                    const token = res.customerFcmToken || res.userFcmToken;
                    if (!token) continue;

                    const resDate = res.reservationDate?.toDate?.() ?? new Date();
                    const timeStr = resDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

                    const notifSound = await getActiveNotificationSound();
                    try {
                        await messaging.send({
                            notification: {
                                title: "🍽️ Ihre Reservierung morgen",
                                body: `${businessName} – ${timeStr} Uhr – ${res.partySize || 0} Personen. Zum Stornieren nutzen Sie bitte die App.`,
                            },
                            data: {
                                type: "reservation_reminder_24h",
                                reservationId: resDoc.id,
                                businessId: businessId,
                            },
                            ...buildSoundConfig(notifSound),
                            token: token,
                        });

                        await resDoc.ref.update({ reminder24hSent: true });
                        sent24h++;
                    } catch (e) {
                        console.error(`[Reservation Reminder] 24h send failed for ${resDoc.id}:`, e);
                    }
                }

                // ─── 2h Customer Reminders ───
                const upcoming2h = await db.collection("businesses")
                    .doc(businessId)
                    .collection("reservations")
                    .where("status", "==", "confirmed")
                    .where("reminder2hSent", "==", false)
                    .where("reservationDate", ">=", admin.firestore.Timestamp.fromDate(reminder2hStart))
                    .where("reservationDate", "<=", admin.firestore.Timestamp.fromDate(reminder2hEnd))
                    .get();

                for (const resDoc of upcoming2h.docs) {
                    const res = resDoc.data();
                    const token = res.customerFcmToken || res.userFcmToken;
                    if (!token) continue;

                    const resDate = res.reservationDate?.toDate?.() ?? new Date();
                    const timeStr = resDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

                    const notifSound2h = await getActiveNotificationSound();
                    try {
                        await messaging.send({
                            notification: {
                                title: "⏰ Ihre Reservierung in 2 Stunden!",
                                body: `${businessName} – ${timeStr} Uhr – ${res.partySize || 0} Personen. Guten Appetit!`,
                            },
                            data: {
                                type: "reservation_reminder_2h",
                                reservationId: resDoc.id,
                                businessId: businessId,
                            },
                            ...buildSoundConfig(notifSound2h),
                            token: token,
                        });

                        await resDoc.ref.update({ reminder2hSent: true });
                        sent2h++;
                    } catch (e) {
                        console.error(`[Reservation Reminder] 2h send failed for ${resDoc.id}:`, e);
                    }
                }

                // ─── 30-min STAFF Reminder — "Masayı hazırladınız mı?" ───
                const upcoming30m = await db.collection("businesses")
                    .doc(businessId)
                    .collection("reservations")
                    .where("status", "==", "confirmed")
                    .where("reservationDate", ">=", admin.firestore.Timestamp.fromDate(reminder30mStart))
                    .where("reservationDate", "<=", admin.firestore.Timestamp.fromDate(reminder30mEnd))
                    .get();

                // Filter in-memory for staffReminder30mSent (to avoid compound index)
                const unreminedStaff = upcoming30m.docs.filter(d => !d.data().staffReminder30mSent);

                if (unreminedStaff.length > 0) {
                    // Collect all staff tokens for this business
                    const staffTokens: string[] = [];
                    const processedIds = new Set<string>();

                    const collectTokens = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
                        if (processedIds.has(doc.id)) return;
                        processedIds.add(doc.id);
                        const data = doc.data();
                        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                            staffTokens.push(...data.fcmTokens);
                        } else if (data.fcmToken) {
                            staffTokens.push(data.fcmToken);
                        }
                    };

                    const adminsSnap = await db.collection("admins")
                        .where("assignedBusinesses", "array-contains", businessId)
                        .get();
                    adminsSnap.docs.forEach(collectTokens);

                    const bizIdSnap = await db.collection("admins")
                        .where("businessId", "==", businessId)
                        .get();
                    bizIdSnap.docs.forEach(collectTokens);

                    const butcherIdSnap = await db.collection("admins")
                        .where("butcherId", "==", businessId)
                        .get();
                    butcherIdSnap.docs.forEach(collectTokens);

                    const legacySnap = await db.collection("butcher_admins")
                        .where("butcherId", "==", businessId)
                        .get();
                    legacySnap.docs.forEach(collectTokens);

                    const uniqueTokens = [...new Set(staffTokens)];

                    for (const resDoc of unreminedStaff) {
                        const res = resDoc.data();
                        const resDate = res.reservationDate?.toDate?.() ?? new Date();
                        const timeStr = resDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                        const customerName = res.userName || res.customerName || "Kunde";
                        const partySize = res.partySize || 0;
                        const tableCards = res.tableCardNumbers || [];
                        const tableInfo = tableCards.length > 0 ? ` (Kart: ${tableCards.join(", ")})` : "";

                        const notifSound30 = await getActiveNotificationSound();
                        if (uniqueTokens.length > 0) {
                            try {
                                await messaging.sendEachForMulticast({
                                    notification: {
                                        title: "🔔 Anstehende Reservierung – 30 Minuten!",
                                        body: `${customerName} – ${partySize} Personen – ${timeStr} Uhr${tableInfo}. Ist der Tisch bereit?`,
                                    },
                                    data: {
                                        type: "reservation_staff_30m_reminder",
                                        reservationId: resDoc.id,
                                        businessId: businessId,
                                    },
                                    ...buildSoundConfig(notifSound30),
                                    tokens: uniqueTokens,
                                });
                                sentStaff30m++;
                            } catch (e) {
                                console.error(`[Reservation Reminder] Staff 30m send failed for ${resDoc.id}:`, e);
                            }
                        }

                        // Mark staff reminder as sent
                        await resDoc.ref.update({ staffReminder30mSent: true });

                        // ─── 30-min CUSTOMER Notification — Masa numarası + hatırlatma ───
                        if (!res.customerReminder30mSent) {
                            const customerToken = res.customerFcmToken || res.userFcmToken;
                            if (customerToken) {
                                const hasTable = tableCards.length > 0;
                                const customerTitle = hasTable
                                    ? `🪑 Ihr Tisch ist bereit! Tisch ${tableCards.join(", ")}`
                                    : "🍽️ Reservierungserinnerung – 30 Minuten!";
                                const customerBody = hasTable
                                    ? `${businessName} – ${timeStr} Uhr – ${partySize} Personen. Ihre Tischnummer: ${tableCards.join(", ")}. Guten Appetit!`
                                    : `${businessName} – ${timeStr} Uhr – ${partySize} Personen. Bis gleich!`;

                                try {
                                    await messaging.send({
                                        notification: {
                                            title: customerTitle,
                                            body: customerBody,
                                        },
                                        data: {
                                            type: "reservation_customer_30m_table",
                                            reservationId: resDoc.id,
                                            businessId: businessId,
                                        },
                                        ...buildSoundConfig(notifSound30),
                                        token: customerToken,
                                    });
                                    sentCustomer30m++;
                                    console.log(`[Reservation Reminder] Sent 30m customer notification for ${resDoc.id}`);
                                } catch (e) {
                                    console.error(`[Reservation Reminder] Customer 30m send failed for ${resDoc.id}:`, e);
                                }

                                await resDoc.ref.update({ customerReminder30mSent: true });
                            }
                        }
                    }
                }
            }

            console.log("========================================");
            console.log("[Reservation Reminder] COMPLETED");
            console.log(`  24h customer reminders: ${sent24h}`);
            console.log(`  2h customer reminders: ${sent2h}`);
            console.log(`  30m staff reminders: ${sentStaff30m}`);
            console.log(`  30m customer table notifications: ${sentCustomer30m}`);
            console.log("========================================");

        } catch (error) {
            console.error("[Reservation Reminder] Critical error:", error);
            throw error;
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IoT Gateway — Alexa + WLED + Hue notification service
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const iotApiKey = defineSecret("IOT_GATEWAY_API_KEY");

export const iotGateway = onRequest(
    {
        region: "europe-west1",
        memory: "1GiB",
        timeoutSeconds: 300,
        minInstances: 0,
        maxInstances: 5,
        secrets: [iotApiKey],
    },
    (req, res) => {
        // API Key auth (skip for health check)
        if (req.path !== "/health") {
            const apiKey = req.headers["x-api-key"] || req.query.apiKey;
            if (apiKey !== iotApiKey.value()) {
                res.status(401).json({ error: "Unauthorized — invalid API key" });
                return;
            }
        }
        iotApp(req, res);
    }
);

// =============================================================================
// SHIFT MANAGEMENT: Orphan Table Detection on Shift End
// =============================================================================

/**
 * When a staff member ends their shift (isOnShift: true → false),
 * detect orphan tables and notify business admins + remaining active staff.
 */
export const onShiftEnd = onDocumentUpdated(
    "admins/{adminId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();
        if (!before || !after) return;

        // Only trigger when isOnShift changes from true to false
        if (before.isOnShift !== true || after.isOnShift !== false) return;

        const staffName = after.displayName || after.email || "Personel";
        const businessId = before.shiftBusinessId || before.businessId;
        if (!businessId) {
            console.log(`[Shift End] No businessId for ${staffName}, skipping orphan check`);
            return;
        }

        const endedTables: string[] = before.shiftAssignedTables || [];
        if (endedTables.length === 0) {
            console.log(`[Shift End] ${staffName} had no assigned tables, skipping orphan check`);
            return;
        }

        console.log(`[Shift End] ${staffName} ended shift at business ${businessId}, had tables: ${endedTables.join(", ")}`);

        try {
            // Find all other on-shift staff at the same business
            const activeStaffSnapshot = await db.collection("admins")
                .where("isOnShift", "==", true)
                .where("shiftBusinessId", "==", businessId)
                .get();

            // Also check via assignedBusinesses
            const activeStaffSnapshot2 = await db.collection("admins")
                .where("isOnShift", "==", true)
                .where("assignedBusinesses", "array-contains", businessId)
                .get();

            // Merge and deduplicate
            const processedIds = new Set<string>();
            const coveredTables = new Set<string>();
            const activeStaffTokens: string[] = [];

            const processActiveStaff = (doc: admin.firestore.QueryDocumentSnapshot) => {
                if (processedIds.has(doc.id)) return;
                if (doc.id === event.params.adminId) return; // Skip the person who just ended shift
                processedIds.add(doc.id);

                const data = doc.data();
                if (data.shiftStatus === "paused") return; // Don't count paused staff

                // Collect covered tables
                const tables: string[] = data.shiftAssignedTables || [];
                tables.forEach(t => coveredTables.add(t));

                // Collect FCM tokens for notification
                if (data.fcmToken) activeStaffTokens.push(data.fcmToken);
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    activeStaffTokens.push(...data.fcmTokens);
                }
            };

            activeStaffSnapshot.docs.forEach(processActiveStaff);
            activeStaffSnapshot2.docs.forEach(processActiveStaff);

            // Detect orphan tables
            const orphanTables = endedTables.filter(t => !coveredTables.has(t));

            if (orphanTables.length === 0) {
                console.log(`[Shift End] All tables covered. No orphan tables after ${staffName}'s shift.`);
                return;
            }

            console.log(`[Shift End] ⚠️ Orphan tables detected: ${orphanTables.join(", ")} — notifying admins`);

            // Get business admin tokens (business owners + super admins)
            const adminTokens: string[] = [...activeStaffTokens];
            const adminProcessed = new Set<string>([...processedIds]);

            // Business admins
            const businessAdmins = await db.collection("admins")
                .where("businessId", "==", businessId)
                .where("adminType", "in", ["admin", "super"])
                .get();

            businessAdmins.docs.forEach(doc => {
                if (adminProcessed.has(doc.id)) return;
                adminProcessed.add(doc.id);
                const data = doc.data();
                if (data.fcmToken) adminTokens.push(data.fcmToken);
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    adminTokens.push(...data.fcmTokens);
                }
                if (data.webFcmTokens && Array.isArray(data.webFcmTokens)) {
                    adminTokens.push(...data.webFcmTokens);
                }
            });

            if (adminTokens.length > 0) {
                const notifSoundOrphan = await getActiveNotificationSound();
                const orphanMessage = {
                    notification: {
                        title: "⚠️ Sahipsiz Masa Uyarısı",
                        body: `${staffName} vardiyasını bitirdi. Masa ${orphanTables.join(", ")} şu an atanmamış!`,
                    },
                    data: {
                        type: "orphan_tables",
                        businessId: businessId,
                        tables: orphanTables.join(","),
                    },
                    ...buildSoundConfig(notifSoundOrphan),
                    tokens: adminTokens,
                };
                const response = await messaging.sendEachForMulticast(orphanMessage);
                console.log(`[Shift End] Orphan alert sent to ${response.successCount}/${adminTokens.length} recipients`);
            } else {
                console.log(`[Shift End] No admin tokens to notify about orphan tables`);
            }
        } catch (err) {
            console.error(`[Shift End] Error during orphan table check:`, err);
        }
    }
);

/**
 * Pre-Order Reminder: Runs every 5 min, sends push 20 min before pickup time
 */
export const preOrderReminder = onSchedule(
    {
        schedule: "*/5 * * * *", // Every 5 minutes
        timeZone: "Europe/Berlin",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async () => {
        const now = new Date();
        let sentCount = 0;

        try {
            // Find scheduled_notifications where sendAt <= now and not yet sent
            const pendingReminders = await db.collection("scheduled_notifications")
                .where("type", "==", "pre_order_reminder")
                .where("sent", "==", false)
                .where("sendAt", "<=", admin.firestore.Timestamp.fromDate(now))
                .limit(30)
                .get();

            if (pendingReminders.empty) return;
            console.log(`[Pre-Order Reminder] Found ${pendingReminders.size} pending reminders`);

            for (const reminderDoc of pendingReminders.docs) {
                const reminder = reminderDoc.data();
                const orderId = reminder.orderId;
                const businessId = reminder.businessId;

                // Check if order is still active (not cancelled/rejected)
                const orderDoc = await db.collection("meat_orders").doc(orderId).get();
                if (!orderDoc.exists) {
                    await reminderDoc.ref.update({ sent: true, skipped: true, reason: "order_not_found" });
                    continue;
                }
                const orderStatus = orderDoc.data()?.status;
                if (["cancelled", "rejected", "delivered", "completed"].includes(orderStatus)) {
                    await reminderDoc.ref.update({ sent: true, skipped: true, reason: `order_${orderStatus}` });
                    continue;
                }

                // Collect FCM tokens for the business
                const allTokens: string[] = [];

                // Mobile tokens from butcher_admins
                try {
                    const butcherDoc = await db.collection("butcher_admins").doc(businessId).get();
                    const mobileTokens = butcherDoc.data()?.fcmTokens || [];
                    allTokens.push(...mobileTokens);
                } catch (e) { /* ignore */ }

                // Web tokens from admins
                try {
                    const adminsSnapshot = await db.collection("admins")
                        .where("businessId", "==", businessId)
                        .get();
                    adminsSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.webFcmTokens && Array.isArray(data.webFcmTokens)) {
                            allTokens.push(...data.webFcmTokens);
                        }
                        if (data.fcmToken) allTokens.push(data.fcmToken);
                        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                            allTokens.push(...data.fcmTokens);
                        }
                    });
                } catch (e) { /* ignore */ }

                if (allTokens.length > 0) {
                    const orderNum = reminder.orderNumber ? `#${reminder.orderNumber}` : "";
                    const pickupStr = reminder.pickupTimeStr || "";
                    const notifSoundPre = await getActiveNotificationSound();
                    const message = {
                        notification: {
                            title: `⏰ Vorbestellungs-Erinnerung! ${orderNum}`,
                            body: `${reminder.customerName || "Kunde"} - ${(reminder.totalAmount || 0).toFixed(2)}€ — ${pickupStr}`,
                        },
                        data: {
                            type: "pre_order_reminder",
                            orderId: orderId,
                            businessId: businessId,
                        },
                        ...buildSoundConfig(notifSoundPre),
                        tokens: allTokens,
                    };

                    const response = await messaging.sendEachForMulticast(message);
                    console.log(`[Pre-Order Reminder] Sent for order ${orderNum} to ${response.successCount}/${allTokens.length} devices`);
                    sentCount++;
                }

                await reminderDoc.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            if (sentCount > 0) {
                console.log(`[Pre-Order Reminder] Total: ${sentCount} reminders sent`);
            }
        } catch (error) {
            console.error("[Pre-Order Reminder] Error:", error);
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: Test Data Cleanup
// Deletes ALL users (Firebase Auth + Firestore) except the protected Super Admin
// Also deletes all test orders, ratings, and commission records
// Protected accounts: hardcoded list of real accounts that must never be deleted
// ─────────────────────────────────────────────────────────────────────────────
export const cleanupTestData = onRequest(
    { secrets: [], cors: true, timeoutSeconds: 300, memory: "512MiB" },
    async (req, res) => {
        // Only allow POST
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }

        // Verify caller is Super Admin via Firebase Auth token
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        let callerUid: string;
        try {
            const token = authHeader.split("Bearer ")[1];
            const decoded = await admin.auth().verifyIdToken(token);
            callerUid = decoded.uid;

            // Verify the caller is a super admin in Firestore
            const callerDoc = await db.collection("admins").doc(callerUid).get();
            if (!callerDoc.exists || callerDoc.data()?.adminType !== "super") {
                res.status(403).json({ error: "Forbidden: Super Admin only" });
                return;
            }
        } catch (e) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }

        // ── Protected accounts — NEVER delete these ────────────────────────
        const PROTECTED_EMAILS = new Set([
            "metin.oez@gmail.com",
        ]);

        const stats: Record<string, any> = {
            authDeleted: 0,
            usersDeleted: 0,
            adminsDeleted: 0,
            ordersDeleted: 0,
            ratingsDeleted: 0,
            commissionRecordsDeleted: 0,
            notificationsDeleted: 0,
            scheduledNotificationsDeleted: 0,
            sponsoredConversionsDeleted: 0,
            referralsDeleted: 0,
            groupOrdersDeleted: 0,
            reservationsDeleted: 0,
            businessesReset: 0,
            errors: [] as string[],
        };

        try {
            console.log(`[Cleanup] Started by Super Admin: ${callerUid}`);

            // ── Step 1: List all Firebase Auth users ──────────────────────
            const authUsersToDelete: string[] = [];
            let pageToken: string | undefined;

            do {
                const result = await admin.auth().listUsers(1000, pageToken);
                for (const user of result.users) {
                    // Skip protected accounts
                    if (user.email && PROTECTED_EMAILS.has(user.email)) {
                        console.log(`[Cleanup] SKIPPING protected: ${user.email}`);
                        continue;
                    }
                    // Skip the caller themselves (extra safety)
                    if (user.uid === callerUid) continue;

                    authUsersToDelete.push(user.uid);
                }
                pageToken = result.pageToken;
            } while (pageToken);

            console.log(`[Cleanup] Auth users to delete: ${authUsersToDelete.length}`);

            // ── Step 2: Delete sub-collections for each user (notifications) ─
            for (const uid of authUsersToDelete) {
                try {
                    const notifSnap = await db.collection("users").doc(uid)
                        .collection("notifications").limit(500).get();
                    const batch = db.batch();
                    notifSnap.docs.forEach(d => batch.delete(d.ref));
                    if (!notifSnap.empty) {
                        await batch.commit();
                        stats.notificationsDeleted += notifSnap.size;
                    }
                } catch (e: any) {
                    stats.errors.push(`notifications/${uid}: ${e.message}`);
                }
            }

            // ── Step 3: Delete Firestore users documents ─────────────────
            const uidSet = new Set(authUsersToDelete);
            const usersSnap = await db.collection("users").limit(500).get();
            const usersBatch = db.batch();
            for (const doc of usersSnap.docs) {
                if (uidSet.has(doc.id)) {
                    usersBatch.delete(doc.ref);
                    stats.usersDeleted++;
                }
            }
            await usersBatch.commit();

            // ── Step 4: Delete admins (non-super, excluding caller) ───────
            const adminsSnap = await db.collection("admins").get();
            const adminsBatch = db.batch();
            for (const doc of adminsSnap.docs) {
                if (doc.id === callerUid) continue;
                const data = doc.data();
                // Never delete super admins
                if (data.adminType === "super") continue;
                adminsBatch.delete(doc.ref);
                stats.adminsDeleted++;
            }
            await adminsBatch.commit();

            // ── Step 5: Delete Firebase Auth users in batches of 1000 ─────
            const BATCH_SIZE = 1000;
            for (let i = 0; i < authUsersToDelete.length; i += BATCH_SIZE) {
                const chunk = authUsersToDelete.slice(i, i + BATCH_SIZE);
                try {
                    const result = await admin.auth().deleteUsers(chunk);
                    stats.authDeleted += result.successCount;
                    if (result.errors.length > 0) {
                        result.errors.forEach(e => {
                            stats.errors.push(`auth/${chunk[e.index]}: ${e.error.message}`);
                        });
                    }
                } catch (e: any) {
                    stats.errors.push(`auth batch: ${e.message}`);
                }
            }

            // ── Step 6: Delete all meat_orders ────────────────────────────
            let hasMoreOrders = true;
            while (hasMoreOrders) {
                const ordersSnap = await db.collection("meat_orders").limit(400).get();
                if (ordersSnap.empty) { hasMoreOrders = false; break; }
                const batch = db.batch();
                ordersSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.ordersDeleted += ordersSnap.size;
                if (ordersSnap.size < 400) hasMoreOrders = false;
            }

            // ── Step 7: Delete all ratings ────────────────────────────────
            const ratingsSnap = await db.collection("ratings").limit(500).get();
            if (!ratingsSnap.empty) {
                const batch = db.batch();
                ratingsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.ratingsDeleted = ratingsSnap.size;
            }

            // ── Step 8: Delete all commission_records ─────────────────────
            const commSnap = await db.collection("commission_records").limit(500).get();
            if (!commSnap.empty) {
                const batch = db.batch();
                commSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.commissionRecordsDeleted = commSnap.size;
            }

            // ── Step 9: Delete scheduled_notifications ────────────────────
            // These reference deleted orders → would cause errors if left behind
            const schedNotifSnap = await db.collection("scheduled_notifications").limit(500).get();
            if (!schedNotifSnap.empty) {
                const batch = db.batch();
                schedNotifSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.scheduledNotificationsDeleted = schedNotifSnap.size;
                console.log(`[Cleanup] scheduled_notifications deleted: ${schedNotifSnap.size}`);
            }

            // ── Step 10: Delete sponsored_conversions ─────────────────────
            // These reference deleted orderIds → orphan records
            const sponsoredSnap = await db.collection("sponsored_conversions").limit(500).get();
            if (!sponsoredSnap.empty) {
                const batch = db.batch();
                sponsoredSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.sponsoredConversionsDeleted = sponsoredSnap.size;
                console.log(`[Cleanup] sponsored_conversions deleted: ${sponsoredSnap.size}`);
            }

            // ── Step 11: Delete referrals ─────────────────────────────────
            // These contain deleted user UIDs as referrerId / referredId
            const referralsSnap = await db.collection("referrals").limit(500).get();
            if (!referralsSnap.empty) {
                const batch = db.batch();
                referralsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.referralsDeleted = referralsSnap.size;
                console.log(`[Cleanup] referrals deleted: ${referralsSnap.size}`);
            }

            // ── Step 12: Delete group_orders ──────────────────────────────
            // These contain deleted user UIDs as participants
            const groupOrdersSnap = await db.collection("group_orders").limit(500).get();
            if (!groupOrdersSnap.empty) {
                const batch = db.batch();
                groupOrdersSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.groupOrdersDeleted = groupOrdersSnap.size;
                console.log(`[Cleanup] group_orders deleted: ${groupOrdersSnap.size}`);
            }

            // ── Step 13: Reset usage counters in all businesses ───────────
            // Test orders inflated these counters — reset them so billing starts fresh
            const businessesSnap = await db.collection("businesses").limit(500).get();
            if (!businessesSnap.empty) {
                const batch = db.batch();
                businessesSnap.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        usage: {},           // wipe all monthly usage counters
                        accountBalance: 0,   // clear any accumulated cash balance
                    });
                });
                await batch.commit();
                stats.businessesReset = businessesSnap.size;
                console.log(`[Cleanup] Businesses usage reset: ${businessesSnap.size}`);
            }

            // ── Step 14: Clean dead FCM tokens from butcher_admins ────────
            const butcherAdminsSnap = await db.collection("butcher_admins").limit(500).get();
            if (!butcherAdminsSnap.empty) {
                const batch = db.batch();
                butcherAdminsSnap.docs.forEach(doc => {
                    batch.update(doc.ref, { fcmTokens: [], webFcmTokens: [] });
                });
                await batch.commit();
                console.log(`[Cleanup] Cleared FCM tokens from ${butcherAdminsSnap.size} butcher_admins`);
            }

            // ── Step 15: Delete reservations ──────────────────────────────
            const reservationsSnap = await db.collection("reservations").limit(500).get();
            if (!reservationsSnap.empty) {
                const batch = db.batch();
                reservationsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                stats.reservationsDeleted = reservationsSnap.size;
                console.log(`[Cleanup] reservations deleted: ${reservationsSnap.size}`);
            }

            // ── Step 16: Delete table_sessions ────────────────────────────
            const tableSessionsSnap = await db.collection("table_sessions").limit(500).get();
            if (!tableSessionsSnap.empty) {
                const batch = db.batch();
                tableSessionsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`[Cleanup] table_sessions deleted: ${tableSessionsSnap.size}`);
            }

            // ── Step 17: Delete courier_locations ─────────────────────────
            const courierLocsSnap = await db.collection("courier_locations").limit(500).get();
            if (!courierLocsSnap.empty) {
                const batch = db.batch();
                courierLocsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`[Cleanup] courier_locations deleted: ${courierLocsSnap.size}`);
            }

            // ── Step 18: Delete promo_usages + coupon_usages ──────────────
            for (const colName of ["promo_usages", "coupon_usages", "promotion_usages"]) {
                const snap = await db.collection(colName).limit(500).get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    console.log(`[Cleanup] ${colName} deleted: ${snap.size}`);
                }
            }

            // ── Step 19: Delete delivery_proofs ───────────────────────────
            const proofsSnap = await db.collection("delivery_proofs").limit(500).get();
            if (!proofsSnap.empty) {
                const batch = db.batch();
                proofsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`[Cleanup] delivery_proofs deleted: ${proofsSnap.size}`);
            }

            // ── Step 20: Delete abandoned carts ───────────────────────────
            for (const colName of ["carts", "kermes_carts"]) {
                const snap = await db.collection(colName).limit(500).get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    console.log(`[Cleanup] ${colName} deleted: ${snap.size}`);
                }
            }

            // ── Step 21: Reset averageRating on all businesses ────────────
            // Test ratings skewed the averages — reset to null so next real rating starts fresh
            if (!businessesSnap.empty) {
                const batch = db.batch();
                businessesSnap.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        averageRating: admin.firestore.FieldValue.delete(),
                        totalRatings: admin.firestore.FieldValue.delete(),
                        ratingCount: admin.firestore.FieldValue.delete(),
                    });
                });
                await batch.commit();
                console.log(`[Cleanup] Rating averages reset on ${businessesSnap.size} businesses`);
            }


            console.log("[Cleanup] Complete:", stats);
            res.status(200).json({
                success: true,
                message: "Test data cleaned up successfully",
                stats,
            });

        } catch (error: any) {
            console.error("[Cleanup] Fatal error:", error);
            res.status(500).json({ error: error.message, stats });
        }
    }
);

/**
 * When a new chat message is created, send a push notification to the recipient
 */
export const onNewChatMessage = onDocumentCreated(
    "meat_orders/{orderId}/messages/{messageId}",
    async (event) => {
        const message = event.data?.data();
        if (!message) return;

        const orderId = event.params.orderId;
        const senderRole = message.senderRole || "customer";
        
        // Fetch order to get tokens and languages
        const orderSnap = await db.collection("meat_orders").doc(orderId).get();
        if (!orderSnap.exists) return;
        const order = orderSnap.data()!;

        const notifSound = await getActiveNotificationSound();

        try {
            if (senderRole === "courier" || senderRole === "business") {
                // Send push to customer
                const customerId = order.userId || order.customerId;
                let lang = "de";
                if (customerId) {
                    lang = await getUserLanguage(customerId);
                }

                const trans = await getPushTranslations(lang);
                
                // Get customer tokens
                const customerFcmTokens: string[] = [];
                if (order.fcmToken) customerFcmTokens.push(order.fcmToken);
                if (order.customerFcmToken) customerFcmTokens.push(order.customerFcmToken);
                
                if (customerId) {
                    const userDoc = await db.collection("users").doc(customerId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data()!;
                        if (userData.fcmToken && !customerFcmTokens.includes(userData.fcmToken)) {
                            customerFcmTokens.push(userData.fcmToken);
                        }
                        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                            userData.fcmTokens.forEach((t: string) => {
                                if (t && !customerFcmTokens.includes(t)) customerFcmTokens.push(t);
                            });
                        }
                    }
                }

                if (customerFcmTokens.length > 0) {
                    const title = trans.newChatMessageTitle || "💬 Neue Nachricht vom Kurier";
                    const body = message.text;

                    const pushData = {
                        notification: { title, body },
                        data: {
                            type: "chat_message",
                            orderId: orderId,
                        },
                        ...buildSoundConfig(notifSound),
                        tokens: customerFcmTokens,
                    };

                    await messaging.sendEachForMulticast(pushData);
                    console.log(`[Chat Push] Sent to customer devices for order ${orderId}`);
                }
            } else if (senderRole === "customer") {
                // Send push to courier
                const courierId = order.courierId || order.assignedCourierId;
                if (!courierId) {
                    console.log(`[Chat Push] No courier assigned for order ${orderId}, skipping courier notification`);
                    return;
                }

                const courierDoc = await db.collection("admins").doc(courierId).get();
                if (!courierDoc.exists) return;
                
                const courierData = courierDoc.data()!;
                const courierTokens: string[] = [];
                if (courierData.fcmToken) courierTokens.push(courierData.fcmToken);
                if (courierData.fcmTokens && Array.isArray(courierData.fcmTokens)) {
                    courierTokens.push(...courierData.fcmTokens);
                }

                if (courierTokens.length > 0) {
                    // Translate for courier
                    const courierLang = courierData.language || "tr";
                    const trans = await getPushTranslations(courierLang);
                    
                    const title = trans.newChatMessageCourierTitle || "💬 Yeni Müşteri Mesajı";
                    const customerName = order.customerName || order.userName || "Müşteri";
                    const body = `${customerName}: ${message.text}`;

                    const pushData = {
                        notification: { title, body },
                        data: {
                            type: "chat_message",
                            orderId: orderId,
                        },
                        ...buildSoundConfig(notifSound),
                        tokens: courierTokens,
                    };

                    await messaging.sendEachForMulticast(pushData);
                    console.log(`[Chat Push] Sent to courier devices for order ${orderId}`);
                }
            }
        } catch (error) {
            console.error("[Chat Push] Error sending chat notification:", error);
        }
    }
);
