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
// Define secrets for secure key management
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
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
    const orderNumber = order.orderNumber || "Yeni Sipariş";
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
    const customerFcmToken = after.customerFcmToken;
    if (!customerFcmToken) {
        console.log("No customer FCM token, skipping notification");
        return;
    }
    const orderNumber = after.orderNumber || "Sipariş";
    const totalAmount = after.totalAmount || 0;
    const newStatus = after.status;
    let title = "";
    let body = "";
    switch (newStatus) {
        case "preparing":
            title = "👨‍🍳 Siparişiniz Hazırlanıyor";
            body = `${orderNumber} - Kasabınız siparişinizi hazırlıyor`;
            break;
        case "ready":
            title = "✅ Siparişiniz Hazır!";
            body = `${orderNumber} - Alabilirsiniz! Toplam: ${totalAmount.toFixed(2)}€`;
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
            break;
        case "completed":
            title = "🎉 Sipariş Tamamlandı";
            body = `${orderNumber} - Afiyet olsun!`;
            break;
        case "rejected":
            const reason = after.rejectionReason || "İstediğiniz ürün şu an mevcut değil";
            const butcherPhone = after.butcherPhone || "";
            title = "❌ Sipariş Kabul Edilemedi";
            body = `${orderNumber} - ${reason}${butcherPhone ? ` Tel: ${butcherPhone}` : ""}`;
            break;
        case "cancelled":
            title = "❌ Sipariş İptal Edildi";
            body = `${orderNumber} - Siparişiniz iptal edildi`;
            break;
        default:
            return; // Don't send notification for other statuses
    }
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
    memory: "512MiB",
    timeoutSeconds: 540, // 9 minutes
    secrets: [stripeSecretKey], // Include Stripe key
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
            }
            catch (error) {
                console.error(`[Monthly Invoicing] Error processing business ${businessDoc.id}:`, error);
                stats.subscriptionFailed++;
            }
        }
        // =================================================================
        // 2. COMMISSION INVOICES (for businesses with commission-based plans)
        // =================================================================
        // Calculate commissions from orders in previous month
        const ordersSnapshot = await db.collection("meat_orders")
            .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(periodStart))
            .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
            .where("status", "==", "completed")
            .get();
        // Group orders by business
        const businessCommissions = {};
        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            const businessId = order.butcherId || order.businessId;
            if (!businessId)
                continue;
            const commission = order.totalCommission || order.commissionAmount || 0;
            if (!businessCommissions[businessId]) {
                businessCommissions[businessId] = {
                    total: 0,
                    orderCount: 0,
                    businessName: order.butcherName || order.businessName || "Unbekannt",
                };
            }
            businessCommissions[businessId].total += commission;
            businessCommissions[businessId].orderCount++;
        }
        // Create commission invoices
        for (const [businessId, commData] of Object.entries(businessCommissions)) {
            if (commData.total <= 0)
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
                // VAT on commission (19%)
                const vatRate = 19;
                const taxAmount = commData.total * (vatRate / 100);
                const grandTotal = commData.total + taxAmount;
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
                    subtotal: commData.total,
                    taxRate: vatRate,
                    taxAmount,
                    grandTotal,
                    currency: "EUR",
                    orderCount: commData.orderCount,
                    issueDate: admin.firestore.FieldValue.serverTimestamp(),
                    dueDate: admin.firestore.Timestamp.fromDate(dueDate),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    generatedBy: "cron_job",
                };
                const commInvoiceRef = await db.collection("invoices").add(commissionInvoiceData);
                const commInvoiceId = commInvoiceRef.id;
                // Sync commission invoice to Stripe for automatic collection
                const commStripeResult = await syncInvoiceToStripe(commInvoiceId, businessId, invoiceNumber, `LOKMA Provision - ${commData.orderCount} Bestellungen - ${periodString}`, grandTotal, dueDate, stripeSecretKey.value());
                stats.commissionGenerated++;
                stats.totalAmount += grandTotal;
                console.log(`[Monthly Invoicing] Created commission invoice ${invoiceNumber} for ${commData.businessName} - €${grandTotal.toFixed(2)} (${commData.orderCount} orders)${commStripeResult.stripeInvoiceId ? " (Stripe: " + commStripeResult.stripeInvoiceId + ")" : ""}`);
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