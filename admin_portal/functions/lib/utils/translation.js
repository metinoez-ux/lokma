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
exports.getPushTranslations = getPushTranslations;
exports.getUserLanguage = getUserLanguage;
const admin = __importStar(require("firebase-admin"));
// Simple caching mechanism to avoid excessive Firestore reads
let translationsCache = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
/**
 * Fetches the translations for the PushNotifications namespace from Firestore.
 * Caches the result to reduce database reads.
 */
async function getPushTranslations(langCode = 'tr') {
    const now = Date.now();
    // Check if cache is valid and has the requested language
    if (now - lastFetchTime < CACHE_TTL_MS && translationsCache[langCode]) {
        return translationsCache[langCode];
    }
    try {
        const db = admin.firestore();
        const docRef = db.collection('translations').doc(langCode);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.PushNotifications) {
                translationsCache[langCode] = data.PushNotifications;
                lastFetchTime = now;
                return data.PushNotifications;
            }
        }
        // Fallback to Turkish if the requested language or its PushNotifications are not found
        if (langCode !== 'tr') {
            console.warn(`Translations for PushNotifications missing for language '${langCode}'. Falling back to 'tr'.`);
            return getPushTranslations('tr');
        }
    }
    catch (error) {
        console.error(`Error fetching translations for ${langCode}:`, error);
    }
    // Absolute fallback if everything fails
    return getFallbackTranslations();
}
/**
 * Absolute fallback for critical translations if Firestore is unreachable or data is missing.
 */
function getFallbackTranslations() {
    return {
        "orderPrefix": "Sipariş",
        "orderAcceptedTitle": "✅ Siparişiniz Onaylandı",
        "orderAcceptedBody": "Siparişiniz onaylandı ve hazırlanmaya başlanacak.",
        "orderPreparingTitle": "👨‍🍳 Siparişiniz Hazırlanıyor",
        "orderPreparingBody": "Siparişiniz şu anda usta tarafından hazırlanıyor.",
        "orderReadyDeliveryTitle": "📦 Siparişiniz Hazır!",
        "orderReadyDeliveryBody": "Kuryenin alması bekleniyor.",
        "orderReadyDineInTitle": "✅ Siparişiniz Hazır!",
        "orderReadyDineInBody": "Siparişiniz hazır, birazdan masanıza servis edilecek!",
        "orderReadyPickupTitle": "✅ Siparişiniz Hazır!",
        "orderReadyPickupBody": "Siparişiniz hazır, gelip alabilirsiniz!",
        "deliveryPendingTitle": "🚚 Teslimat Bekliyor!",
        "deliveryPickedUpTitle": "🛵 Siparişiniz Yolda!",
        "deliveryPickedUpBody": "Kuryemiz siparişinizi yola çıkardı.",
        "orderDeliveredTitle": "🍽️ Afiyet Olsun!",
        "orderDeliveredBody": "Siparişiniz teslim edildi.",
        "orderCancelledTitle": "❌ Siparişiniz İptal Edildi",
        "orderCancelledBody": "Siparişiniz iptal edilmiştir.",
        "feedbackRequestTitle": "⭐ Siparişinizi Değerlendirin",
        "feedbackRequestBody": "Siparişiniz nasıldı? Lütfen değerlendirin."
    };
}
/**
 * Helper to fetch a user's language preference from Firestore
 */
async function getUserLanguage(userId) {
    if (!userId)
        return 'tr';
    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            if (data && data.language) {
                return data.language; // Expected to be 'tr', 'en', 'de', etc.
            }
        }
    }
    catch (error) {
        console.error(`Error fetching language preference for user ${userId}:`, error);
    }
    return 'tr'; // Default language
}
//# sourceMappingURL=translation.js.map