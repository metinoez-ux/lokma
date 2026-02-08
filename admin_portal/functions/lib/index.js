"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onScheduledFeedbackRequests = exports.onScheduledMonthlyDeliveryPauseReport = exports.onScheduledMonthlyInvoicing = exports.onOrderStatusChange = exports.onNewOrder = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const stripe_1 = __importDefault(require("stripe"));
const resend_1 = require("resend");
const invoicePdf_1 = require("./invoicePdf");
// Define secrets for secure key management
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const resendApiKey = (0, params_1.defineSecret)("RESEND_API_KEY");
admin.initializeApp();
const messaging = admin.messaging();
const db = admin.firestore();
/**
 * When a new order is created, send push notification to butcher admin
 */
exports.onNewOrder = (0, firestore_1.onDocumentCreated)("meat_orders/{orderId}", async (event) => {
    const order = event.data?.data();
    if (!order)
        return;
    const butcherId = order.butcherId;
    const rawOrderNum = order.orderNumber;
    const orderNumber = rawOrderNum ? `Sipariş #${rawOrderNum}` : "Yeni Sipariş";
    const totalAmount = order.totalAmount || 0;
    const customerName = order.customerName || "Müşteri";
    // Get butcher admin FCM tokens
    try {
        const butcherDoc = await admin.firestore()
            .collection("butcher_admins")
            .doc(butcherId)
            .get();
        const butcherData = butcherDoc.data();
        const fcmTokens = butcherData?.fcmTokens || [];
        if (fcmTokens.length === 0) {
            console.log(`No FCM tokens for butcher ${butcherId}`);
            return;
        }
        // Send notification to all butcher admin devices
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
        console.log(`Sent to ${response.successCount}/${fcmTokens.length} devices`);
    }
    catch (error) {
        console.error("Error sending notification to butcher:", error);
    }
});
/**
 * Create commission record when an order is delivered/completed
 */
async function createCommissionRecord(orderId, orderData) {
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
        const businessData = businessDoc.data();
        const businessName = businessData.name || businessData.businessName || "İşletme";
        const planId = businessData.subscriptionPlan || businessData.plan || "free";
        // Get the plan from subscription_plans collection
        let plan = null;
        const plansSnapshot = await db.collection("subscription_plans").doc(planId).get();
        if (plansSnapshot.exists) {
            plan = plansSnapshot.data();
        }
        else {
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
            // Check if business has own courier or uses LOKMA courier
            courierType = orderData.assignedCourierId ? "lokma_courier" : (businessData.hasOwnCourier ? "own_courier" : "lokma_courier");
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
            }
            else if (plan.perOrderFeeType === "fixed") {
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
            period: currentMonth,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection("commission_records").add(commissionRecord);
        console.log(`[Commission] Created record: ${orderId} | ${businessName} | ${totalCommission}€ (${collectionStatus})`);
        // Update business usage counters
        const usageUpdate = {
            [`usage.orders.${currentMonth}`]: admin.firestore.FieldValue.increment(1),
            [`usage.totalCommission.${currentMonth}`]: admin.firestore.FieldValue.increment(totalCommission),
            "usage.lastOrderAt": admin.firestore.FieldValue.serverTimestamp(),
        };
        // For cash orders: accumulate balance owed to LOKMA
        if (!isCardPayment && totalCommission > 0) {
            usageUpdate.accountBalance = admin.firestore.FieldValue.increment(totalCommission);
        }
        await db.collection("businesses").doc(businessId).update(usageUpdate);
        console.log(`[Commission] Updated usage for ${businessName}: +1 order, +${totalCommission}€ commission`);
    }
    catch (error) {
        console.error(`[Commission] Error creating record for order ${orderId}:`, error);
    }
}
/**
 * When order status changes, send push notification to customer
 */
exports.onOrderStatusChange = (0, firestore_1.onDocumentUpdated)("meat_orders/{orderId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    // Only process if status changed
    if (before.status === after.status)
        return;
    // Support both field names for customer FCM token (mobile uses 'fcmToken')
    const customerFcmToken = after.customerFcmToken || after.fcmToken;
    const hasCustomerToken = !!customerFcmToken;
    if (!hasCustomerToken) {
        console.log("No customer FCM token found, will skip customer notification but continue for driver notifications");
    }
    const rawOrderNumber = after.orderNumber;
    const orderNumber = rawOrderNumber ? `Sipariş #${rawOrderNumber}` : "Sipariş";
    const totalAmount = after.totalAmount || 0;
    const businessName = after.butcherName || after.businessName || "İşletme";
    const newStatus = after.status;
    let title = "";
    let body = "";
    switch (newStatus) {
        case "preparing":
            title = "👨‍🍳 Siparişiniz Hazırlanıyor";
            body = `${orderNumber} - ${businessName} siparişinizi hazırlıyor`;
            break;
        case "ready":
            // Check if delivery order or pickup
            const isDeliveryOrder = after.orderType === "delivery" || after.deliveryType === "delivery" || after.deliveryMethod === "delivery";
            if (isDeliveryOrder) {
                // Delivery order: ready but waiting for courier to claim
                title = "📦 Siparişiniz Hazır!";
                body = `${orderNumber} - Kuryenin alması bekleniyor. Toplam: ${totalAmount.toFixed(2)}€`;
            }
            else {
                // Pickup order: customer should come pick it up
                title = "✅ Siparişiniz Hazır!";
                body = `${orderNumber} - Alabilirsiniz! Toplam: ${totalAmount.toFixed(2)}€`;
            }
            // If delivery order, also notify staff about pending delivery
            if (isDeliveryOrder) {
                const butcherId = after.butcherId || after.businessId;
                const deliveryAddress = after.deliveryAddress || "";
                // Get all driver FCM tokens who are assigned to this business
                try {
                    // Query 1: Drivers assigned via assignedBusinesses array
                    const driversSnapshot = await db.collection("admins")
                        .where("isDriver", "==", true)
                        .where("assignedBusinesses", "array-contains", butcherId)
                        .get();
                    // Query 2: Staff with direct businessId match (legacy support)
                    const staffSnapshot = await db.collection("admins")
                        .where("businessId", "==", butcherId)
                        .get();
                    const staffTokens = [];
                    const processedIds = new Set();
                    // Process drivers first
                    driversSnapshot.docs.forEach(doc => {
                        if (processedIds.has(doc.id))
                            return;
                        processedIds.add(doc.id);
                        const data = doc.data();
                        if (data.fcmToken)
                            staffTokens.push(data.fcmToken);
                        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                            staffTokens.push(...data.fcmTokens);
                        }
                    });
                    // Process legacy staff (only if not already processed as driver)
                    staffSnapshot.docs.forEach(doc => {
                        if (processedIds.has(doc.id))
                            return;
                        processedIds.add(doc.id);
                        const data = doc.data();
                        if (data.fcmToken)
                            staffTokens.push(data.fcmToken);
                        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                            staffTokens.push(...data.fcmTokens);
                        }
                    });
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
                        console.log(`Sent delivery notification to ${response.successCount}/${staffTokens.length} drivers/staff`);
                    }
                    else {
                        console.log(`No driver tokens found for business ${butcherId}`);
                    }
                }
                catch (staffErr) {
                    console.error("Error notifying drivers:", staffErr);
                }
            }
            break;
        case "onTheWay":
            // Courier has claimed and started delivery
            const courierName = after.courierName || "Kurye";
            title = "🚚 Kurye Yola Çıktı!";
            body = `${orderNumber} - ${courierName} siparişinizi getiriyor`;
            break;
        case "delivered":
            title = "🎉 Siparişiniz Teslim Edildi";
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
            title = "🎉 Sipariş Tamamlandı";
            body = `${orderNumber} - Afiyet olsun!`;
            // Also create commission record for completed orders (if not already created at delivered)
            await createCommissionRecord(event.params.orderId, after);
            break;
        case "rejected":
            const reason = after.rejectionReason || "İstediğiniz ürün şu an mevcut değil";
            const butcherPhone = after.butcherPhone || "";
            title = "❌ Sipariş Kabul Edilemedi";
            body = `${orderNumber} - ${reason}${butcherPhone ? ` Tel: ${butcherPhone}` : ""}`;
            break;
        case "cancelled":
            const cancellationReason = after.cancellationReason || "İşletme tarafından iptal edildi";
            const paymentStatus = after.paymentStatus;
            const paymentMethod = after.paymentMethod;
            title = "❌ Sipariş İptal Edildi";
            // Build message with reason and refund info
            let cancelMsg = `${orderNumber} - Sebep: ${cancellationReason}`;
            // If payment was made (paid/completed), mention refund
            if (paymentStatus === "paid" || paymentStatus === "completed") {
                if (paymentMethod === "card" || paymentMethod === "stripe") {
                    cancelMsg += ". 💳 Ödemeniz kartınıza otomatik olarak iade edilecektir.";
                }
                else {
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
        }
        catch (error) {
            console.error("Error sending notification to customer:", error);
        }
    }
    else if (!hasCustomerToken) {
        console.log(`Skipped customer notification for ${newStatus} - no FCM token`);
    }
});
// =============================================================================
// MONTHLY AUTOMATIC INVOICING (Cron Job)
// Runs on the 1st of every month at 02:00 Berlin time
// =============================================================================
/**
 * GoBD-Compliant Invoice Number Generator
 * Format: RE-{YEAR}-{SEQUENCE} (e.g., RE-2026-00001)
 */
async function getNextInvoiceNumber() {
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
async function syncInvoiceToStripe(invoiceId, businessId, invoiceNumber, description, grossAmount, dueDate, stripeKey) {
    try {
        // Get business Stripe customer ID
        const businessDoc = await db.collection("butcher_partners").doc(businessId).get();
        const business = businessDoc.data();
        if (!business?.stripeCustomerId) {
            console.log(`[Stripe Sync] No Stripe customer ID for business ${businessId}`);
            return { stripeInvoiceId: null, stripeInvoiceUrl: null };
        }
        // Initialize Stripe with the secret key
        const stripe = new stripe_1.default(stripeKey);
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
        const invoiceIdStr = stripeInvoice.id;
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
    }
    catch (error) {
        console.error(`[Stripe Sync] Error syncing invoice ${invoiceId}:`, error);
        return { stripeInvoiceId: null, stripeInvoiceUrl: null };
    }
}
/**
 * Monthly Subscription Invoicing
 * Creates invoices for all active businesses with paid subscriptions
 */
exports.onScheduledMonthlyInvoicing = (0, scheduler_1.onSchedule)({
    schedule: "0 2 1 * *", // 1st of every month at 02:00
    timeZone: "Europe/Berlin",
    memory: "1GiB",
    timeoutSeconds: 540, // 9 minutes
    secrets: [stripeSecretKey, resendApiKey],
}, async () => {
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
    const resend = new resend_1.Resend(resendApiKey.value());
    // Helper: Generate PDF and send invoice email
    const sendInvoiceEmail = async (invoiceData, recipientEmail) => {
        try {
            const pdfBuffer = await (0, invoicePdf_1.generateInvoicePDF)(invoiceData);
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
        }
        catch (emailError) {
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
                const stripeResult = await syncInvoiceToStripe(invoiceId, businessId, invoiceNumber, `LOKMA ${plan?.name || "Abonnement"} - ${periodString}`, grandTotal, dueDate, stripeSecretKey.value());
                stats.subscriptionGenerated++;
                stats.totalAmount += grandTotal;
                console.log(`[Monthly Invoicing] Created subscription invoice ${invoiceNumber} for ${business.companyName} - €${grandTotal.toFixed(2)}${stripeResult.stripeInvoiceId ? " (Stripe: " + stripeResult.stripeInvoiceId + ")" : ""}`);
                // Send invoice email with PDF
                const recipientEmail = business.email || business.contactEmail || business.adminEmail;
                if (recipientEmail) {
                    await sendInvoiceEmail({ ...invoiceData, dueDate }, recipientEmail);
                }
            }
            catch (error) {
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
        const businessCommissions = {};
        for (const recDoc of commRecordsSnapshot.docs) {
            const rec = recDoc.data();
            const businessId = rec.businessId;
            if (!businessId)
                continue;
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
            }
            else {
                bc.cashCommission += rec.totalCommission || 0;
            }
        }
        console.log(`[Monthly Invoicing] Found commission records for ${Object.keys(businessCommissions).length} businesses in ${periodString}`);
        // Create commission invoices
        for (const [businessId, commData] of Object.entries(businessCommissions)) {
            if (commData.totalCommission <= 0)
                continue;
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
                const commissionInvoiceData = {
                    invoiceNumber,
                    type: "commission",
                    status: "pending",
                    businessId,
                    butcherName: commData.businessName,
                    period: periodString,
                    periodStart: admin.firestore.Timestamp.fromDate(periodStart),
                    periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
                    description: `LOKMA Provision - ${commData.orderCount} Bestellungen - ${periodString}`,
                    subtotal: commData.netCommission,
                    taxRate: 19,
                    taxAmount: commData.vatAmount,
                    grandTotal: commData.totalCommission,
                    currency: "EUR",
                    orderCount: commData.orderCount,
                    cardCommission: commData.cardCommission,
                    cashCommission: commData.cashCommission,
                    issueDate: admin.firestore.FieldValue.serverTimestamp(),
                    dueDate: admin.firestore.Timestamp.fromDate(dueDate),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    generatedBy: "cron_job",
                    commissionRecordIds: commData.recordIds,
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
                const commStripeResult = await syncInvoiceToStripe(commInvoiceId, businessId, invoiceNumber, `LOKMA Provision - ${commData.orderCount} Bestellungen - ${periodString}`, commData.totalCommission, dueDate, stripeSecretKey.value());
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error("[Monthly Invoicing] Critical error:", error);
        throw error;
    }
});
// =============================================================================
// MONTHLY COURIER PAUSE REPORT (E-mail to Admin)
// Runs on the 1st of every month at 09:00 Berlin time
// =============================================================================
/**
 * Monthly Courier Pause Report
 * Collects all delivery pause/resume logs from the previous month
 * and sends a summary email to the platform admin
 */
exports.onScheduledMonthlyDeliveryPauseReport = (0, scheduler_1.onSchedule)({
    schedule: "0 9 1 * *", // 1st of every month at 09:00
    timeZone: "Europe/Berlin",
    memory: "256MiB",
    timeoutSeconds: 300, // 5 minutes
}, async () => {
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
        const reportData = {};
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
            if (logsSnapshot.empty)
                continue;
            const logs = logsSnapshot.docs.map(doc => ({
                action: doc.data().action,
                timestamp: doc.data().timestamp?.toDate() || new Date(),
                adminEmail: doc.data().adminEmail || "unknown",
            }));
            // Calculate stats
            let pauseStart = null;
            let pausedMs = 0;
            let pauseCount = 0;
            let resumeCount = 0;
            for (const log of logs) {
                if (log.action === "paused") {
                    pauseStart = log.timestamp;
                    pauseCount++;
                }
                else if (log.action === "resumed" && pauseStart) {
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
    }
    catch (error) {
        console.error("[Monthly Delivery Report] Critical error:", error);
        throw error;
    }
});
// =============================================================================
// HOURLY FEEDBACK REQUEST NOTIFICATIONS
// Sends feedback request 24 hours after order delivery
// =============================================================================
/**
 * Hourly check for orders that need feedback requests
 * Sends push notifications asking customers to rate their experience
 */
exports.onScheduledFeedbackRequests = (0, scheduler_1.onSchedule)({
    schedule: "0 * * * *", // Every hour at minute 0
    timeZone: "Europe/Berlin",
    memory: "256MiB",
    timeoutSeconds: 120,
}, async () => {
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
            }
            catch (sendError) {
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
    }
    catch (error) {
        console.error("[Feedback Request] Critical error:", error);
        throw error;
    }
});
//# sourceMappingURL=index.js.map