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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onKermesOrderStatusChangedNotif = exports.cancelStaleCashOrders = exports.onKermesOrderPaidNotif = exports.onKermesOrderCreatedNotif = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const translation_1 = require("./utils/translation");
exports.onKermesOrderCreatedNotif = (0, firestore_1.onDocumentCreated)({
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
}, async (event) => {
    const orderData = event.data?.data();
    if (!orderData)
        return;
    const db = admin.firestore();
    const orderId = event.params.orderId;
    const orderNumber = orderData.orderNumber;
    const totalAmount = orderData.totalAmount || 0;
    const kermesId = orderData.kermesId;
    const userId = orderData.userId;
    if (userId && !userId.startsWith("guest_")) {
        const userLang = await (0, translation_1.getUserLanguage)(userId);
        const trans = await (0, translation_1.getPushTranslations)(userLang);
        const title = trans.kermesOrderReceivedTitle || "Siparişiniz Alındı";
        const body = (trans.kermesOrderReceivedBody || "#{{orderNumber}} numaralı siparişiniz sistemimize ulaştı.").replace("{{orderNumber}}", orderNumber);
        const notifType = "kermes_order_created";
        try {
            await db.collection("users").doc(userId).collection("notifications").add({
                title,
                body,
                type: notifType,
                orderId: orderId,
                orderNumber: orderNumber,
                status: "pending",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
        }
        catch (e) {
            console.error("[OrderCreatedNotif] Failed to write to DB notifications", e);
        }
        try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const fcmToken = userData?.fcmToken;
                if (fcmToken) {
                    await admin.messaging().send({
                        token: fcmToken,
                        notification: { title, body },
                        data: { type: notifType, orderId, orderNumber },
                        android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
                        apns: { payload: { aps: { sound: "default", badge: 1 } } },
                    });
                    console.log(`[OrderCreatedNotif] Push sent to user ${userId}`);
                }
            }
        }
        catch (pushErr) {
            console.error("[OrderCreatedNotif] Push failed for user:", pushErr);
        }
    }
    else {
        console.log(`[OrderCreatedNotif] Siparis ${orderId}: userId yok veya guest, müşteri bildirimi atlanıyor.`);
    }
    // 2. Kermes personeline (Admin / KDS) bildirim gönder
    if (kermesId) {
        try {
            const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
            if (kermesDoc.exists) {
                const kData = kermesDoc.data();
                const kermesName = kData?.kermesName || kData?.city || "Kermes";
                const staffUids = new Set();
                ['kermesAdmins', 'assignedStaff', 'assignedWaiters', 'assignedDrivers'].forEach(field => {
                    if (Array.isArray(kData?.[field])) {
                        kData[field].forEach((uid) => staffUids.add(uid));
                    }
                });
                if (kData?.prepZoneAssignments) {
                    Object.values(kData.prepZoneAssignments).forEach((uids) => {
                        if (Array.isArray(uids)) {
                            uids.forEach((uid) => staffUids.add(uid));
                        }
                    });
                }
                if (staffUids.size > 0) {
                    const adminPromises = Array.from(staffUids).map(uid => db.collection("admins").doc(uid).get());
                    const adminDocs = await Promise.all(adminPromises);
                    const mobileTokens = [];
                    const webTokens = [];
                    adminDocs.forEach(doc => {
                        if (doc.exists) {
                            const data = doc.data();
                            // Mobile app writes singular fcmToken, check both formats
                            if (data?.fcmToken && typeof data.fcmToken === 'string')
                                mobileTokens.push(data.fcmToken);
                            if (data?.fcmTokens && Array.isArray(data.fcmTokens))
                                mobileTokens.push(...data.fcmTokens);
                            if (data?.webFcmTokens && Array.isArray(data.webFcmTokens))
                                webTokens.push(...data.webFcmTokens);
                        }
                    });
                    const staffLang = "tr"; // Multicast default for staff
                    const trans = await (0, translation_1.getPushTranslations)(staffLang);
                    const staffTitle = (trans.kermesNewStaffTitle || `🔔 Yeni Sipariş ({{kermesName}})!`).replace("{{kermesName}}", kermesName);
                    let staffBody = (trans.kermesNewStaffBody || `#{{orderNumber}} - {{amount}}€ [{{deliveryType}}]`)
                        .replace("{{orderNumber}}", orderNumber)
                        .replace("{{amount}}", totalAmount.toFixed(2));
                    if (orderData.deliveryType) {
                        staffBody = staffBody.replace("{{deliveryType}}", orderData.deliveryType);
                    }
                    else {
                        staffBody = staffBody.replace(" [{{deliveryType}}]", "").replace("[{{deliveryType}}]", "");
                    }
                    const sendObj = (tokens, isWeb) => ({
                        notification: { title: staffTitle, body: staffBody },
                        data: { type: "kermes_new_order", orderId, orderNumber, kermesId },
                        tokens,
                        android: { priority: "high", notification: { channelId: "kermes_orders", sound: "notification_sound" } },
                        apns: { payload: { aps: { sound: "notification_sound.wav", badge: 1 } } },
                        webpush: isWeb ? { fcmOptions: { link: `/kermes/orders` } } : undefined,
                    });
                    if (mobileTokens.length > 0) {
                        const res = await admin.messaging().sendEachForMulticast(sendObj(mobileTokens, false));
                        console.log(`[Mobile] Sent to ${res.successCount}/${mobileTokens.length} devices`);
                    }
                    if (webTokens.length > 0) {
                        const res = await admin.messaging().sendEachForMulticast(sendObj(webTokens, true));
                        console.log(`[Web] Sent to ${res.successCount}/${webTokens.length} devices`);
                    }
                    // Write to personnel_notifications subcollection for in-app inbox
                    const batch = db.batch();
                    for (const uid of staffUids) {
                        const notifRef = db.collection("users").doc(uid).collection("personnel_notifications").doc();
                        batch.set(notifRef, {
                            title: staffTitle,
                            body: staffBody,
                            type: "kermes_new_order",
                            orderId,
                            orderNumber,
                            kermesId,
                            read: false,
                            createdAt: new Date().toISOString(),
                        });
                    }
                    await batch.commit();
                    console.log(`[Inbox] Written to ${staffUids.size} staff inboxes`);
                }
            }
        }
        catch (e) {
            console.error("[OrderCreatedNotif] Failed to notify Kermes staff:", e);
        }
    }
});
exports.onKermesOrderPaidNotif = (0, firestore_1.onDocumentUpdated)({
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const db = admin.firestore();
    const orderId = event.params.orderId;
    const userId = after.userId;
    const orderNumber = after.orderNumber;
    // ── 1. ODEME BILDIRIMI ──────────────────────────────────────────────────
    const wasPaid = before.isPaid === true;
    const isPaidNow = after.isPaid === true;
    if (!wasPaid && isPaidNow) {
        console.log(`[OrderPaymentNotif] Siparis ${orderId} (${orderNumber}) odendi!`);
        if (userId && !userId.startsWith("guest_")) {
            const userLang = await (0, translation_1.getUserLanguage)(userId);
            const trans = await (0, translation_1.getPushTranslations)(userLang);
            const title = trans.kermesPaymentReceivedTitle || "Odemeniz Alindi";
            const body = (trans.kermesPaymentReceivedBody || "#{{orderNumber}} numarali siparisinizin odemesi basariyla alinmistir. Tesekkur ederiz!").replace("{{orderNumber}}", orderNumber);
            const notifType = "kermes_order_paid";
            try {
                await db.collection("users").doc(userId).collection("notifications").add({
                    title,
                    body,
                    type: notifType,
                    orderId: orderId,
                    orderNumber: orderNumber,
                    status: "paid",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
            }
            catch (e) {
                console.error("[OrderPaymentNotif] Failed to write DB notification", e);
            }
            try {
                const userDoc = await db.collection("users").doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const fcmToken = userData?.fcmToken;
                    if (fcmToken) {
                        await admin.messaging().send({
                            token: fcmToken,
                            notification: { title, body },
                            data: { type: notifType, orderId: orderId, orderNumber: orderNumber },
                            android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
                            apns: { payload: { aps: { sound: "default", badge: 1 } } },
                        });
                        console.log(`[OrderPaymentNotif] Push sent to user ${userId}`);
                    }
                }
            }
            catch (pushErr) {
                console.error("[OrderPaymentNotif] Push failed:", pushErr);
            }
        }
        // Personele Bildir (Odeme Yapildi)
        const kermesId = after.kermesId;
        if (kermesId) {
            try {
                const kermesDoc = await db.collection("kermes_events").doc(kermesId).get();
                if (kermesDoc.exists) {
                    const kData = kermesDoc.data();
                    const staffUids = new Set();
                    ['kermesAdmins', 'assignedStaff', 'assignedWaiters', 'assignedDrivers'].forEach(field => {
                        if (Array.isArray(kData?.[field])) {
                            kData[field].forEach((uid) => staffUids.add(uid));
                        }
                    });
                    if (kData?.prepZoneAssignments) {
                        Object.values(kData.prepZoneAssignments).forEach((uids) => {
                            if (Array.isArray(uids)) {
                                uids.forEach((uid) => staffUids.add(uid));
                            }
                        });
                    }
                    if (staffUids.size > 0) {
                        const adminPromises = Array.from(staffUids).map(uid => db.collection("admins").doc(uid).get());
                        const adminDocs = await Promise.all(adminPromises);
                        const mobileTokens = [];
                        const webTokens = [];
                        adminDocs.forEach(doc => {
                            if (doc.exists) {
                                const data = doc.data();
                                if (data?.fcmToken && typeof data.fcmToken === 'string')
                                    mobileTokens.push(data.fcmToken);
                                if (data?.fcmTokens && Array.isArray(data.fcmTokens))
                                    mobileTokens.push(...data.fcmTokens);
                                if (data?.webFcmTokens && Array.isArray(data.webFcmTokens))
                                    webTokens.push(...data.webFcmTokens);
                            }
                        });
                        const staffLang = "tr";
                        const trans = await (0, translation_1.getPushTranslations)(staffLang);
                        const staffTitle = trans.kermesPaymentStaffTitle || "Odeme Alindi!";
                        const staffBody = (trans.kermesPaymentStaffBody || "#{{orderNumber}} numarali siparisin odemesi yapildi.").replace("{{orderNumber}}", orderNumber);
                        const sendObj = (tokens, isWeb) => ({
                            notification: { title: staffTitle, body: staffBody },
                            data: { type: "kermes_order_paid", orderId: event.params.orderId, orderNumber },
                            tokens,
                            android: { priority: "high", notification: { channelId: "kermes_orders", sound: "notification_sound" } },
                            apns: { payload: { aps: { sound: "notification_sound.wav", badge: 1 } } },
                            webpush: isWeb ? { fcmOptions: { link: `/kermes/orders` } } : undefined,
                        });
                        if (mobileTokens.length > 0)
                            admin.messaging().sendEachForMulticast(sendObj(mobileTokens, false));
                        if (webTokens.length > 0)
                            admin.messaging().sendEachForMulticast(sendObj(webTokens, true));
                        const batch2 = db.batch();
                        for (const uid of staffUids) {
                            const notifRef = db.collection("users").doc(uid).collection("personnel_notifications").doc();
                            batch2.set(notifRef, {
                                title: staffTitle,
                                body: staffBody,
                                type: "kermes_order_paid",
                                orderId: event.params.orderId,
                                orderNumber,
                                kermesId,
                                read: false,
                                createdAt: new Date().toISOString(),
                            });
                        }
                        await batch2.commit();
                        console.log(`[Inbox] Payment notification written to ${staffUids.size} staff inboxes`);
                    }
                }
            }
            catch (e) {
                console.error("[OrderPaymentNotif] Failed to notify staff:", e);
            }
        }
    }
    // ── 2. STATUS DEGISIKLIK BILDIRIMI ──────────────────────────────────────
    if (before.status === after.status)
        return;
    const newStatus = after.status;
    const deliveryType = after.deliveryType;
    // Kurye Bildirimi: siparis ready oldugunda atanmis kuryeye push gonder
    if (newStatus === "ready" && deliveryType === "kurye") {
        const courierId = after.assignedCourierId;
        if (courierId) {
            try {
                const courierUserDoc = await db.collection("users").doc(courierId).get();
                let courierToken;
                if (courierUserDoc.exists) {
                    courierToken = courierUserDoc.data()?.fcmToken;
                }
                if (!courierToken) {
                    const courierAdminDoc = await db.collection("admins").doc(courierId).get();
                    if (courierAdminDoc.exists) {
                        courierToken = courierAdminDoc.data()?.fcmToken;
                    }
                }
                if (courierToken) {
                    await admin.messaging().send({
                        token: courierToken,
                        notification: {
                            title: "Yeni Kurye Siparisi!",
                            body: `#${orderNumber} numarali siparis size atandi. Tezgahtan teslim alin.`,
                        },
                        data: { type: "kermes_courier_assigned", orderId, orderNumber },
                        android: { priority: "high", notification: { channelId: "kermes_orders", sound: "notification_sound" } },
                        apns: { payload: { aps: { sound: "notification_sound.wav", badge: 1 } } },
                    });
                    console.log(`[CourierPush] Kurye ${courierId} bilgilendirildi - siparis #${orderNumber}`);
                }
            }
            catch (courierPushErr) {
                console.error("[CourierPush] Kuryeye push gonderilemedi:", courierPushErr);
            }
        }
    }
    // Musteri bildirimi
    if (!userId || userId.startsWith("guest_"))
        return;
    const userLang = await (0, translation_1.getUserLanguage)(userId);
    const trans = await (0, translation_1.getPushTranslations)(userLang);
    let title = "";
    let body = "";
    let notifType = "kermes_order_update";
    let podImageUrl = null;
    if (newStatus === "preparing") {
        title = trans.kermesOrderPreparingTitle || "Siparisimiz Hazirlaniyor";
        body = (trans.kermesOrderPreparingBody || "#{{orderNumber}} numarali siparisimiz mutfakta hazirlanmaya basladi!").replace("{{orderNumber}}", orderNumber);
    }
    else if (newStatus === "ready" && deliveryType === "kurye") {
        title = trans.kermesOrderReadyCourierTitle || "Siparisimiz Hazir!";
        body = (trans.kermesOrderReadyCourierBody || "#{{orderNumber}} numarali siparisimiz hazir, kurye yola cikmak uzere.").replace("{{orderNumber}}", orderNumber);
    }
    else if (newStatus === "onTheWay") {
        const courierName = after.assignedCourierName || "Kuryemiz";
        title = trans.kermesOrderOnTheWayTitle || "Kuryemiz Yola Cikti!";
        body = (trans.kermesOrderOnTheWayBody || "#{{orderNumber}} numarali siparisimiz {{courierName}} tarafindan yola cikti. Canli takip edebilirsiniz.")
            .replace("{{orderNumber}}", orderNumber)
            .replace("{{courierName}}", courierName);
        notifType = "kermes_courier_on_the_way";
    }
    else if (newStatus === "delivering" && deliveryType === "masada") {
        const waiterName = after.assignedWaiterName || "Garsonumuz";
        title = trans.kermesOrderDeliveringTitle || "Siparisimiz Geliyor!";
        body = (trans.kermesOrderDeliveringBody || "Siparisimiz yola cikti, {{waiterName}} tarafindan masaniza getiriliyor.").replace("{{waiterName}}", waiterName);
    }
    else if (newStatus === "delivered") {
        title = trans.kermesOrderDeliveredTitle || "Siparis Teslim Edildi!";
        body = (trans.kermesOrderDeliveredBody || "#{{orderNumber}} numarali siparisimiz teslim edildi. Afiyet olsun!").replace("{{orderNumber}}", orderNumber);
        notifType = "kermes_order_delivered";
        // PoD resmi varsa ekle
        podImageUrl = (after.deliveryProof && after.deliveryProof.photoUrl) || after.podImageUrl || after.deliveryProofUrl || null;
    }
    else if (newStatus === "cancelled") {
        title = trans.orderCancelledTitle || "Siparis Iptal Edildi";
        body = (trans.kermesOrderCancelledBody || "#{{orderNumber}} numarali siparisimiz iptal edildi.").replace("{{orderNumber}}", orderNumber);
        notifType = "kermes_order_cancelled";
    }
    else {
        return;
    }
    // In-app bildirim kaydet
    try {
        const notifData = {
            title,
            body,
            type: notifType,
            orderId: orderId,
            orderNumber: orderNumber,
            status: newStatus,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        };
        if (podImageUrl)
            notifData.podImageUrl = podImageUrl;
        await db.collection("users").doc(userId).collection("notifications").add(notifData);
    }
    catch (e) {
        console.error("[OrderStatusNotif] DB write failed", e);
    }
    // FCM push gonder
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const fcmToken = userData?.fcmToken;
            if (fcmToken) {
                const pushPayload = {
                    token: fcmToken,
                    notification: { title, body },
                    data: { type: notifType, orderId, orderNumber },
                    android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
                    apns: { payload: { aps: { sound: "default", badge: 1 } } },
                };
                // PoD resmi rich notification olarak ekle
                if (podImageUrl) {
                    pushPayload.apns = {
                        fcmOptions: { imageUrl: podImageUrl },
                        payload: { aps: { "mutable-content": 1, sound: "default", badge: 1 } },
                    };
                    pushPayload.android = {
                        priority: "high",
                        notification: { imageUrl: podImageUrl, channelId: "kermes_orders", sound: "default" },
                    };
                    pushPayload.data.podImageUrl = podImageUrl;
                }
                await admin.messaging().send(pushPayload);
            }
        }
    }
    catch (pushErr) {
        console.error("[OrderStatusNotif] Push failed:", pushErr);
    }
});
/**
 * Scheduled job to cancel Kermes cash orders that are older than 2 hours and unpaid.
 */
exports.cancelStaleCashOrders = (0, scheduler_1.onSchedule)({
    schedule: "every 15 minutes",
    region: "europe-west1",
}, async (event) => {
    const db = admin.firestore();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    try {
        // Fetch all unpaid cash orders. We filter date locally to avoid composite index requirements.
        const ordersSnapshot = await db.collection("kermes_orders")
            .where("paymentMethod", "==", "cash")
            .where("isPaid", "==", false)
            .get();
        if (ordersSnapshot.empty) {
            console.log("[CancelStaleCashOrders] No unpaid cash orders found.");
            return;
        }
        let cancelledCount = 0;
        const batch = db.batch();
        for (const doc of ordersSnapshot.docs) {
            const data = doc.data();
            // Skip already cancelled or completed/delivered orders
            if (data.status === "cancelled" || data.status === "delivered")
                continue;
            const createdAt = data.createdAt?.toDate();
            if (!createdAt || createdAt.getTime() > twoHoursAgo.getTime())
                continue;
            const orderId = doc.id;
            const orderNumber = data.orderNumber;
            const userId = data.userId;
            const updateData = {
                status: "cancelled",
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                notes: data.notes
                    ? `${data.notes}\n(Otomatik iptal: 2 saat içinde ödeme yapılmadı)`
                    : "(Otomatik iptal: 2 saat içinde ödeme yapılmadı)"
            };
            batch.update(doc.ref, updateData);
            cancelledCount++;
            // Notify customer if applicable
            if (userId && !userId.startsWith("guest_")) {
                try {
                    const userLang = await (0, translation_1.getUserLanguage)(userId);
                    const trans = await (0, translation_1.getPushTranslations)(userLang);
                    const title = trans.orderCancelledTitle || "Sipariş İptal Edildi";
                    const body = (trans.kermesOrderCancelledDueToPaymentTimeoutBody || "#{{orderNumber}} numaralı siparişiniz, 2 saat içinde ödeme yapılmadığı için iptal edilmiştir.")
                        .replace("{{orderNumber}}", orderNumber);
                    // In-app notification
                    const notifRef = db.collection("users").doc(userId).collection("notifications").doc();
                    batch.set(notifRef, {
                        title,
                        body,
                        type: "kermes_order_cancelled",
                        orderId,
                        orderNumber,
                        status: "cancelled",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                    // FCM Push
                    const userDoc = await db.collection("users").doc(userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const fcmToken = userData?.fcmToken;
                        if (fcmToken) {
                            await admin.messaging().send({
                                token: fcmToken,
                                notification: { title, body },
                                data: { type: "kermes_order_cancelled", orderId, orderNumber },
                                android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
                                apns: { payload: { aps: { sound: "default", badge: 1 } } },
                            });
                        }
                    }
                }
                catch (err) {
                    console.error(`[CancelStaleCashOrders] Failed to notify user ${userId} for order ${orderId}`, err);
                }
            }
        }
        if (cancelledCount > 0) {
            await batch.commit();
            console.log(`[CancelStaleCashOrders] Successfully cancelled ${cancelledCount} stale cash orders.`);
        }
        else {
            console.log("[CancelStaleCashOrders] No cash orders were older than 2 hours.");
        }
    }
    catch (err) {
        console.error("[CancelStaleCashOrders] Error fetching or updating orders", err);
    }
});
exports.onKermesOrderStatusChangedNotif = (0, firestore_1.onDocumentUpdated)({
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    if (before.status === after.status)
        return;
    const db = admin.firestore();
    const orderId = event.params.orderId;
    const userId = after.userId;
    const orderNumber = after.orderNumber;
    const deliveryType = after.deliveryType;
    const newStatus = after.status;
    // ── Kurye Bildirimi: siparis ready oldugunda atanmis kuryeye push gonder ──
    if (newStatus === "ready" && deliveryType === "kurye") {
        const courierId = after.assignedCourierId;
        if (courierId) {
            try {
                // Kuryenin FCM token'ini users koleksiyonundan al
                const courierUserDoc = await db.collection("users").doc(courierId).get();
                let courierToken;
                if (courierUserDoc.exists) {
                    courierToken = courierUserDoc.data()?.fcmToken;
                }
                // Admins koleksiyonundan da kontrol et
                if (!courierToken) {
                    const courierAdminDoc = await db.collection("admins").doc(courierId).get();
                    if (courierAdminDoc.exists) {
                        courierToken = courierAdminDoc.data()?.fcmToken;
                    }
                }
                if (courierToken) {
                    await admin.messaging().send({
                        token: courierToken,
                        notification: {
                            title: "Yeni Kurye Siparişi!",
                            body: `#${orderNumber} numaralı sipariş size atandı. Tezgahtan teslim alın.`,
                        },
                        data: {
                            type: "kermes_courier_assigned",
                            orderId,
                            orderNumber,
                        },
                        android: { priority: "high", notification: { channelId: "kermes_orders", sound: "notification_sound" } },
                        apns: { payload: { aps: { sound: "notification_sound.wav", badge: 1 } } },
                    });
                    console.log(`[CourierPush] Kurye ${courierId} bilgilendirildi - siparis #${orderNumber}`);
                }
                else {
                    console.log(`[CourierPush] Kurye ${courierId} icin FCM token bulunamadi`);
                }
                // In-app bildirim kaydet
                try {
                    await db.collection("users").doc(courierId).collection("notifications").add({
                        title: "Yeni Kurye Siparişi!",
                        body: `#${orderNumber} numaralı sipariş size atandı. Tezgahtan teslim alın.`,
                        type: "kermes_courier_assigned",
                        orderId,
                        orderNumber,
                        status: "ready",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                }
                catch (e) {
                    console.error("[CourierPush] In-app notification write failed", e);
                }
            }
            catch (courierPushErr) {
                console.error("[CourierPush] Kuryeye push gonderilemedi:", courierPushErr);
            }
        }
    }
    // ── Musteri bildirimi: userId olmayan veya guest siparisleri atla ──
    if (!userId || userId.startsWith("guest_"))
        return;
    const userLang = await (0, translation_1.getUserLanguage)(userId);
    const trans = await (0, translation_1.getPushTranslations)(userLang);
    let title = "";
    let body = "";
    let notifType = "kermes_order_update";
    if (newStatus === "preparing") {
        title = trans.kermesOrderPreparingTitle || "Siparisimiz Hazirlaniyor";
        body = (trans.kermesOrderPreparingBody || "#{{orderNumber}} numarali siparisimiz mutfakta hazirlanmaya basladi!").replace("{{orderNumber}}", orderNumber);
    }
    else if (newStatus === "ready" && deliveryType === "kurye") {
        title = trans.kermesOrderReadyCourierTitle || "Siparisimiz Hazir!";
        body = (trans.kermesOrderReadyCourierBody || "#{{orderNumber}} numarali siparisimiz hazir, kurye yola cikmak uzere.").replace("{{orderNumber}}", orderNumber);
    }
    else if (newStatus === "onTheWay") {
        const courierName = after.assignedCourierName || "Kuryemiz";
        title = trans.kermesOrderOnTheWayTitle || "Kuryemiz Yola Cikti!";
        body = (trans.kermesOrderOnTheWayBody || "#{{orderNumber}} numarali siparisimiz {{courierName}} tarafindan yola cikti. Canli takip edebilirsiniz.")
            .replace("{{orderNumber}}", orderNumber)
            .replace("{{courierName}}", courierName);
        notifType = "kermes_courier_on_the_way";
    }
    else if (newStatus === "delivering" && deliveryType === "masada") {
        const waiterName = after.assignedWaiterName || "Garsonumuz";
        title = trans.kermesOrderDeliveringTitle || "Siparisimiz Geliyor!";
        body = (trans.kermesOrderDeliveringBody || "Siparisimiz yola cikti, {{waiterName}} tarafindan masaniza getiriliyor.").replace("{{waiterName}}", waiterName);
    }
    else if (newStatus === "delivered") {
        title = trans.kermesOrderDeliveredTitle || "Siparis Teslim Edildi!";
        body = (trans.kermesOrderDeliveredBody || "#{{orderNumber}} numarali siparisimiz teslim edildi. Afiyet olsun!").replace("{{orderNumber}}", orderNumber);
        notifType = "kermes_order_delivered";
    }
    else if (newStatus === "cancelled") {
        title = trans.orderCancelledTitle || "Siparis Iptal Edildi";
        body = (trans.kermesOrderCancelledBody || "#{{orderNumber}} numarali siparisimiz iptal edildi.").replace("{{orderNumber}}", orderNumber);
        notifType = "kermes_order_cancelled";
    }
    else {
        return;
    }
    // In-app bildirim kaydet
    try {
        await db.collection("users").doc(userId).collection("notifications").add({
            title,
            body,
            type: notifType,
            orderId: orderId,
            orderNumber: orderNumber,
            status: newStatus,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
    }
    catch (e) {
        console.error("[OrderStatusNotif] DB write failed", e);
    }
    // FCM push gonder
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const fcmToken = userData?.fcmToken;
            if (fcmToken) {
                await admin.messaging().send({
                    token: fcmToken,
                    notification: { title, body },
                    data: { type: notifType, orderId, orderNumber },
                    android: { priority: "high", notification: { channelId: "kermes_orders", sound: "default" } },
                    apns: { payload: { aps: { sound: "default", badge: 1 } } },
                });
            }
        }
    }
    catch (pushErr) {
        console.error("[OrderStatusNotif] Push failed:", pushErr);
    }
});
//# sourceMappingURL=kermesCustomerNotifications.js.map