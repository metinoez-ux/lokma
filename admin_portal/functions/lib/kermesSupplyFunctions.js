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
exports.onKermesSupplyStatusUpdated = exports.onKermesSupplyRequested = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
exports.onKermesSupplyRequested = (0, firestore_1.onDocumentCreated)('kermes_events/{kermesId}/supply_requests/{requestId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    if (!data)
        return;
    const kermesId = event.params.kermesId;
    const itemName = data.itemName || 'Malzeme';
    const urgency = data.urgency || 'normal';
    const reqZone = data.requestedZone || 'Personel';
    const requestedByName = data.requestedByName || 'Biri';
    const requestId = event.params.requestId;
    try {
        const db = admin.firestore();
        // Fetch Kermes Admins (or anyone assigned as Tedarik, but we notify Kermes Admins generally for now)
        const kermesDoc = await db.collection('kermes_events').doc(kermesId).get();
        if (!kermesDoc.exists)
            return;
        const kData = kermesDoc.data();
        const kermesAdmins = kData.kermesAdmins || [];
        if (kermesAdmins.length === 0)
            return;
        const isUrgent = urgency === 'super_urgent';
        const title = isUrgent ? `🚨🔥 SÜPER ACİL: ${itemName}` : `🚨 İhtiyaç: ${itemName}`;
        const body = isUrgent
            ? `⚠️ DİKKAT! ${requestedByName} (${reqZone}) işi gücü bırakıp HEMEN ${itemName} getirmenizi bekliyor!`
            : `${requestedByName} (${reqZone}) şu an ${itemName} bekliyor.`;
        // 1. DYNAMIC INBOX MESSAGE FOR ADMINS
        const batch = db.batch();
        for (const uid of kermesAdmins) {
            const notifRef = db.collection("users").doc(uid).collection("notifications").doc(requestId);
            batch.set(notifRef, {
                title,
                body,
                type: "supply_alarm",
                kermesId,
                requestId,
                itemName,
                status: "pending",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
        // 2. FCM PUSH FOR ADMINS
        const tokens = [];
        const userSnaps = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', kermesAdmins.slice(0, 10)).get();
        userSnaps.forEach((doc) => {
            const ud = doc.data();
            if (ud.fcmToken) {
                if (Array.isArray(ud.fcmToken)) {
                    tokens.push(...ud.fcmToken);
                }
                else {
                    tokens.push(ud.fcmToken);
                }
            }
        });
        if (tokens.length > 0) {
            const uniqueTokens = Array.from(new Set(tokens));
            await admin.messaging().sendEachForMulticast({
                tokens: uniqueTokens,
                notification: { title, body },
                data: { type: 'supply_alarm', kermesId, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
                apns: { payload: { aps: { sound: 'default' } } }
            });
            console.log(`[kermesSupplyFunctions] Sent supply alarm to ${uniqueTokens.length} devices for ${itemName}.`);
        }
    }
    catch (err) {
        console.error('Error onKermesSupplyRequested:', err);
    }
});
exports.onKermesSupplyStatusUpdated = (0, firestore_1.onDocumentUpdated)('kermes_events/{kermesId}/supply_requests/{requestId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const before = snap.before.data();
    const after = snap.after.data();
    if (!before || !after)
        return;
    // Yalnızca status değişirse inbox & push tetikleyelim
    if (before.status === after.status)
        return;
    const kermesId = event.params.kermesId;
    const requestId = event.params.requestId;
    const itemName = after.itemName || 'Malzeme';
    const reqUid = after.requestedByUid; // Personel ID
    const newStatus = after.status;
    try {
        const db = admin.firestore();
        // Update the admin's inbox messages! (We want to change the visual green ok for everyone)
        // First, get admins to update their inbox
        const kermesDoc = await db.collection('kermes_events').doc(kermesId).get();
        if (kermesDoc.exists) {
            const kData = kermesDoc.data();
            const kermesAdmins = kData.kermesAdmins || [];
            const batch = db.batch();
            for (const adminUid of kermesAdmins) {
                const notifRef = db.collection("users").doc(adminUid).collection("notifications").doc(requestId);
                if (newStatus === 'cancelled') {
                    // The requester cancelled the request, remove the alarm from all admins' inboxes immediately.
                    batch.delete(notifRef);
                }
                else {
                    batch.set(notifRef, {
                        status: newStatus,
                        body: newStatus === 'on_the_way' ? `${after.requestedByName} talebine YOLA ÇIKTI damgası vurdunuz.` : newStatus === 'rejected' ? `${after.requestedByName} talebi tarafınızca REDDEDİLDİ.` : `${after.requestedByName} talebi TAMAMLANDI.`,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }); // using merge: true to avoid throw if doc magically disappeared
                }
            }
            await batch.commit();
        }
        // If personnel who requested it exists
        if (!reqUid)
            return;
        // If the requester cancelled it themselves, no need to send them a push notification
        if (newStatus === 'cancelled')
            return;
        const title = newStatus === 'on_the_way' ? `🏃 Malzeme Yola Çıktı!` : newStatus === 'rejected' ? `❌ Malzeme İsteği Reddedildi` : `✅ Malzeme İsteği Tamamlandı`;
        const adminReply = after.adminReply ? `\nCevap: "${after.adminReply}"` : '';
        const body = newStatus === 'on_the_way'
            ? `Kermes Yetkilisi, "${itemName}" talebinizi onayladı ve yola çıkardı!${adminReply}`
            : newStatus === 'rejected' ? `Yetkili, "${itemName}" talebini şu an iptal etti.${adminReply}` : `"${itemName}" talebi tamam olarak işaretlendi.`;
        // 1. INBOX MESSAGE FOR THE REQUESTER
        await db.collection("users").doc(reqUid).collection("notifications").doc(requestId).set({
            title,
            body,
            type: "supply_alarm_status",
            kermesId,
            requestId,
            itemName,
            status: newStatus,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 2. FCM PUSH FOR THE REQUESTER
        const userDoc = await db.collection('users').doc(reqUid).get();
        if (!userDoc.exists)
            return;
        const fcmToken = userDoc.data()?.fcmToken;
        if (fcmToken) {
            const tokens = Array.isArray(fcmToken) ? fcmToken : [fcmToken];
            if (tokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens,
                    notification: { title, body },
                    data: { type: 'supply_alarm_status', status: newStatus, kermesId, requestId, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
                    apns: { payload: { aps: { sound: 'default' } } }
                });
                console.log(`[kermesSupplyFunctions] Push sent to requester ${reqUid} for status ${newStatus}.`);
            }
        }
    }
    catch (err) {
        console.error('Error onKermesSupplyStatusUpdated:', err);
    }
});
//# sourceMappingURL=kermesSupplyFunctions.js.map