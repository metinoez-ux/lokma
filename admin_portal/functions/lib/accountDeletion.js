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
exports.onUserAccountDeleted = void 0;
const admin = __importStar(require("firebase-admin"));
const auth = __importStar(require("firebase-functions/v1/auth"));
// V1 Auth trigger
exports.onUserAccountDeleted = auth.user().onDelete(async (user) => {
    const uid = user.uid;
    const db = admin.firestore();
    console.log(`[GDPR] Starting data cleanup for deleted user: ${uid}`);
    try {
        const batch = db.batch();
        // 1. Delete user from 'users' collection
        const userRef = db.collection('users').doc(uid);
        batch.delete(userRef);
        // 2. Delete user from 'user_profiles' collection
        const profileRef = db.collection('user_profiles').doc(uid);
        batch.delete(profileRef);
        // 3. Anonymize past orders in 'meat_orders' collection
        console.log(`[GDPR] Querying meat_orders for user: ${uid}...`);
        // Sometimes orders use 'userId', sometimes 'customerId'
        const ordersByUserId = await db.collection('meat_orders').where('userId', '==', uid).get();
        const ordersByCustomerId = await db.collection('meat_orders').where('customerId', '==', uid).get();
        // Combine unique order references
        const orderRefs = new Map();
        ordersByUserId.docs.forEach(doc => orderRefs.set(doc.id, doc.ref));
        ordersByCustomerId.docs.forEach(doc => orderRefs.set(doc.id, doc.ref));
        console.log(`[GDPR] Found ${orderRefs.size} orders to anonymize for user: ${uid}`);
        const anonymizedData = {
            customerName: 'Silinmiş Kullanıcı',
            customerPhone: '0000000000',
            customerEmail: 'deleted@user.lokma',
            deliveryAddress: 'Gizlenmiş Adres',
            addressDetails: 'Gizlenmiş Adres',
            city: 'Gizlenmiş',
            ort: 'Gizlenmiş',
            zip: '00000',
            postalCode: '00000',
            notes: 'Kullanıcı silindiği için notlar gizlenmiştir.',
            fcmToken: admin.firestore.FieldValue.delete(),
            customerFcmToken: admin.firestore.FieldValue.delete(),
            fcmTokens: admin.firestore.FieldValue.delete(),
            userId: 'DELETED_USER',
            customerId: 'DELETED_USER'
        };
        orderRefs.forEach((ref) => {
            batch.update(ref, anonymizedData);
        });
        // Execute all deletes and updates
        await batch.commit();
        console.log(`[GDPR] Data cleanup successfully completed for user: ${uid}`);
    }
    catch (error) {
        console.error(`[GDPR] Error during data cleanup for user ${uid}:`, error);
        throw error;
    }
});
//# sourceMappingURL=accountDeletion.js.map