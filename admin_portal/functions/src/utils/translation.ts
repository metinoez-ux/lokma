import * as admin from 'firebase-admin';

// Simple caching mechanism to avoid excessive Firestore reads
let translationsCache: Record<string, any> = {};
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

/**
 * Fetches the translations for the PushNotifications namespace from Firestore.
 * Caches the result to reduce database reads.
 */
export async function getPushTranslations(langCode: string = 'tr'): Promise<Record<string, string>> {
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

    } catch (error) {
        console.error(`Error fetching translations for ${langCode}:`, error);
    }

    // Absolute fallback if everything fails
    return getFallbackTranslations();
}

/**
 * Absolute fallback for critical translations if Firestore is unreachable or data is missing.
 */
function getFallbackTranslations(): Record<string, string> {
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
export async function getUserLanguage(userId: string): Promise<string> {
    if (!userId) return 'tr';

    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
            const data = userDoc.data();
            if (data && data.language) {
                return data.language; // Expected to be 'tr', 'en', 'de', etc.
            }
        }
    } catch (error) {
        console.error(`Error fetching language preference for user ${userId}:`, error);
    }

    return 'tr'; // Default language
}
