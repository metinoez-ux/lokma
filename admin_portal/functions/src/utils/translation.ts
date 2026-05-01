import * as admin from 'firebase-admin';

// Simple caching mechanism to avoid excessive Firestore reads
let translationsCache: Record<string, any> = {};
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

/**
 * Fetches the translations for the PushNotifications namespace from Firestore.
 * Caches the result to reduce database reads.
 */
export async function getPushTranslations(langCode: string = 'de'): Promise<Record<string, string>> {
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

        // Fallback to German if the requested language or its PushNotifications are not found
        if (langCode !== 'de') {
            console.warn(`Translations for PushNotifications missing for language '${langCode}'. Falling back to 'de'.`);
            return getPushTranslations('de');
        }

    } catch (error) {
        console.error(`Error fetching translations for ${langCode}:`, error);
    }

    // Absolute fallback if everything fails — German for LOKMA Germany
    return getFallbackTranslations(langCode);
}

/**
 * Returns hardcoded fallback translations keyed by language.
 * German is the primary market language.
 */
function getFallbackTranslations(lang: string = 'de'): Record<string, string> {
    const all: Record<string, Record<string, string>> = {
        de: {
            "orderPrefix": "Bestellung",
            "newOrderTitle": "🔔 Neue Bestellung!",
            "preOrderTitle": "📋 Vorbestellung (Abholung)!",
            "deliveryLabel": "Lieferung",
            "pickupLabel": "Abholung",
            "orderAcceptedTitle": "✅ Bestellung bestätigt",
            "orderAcceptedBody": "Ihre Bestellung wurde bestätigt und wird bald zubereitet.",
            "orderPreparingTitle": "👨‍🍳 Bestellung wird zubereitet",
            "orderPreparingBody": "Ihre Bestellung wird gerade zubereitet.",
            "orderReadyDeliveryTitle": "📦 Bestellung fertig!",
            "orderReadyDeliveryBody": "Wartet auf Abholung durch Kurier.",
            "orderReadyDineInTitle": "✅ Bestellung fertig!",
            "orderReadyDineInBody": "Ihre Bestellung wird gleich an Ihren Tisch serviert!",
            "orderReadyPickupTitle": "✅ Bestellung fertig!",
            "orderReadyPickupBody": "Ihre Bestellung ist fertig, Sie können sie abholen!",
            "deliveryPendingTitle": "🚚 Lieferung ausstehend!",
            "deliveryPickedUpTitle": "🛵 Bestellung unterwegs!",
            "deliveryPickedUpBody": "Unser Kurier hat Ihre Bestellung abgeholt.",
            "orderDeliveredTitle": "🍽️ Guten Appetit!",
            "orderDeliveredBody": "Ihre Bestellung wurde geliefert. Guten Appetit!",
            "orderCancelledTitle": "❌ Bestellung storniert",
            "orderCancelledBody": "Ihre Bestellung wurde storniert.",
            "orderPendingTitle": "Bestellung aktualisiert",
            "orderPendingBody": "Ihre Bestellung ist wieder im Wartestatus.",
            "orderServedTitle": "🍽️ Guten Appetit!",
            "orderServedBody": "Ihre Bestellung wurde an Ihren Tisch serviert.",
            "orderRejectedTitle": "❌ Bestellung konnte nicht bestätigt werden",
            "feedbackRequestTitle": "⭐ Bewerten Sie Ihre Bestellung",
            "feedbackRequestBody": "Wie war Ihre Bestellung? Bitte bewerten Sie.",
            "preOrderReminderTitle": "⏰ Vorbestellungs-Erinnerung!",
            "tableOrderTitle": "🍽️ Tischbestellung fertig!",
            "today": "Heute",
            "tomorrow": "Morgen",
            "customer": "Kunde",
            "business": "Geschäft",
            "delivery": "Lieferung",
            "table": "Tisch",
            "refundCardMessage": "Ihre Zahlung wird automatisch auf Ihre Karte zuruckerstattet.",
            "refundGeneralMessage": "Ihre Zahlung wird erstattet.",
            "cancelApology": "Wir entschuldigen uns fur die Unannehmlichkeiten.",
            "kermesOrderReceivedTitle": "✅ Bestellung bestätigt",
            "kermesOrderReceivedBody": "Ihre Bestellung #{{orderNumber}} wurde bestätigt.",
            "kermesPaymentReceivedTitle": "💳 Zahlung erhalten",
            "kermesPaymentReceivedBody": "Ihre Zahlung für Bestellung #{{orderNumber}} wurde erfolgreich verarbeitet. Vielen Dank!",
            "kermesNewStaffTitle": "🔔 Neue Bestellung ({{kermesName}})!",
            "kermesNewStaffBody": "#{{orderNumber}} - {{amount}}€ [{{deliveryType}}]",
            "kermesPaymentStaffTitle": "💳 Zahlung erhalten!",
            "kermesPaymentStaffBody": "Die Zahlung für Bestellung #{{orderNumber}} wurde getätigt.",
            "kermesOrderDeliveredTitle": "🍽️ Guten Appetit!",
            "kermesOrderDeliveredBody": "Ihre Bestellung #{{orderNumber}} wurde geliefert. Guten Appetit!",
        },
        tr: {
            "orderPrefix": "Sipariş",
            "newOrderTitle": "🔔 Yeni Sipariş!",
            "preOrderTitle": "📋 Ön Sipariş (Gel Al)!",
            "deliveryLabel": "Kurye Teslimat",
            "pickupLabel": "Gel Al",
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
            "orderDeliveredBody": "Siparişiniz teslim edildi. Afiyet olsun!",
            "orderCancelledTitle": "❌ Siparişiniz İptal Edildi",
            "orderCancelledBody": "Siparişiniz iptal edilmiştir.",
            "orderPendingTitle": "Sipariş Güncellendi",
            "orderPendingBody": "Siparişiniz tekrar bekleme durumunda.",
            "orderServedTitle": "🍽️ Afiyet Olsun!",
            "orderServedBody": "Siparişiniz masanıza servis edildi.",
            "orderRejectedTitle": "❌ Sipariş Kabul Edilemedi",
            "feedbackRequestTitle": "⭐ Siparişinizi Değerlendirin",
            "feedbackRequestBody": "Siparişiniz nasıldı? Lütfen değerlendirin.",
            "preOrderReminderTitle": "⏰ Ön Sipariş Hatırlatma!",
            "tableOrderTitle": "🍽️ Masa Siparişi Hazır!",
            "today": "Bugün",
            "tomorrow": "Yarın",
            "customer": "Müşteri",
            "business": "İşletme",
            "delivery": "Teslimat",
            "table": "Masa",
            "refundCardMessage": "Odemeniz otomatik olarak kartiniza iade edilecektir.",
            "refundGeneralMessage": "Odemeniz iade edilecektir.",
            "cancelApology": "Yasanan aksaklik icin ozur dileriz.",
            "kermesOrderReceivedTitle": "Siparişiniz Alındı",
            "kermesOrderReceivedBody": "#{{orderNumber}} numaralı siparişiniz sistemimize ulaştı.",
            "kermesPaymentReceivedTitle": "Ödemeniz Alındı",
            "kermesPaymentReceivedBody": "#{{orderNumber}} numaralı siparişinizin ödemesi başarıyla alınmıştır. Teşekkür ederiz!",
            "kermesNewStaffTitle": "🔔 Yeni Sipariş ({{kermesName}})!",
            "kermesNewStaffBody": "#{{orderNumber}} - {{amount}}€ [{{deliveryType}}]",
            "kermesPaymentStaffTitle": "💳 Ödeme Alındı!",
            "kermesPaymentStaffBody": "#{{orderNumber}} numaralı siparişin ödemesi yapıldı.",
            "kermesOrderDeliveredTitle": "🍽️ Afiyet Olsun!",
            "kermesOrderDeliveredBody": "#{{orderNumber}} numaralı siparişiniz teslim edildi. Afiyet olsun!",
        },
        en: {
            "orderPrefix": "Order",
            "newOrderTitle": "🔔 New Order!",
            "preOrderTitle": "📋 Pre-Order (Pickup)!",
            "deliveryLabel": "Delivery",
            "pickupLabel": "Pickup",
            "orderAcceptedTitle": "✅ Order Confirmed",
            "orderAcceptedBody": "Your order has been confirmed and will be prepared soon.",
            "orderPreparingTitle": "👨‍🍳 Order Being Prepared",
            "orderPreparingBody": "Your order is currently being prepared.",
            "orderReadyDeliveryTitle": "📦 Order Ready!",
            "orderReadyDeliveryBody": "Waiting for courier pickup.",
            "orderReadyDineInTitle": "✅ Order Ready!",
            "orderReadyDineInBody": "Your order is ready, it will be served to your table shortly!",
            "orderReadyPickupTitle": "✅ Order Ready!",
            "orderReadyPickupBody": "Your order is ready, you can pick it up!",
            "deliveryPendingTitle": "🚚 Delivery Pending!",
            "deliveryPickedUpTitle": "🛵 Order On Its Way!",
            "deliveryPickedUpBody": "Our courier has picked up your order.",
            "orderDeliveredTitle": "🍽️ Enjoy Your Meal!",
            "orderDeliveredBody": "Your order has been delivered. Enjoy your meal!",
            "orderCancelledTitle": "❌ Order Cancelled",
            "orderCancelledBody": "Your order has been cancelled.",
            "orderPendingTitle": "Order Updated",
            "orderPendingBody": "Your order is back to pending status.",
            "orderServedTitle": "🍽️ Enjoy Your Meal!",
            "orderServedBody": "Your order has been served to your table.",
            "orderRejectedTitle": "❌ Order Could Not Be Confirmed",
            "feedbackRequestTitle": "⭐ Rate Your Order",
            "feedbackRequestBody": "How was your order? Please leave a rating.",
            "preOrderReminderTitle": "⏰ Pre-Order Reminder!",
            "tableOrderTitle": "🍽️ Table Order Ready!",
            "today": "Today",
            "tomorrow": "Tomorrow",
            "customer": "Customer",
            "business": "Business",
            "delivery": "Delivery",
            "table": "Table",
            "refundCardMessage": "Your payment will be automatically refunded to your card.",
            "refundGeneralMessage": "Your payment will be refunded.",
            "cancelApology": "We apologize for the inconvenience.",
            "kermesOrderReceivedTitle": "✅ Order Received",
            "kermesOrderReceivedBody": "Your order #{{orderNumber}} has been received.",
            "kermesPaymentReceivedTitle": "💳 Payment Received",
            "kermesPaymentReceivedBody": "Your payment for order #{{orderNumber}} has been successfully processed. Thank you!",
            "kermesNewStaffTitle": "🔔 New Order ({{kermesName}})!",
            "kermesNewStaffBody": "#{{orderNumber}} - {{amount}}€ [{{deliveryType}}]",
            "kermesPaymentStaffTitle": "💳 Payment Received!",
            "kermesPaymentStaffBody": "Payment for order #{{orderNumber}} has been made.",
            "kermesOrderDeliveredTitle": "🍽️ Enjoy Your Meal!",
            "kermesOrderDeliveredBody": "Your order #{{orderNumber}} has been delivered. Enjoy your meal!",
        },
    };

    return all[lang] || all.de;
}

/**
 * Helper to fetch a user's language preference from Firestore
 */
export async function getUserLanguage(userId: string): Promise<string> {
    if (!userId) return 'de';

    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
            const data = userDoc.data();
            // Check multiple possible field names for language preference
            const rawLang = data?.language || data?.preferredLanguage || data?.locale || data?.lang;
            if (rawLang) {
                // Normalize: 'de-DE' → 'de', 'tr_TR' → 'tr'
                const normalized = rawLang.split(/[-_]/)[0].toLowerCase();
                const supportedLangs = ['de', 'tr', 'en', 'es', 'fr', 'it', 'nl'];
                if (supportedLangs.includes(normalized)) {
                    return normalized;
                }
            }
        }
    } catch (error) {
        console.error(`Error fetching language preference for user ${userId}:`, error);
    }

    return 'de'; // Default language — German for LOKMA Germany
}

/**
 * Day names by locale for date formatting in push notifications
 */
export function getDayNames(lang: string): string[] {
    const days: Record<string, string[]> = {
        de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
        tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
        en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
        fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
        it: ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"],
        nl: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"],
    };
    return days[lang] || days.de;
}

/**
 * Get "Today"/"Tomorrow" label in user's language
 */
export function getDateLabel(lang: string, key: 'today' | 'tomorrow'): string {
    const labels: Record<string, Record<string, string>> = {
        de: { today: "Heute", tomorrow: "Morgen" },
        tr: { today: "Bugün", tomorrow: "Yarın" },
        en: { today: "Today", tomorrow: "Tomorrow" },
        es: { today: "Hoy", tomorrow: "Mañana" },
        fr: { today: "Aujourd'hui", tomorrow: "Demain" },
        it: { today: "Oggi", tomorrow: "Domani" },
        nl: { today: "Vandaag", tomorrow: "Morgen" },
    };
    return (labels[lang] || labels.de)[key];
}
