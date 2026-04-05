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
exports.onKermesOrderPaidNotif = exports.onKermesOrderCreatedNotif = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const db = admin.firestore();
exports.onKermesOrderCreatedNotif = (0, firestore_1.onDocumentCreated)({
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
}, async (event) => {
    const orderData = event.data?.data();
    if (!orderData)
        return;
    const orderId = event.params.orderId;
    const userId = orderData.userId;
    if (!userId) {
        console.log(`[OrderCreatedNotif] Siparis ${orderId}: userId yok, atlanıyor.`);
        return;
    }
    const orderNumber = orderData.orderNumber;
    const title = "Siparişiniz Alındı";
    const body = `#${orderNumber} numaralı siparişiniz sistemimize ulaştı.`;
    const notifType = "kermes_order_created";
    // Write to user notifications
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
    // Read user token and send FCM
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const fcmToken = userData?.fcmToken;
            if (fcmToken) {
                await admin.messaging().send({
                    token: fcmToken,
                    notification: {
                        title: title,
                        body: body,
                    },
                    data: {
                        type: notifType,
                        orderId: orderId,
                        orderNumber: orderNumber,
                    },
                    android: {
                        priority: "high",
                        notification: {
                            channelId: "kermes_orders",
                            sound: "default",
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: "default",
                                badge: 1,
                            },
                        },
                    },
                });
                console.log(`[OrderCreatedNotif] Push sent to user ${userId}`);
            }
        }
    }
    catch (pushErr) {
        console.error("[OrderCreatedNotif] Push failed:", pushErr);
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
    // Sadece isPaid değiştiğinde
    const wasPaid = before.isPaid === true;
    const isPaidNow = after.isPaid === true;
    if (wasPaid === isPaidNow)
        return;
    // Ödeme yapıldıysa
    if (isPaidNow) {
        const orderId = event.params.orderId;
        const userId = after.userId;
        const orderNumber = after.orderNumber;
        console.log(`[OrderPaymentNotif] Sipariş ${orderId} (${orderNumber}) ödendi!`);
        if (!userId)
            return;
        const title = "Ödemeniz Alındı";
        const body = `#${orderNumber} numaralı siparişinizin ödemesi başarıyla alınmıştır. Teşekkür ederiz!`;
        const notifType = "kermes_order_paid";
        // DB'ye kaydet
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
        // FCM gönder
        try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const fcmToken = userData?.fcmToken;
                if (fcmToken) {
                    await admin.messaging().send({
                        token: fcmToken,
                        notification: { title, body },
                        data: {
                            type: notifType,
                            orderId: orderId,
                            orderNumber: orderNumber,
                        },
                        android: {
                            priority: "high",
                            notification: {
                                channelId: "kermes_orders",
                                sound: "default",
                            },
                        },
                        apns: {
                            payload: {
                                aps: {
                                    sound: "default",
                                    badge: 1,
                                },
                            },
                        },
                    });
                    console.log(`[OrderPaymentNotif] Push sent to user ${userId}`);
                }
            }
        }
        catch (pushErr) {
            console.error("[OrderPaymentNotif] Push failed:", pushErr);
        }
    }
});
//# sourceMappingURL=kermesCustomerNotifications.js.map