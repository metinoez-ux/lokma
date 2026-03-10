/**
 * LOKMA Promotion Templates — Seed Data Script
 * 
 * 16 promosyon tipi için Firestore'a şablonlar yükler.
 * Her şablonda 7 dil desteği var (TR, EN, DE, FR, ES, IT, NL).
 * 
 * Kullanım:
 *   npx ts-node scripts/seed_promotion_templates.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Firebase Admin SDK init
const serviceAccount = require('../serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

interface PromotionTemplateData {
    name: string;
    nameTranslations: Record<string, string>;
    description: string;
    descriptionTranslations: Record<string, string>;
    type: string;
    icon: string;
    defaultValue: number;
    defaultDurationDays: number;
    minPlanTier: string;
    allowedPopupFormats: string[];
    isActive: boolean;
    sortOrder: number;
    createdAt: any;
    updatedAt: any;
}

const TEMPLATES: PromotionTemplateData[] = [
    // 1. percentOff
    {
        name: 'Yüzde İndirim',
        nameTranslations: { tr: 'Yüzde İndirim', en: 'Percent Off', de: 'Prozentrabatt', fr: 'Réduction en pourcentage', es: 'Descuento porcentual', it: 'Sconto percentuale', nl: 'Procentkorting' },
        description: 'Siparişe yüzdelik indirim uygulayın',
        descriptionTranslations: { tr: 'Siparişe yüzdelik indirim uygulayın', en: 'Apply percentage discount to orders', de: 'Prozentrabatt auf Bestellungen anwenden', fr: 'Appliquer une réduction en pourcentage', es: 'Aplicar descuento porcentual', it: 'Applica sconto percentuale', nl: 'Pas procentkorting toe' },
        type: 'percentOff',
        icon: '🏷️',
        defaultValue: 10,
        defaultDurationDays: 30,
        minPlanTier: 'free',
        allowedPopupFormats: ['bottomSheet', 'topBanner'],
        isActive: true,
        sortOrder: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 2. fixedOff
    {
        name: 'Sabit İndirim',
        nameTranslations: { tr: 'Sabit İndirim', en: 'Fixed Discount', de: 'Festrabatt', fr: 'Remise fixe', es: 'Descuento fijo', it: 'Sconto fisso', nl: 'Vaste korting' },
        description: 'Siparişe sabit tutar indirim uygulayın',
        descriptionTranslations: { tr: 'Siparişe sabit tutar indirim uygulayın', en: 'Apply fixed amount discount', de: 'Festen Rabattbetrag anwenden', fr: 'Appliquer une remise fixe', es: 'Aplicar descuento de cantidad fija', it: 'Applica sconto di importo fisso', nl: 'Pas vast kortingsbedrag toe' },
        type: 'fixedOff',
        icon: '💰',
        defaultValue: 5,
        defaultDurationDays: 14,
        minPlanTier: 'free',
        allowedPopupFormats: ['bottomSheet'],
        isActive: true,
        sortOrder: 2,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 3. freeDelivery
    {
        name: 'Ücretsiz Teslimat',
        nameTranslations: { tr: 'Ücretsiz Teslimat', en: 'Free Delivery', de: 'Kostenlose Lieferung', fr: 'Livraison gratuite', es: 'Entrega gratuita', it: 'Consegna gratuita', nl: 'Gratis bezorging' },
        description: 'Teslimat ücretini kaldırın',
        descriptionTranslations: { tr: 'Teslimat ücretini kaldırın', en: 'Remove delivery fee', de: 'Liefergebühr entfernen', fr: 'Supprimer les frais de livraison', es: 'Eliminar gastos de envío', it: 'Rimuovi costi di consegna', nl: 'Bezorgkosten verwijderen' },
        type: 'freeDelivery',
        icon: '🚚',
        defaultValue: 0,
        defaultDurationDays: 7,
        minPlanTier: 'basic',
        allowedPopupFormats: ['topBanner', 'snackbar'],
        isActive: true,
        sortOrder: 3,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 4. buyXGetY
    {
        name: '2 Al 1 Öde (BOGO)',
        nameTranslations: { tr: '2 Al 1 Öde', en: 'Buy 2 Pay 1 (BOGO)', de: '2 kaufen 1 zahlen', fr: '2 achetés 1 payé', es: '2x1', it: '2 compri 1 paghi', nl: '2 halen 1 betalen' },
        description: 'Belirli ürünlerde al X öde Y kampanyası',
        descriptionTranslations: { tr: 'Belirli ürünlerde al X öde Y kampanyası', en: 'Buy X Pay Y on selected products', de: 'X kaufen Y zahlen auf ausgewählte Produkte', fr: 'Achetez X payez Y sur les produits sélectionnés', es: 'Compra X paga Y en productos seleccionados', it: 'Compra X paga Y su prodotti selezionati', nl: 'Koop X betaal Y op geselecteerde producten' },
        type: 'buyXGetY',
        icon: '🎁',
        defaultValue: 0,
        defaultDurationDays: 14,
        minPlanTier: 'standard',
        allowedPopupFormats: ['bottomSheet', 'centerModal'],
        isActive: true,
        sortOrder: 4,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 5. minOrderDiscount
    {
        name: 'Minimum Sipariş İndirimi',
        nameTranslations: { tr: 'Minimum Sipariş İndirimi', en: 'Minimum Order Discount', de: 'Mindestbestellrabatt', fr: 'Remise commande minimum', es: 'Descuento pedido mínimo', it: 'Sconto ordine minimo', nl: 'Minimumbestelkorting' },
        description: 'Belirli tutarın üstünde siparişlere indirim',
        descriptionTranslations: { tr: 'Belirli tutarın üstünde siparişlere indirim', en: 'Discount on orders above a certain amount', de: 'Rabatt auf Bestellungen über einem bestimmten Betrag', fr: 'Remise sur commandes au-dessus d\'un certain montant', es: 'Descuento en pedidos superiores a cierta cantidad', it: 'Sconto su ordini sopra un certo importo', nl: 'Korting op bestellingen boven een bepaald bedrag' },
        type: 'minOrderDiscount',
        icon: '📊',
        defaultValue: 5,
        defaultDurationDays: 30,
        minPlanTier: 'basic',
        allowedPopupFormats: ['bottomSheet'],
        isActive: true,
        sortOrder: 5,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 6. happyHour
    {
        name: 'Happy Hour',
        nameTranslations: { tr: 'Happy Hour', en: 'Happy Hour', de: 'Happy Hour', fr: 'Happy Hour', es: 'Hora Feliz', it: 'Happy Hour', nl: 'Happy Hour' },
        description: 'Belirli saatler arasında özel indirim',
        descriptionTranslations: { tr: 'Belirli saatler arasında özel indirim', en: 'Special discount during specific hours', de: 'Sonderrabatt zu bestimmten Zeiten', fr: 'Remise spéciale pendant certaines heures', es: 'Descuento especial en horario específico', it: 'Sconto speciale in orari specifici', nl: 'Speciale korting op bepaalde tijden' },
        type: 'happyHour',
        icon: '⏰',
        defaultValue: 15,
        defaultDurationDays: 30,
        minPlanTier: 'standard',
        allowedPopupFormats: ['topBanner', 'snackbar'],
        isActive: true,
        sortOrder: 6,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 7. flashSale
    {
        name: 'Flash Sale',
        nameTranslations: { tr: 'Flash İndirim', en: 'Flash Sale', de: 'Blitzangebot', fr: 'Vente Flash', es: 'Venta Relámpago', it: 'Vendita Flash', nl: 'Flitsverkoop' },
        description: 'Kısa süreli yoğun indirim kampanyası',
        descriptionTranslations: { tr: 'Kısa süreli yoğun indirim kampanyası', en: 'Short-term intensive discount campaign', de: 'Kurzfristige intensive Rabattaktion', fr: 'Campagne de remise intensive à court terme', es: 'Campaña de descuento intensiva a corto plazo', it: 'Campagna di sconto intensiva a breve termine', nl: 'Kortstondige intensieve kortingsactie' },
        type: 'flashSale',
        icon: '⚡',
        defaultValue: 25,
        defaultDurationDays: 3,
        minPlanTier: 'standard',
        allowedPopupFormats: ['centerModal', 'topBanner'],
        isActive: true,
        sortOrder: 7,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 8. loyaltyCard
    {
        name: 'Puan Kartı (Stempelkarte)',
        nameTranslations: { tr: 'Puan Kartı', en: 'Loyalty Card', de: 'Stempelkarte', fr: 'Carte de fidélité', es: 'Tarjeta de fidelidad', it: 'Carta fedeltà', nl: 'Klantenkaart' },
        description: 'Belirli sayıda siparişten sonra ücretsiz hediye',
        descriptionTranslations: { tr: 'Belirli sayıda siparişten sonra ücretsiz hediye', en: 'Free reward after a number of orders', de: 'Gratis Belohnung nach einer bestimmten Anzahl von Bestellungen', fr: 'Récompense gratuite après un nombre de commandes', es: 'Recompensa gratis después de cierto número de pedidos', it: 'Ricompensa gratuita dopo un certo numero di ordini', nl: 'Gratis beloning na een aantal bestellingen' },
        type: 'loyaltyCard',
        icon: '🎖',
        defaultValue: 10,
        defaultDurationDays: 90,
        minPlanTier: 'standard',
        allowedPopupFormats: ['bottomSheet'],
        isActive: true,
        sortOrder: 8,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 9. cashback
    {
        name: 'Cashback',
        nameTranslations: { tr: 'Cashback İade', en: 'Cashback', de: 'Cashback', fr: 'Cashback', es: 'Cashback', it: 'Cashback', nl: 'Cashback' },
        description: 'Sipariş sonrası cüzdana yüzdelik iade',
        descriptionTranslations: { tr: 'Sipariş sonrası cüzdana yüzdelik iade', en: 'Percentage refund to wallet after order', de: 'Prozentuale Rückerstattung an Wallet nach Bestellung', fr: 'Remboursement en pourcentage au portefeuille après commande', es: 'Reembolso porcentual a billetera después del pedido', it: 'Rimborso percentuale al portafoglio dopo l\'ordine', nl: 'Procentuele terugbetaling naar portemonnee na bestelling' },
        type: 'cashback',
        icon: '💸',
        defaultValue: 10,
        defaultDurationDays: 30,
        minPlanTier: 'premium',
        allowedPopupFormats: ['bottomSheet', 'snackbar'],
        isActive: true,
        sortOrder: 9,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 10. spinWheel
    {
        name: 'Çark Çevir',
        nameTranslations: { tr: 'Çark Çevir & Kazan', en: 'Spin & Win', de: 'Dreh & Gewinn', fr: 'Tourne & Gagne', es: 'Gira y Gana', it: 'Gira e Vinci', nl: 'Draai & Win' },
        description: 'Sipariş sonrası şans çarkı ile ödül kazanma',
        descriptionTranslations: { tr: 'Sipariş sonrası şans çarkı ile ödül kazanma', en: 'Win prizes with a lucky wheel after ordering', de: 'Gewinnen Sie Preise mit dem Glücksrad nach der Bestellung', fr: 'Gagnez des prix avec la roue de la chance après la commande', es: 'Gane premios con la rueda de la suerte después de pedir', it: 'Vinci premi con la ruota della fortuna dopo l\'ordine', nl: 'Win prijzen met het gelukswiel na bestelling' },
        type: 'spinWheel',
        icon: '🎰',
        defaultValue: 0,
        defaultDurationDays: 30,
        minPlanTier: 'premium',
        allowedPopupFormats: ['centerModal'],
        isActive: true,
        sortOrder: 10,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 11. bundleDeal
    {
        name: 'Paket / Combo Fırsat',
        nameTranslations: { tr: 'Paket / Combo Fırsat', en: 'Bundle Deal', de: 'Paketangebot', fr: 'Offre groupée', es: 'Oferta de paquete', it: 'Offerta pacchetto', nl: 'Bundelaanbieding' },
        description: 'Birden fazla ürünü paket fiyatına satın',
        descriptionTranslations: { tr: 'Birden fazla ürünü paket fiyatına satın', en: 'Sell multiple products at a bundle price', de: 'Mehrere Produkte zum Paketpreis verkaufen', fr: 'Vendre plusieurs produits à prix groupé', es: 'Vender múltiples productos a precio de paquete', it: 'Vendi più prodotti a prezzo pacchetto', nl: 'Verkoop meerdere producten voor een bundelprijs' },
        type: 'bundleDeal',
        icon: '📦',
        defaultValue: 0,
        defaultDurationDays: 14,
        minPlanTier: 'standard',
        allowedPopupFormats: ['bottomSheet', 'centerModal'],
        isActive: true,
        sortOrder: 11,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 12. productDiscount
    {
        name: 'Ürün Bazlı İndirim',
        nameTranslations: { tr: 'Ürün Bazlı İndirim', en: 'Product Discount', de: 'Produktrabatt', fr: 'Remise produit', es: 'Descuento de producto', it: 'Sconto prodotto', nl: 'Productkorting' },
        description: 'Belirli ürünlere özel yüzde indirimi',
        descriptionTranslations: { tr: 'Belirli ürünlere özel yüzde indirimi', en: 'Special percentage discount on specific products', de: 'Spezieller Prozentrabatt auf bestimmte Produkte', fr: 'Réduction spéciale en pourcentage sur des produits spécifiques', es: 'Descuento porcentual especial en productos específicos', it: 'Sconto percentuale speciale su prodotti specifici', nl: 'Speciale procentkorting op specifieke producten' },
        type: 'productDiscount',
        icon: '🏷️',
        defaultValue: 20,
        defaultDurationDays: 7,
        minPlanTier: 'basic',
        allowedPopupFormats: ['bottomSheet', 'topBanner'],
        isActive: true,
        sortOrder: 12,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 13. cartBooster
    {
        name: 'Sepet Büyütücü',
        nameTranslations: { tr: 'Sepet Büyütücü', en: 'Cart Booster', de: 'Warenkorb-Booster', fr: 'Booster de panier', es: 'Impulsor de carrito', it: 'Booster carrello', nl: 'Winkelwagen-booster' },
        description: 'Belirli tutarın üstünde sepete hediye ürün',
        descriptionTranslations: { tr: 'Belirli tutarın üstünde sepete hediye ürün', en: 'Free product for orders above a threshold', de: 'Gratis Produkt für Bestellungen über einem Schwellenwert', fr: 'Produit gratuit pour commandes au-dessus d\'un seuil', es: 'Producto gratis para pedidos superiores a un umbral', it: 'Prodotto gratuito per ordini sopra una soglia', nl: 'Gratis product bij bestellingen boven een drempel' },
        type: 'cartBooster',
        icon: '🛒',
        defaultValue: 3,
        defaultDurationDays: 14,
        minPlanTier: 'standard',
        allowedPopupFormats: ['bottomSheet', 'snackbar'],
        isActive: true,
        sortOrder: 13,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 14. segmentCampaign
    {
        name: 'Hedefli Kampanya',
        nameTranslations: { tr: 'Hedefli Kampanya', en: 'Segment Campaign', de: 'Segment-Kampagne', fr: 'Campagne ciblée', es: 'Campaña segmentada', it: 'Campagna mirata', nl: 'Gerichte campagne' },
        description: 'VIP, yeni veya geri dönen müşterilere özel',
        descriptionTranslations: { tr: 'VIP, yeni veya geri dönen müşterilere özel', en: 'Exclusive for VIP, new, or returning customers', de: 'Exklusiv für VIP-, neue oder wiederkehrende Kunden', fr: 'Exclusif pour les clients VIP, nouveaux ou récurrents', es: 'Exclusivo para clientes VIP, nuevos o recurrentes', it: 'Esclusivo per clienti VIP, nuovi o di ritorno', nl: 'Exclusief voor VIP-, nieuwe of terugkerende klanten' },
        type: 'segmentCampaign',
        icon: '🎯',
        defaultValue: 15,
        defaultDurationDays: 30,
        minPlanTier: 'premium',
        allowedPopupFormats: ['centerModal', 'bottomSheet'],
        isActive: true,
        sortOrder: 14,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 15. firstOrderSurprise
    {
        name: 'İlk Sipariş Sürprizi',
        nameTranslations: { tr: 'İlk Sipariş Sürprizi', en: 'First Order Surprise', de: 'Erste-Bestellung-Überraschung', fr: 'Surprise première commande', es: 'Sorpresa primer pedido', it: 'Sorpresa primo ordine', nl: 'Eerste bestelling verrassing' },
        description: 'İlk kez sipariş veren müşterilere otomatik indirim',
        descriptionTranslations: { tr: 'İlk kez sipariş veren müşterilere otomatik indirim', en: 'Automatic discount for first-time customers', de: 'Automatischer Rabatt für Erstbesteller', fr: 'Remise automatique pour les nouveaux clients', es: 'Descuento automático para nuevos clientes', it: 'Sconto automatico per i nuovi clienti', nl: 'Automatische korting voor nieuwe klanten' },
        type: 'firstOrderSurprise',
        icon: '💳',
        defaultValue: 20,
        defaultDurationDays: 90,
        minPlanTier: 'standard',
        allowedPopupFormats: ['centerModal', 'bottomSheet'],
        isActive: true,
        sortOrder: 15,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
    // 16. pushPromo
    {
        name: 'Push Promosyon',
        nameTranslations: { tr: 'Push Promosyon', en: 'Push Promotion', de: 'Push-Promotion', fr: 'Promotion push', es: 'Promoción push', it: 'Promozione push', nl: 'Push-promotie' },
        description: 'Bildirimle gönderilen özel fırsat kodu',
        descriptionTranslations: { tr: 'Bildirimle gönderilen özel fırsat kodu', en: 'Special offer code sent via push notification', de: 'Spezieller Angebotscode per Push-Benachrichtigung', fr: 'Code offre spéciale par notification push', es: 'Código de oferta especial por notificación push', it: 'Codice offerta speciale via notifica push', nl: 'Speciale aanbiedingscode via pushmelding' },
        type: 'pushPromo',
        icon: '📲',
        defaultValue: 10,
        defaultDurationDays: 7,
        minPlanTier: 'premium',
        allowedPopupFormats: ['snackbar', 'topBanner'],
        isActive: true,
        sortOrder: 16,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    },
];

async function seedTemplates() {
    console.log('🎯 Seeding 16 promotion templates...\n');

    const batch = db.batch();
    const collectionRef = db.collection('promotionTemplates');

    for (const template of TEMPLATES) {
        const docRef = collectionRef.doc(template.type);
        batch.set(docRef, template, { merge: true });
        console.log(`  ✅ ${template.icon} ${template.name} (${template.type})`);
    }

    await batch.commit();
    console.log('\n🚀 All 16 templates seeded successfully!');
    process.exit(0);
}

seedTemplates().catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
});
