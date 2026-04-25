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
exports.delayedOrderNotification = exports.nightlyOrderArchive = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const translation_1 = require("./utils/translation");
const db = admin.firestore();
/**
 * 1. Nightly Archive Job
 * Runs daily at 23:59 (Europe/Berlin).
 * Finds all orders that are 'completed', 'delivered', 'served', or 'cancelled',
 * created before today, and sets isArchived to true.
 */
exports.nightlyOrderArchive = (0, scheduler_1.onSchedule)({
    schedule: "59 23 * * *", // 23:59 every day
    timeZone: "Europe/Berlin",
    memory: "512MiB",
    timeoutSeconds: 300,
}, async (event) => {
    console.log("[NightlyArchive] Starting nightly order archive process...");
    let archivedCount = 0;
    const statusesToArchive = ['completed', 'delivered', 'served', 'cancelled'];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    for (const status of statusesToArchive) {
        let hasMore = true;
        let lastDoc = null;
        while (hasMore) {
            let q = db.collection("meat_orders")
                .where("status", "==", status)
                .where("createdAt", "<", admin.firestore.Timestamp.fromDate(today))
                .limit(500);
            if (lastDoc) {
                q = q.startAfter(lastDoc);
            }
            const snap = await q.get();
            if (snap.empty) {
                hasMore = false;
                break;
            }
            const batch = db.batch();
            let batchCount = 0;
            snap.forEach((doc) => {
                const data = doc.data();
                if (!data.isArchived) {
                    batch.update(doc.ref, { isArchived: true });
                    batchCount++;
                }
            });
            if (batchCount > 0) {
                await batch.commit();
                archivedCount += batchCount;
                console.log(`[NightlyArchive] Archived ${batchCount} old orders for status: ${status}`);
            }
            lastDoc = snap.docs[snap.docs.length - 1];
        }
    }
    console.log(`[NightlyArchive] Finished. Total archived: ${archivedCount}`);
});
/**
 * 2. Delayed Order Notification Job
 * Runs every 5 minutes.
 * Notifies the user if an order has been stuck in 'pending' or 'accepted' for over 20 minutes.
 */
exports.delayedOrderNotification = (0, scheduler_1.onSchedule)({
    schedule: "*/5 * * * *", // Every 5 minutes
    memory: "256MiB",
    timeoutSeconds: 120,
}, async (event) => {
    console.log("[DelayedOrderNotification] Checking for delayed orders...");
    const now = Date.now();
    const twentyMinutesAgo = now - 20 * 60 * 1000;
    const statuses = ['accepted', 'pending'];
    for (const status of statuses) {
        let hasMore = true;
        let lastDoc = null;
        while (hasMore) {
            let q = db.collection("meat_orders")
                .where("status", "==", status)
                .where("createdAt", "<=", admin.firestore.Timestamp.fromMillis(twentyMinutesAgo))
                .limit(500);
            if (lastDoc) {
                q = q.startAfter(lastDoc);
            }
            const snap = await q.get();
            if (snap.empty) {
                hasMore = false;
                break;
            }
            for (const doc of snap.docs) {
                const data = doc.data();
                // Skip pre-orders or if already notified
                if (data.delayNotificationSent || data.isScheduledOrder || data.isPreOrder) {
                    continue;
                }
                const userId = data.userId || data.customerId;
                if (!userId)
                    continue;
                const userDoc = await db.collection("users").doc(userId).get();
                if (!userDoc.exists)
                    continue;
                const userData = userDoc.data();
                const fcmToken = userData?.fcmToken;
                if (fcmToken) {
                    try {
                        const lang = await (0, translation_1.getUserLanguage)(userId);
                        const translations = await (0, translation_1.getPushTranslations)(lang);
                        // Get translated strings or fallback to sensible defaults
                        const title = translations["order_delayed_title"] ||
                            (lang === "de" ? "Bestellung verzögert sich" :
                                lang === "tr" ? "Sipariş Gecikmesi" : "Order Delayed");
                        const body = translations["order_delayed_body"] ||
                            (lang === "de" ? "Aufgrund der hohen Auslastung verzögert sich Ihre Bestellung etwas. Wir bitten um Verständnis." :
                                lang === "tr" ? "Yoğunluktan dolayı siparişinizde gecikme yaşanmaktadır. Anlayışınız için teşekkür ederiz." :
                                    "Due to high demand, your order is slightly delayed. Thank you for your understanding.");
                        const payload = {
                            notification: {
                                title,
                                body,
                            },
                            data: {
                                type: "order_delayed",
                                orderId: doc.id,
                                click_action: "FLUTTER_NOTIFICATION_CLICK"
                            }
                        };
                        await admin.messaging().send({
                            token: fcmToken,
                            ...payload,
                            android: {
                                priority: "high",
                                notification: {
                                    sound: "default",
                                    channelId: "high_importance_channel"
                                }
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: "default"
                                    }
                                }
                            }
                        });
                        console.log(`[DelayedOrderNotification] Sent delay notification for order ${doc.id}`);
                    }
                    catch (error) {
                        console.error(`[DelayedOrderNotification] Error sending to ${doc.id}:`, error);
                    }
                }
                // Mark as sent so we don't spam the user
                await doc.ref.update({ delayNotificationSent: true });
            }
            lastDoc = snap.docs[snap.docs.length - 1];
        }
    }
});
//# sourceMappingURL=orderMaintenance.js.map