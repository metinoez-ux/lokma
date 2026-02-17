import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { Resend } from "resend";
import { generateInvoicePDF } from "./invoicePdf";
import { iotApp } from "./iot-gateway";

// Define secrets for secure key management
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");

admin.initializeApp();

const messaging = admin.messaging();
const db = admin.firestore();

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
        const orderNumber = rawOrderNum ? `Sipariş #${rawOrderNum}` : "Yeni Sipariş";
        const totalAmount = order.totalAmount || 0;
        const customerName = order.customerName || "Müşteri";

        // Get butcher admin FCM tokens (mobile)
        try {
            const butcherDoc = await admin.firestore()
                .collection("butcher_admins")
                .doc(butcherId)
                .get();

            const butcherData = butcherDoc.data();
            const fcmTokens: string[] = butcherData?.fcmTokens || [];

            if (fcmTokens.length > 0) {
                const message = {
                    notification: {
                        title: "🔔 Yeni Sipariş!",
                        body: `${orderNumber} - ${customerName} - ${totalAmount.toFixed(2)}€`,
                    },
                    data: {
                        type: "new_order",
                        orderId: event.params.orderId,
                        orderNumber: orderNumber,
                    },
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
                const webMessage = {
                    notification: {
                        title: "🔔 Yeni Sipariş!",
                        body: `${orderNumber} - ${customerName} - ${totalAmount.toFixed(2)}€`,
                    },
                    data: {
                        type: "new_order",
                        orderId: event.params.orderId,
                        orderNumber: orderNumber,
                    },
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
        const businessName = businessData.companyName || businessData.name || businessData.businessName || businessData.brand || orderData.butcherName || "İşletme";
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

        // Support both field names for customer FCM token (mobile uses 'fcmToken')
        const customerFcmToken = after.customerFcmToken || after.fcmToken;
        const hasCustomerToken = !!customerFcmToken;
        if (!hasCustomerToken) {
            console.log("No customer FCM token found, will skip customer notification but continue for driver notifications");
        }


        // UOIP: Fallback to First-6-Digit standard from doc ID if orderNumber not on document
        const rawOrderNumber = after.orderNumber || event.params.orderId.substring(0, 6).toUpperCase();
        const orderNumber = rawOrderNumber ? `Sipariş #${rawOrderNumber}` : "Sipariş";
        const orderTag = rawOrderNumber ? ` (#${rawOrderNumber})` : "";
        const totalAmount = after.totalAmount || 0;
        const businessName = after.butcherName || after.businessName || "İşletme";
        const newStatus = after.status;

        let title = "";
        let body = "";

        switch (newStatus) {
            case "preparing":
                title = `👨‍🍳 Siparişiniz Hazırlanıyor${orderTag}`;
                body = `${orderNumber} - ${businessName} siparişinizi hazırlıyor`;
                break;
            case "ready":
                // Check if delivery order or pickup
                const isDeliveryOrder = after.orderType === "delivery" || after.deliveryType === "delivery" || after.deliveryMethod === "delivery";

                if (isDeliveryOrder) {
                    // Delivery order: ready but waiting for courier to claim
                    title = `📦 Siparişiniz Hazır!${orderTag}`;
                    body = `${orderNumber} - Kuryenin alması bekleniyor. Toplam: ${totalAmount.toFixed(2)}€`;
                } else {
                    // Check if dine-in
                    const isDineInReady = after.orderType === "dine-in" || after.orderType === "masa" || after.tableNumber != null;
                    if (isDineInReady && after.tableNumber != null) {
                        title = `✅ Siparişiniz Hazır!${orderTag}`;
                        body = `${orderNumber} - Masa ${after.tableNumber}: Siparişiniz hazır, masanıza servis edilecek!`;
                    } else {
                        // Pickup order: customer should come pick it up
                        title = `✅ Siparişiniz Hazır!${orderTag}`;
                        body = `${orderNumber} - Alabilirsiniz! Toplam: ${totalAmount.toFixed(2)}€`;
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
                                    title: "🚚 Teslimat Bekliyor!",
                                    body: `${orderNumber} - ${deliveryAddress.substring(0, 50)}${deliveryAddress.length > 50 ? "..." : ""}`,
                                },
                                data: {
                                    type: "delivery_ready",
                                    orderId: event.params.orderId,
                                    businessId: butcherId,
                                },
                                tokens: staffTokens,
                            };
                            const response = await messaging.sendEachForMulticast(staffMessage);
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
                                    title: `🍽️ Masa ${tableNum} Siparişi Hazır!`,
                                    body: `${orderNumber} - Masaya servis edilmeyi bekliyor`,
                                },
                                data: {
                                    type: "table_order_ready",
                                    orderId: event.params.orderId,
                                    businessId: butcherId,
                                    tableNumber: String(tableNum),
                                },
                                tokens: waiterTokens,
                            };
                            const response = await messaging.sendEachForMulticast(waiterMessage);
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
                const servedByName = after.servedByName || "Garson";
                if (isDineInServed && after.tableNumber != null) {
                    title = `🍽️ Afiyet Olsun!${orderTag}`;
                    body = `${orderNumber} - Siparişiniz masanıza servis edildi. Afiyet olsun! 😊`;
                } else {
                    title = `🍽️ Siparişiniz Servis Edildi${orderTag}`;
                    body = `${orderNumber} - ${servedByName} tarafından servis edildi. Afiyet olsun!`;
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
                const courierName = after.courierName || "Kurye";
                title = `🚚 Kurye Yola Çıktı!${orderTag}`;
                body = `${orderNumber} - ${courierName} siparişinizi getiriyor`;
                break;
            case "delivered":
                title = `🎉 Siparişiniz Teslim Edildi${orderTag}`;
                body = `${orderNumber} - Afiyet olsun!`;
                // Schedule feedback request for 24 hours later
                const feedbackSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                await db.collection("meat_orders").doc(event.params.orderId).update({
                    feedbackSendAt: admin.firestore.Timestamp.fromDate(feedbackSendAt),
                    feedbackSent: false,
                });
                console.log(`[Feedback] Scheduled feedback request for ${orderNumber} at ${feedbackSendAt.toISOString()}`);
                // Create commission record on delivery
                await createCommissionRecord(event.params.orderId, after);
                break;
            case "completed":
                title = `🎉 Sipariş Tamamlandı${orderTag}`;
                body = `${orderNumber} - Afiyet olsun!`;
                // Also create commission record for completed orders (if not already created at delivered)
                await createCommissionRecord(event.params.orderId, after);
                break;
            case "rejected":
                const reason = after.rejectionReason || "İstediğiniz ürün şu an mevcut değil";
                const butcherPhone = after.butcherPhone || "";
                title = `❌ Sipariş Kabul Edilemedi${orderTag}`;
                body = `${orderNumber} - ${reason}${butcherPhone ? ` Tel: ${butcherPhone}` : ""}`;
                break;
            case "cancelled":
                const cancellationReason = after.cancellationReason || "İşletme tarafından iptal edildi";
                const paymentStatus = after.paymentStatus;
                const paymentMethod = after.paymentMethod;

                title = `❌ Sipariş İptal Edildi${orderTag}`;

                // Build message with reason and refund info
                let cancelMsg = `${orderNumber} - Sebep: ${cancellationReason}`;

                // If payment was made (paid/completed), mention refund
                if (paymentStatus === "paid" || paymentStatus === "completed") {
                    if (paymentMethod === "card" || paymentMethod === "stripe") {
                        cancelMsg += ". 💳 Ödemeniz kartınıza otomatik olarak iade edilecektir.";
                    } else {
                        cancelMsg += ". Ödemeniz iade edilecektir.";
                    }
                }

                // Add apology
                cancelMsg += " Verdiğimiz rahatsızlık için özür dileriz. 🙏";
                body = cancelMsg;
                break;
            default:
                return; // Don't send notification for other statuses
        }

        // Only send customer notification if we have a token
        if (hasCustomerToken && title && body) {
            try {
                await messaging.send({
                    notification: { title, body },
                    data: {
                        type: "order_status",
                        orderId: event.params.orderId,
                        status: newStatus,
                    },
                    token: customerFcmToken,
                });
                console.log(`Sent ${newStatus} notification to customer`);
            } catch (error) {
                console.error("Error sending notification to customer:", error);
            }
        } else if (!hasCustomerToken) {
            console.log(`Skipped customer notification for ${newStatus} - no FCM token`);
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
            currency: "eur",
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
 * Monthly Subscription Invoicing
 * Creates invoices for all active businesses with paid subscriptions
 */
export const onScheduledMonthlyInvoicing = onSchedule(
    {
        schedule: "0 2 1 * *", // 1st of every month at 02:00
        timeZone: "Europe/Berlin",
        memory: "1GiB",
        timeoutSeconds: 540, // 9 minutes
        secrets: [stripeSecretKey, resendApiKey],
    },
    async () => {
        console.log("[Monthly Invoicing] Starting monthly invoice generation...");

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
            subscriptionGenerated: 0,
            subscriptionFailed: 0,
            commissionGenerated: 0,
            commissionFailed: 0,
            totalAmount: 0,
            emailsSent: 0,
            emailsFailed: 0,
        };

        // Initialize Resend for email delivery
        const resend = new Resend(resendApiKey.value());

        // Helper: Generate PDF and send invoice email
        const sendInvoiceEmail = async (invoiceData: any, recipientEmail: string) => {
            try {
                const pdfBuffer = await generateInvoicePDF(invoiceData);
                const pdfBase64 = pdfBuffer.toString("base64");

                await resend.emails.send({
                    from: "LOKMA Marketplace <noreply@lokma.shop>",
                    to: recipientEmail,
                    subject: `Rechnung ${invoiceData.invoiceNumber} – ${invoiceData.period}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background: #1a1a1a; color: #ffffff; padding: 30px;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <div style="background: #E65100; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                                    <h1 style="margin: 0; color: white; font-size: 24px;">LOKMA</h1>
                                    <p style="margin: 5px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Rechnung</p>
                                </div>
                                <div style="background: #2a2a2a; padding: 25px; border-radius: 0 0 8px 8px;">
                                    <p style="color: #ccc; margin: 0 0 15px;">Sehr geehrte/r Geschäftspartner/in,</p>
                                    <p style="color: #ccc; margin: 0 0 20px;">anbei erhalten Sie Ihre Rechnung <strong style="color: #E65100;">${invoiceData.invoiceNumber}</strong> für den Zeitraum <strong>${invoiceData.period}</strong>.</p>
                                    <div style="background: #333; border-radius: 8px; padding: 15px; margin: 15px 0;">
                                        <table style="width: 100%; color: #ccc; font-size: 14px;">
                                            <tr><td>Rechnungsbetrag:</td><td style="text-align: right; font-weight: bold; color: #E65100; font-size: 18px;">€${invoiceData.grandTotal.toFixed(2)}</td></tr>
                                            <tr><td style="color: #999;">davon USt. ${invoiceData.taxRate}%:</td><td style="text-align: right; color: #999;">€${invoiceData.taxAmount.toFixed(2)}</td></tr>
                                            <tr><td style="color: #999;">Fällig am:</td><td style="text-align: right; color: #ff9800;">${invoiceData.dueDate instanceof Date ? invoiceData.dueDate.toLocaleDateString("de-DE") : "14 Tage"}</td></tr>
                                        </table>
                                    </div>
                                    <p style="color: #999; font-size: 12px; margin: 20px 0 0;">Die Rechnung finden Sie als PDF im Anhang.</p>
                                </div>
                                <p style="color: #666; font-size: 11px; text-align: center; margin-top: 15px;">LOKMA Marketplace GmbH · noreply@lokma.shop</p>
                            </div>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: `Rechnung_${invoiceData.invoiceNumber}.pdf`,
                            content: pdfBase64,
                        },
                    ],
                });

                stats.emailsSent++;
                console.log(`[Monthly Invoicing] Email sent to ${recipientEmail} for ${invoiceData.invoiceNumber}`);
            } catch (emailError) {
                stats.emailsFailed++;
                console.error(`[Monthly Invoicing] Email failed for ${invoiceData.invoiceNumber}:`, emailError);
            }
        };

        try {
            // =================================================================
            // 1. SUBSCRIPTION INVOICES
            // =================================================================
            const businessesSnapshot = await db.collection("butcher_partners")
                .where("subscriptionStatus", "==", "active")
                .get();

            console.log(`[Monthly Invoicing] Found ${businessesSnapshot.size} active businesses`);

            for (const businessDoc of businessesSnapshot.docs) {
                try {
                    const business = businessDoc.data();
                    const businessId = businessDoc.id;

                    // Get subscription plan details
                    const planId = business.subscriptionPlan || "basic";
                    const planDoc = await db.collection("subscription_plans").doc(planId).get();
                    const plan = planDoc.exists ? planDoc.data() : null;

                    const monthlyFee = plan?.monthlyFee || business.monthlyFee || 29;

                    // Skip free plans
                    if (monthlyFee <= 0) {
                        console.log(`[Monthly Invoicing] Skipping ${businessId} - Free plan`);
                        continue;
                    }

                    // Check if invoice already exists for this period
                    const existingInvoice = await db.collection("invoices")
                        .where("businessId", "==", businessId)
                        .where("period", "==", periodString)
                        .where("type", "==", "subscription")
                        .limit(1)
                        .get();

                    if (!existingInvoice.empty) {
                        console.log(`[Monthly Invoicing] Invoice already exists for ${businessId} period ${periodString}`);
                        continue;
                    }

                    // Generate invoice number
                    const invoiceNumber = await getNextInvoiceNumber();

                    // Calculate VAT (19% for services in Germany)
                    const vatRate = 19;
                    const netAmount = monthlyFee;
                    const taxAmount = netAmount * (vatRate / 100);
                    const grandTotal = netAmount + taxAmount;

                    // Create invoice document
                    const invoiceData = {
                        invoiceNumber,
                        type: "subscription",
                        status: "pending",

                        // Business info
                        businessId,
                        butcherName: business.companyName || business.brand || "Unbekannt",
                        butcherAddress: business.address ?
                            `${business.address.street}, ${business.address.postalCode} ${business.address.city}` : "",

                        // Period
                        period: periodString,
                        periodStart: admin.firestore.Timestamp.fromDate(periodStart),
                        periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),

                        // Amounts
                        description: `LOKMA ${plan?.name || "Abonnement"} - ${periodString}`,
                        subtotal: netAmount,
                        taxRate: vatRate,
                        taxAmount,
                        grandTotal,
                        currency: "EUR",

                        // Dates
                        issueDate: admin.firestore.FieldValue.serverTimestamp(),
                        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

                        // Meta
                        generatedBy: "cron_job",
                        planId,
                    };

                    const invoiceRef = await db.collection("invoices").add(invoiceData);
                    const invoiceId = invoiceRef.id;

                    // Sync to Stripe for automatic collection
                    const stripeResult = await syncInvoiceToStripe(
                        invoiceId,
                        businessId,
                        invoiceNumber,
                        `LOKMA ${plan?.name || "Abonnement"} - ${periodString}`,
                        grandTotal,
                        dueDate,
                        stripeSecretKey.value()
                    );

                    stats.subscriptionGenerated++;
                    stats.totalAmount += grandTotal;

                    console.log(`[Monthly Invoicing] Created subscription invoice ${invoiceNumber} for ${business.companyName} - €${grandTotal.toFixed(2)}${stripeResult.stripeInvoiceId ? " (Stripe: " + stripeResult.stripeInvoiceId + ")" : ""}`);

                    // Send invoice email with PDF
                    const recipientEmail = business.email || business.contactEmail || business.adminEmail;
                    if (recipientEmail) {
                        await sendInvoiceEmail({ ...invoiceData, dueDate }, recipientEmail);
                    }

                } catch (error) {
                    console.error(`[Monthly Invoicing] Error processing business ${businessDoc.id}:`, error);
                    stats.subscriptionFailed++;
                }
            }

            // =================================================================
            // 2. COMMISSION INVOICES (from commission_records collection)
            // =================================================================
            const commRecordsSnapshot = await db.collection("commission_records")
                .where("period", "==", periodString)
                .get();

            // Group commission records by business
            const businessCommissions: Record<string, {
                totalCommission: number;
                netCommission: number;
                vatAmount: number;
                cardCommission: number;
                cashCommission: number;
                orderCount: number;
                businessName: string;
                recordIds: string[];
            }> = {};

            for (const recDoc of commRecordsSnapshot.docs) {
                const rec = recDoc.data();
                const businessId = rec.businessId;
                if (!businessId) continue;

                if (!businessCommissions[businessId]) {
                    businessCommissions[businessId] = {
                        totalCommission: 0,
                        netCommission: 0,
                        vatAmount: 0,
                        cardCommission: 0,
                        cashCommission: 0,
                        orderCount: 0,
                        businessName: rec.businessName || "Unbekannt",
                        recordIds: [],
                    };
                }

                const bc = businessCommissions[businessId];
                bc.totalCommission += rec.totalCommission || 0;
                bc.netCommission += rec.netCommission || 0;
                bc.vatAmount += rec.vatAmount || 0;
                bc.orderCount++;
                bc.recordIds.push(recDoc.id);

                const isCard = rec.paymentMethod === "card" || rec.paymentMethod === "stripe";
                if (isCard) {
                    bc.cardCommission += rec.totalCommission || 0;
                } else {
                    bc.cashCommission += rec.totalCommission || 0;
                }
            }

            console.log(`[Monthly Invoicing] Found commission records for ${Object.keys(businessCommissions).length} businesses in ${periodString}`);

            // Create commission invoices (including sponsored fees)
            for (const [businessId, commData] of Object.entries(businessCommissions)) {
                if (commData.totalCommission <= 0) continue;

                try {
                    // Check for existing commission invoice
                    const existingCommInvoice = await db.collection("invoices")
                        .where("businessId", "==", businessId)
                        .where("period", "==", periodString)
                        .where("type", "==", "commission")
                        .limit(1)
                        .get();

                    if (!existingCommInvoice.empty) {
                        console.log(`[Monthly Invoicing] Commission invoice already exists for ${businessId}`);
                        continue;
                    }

                    const invoiceNumber = await getNextInvoiceNumber();

                    // Aggregate sponsored conversion fees for this business
                    let sponsoredFeeTotal = 0;
                    let sponsoredConversionCount = 0;
                    const sponsoredRecordIds: string[] = [];
                    try {
                        const sponsoredSnapshot = await db.collection("sponsored_conversions")
                            .where("businessId", "==", businessId)
                            .where("period", "==", periodString)
                            .get();
                        for (const sDoc of sponsoredSnapshot.docs) {
                            const sData = sDoc.data();
                            sponsoredFeeTotal += sData.totalFee || 0;
                            sponsoredConversionCount += sData.sponsoredItemCount || 0;
                            sponsoredRecordIds.push(sDoc.id);
                        }
                        sponsoredFeeTotal = Math.round(sponsoredFeeTotal * 100) / 100;
                    } catch (sponsoredErr) {
                        console.error(`[Monthly Invoicing] Error aggregating sponsored fees for ${businessId}:`, sponsoredErr);
                    }

                    // Grand total = commission + sponsored fees
                    const grandTotalWithSponsored = Math.round((commData.totalCommission + sponsoredFeeTotal) * 100) / 100;
                    const netWithSponsored = Math.round((grandTotalWithSponsored / 1.19) * 100) / 100;
                    const vatWithSponsored = Math.round((grandTotalWithSponsored - netWithSponsored) * 100) / 100;

                    const sponsoredDescription = sponsoredFeeTotal > 0
                        ? ` + ${sponsoredConversionCount} Öne Çıkan (€${sponsoredFeeTotal.toFixed(2)})`
                        : "";

                    const commissionInvoiceData = {
                        invoiceNumber,
                        type: "commission",
                        status: "pending",

                        businessId,
                        butcherName: commData.businessName,

                        period: periodString,
                        periodStart: admin.firestore.Timestamp.fromDate(periodStart),
                        periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),

                        description: `LOKMA Provision - ${commData.orderCount} Bestellungen${sponsoredDescription} - ${periodString}`,
                        subtotal: netWithSponsored,
                        taxRate: 19,
                        taxAmount: vatWithSponsored,
                        grandTotal: grandTotalWithSponsored,
                        currency: "EUR",
                        orderCount: commData.orderCount,
                        cardCommission: commData.cardCommission,
                        cashCommission: commData.cashCommission,
                        sponsoredFee: sponsoredFeeTotal,
                        sponsoredConversionCount,

                        issueDate: admin.firestore.FieldValue.serverTimestamp(),
                        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

                        generatedBy: "cron_job",
                        commissionRecordIds: commData.recordIds,
                        sponsoredRecordIds,
                    };

                    const commInvoiceRef = await db.collection("invoices").add(commissionInvoiceData);
                    const commInvoiceId = commInvoiceRef.id;

                    // Mark commission records as invoiced
                    const batch = db.batch();
                    for (const recordId of commData.recordIds) {
                        batch.update(db.collection("commission_records").doc(recordId), {
                            collectionStatus: "invoiced",
                            invoiceId: commInvoiceId,
                            invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                    await batch.commit();

                    // Sync commission invoice to Stripe for automatic collection
                    const commStripeResult = await syncInvoiceToStripe(
                        commInvoiceId,
                        businessId,
                        invoiceNumber,
                        `LOKMA Provision - ${commData.orderCount} Bestellungen - ${periodString}`,
                        commData.totalCommission,
                        dueDate,
                        stripeSecretKey.value()
                    );

                    stats.commissionGenerated++;
                    stats.totalAmount += commData.totalCommission;

                    console.log(`[Monthly Invoicing] Created commission invoice ${invoiceNumber} for ${commData.businessName} - €${commData.totalCommission.toFixed(2)} (${commData.orderCount} orders, Card: €${commData.cardCommission.toFixed(2)}, Cash: €${commData.cashCommission.toFixed(2)})${commStripeResult.stripeInvoiceId ? " (Stripe: " + commStripeResult.stripeInvoiceId + ")" : ""}`);

                    // Send commission invoice email with PDF
                    const businessDoc = await db.collection("butcher_partners").doc(businessId).get();
                    const biz = businessDoc.exists ? businessDoc.data() : null;
                    const recipientEmail = biz?.email || biz?.contactEmail || biz?.adminEmail;
                    if (recipientEmail) {
                        await sendInvoiceEmail({ ...commissionInvoiceData, dueDate }, recipientEmail);
                    }
                } catch (error) {
                    console.error(`[Monthly Invoicing] Error creating commission invoice for ${businessId}:`, error);
                    stats.commissionFailed++;
                }
            }

            // =================================================================
            // LOG SUMMARY
            // =================================================================
            console.log("========================================");
            console.log("[Monthly Invoicing] COMPLETED");
            console.log(`  Subscription Invoices: ${stats.subscriptionGenerated} created, ${stats.subscriptionFailed} failed`);
            console.log(`  Commission Invoices: ${stats.commissionGenerated} created, ${stats.commissionFailed} failed`);
            console.log(`  Emails: ${stats.emailsSent} sent, ${stats.emailsFailed} failed`);
            console.log(`  Total Amount: €${stats.totalAmount.toFixed(2)}`);
            console.log("========================================");

            // Store run log
            await db.collection("system_logs").add({
                type: "monthly_invoicing",
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
        const periodString = `${periodStart.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}`;

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
                    companyName: business.companyName || business.brand || "Bilinmeyen İşletme",
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
                <h2>📊 LOKMA İşletme Performans Raporu - ${periodString}</h2>
                <hr/>
                <h3>Özet</h3>
                <ul>
                    <li><strong>Toplam İşletme Sayısı (kapatma yapan):</strong> ${businessCount}</li>
                    <li><strong>Toplam Durdurma Sayısı:</strong> ${totalPauses}</li>
                    <li><strong>Toplam Durdurma Süresi:</strong> ${totalPausedHours} saat</li>
                    <li><strong>Ort. Sipariş Teslim Süresi:</strong> ${businessesWithOrders > 0 ? Math.round(totalAvgFulfillmentMins / businessesWithOrders) : 0} dakika</li>
                </ul>
                <hr/>
                <h3>İşletmeler Detay</h3>
                <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
                    <tr style="background-color: #f0f0f0;">
                        <th>İşletme</th>
                        <th>Durdurma</th>
                        <th>Devam</th>
                        <th>Durma Süresi (saat)</th>
                        <th>Sipariş</th>
                        <th>Ort. Teslim (dk)</th>
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
                    Bu rapor LOKMA Platform tarafından otomatik olarak oluşturulmuştur.<br/>
                    Rapor Dönemi: ${periodStart.toLocaleDateString("tr-TR")} - ${periodEnd.toLocaleDateString("tr-TR")}
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

                const butcherName = order.butcherName || "İşletme";

                try {
                    await messaging.send({
                        notification: {
                            title: "⭐ Siparişinizi Değerlendirir misiniz?",
                            body: `${butcherName}'den aldığınız siparişten memnun kaldınız mı?`,
                        },
                        data: {
                            type: "feedback_request",
                            orderId: orderId,
                            businessId: order.butcherId || "",
                            businessName: butcherName,
                        },
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
    }
);

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
        const customerName = reservation.userName || reservation.customerName || "Müşteri";
        const partySize = reservation.partySize || 0;
        const resDate = reservation.reservationDate?.toDate?.() ?? new Date();
        const dateStr = resDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
        const timeStr = resDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

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

            if (staffTokens.length === 0) {
                console.log(`[Reservation] No staff tokens found for business ${businessId}`);
                return;
            }

            // Remove duplicates
            const uniqueTokens = [...new Set(staffTokens)];

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
                tokens: uniqueTokens,
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log(`[Reservation] Notified ${response.successCount}/${uniqueTokens.length} staff devices`);

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
        const businessName = after.businessName || "İşletme";
        const resDate = after.reservationDate?.toDate?.() ?? new Date();
        const dateStr = resDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
        const timeStr = resDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const partySize = after.partySize || 0;
        const customerName = after.userName || after.customerName || "Müşteri";
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
                        tokens: uniqueTokens,
                    });
                    console.log(`[Reservation] Notified staff about cancellation`);
                }
            } catch (error) {
                console.error("[Reservation] Error notifying staff about cancellation:", error);
            }
            return;
        }

        // ─── Staff-initiated status change → notify customer ───
        if (newStatus !== "confirmed" && newStatus !== "rejected") return;

        const customerFcmToken = after.customerFcmToken || after.userFcmToken;

        let title = "";
        let body = "";

        if (newStatus === "confirmed") {
            title = "✅ Rezervasyonunuz Onaylandı!";
            body = `${businessName} – ${dateStr} ${timeStr} – ${partySize} kişi. Afiyet olsun!`;
        } else {
            title = "❌ Rezervasyonunuz Reddedildi";
            body = `${businessName} – ${dateStr} ${timeStr} için rezervasyonunuz maalesef onaylanmadı.`;
        }

        // Send push notification if token available
        if (customerFcmToken) {
            try {
                await messaging.send({
                    notification: { title, body },
                    data: {
                        type: "reservation_status",
                        reservationId: event.params.reservationId,
                        businessId: businessId,
                        status: newStatus,
                    },
                    token: customerFcmToken,
                });
                console.log(`[Reservation] Sent ${newStatus} push notification to customer`);
            } catch (error) {
                console.error(`[Reservation] Error sending ${newStatus} push notification:`, error);
            }
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
                        <p style="color: #81C784; font-size: 12px; margin: 0 0 8px; font-weight: 600;">MASA KART NUMARANIZ</p>
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
                    subject: `✅ Rezervasyonunuz Onaylandı – ${businessName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background: #1a1a1a; color: #ffffff; padding: 30px;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <div style="background: #2E7D32; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
                                    <h1 style="margin: 0; color: white; font-size: 22px;">LOKMA</h1>
                                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">Rezervasyonunuz Onaylandı ✓</p>
                                </div>
                                <div style="background: #2a2a2a; padding: 25px; border-radius: 0 0 8px 8px;">
                                    <p style="color: #eee; margin: 0 0 20px; font-size: 15px;">Merhaba <strong>${customerName}</strong>,</p>
                                    <p style="color: #ccc; margin: 0 0 20px;">Masa rezervasyonunuz onaylanmıştır. Detaylar aşağıdadır:</p>
                                    
                                    <div style="background: #333; border-radius: 10px; padding: 18px; margin: 15px 0;">
                                        <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">İşletme</td>
                                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #fff;">${businessName}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Tarih</td>
                                                <td style="padding: 6px 0; text-align: right; color: #fff;">${dateStr}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Saat</td>
                                                <td style="padding: 6px 0; text-align: right; color: #fff;">${timeStr}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #999;">Kişi Sayısı</td>
                                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #4CAF50; font-size: 16px;">${partySize} Kişi</td>
                                            </tr>
                                        </table>
                                    </div>

                                    ${tableCardHtml}

                                    <p style="color: #aaa; font-size: 13px; margin: 20px 0 15px; text-align: center;">Rezervasyonu takviminize ekleyin:</p>
                                    
                                    <div style="text-align: center; margin: 15px 0;">
                                        <a href="${googleCalendarUrl}" target="_blank" style="display: inline-block; background: #4285F4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin: 0 6px 10px;">
                                            📅 Google Takvim'e Ekle
                                        </a>
                                    </div>
                                    <p style="color: #777; font-size: 11px; text-align: center; margin: 10px 0 0;">iCal dosyası ekte mevcuttur — Apple Takvim veya Outlook'a tek tıkla ekleyebilirsiniz.</p>
                                    
                                    <div style="border-top: 1px solid #444; margin-top: 20px; padding-top: 15px;">
                                        <p style="color: #999; font-size: 12px; margin: 0;">Afiyet olsun! 🍽️</p>
                                    </div>
                                </div>
                                <p style="color: #555; font-size: 11px; text-align: center; margin-top: 15px;">LOKMA Marketplace · noreply@lokma.shop</p>
                            </div>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: "rezervasyon.ics",
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
                const businessName = businessDoc.data().companyName || "İşletme";

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
                    const timeStr = resDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

                    try {
                        await messaging.send({
                            notification: {
                                title: "🍽️ Yarınki Rezervasyonunuz",
                                body: `${businessName} – Saat ${timeStr} – ${res.partySize || 0} kişi. İptal etmek isterseniz uygulamadan yapabilirsiniz.`,
                            },
                            data: {
                                type: "reservation_reminder_24h",
                                reservationId: resDoc.id,
                                businessId: businessId,
                            },
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
                    const timeStr = resDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

                    try {
                        await messaging.send({
                            notification: {
                                title: "⏰ Rezervasyonunuz 2 Saat Sonra!",
                                body: `${businessName} – Saat ${timeStr} – ${res.partySize || 0} kişi. Afiyet olsun!`,
                            },
                            data: {
                                type: "reservation_reminder_2h",
                                reservationId: resDoc.id,
                                businessId: businessId,
                            },
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
                        const timeStr = resDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
                        const customerName = res.userName || res.customerName || "Müşteri";
                        const partySize = res.partySize || 0;
                        const tableCards = res.tableCardNumbers || [];
                        const tableInfo = tableCards.length > 0 ? ` (Kart: ${tableCards.join(", ")})` : "";

                        if (uniqueTokens.length > 0) {
                            try {
                                await messaging.sendEachForMulticast({
                                    notification: {
                                        title: "🔔 Yaklaşan Rezervasyon – 30 Dakika!",
                                        body: `${customerName} – ${partySize} kişi – Saat ${timeStr}${tableInfo}. Masayı hazırladınız mı?`,
                                    },
                                    data: {
                                        type: "reservation_staff_30m_reminder",
                                        reservationId: resDoc.id,
                                        businessId: businessId,
                                    },
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
                                    ? `🪑 Masanız Hazırlandı! Masa ${tableCards.join(", ")}`
                                    : "🍽️ Rezervasyon Hatırlatma – 30 Dakika!";
                                const customerBody = hasTable
                                    ? `${businessName} – Saat ${timeStr} – ${partySize} kişi. Masa numaranız: ${tableCards.join(", ")}. Afiyet olsun!`
                                    : `${businessName} – Saat ${timeStr} – ${partySize} kişi. Görüşmek üzere!`;

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
