const fs = require('fs');

const pushKeys = {
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

const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    if (!fs.existsSync(langPath)) continue;
    
    let content = fs.readFileSync(langPath, 'utf8');
    let langData = JSON.parse(content);
    
    if (!langData["PushNotifications"]) {
        langData["PushNotifications"] = {};
    }
    
    // Only TR gets the real strings initially, others get placeholders so auto-translate works
    for (const [k, v] of Object.entries(pushKeys)) {
        if (!langData["PushNotifications"][k]) {
            langData["PushNotifications"][k] = lang === 'tr' ? v : `[${lang.toUpperCase()}] ${v}`;
        }
    }

    fs.writeFileSync(langPath, JSON.stringify(langData, null, 2));
    console.log(`Added PushNotifications to ${lang}.json`);
}
