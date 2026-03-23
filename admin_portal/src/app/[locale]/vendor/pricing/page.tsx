'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';
import { subscriptionService } from '@/services/subscriptionService';
import { ButcherSubscriptionPlan } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';

// ── i18n ──────────────────────────────────────────────────────────
const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Planlar ve Fiyatlar',
        heroTitle: 'Transparente Preise',
        heroHighlight: 'für Ihr Geschäft.',
        heroSub: 'Wählen Sie den passenden Plan für Ihre Branche. Alle Pläne beinhalten persönlichen Support und eine kostenlose Testphase.',
        segYemek: 'Gastronomie',
        segMarket: 'Marketplace',
        perMonth: '/Monat',
        perYear: '/Jahr',
        orYearly: 'oder',
        free: 'Kostenlos',
        popular: 'AM BELIEBTESTEN',
        getStarted: 'Jetzt starten',
        contactUs: 'Kontakt aufnehmen',
        features: 'Funktionen',
        limits: 'Limits & Konditionen',
        orders: 'Bestellungen',
        products: 'Produkte',
        staff: 'Personal',
        commission: 'Provision',
        unlimited: 'Unbegrenzt',
        included: 'Inklusive',
        notIncluded: 'Nicht enthalten',
        trialDays: 'Tage kostenlos testen',
        setupFee: 'Einrichtungsgebühr',
        faqTitle: 'Häufig gestellte Fragen',
        faq1Q: 'Kann ich den Plan jederzeit wechseln?',
        faq1A: 'Ja, Sie können jederzeit upgraden oder downgraden. Die Änderung wird zum nächsten Abrechnungszeitraum wirksam.',
        faq2Q: 'Gibt es eine Mindestvertragslaufzeit?',
        faq2A: 'Die meisten Pläne haben keine Mindestlaufzeit. Nur bei Hardware-Paketen (ESL) kann eine Laufzeit gelten.',
        faq3Q: 'Wie funktioniert die kostenlose Testphase?',
        faq3A: 'Starten Sie mit allen Funktionen Ihres gewählten Plans. Keine Kreditkarte erforderlich während der Testphase.',
        ctaTitle: 'Bereit loszulegen?',
        ctaSub: 'Starten Sie noch heute mit LOKMA und digitalisieren Sie Ihr Geschäft.',
        ctaBtn: 'Jetzt Partner werden',
        loading: 'Pläne werden geladen...',
        noPlans: 'Keine Pläne für dieses Segment verfügbar.',
        // Feature labels
        fClickCollect: 'Gel-Al (Click & Collect)',
        fDelivery: 'Lieferung',
        fOnlinePayment: 'Online-Zahlung',
        fCampaigns: 'Kampagnen',
        fPrioritySupport: 'Priority Support',
        fCourierTracking: 'Live-Kuriertracking',
        fPOS: 'POS-Integration',
        fESL: 'ESL-Integration',
        fScale: 'Waagen-Integration',
        fAccounting: 'Buchhaltung',
        fAI: 'KI-Bestellung',
        fReservation: 'Tischreservierung',
        fDineInQR: 'QR-Bestellung',
        fWaiter: 'Kellnerbestellung',
        fCoupon: 'Kupon-System',
        fReferral: 'Empfehlungssystem',
        fFirstOrder: 'Erstbestellungsrabatt',
        fFreeDrink: 'Gratis-Getränk',
        fDonation: 'Spendenaufrundung',
        fSponsored: 'Gesponserte Produkte',
    },
    tr: {
        title: 'Planlar ve Fiyatlar',
        heroTitle: 'Seffaf fiyatlar',
        heroHighlight: 'isletmeniz icin.',
        heroSub: 'Sektorunuze uygun plani secin. Tum planlar kisisel destek ve ucretsiz deneme suresi icerir.',
        segYemek: 'Yemek',
        segMarket: 'Marketplace',
        perMonth: '/ay',
        perYear: '/yil',
        orYearly: 'veya',
        free: 'Ucretsiz',
        popular: 'EN POPULER',
        getStarted: 'Hemen Basla',
        contactUs: 'Iletisime Gec',
        features: 'Ozellikler',
        limits: 'Limitler & Kosullar',
        orders: 'Siparis',
        products: 'Urun',
        staff: 'Personel',
        commission: 'Komisyon',
        unlimited: 'Sinirsiz',
        included: 'Dahil',
        notIncluded: 'Dahil degil',
        trialDays: 'gun ucretsiz dene',
        setupFee: 'Kurulum Ucreti',
        faqTitle: 'Sikca Sorulan Sorular',
        faq1Q: 'Plani istedigim zaman degistirebilir miyim?',
        faq1A: 'Evet, istediginiz zaman yukseltin veya dusurun. Degisiklik bir sonraki fatura doneminizde gecerli olur.',
        faq2Q: 'Minimum sozlesme suresi var mi?',
        faq2A: 'Cogu planin minimum suresi yoktur. Sadece donanim paketlerinde (ESL) minimum sure uygulanabilir.',
        faq3Q: 'Ucretsiz deneme suresi nasil calisiyor?',
        faq3A: 'Sectiginiz planin tum ozellikleriyle baslayin. Deneme surecinde kredi karti gerekmez.',
        ctaTitle: 'Baslamaya hazir misiniz?',
        ctaSub: 'LOKMA ile bugun baslayin ve isletmenizi dijitallestirin.',
        ctaBtn: 'Simdi Partner Ol',
        loading: 'Planlar yukleniyor...',
        noPlans: 'Bu segment icin plan bulunmuyor.',
        fClickCollect: 'Gel-Al',
        fDelivery: 'Teslimat',
        fOnlinePayment: 'Online Odeme',
        fCampaigns: 'Kampanyalar',
        fPrioritySupport: 'Oncelikli Destek',
        fCourierTracking: 'Canli Kurye Takibi',
        fPOS: 'POS Entegrasyonu',
        fESL: 'ESL Entegrasyonu',
        fScale: 'Terazi Entegrasyonu',
        fAccounting: 'Muhasebe',
        fAI: 'AI Siparis',
        fReservation: 'Masa Rezervasyonu',
        fDineInQR: 'QR Siparis',
        fWaiter: 'Garson Siparisi',
        fCoupon: 'Kupon Sistemi',
        fReferral: 'Davet Sistemi',
        fFirstOrder: 'Ilk Siparis Indirimi',
        fFreeDrink: 'Gratis Icecek',
        fDonation: 'Bagis Yuvarlama',
        fSponsored: 'Sponsorlu Urunler',
    },
    en: {
        title: 'Plans & Pricing',
        heroTitle: 'Transparent pricing',
        heroHighlight: 'for your business.',
        heroSub: 'Choose the right plan for your industry. All plans include personal support and a free trial period.',
        segYemek: 'Food & Dining',
        segMarket: 'Marketplace',
        perMonth: '/month',
        perYear: '/year',
        orYearly: 'or',
        free: 'Free',
        popular: 'MOST POPULAR',
        getStarted: 'Get Started',
        contactUs: 'Contact Us',
        features: 'Features',
        limits: 'Limits & Conditions',
        orders: 'Orders',
        products: 'Products',
        staff: 'Staff',
        commission: 'Commission',
        unlimited: 'Unlimited',
        included: 'Included',
        notIncluded: 'Not included',
        trialDays: 'days free trial',
        setupFee: 'Setup Fee',
        faqTitle: 'Frequently Asked Questions',
        faq1Q: 'Can I change my plan anytime?',
        faq1A: 'Yes, you can upgrade or downgrade at any time. Changes take effect at your next billing cycle.',
        faq2Q: 'Is there a minimum contract period?',
        faq2A: 'Most plans have no minimum term. Only hardware packages (ESL) may require a commitment.',
        faq3Q: 'How does the free trial work?',
        faq3A: 'Start with all features of your chosen plan. No credit card required during the trial.',
        ctaTitle: 'Ready to get started?',
        ctaSub: 'Start with LOKMA today and digitalize your business.',
        ctaBtn: 'Become a Partner',
        loading: 'Loading plans...',
        noPlans: 'No plans available for this segment.',
        fClickCollect: 'Click & Collect',
        fDelivery: 'Delivery',
        fOnlinePayment: 'Online Payment',
        fCampaigns: 'Campaigns',
        fPrioritySupport: 'Priority Support',
        fCourierTracking: 'Live Courier Tracking',
        fPOS: 'POS Integration',
        fESL: 'ESL Integration',
        fScale: 'Scale Integration',
        fAccounting: 'Accounting',
        fAI: 'AI Ordering',
        fReservation: 'Table Reservation',
        fDineInQR: 'QR Ordering',
        fWaiter: 'Waiter Order',
        fCoupon: 'Coupon System',
        fReferral: 'Referral System',
        fFirstOrder: 'First Order Discount',
        fFreeDrink: 'Free Drink',
        fDonation: 'Donation Round-Up',
        fSponsored: 'Sponsored Products',
    },
    fr: {
        title: 'Plans et Tarifs',
        heroTitle: 'Des prix transparents',
        heroHighlight: 'pour votre commerce.',
        heroSub: 'Choisissez le plan adapte a votre secteur. Support personnel et essai gratuit inclus.',
        segYemek: 'Restauration',
        segMarket: 'Marketplace',
        perMonth: '/mois', perYear: '/an', orYearly: 'ou', free: 'Gratuit',
        popular: 'LE PLUS POPULAIRE', getStarted: 'Commencer', contactUs: 'Nous contacter',
        features: 'Fonctionnalites', limits: 'Limites', orders: 'Commandes', products: 'Produits',
        staff: 'Personnel', commission: 'Commission', unlimited: 'Illimite',
        included: 'Inclus', notIncluded: 'Non inclus', trialDays: 'jours gratuits', setupFee: 'Frais installation',
        faqTitle: 'Questions frequentes',
        faq1Q: 'Puis-je changer de plan ?', faq1A: 'Oui, vous pouvez changer a tout moment.',
        faq2Q: 'Y a-t-il une duree minimale ?', faq2A: 'Non, sauf pour les packs ESL.',
        faq3Q: 'Comment fonctionne l\'essai ?', faq3A: 'Acces complet sans carte bancaire.',
        ctaTitle: 'Pret a commencer ?', ctaSub: 'Lancez-vous avec LOKMA.', ctaBtn: 'Devenir partenaire',
        loading: 'Chargement...', noPlans: 'Aucun plan disponible.',
        fClickCollect: 'Click & Collect', fDelivery: 'Livraison', fOnlinePayment: 'Paiement en ligne',
        fCampaigns: 'Campagnes', fPrioritySupport: 'Support prioritaire', fCourierTracking: 'Suivi coursier',
        fPOS: 'Integration POS', fESL: 'Integration ESL', fScale: 'Integration balance',
        fAccounting: 'Comptabilite', fAI: 'Commande IA', fReservation: 'Reservation table',
        fDineInQR: 'Commande QR', fWaiter: 'Commande serveur', fCoupon: 'Systeme coupons',
        fReferral: 'Parrainage', fFirstOrder: 'Remise 1ere commande', fFreeDrink: 'Boisson gratuite',
        fDonation: 'Arrondi don', fSponsored: 'Produits sponsorises',
    },
    it: {
        title: 'Piani e Prezzi',
        heroTitle: 'Prezzi trasparenti',
        heroHighlight: 'per la tua attivita.',
        heroSub: 'Scegli il piano giusto per il tuo settore. Supporto personale e prova gratuita inclusi.',
        segYemek: 'Ristorazione',
        segMarket: 'Marketplace',
        perMonth: '/mese', perYear: '/anno', orYearly: 'o', free: 'Gratuito',
        popular: 'PIU POPOLARE', getStarted: 'Inizia ora', contactUs: 'Contattaci',
        features: 'Funzionalita', limits: 'Limiti', orders: 'Ordini', products: 'Prodotti',
        staff: 'Personale', commission: 'Commissione', unlimited: 'Illimitato',
        included: 'Incluso', notIncluded: 'Non incluso', trialDays: 'giorni gratis', setupFee: 'Costo installazione',
        faqTitle: 'Domande frequenti',
        faq1Q: 'Posso cambiare piano?', faq1A: 'Si, in qualsiasi momento.',
        faq2Q: 'C\'e una durata minima?', faq2A: 'No, salvo i pacchetti ESL.',
        faq3Q: 'Come funziona la prova?', faq3A: 'Accesso completo senza carta di credito.',
        ctaTitle: 'Pronto a iniziare?', ctaSub: 'Inizia con LOKMA oggi.', ctaBtn: 'Diventa partner',
        loading: 'Caricamento...', noPlans: 'Nessun piano disponibile.',
        fClickCollect: 'Click & Collect', fDelivery: 'Consegna', fOnlinePayment: 'Pagamento online',
        fCampaigns: 'Campagne', fPrioritySupport: 'Supporto prioritario', fCourierTracking: 'Tracking corriere',
        fPOS: 'Integrazione POS', fESL: 'Integrazione ESL', fScale: 'Integrazione bilancia',
        fAccounting: 'Contabilita', fAI: 'Ordine IA', fReservation: 'Prenotazione tavolo',
        fDineInQR: 'Ordine QR', fWaiter: 'Ordine cameriere', fCoupon: 'Sistema coupon',
        fReferral: 'Sistema referral', fFirstOrder: 'Sconto primo ordine', fFreeDrink: 'Bevanda gratis',
        fDonation: 'Arrotondamento donazione', fSponsored: 'Prodotti sponsorizzati',
    },
    es: {
        title: 'Planes y Precios',
        heroTitle: 'Precios transparentes',
        heroHighlight: 'para tu negocio.',
        heroSub: 'Elige el plan adecuado para tu sector. Soporte personal y prueba gratuita incluidos.',
        segYemek: 'Gastronomia',
        segMarket: 'Marketplace',
        perMonth: '/mes', perYear: '/ano', orYearly: 'o', free: 'Gratis',
        popular: 'MAS POPULAR', getStarted: 'Empezar', contactUs: 'Contactar',
        features: 'Funciones', limits: 'Limites', orders: 'Pedidos', products: 'Productos',
        staff: 'Personal', commission: 'Comision', unlimited: 'Ilimitado',
        included: 'Incluido', notIncluded: 'No incluido', trialDays: 'dias gratis', setupFee: 'Coste instalacion',
        faqTitle: 'Preguntas frecuentes',
        faq1Q: 'Puedo cambiar de plan?', faq1A: 'Si, en cualquier momento.',
        faq2Q: 'Hay un periodo minimo?', faq2A: 'No, salvo para packs ESL.',
        faq3Q: 'Como funciona la prueba?', faq3A: 'Acceso completo sin tarjeta de credito.',
        ctaTitle: 'Listo para empezar?', ctaSub: 'Empieza con LOKMA hoy.', ctaBtn: 'Ser socio',
        loading: 'Cargando...', noPlans: 'No hay planes disponibles.',
        fClickCollect: 'Click & Collect', fDelivery: 'Entrega', fOnlinePayment: 'Pago online',
        fCampaigns: 'Campanas', fPrioritySupport: 'Soporte prioritario', fCourierTracking: 'Tracking mensajero',
        fPOS: 'Integracion POS', fESL: 'Integracion ESL', fScale: 'Integracion bascula',
        fAccounting: 'Contabilidad', fAI: 'Pedido IA', fReservation: 'Reserva mesa',
        fDineInQR: 'Pedido QR', fWaiter: 'Pedido camarero', fCoupon: 'Sistema cupones',
        fReferral: 'Sistema referidos', fFirstOrder: 'Descuento 1er pedido', fFreeDrink: 'Bebida gratis',
        fDonation: 'Redondeo donacion', fSponsored: 'Productos patrocinados',
    },
    nl: {
        title: 'Plannen en Prijzen',
        heroTitle: 'Transparante prijzen',
        heroHighlight: 'voor uw bedrijf.',
        heroSub: 'Kies het juiste plan voor uw branche. Persoonlijke ondersteuning en gratis proefperiode inbegrepen.',
        segYemek: 'Horeca',
        segMarket: 'Marketplace',
        perMonth: '/maand', perYear: '/jaar', orYearly: 'of', free: 'Gratis',
        popular: 'MEEST POPULAIR', getStarted: 'Nu starten', contactUs: 'Contact opnemen',
        features: 'Functies', limits: 'Limieten', orders: 'Bestellingen', products: 'Producten',
        staff: 'Personeel', commission: 'Commissie', unlimited: 'Onbeperkt',
        included: 'Inbegrepen', notIncluded: 'Niet inbegrepen', trialDays: 'dagen gratis', setupFee: 'Installatiekosten',
        faqTitle: 'Veelgestelde vragen',
        faq1Q: 'Kan ik van plan wisselen?', faq1A: 'Ja, op elk moment.',
        faq2Q: 'Is er een minimale looptijd?', faq2A: 'Nee, behalve voor ESL-pakketten.',
        faq3Q: 'Hoe werkt de proefperiode?', faq3A: 'Volledige toegang zonder creditcard.',
        ctaTitle: 'Klaar om te starten?', ctaSub: 'Begin vandaag met LOKMA.', ctaBtn: 'Word partner',
        loading: 'Laden...', noPlans: 'Geen plannen beschikbaar.',
        fClickCollect: 'Click & Collect', fDelivery: 'Bezorging', fOnlinePayment: 'Online betaling',
        fCampaigns: 'Campagnes', fPrioritySupport: 'Prioriteitsondersteuning', fCourierTracking: 'Live tracking',
        fPOS: 'POS-integratie', fESL: 'ESL-integratie', fScale: 'Weegschaalintegratie',
        fAccounting: 'Boekhouding', fAI: 'AI-bestelling', fReservation: 'Tafelreservering',
        fDineInQR: 'QR-bestelling', fWaiter: 'Kelnerbestelling', fCoupon: 'Couponsysteem',
        fReferral: 'Verwijzingssysteem', fFirstOrder: 'Eerste bestelling korting', fFreeDrink: 'Gratis drankje',
        fDonation: 'Donatie afronding', fSponsored: 'Gesponsorde producten',
    },
};

// ── Segment mapping ──────────────────────────────────────────────
const SEGMENTS = [
    { id: 'yemek', icon: 'restaurant' },
    { id: 'market', icon: 'storefront' },
];

// ── Feature keys for comparison ──────────────────────────────────
const FEATURE_KEYS: { key: string; labelKey: string }[] = [
    { key: 'clickAndCollect', labelKey: 'fClickCollect' },
    { key: 'delivery', labelKey: 'fDelivery' },
    { key: 'onlinePayment', labelKey: 'fOnlinePayment' },
    { key: 'campaigns', labelKey: 'fCampaigns' },
    { key: 'dineInQR', labelKey: 'fDineInQR' },
    { key: 'waiterOrder', labelKey: 'fWaiter' },
    { key: 'tableReservation', labelKey: 'fReservation' },
    { key: 'couponSystem', labelKey: 'fCoupon' },
    { key: 'referralSystem', labelKey: 'fReferral' },
    { key: 'firstOrderDiscount', labelKey: 'fFirstOrder' },
    { key: 'freeDrink', labelKey: 'fFreeDrink' },
    { key: 'donationRoundUp', labelKey: 'fDonation' },
    { key: 'sponsoredProducts', labelKey: 'fSponsored' },
    { key: 'prioritySupport', labelKey: 'fPrioritySupport' },
    { key: 'liveCourierTracking', labelKey: 'fCourierTracking' },
    { key: 'posIntegration', labelKey: 'fPOS' },
    { key: 'eslIntegration', labelKey: 'fESL' },
    { key: 'scaleIntegration', labelKey: 'fScale' },
    { key: 'accountingIntegration', labelKey: 'fAccounting' },
    { key: 'aiSupplierOrdering', labelKey: 'fAI' },
];

// ── Color map: plan.color (Tailwind class) -> gradient ───────────
function planGradient(color: string): string {
    if (color.includes('green')) return 'from-emerald-500 to-emerald-600';
    if (color.includes('blue')) return 'from-blue-500 to-blue-600';
    if (color.includes('yellow')) return 'from-amber-500 to-amber-600';
    if (color.includes('purple')) return 'from-purple-500 to-purple-600';
    if (color.includes('red')) return 'from-red-500 to-red-600';
    if (color.includes('pink')) return 'from-pink-500 to-pink-600';
    if (color.includes('indigo')) return 'from-indigo-500 to-indigo-600';
    return 'from-gray-500 to-gray-600';
}

function planAccent(color: string): string {
    if (color.includes('green')) return '#10b981';
    if (color.includes('blue')) return '#3b82f6';
    if (color.includes('yellow')) return '#f59e0b';
    if (color.includes('purple')) return '#8b5cf6';
    if (color.includes('red')) return '#ef4444';
    if (color.includes('pink')) return '#ec4899';
    if (color.includes('indigo')) return '#6366f1';
    return '#6b7280';
}

// ═══════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function VendorPricingPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['de'];
    const t = (k: string) => tx[k] || k;

    const [selectedSegment, setSelectedSegment] = useState('yemek');
    const [plans, setPlans] = useState<ButcherSubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    // Fetch plans when segment changes
    useEffect(() => {
        const fetchPlans = async () => {
            setLoading(true);
            try {
                const data = await subscriptionService.getActivePlans(selectedSegment);
                setPlans(data);
            } catch (err) {
                console.error('Failed to fetch plans:', err);
                setPlans([]);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, [selectedSegment]);

    const faqs = [
        { q: t('faq1Q'), a: t('faq1A') },
        { q: t('faq2Q'), a: t('faq2A') },
        { q: t('faq3Q'), a: t('faq3A') },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />

            {/* ── Hero ─────────────────────────────────────────── */}
            <section className="pt-32 pb-12 px-4 md:px-8">
                <div className="max-w-5xl mx-auto text-center">
                    <span className="inline-flex items-center gap-2 bg-[#ea184a]/10 text-[#ea184a] px-4 py-1.5 rounded-full text-sm font-bold mb-6 tracking-widest uppercase border border-[#ea184a]/20">
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        {t('title')}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight mb-6">
                        {t('heroTitle')}<br />
                        <span className="bg-gradient-to-r from-[#ea184a] to-[#ff6b6b] bg-clip-text text-transparent">{t('heroHighlight')}</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
                        {t('heroSub')}
                    </p>
                </div>
            </section>

            {/* ── Segment Toggle ───────────────────────────────── */}
            <section className="pb-8 px-4">
                <div className="max-w-5xl mx-auto flex justify-center">
                    <div className="inline-flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-1.5 gap-1">
                        {SEGMENTS.map(seg => (
                            <button
                                key={seg.id}
                                onClick={() => setSelectedSegment(seg.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                    selectedSegment === seg.id
                                        ? 'bg-[#ea184a] text-white shadow-lg shadow-[#ea184a]/25'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{seg.icon}</span>
                                {seg.id === 'yemek' ? t('segYemek') : t('segMarket')}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Plan Cards ───────────────────────────────────── */}
            <section className="pb-20 px-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex items-center gap-3 text-gray-400">
                                <div className="w-6 h-6 border-2 border-[#ea184a] border-t-transparent rounded-full animate-spin" />
                                {t('loading')}
                            </div>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <span className="material-symbols-outlined text-5xl mb-4 block opacity-40">inventory_2</span>
                            {t('noPlans')}
                        </div>
                    ) : (
                        <div className={`grid grid-cols-1 gap-6 ${
                            plans.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' :
                            plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' :
                            plans.length === 3 ? 'md:grid-cols-3' :
                            'md:grid-cols-2 lg:grid-cols-4'
                        }`}>
                            {plans.map((plan) => {
                                const accent = planAccent(plan.color);
                                const isFree = plan.monthlyFee === 0;
                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-3xl border transition-all duration-300 hover:-translate-y-1 flex flex-col ${
                                            plan.highlighted
                                                ? 'border-[#ea184a]/50 shadow-2xl shadow-[#ea184a]/10 dark:shadow-[#ea184a]/5 scale-[1.02]'
                                                : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                        } bg-white dark:bg-white/[0.02]`}
                                    >
                                        {/* Popular badge */}
                                        {plan.highlighted && (
                                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                                                <span className="bg-gradient-to-r from-[#ea184a] to-[#ff6b6b] text-white text-[11px] font-black px-4 py-1.5 rounded-full tracking-wider shadow-lg">
                                                    {t('popular')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Color bar */}
                                        <div className={`h-1.5 rounded-t-3xl bg-gradient-to-r ${planGradient(plan.color)}`} />

                                        <div className="p-6 flex-1 flex flex-col">
                                            {/* Plan name */}
                                            <h3 className="text-xl font-black mb-1 tracking-tight">{plan.name}</h3>
                                            {plan.description && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">{plan.description}</p>
                                            )}

                                            {/* Price */}
                                            <div className="mb-6">
                                                {isFree ? (
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-emerald-500">{t('free')}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-4xl font-black">{formatCurrency(plan.monthlyFee, plan.currency || 'EUR')}</span>
                                                            <span className="text-gray-400 font-medium">{t('perMonth')}</span>
                                                        </div>
                                                        {plan.yearlyFee > 0 && (
                                                            <p className="text-sm text-gray-400 mt-1">
                                                                {t('orYearly')} {formatCurrency(plan.yearlyFee, plan.currency || 'EUR')}{t('perYear')}
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Trial badge */}
                                            {plan.trialDays > 0 && (
                                                <div className="mb-4 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold w-fit">
                                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                    {plan.trialDays} {t('trialDays')}
                                                </div>
                                            )}

                                            {/* Limits compact grid */}
                                            <div className="grid grid-cols-3 gap-0 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 p-1 mb-5">
                                                <div className="text-center py-2.5">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">{t('orders')}</p>
                                                    <p className="text-sm font-bold">{plan.orderLimit === null || plan.orderLimit === undefined ? '∞' : plan.orderLimit}</p>
                                                </div>
                                                <div className="text-center py-2.5 border-x border-gray-100 dark:border-white/5">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">{t('staff')}</p>
                                                    <p className="text-sm font-bold">{plan.personnelLimit === null || plan.personnelLimit === undefined ? '∞' : plan.personnelLimit}</p>
                                                </div>
                                                <div className="text-center py-2.5">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">{t('commission')}</p>
                                                    <p className="text-sm font-bold" style={{ color: accent }}>%{plan.commissionClickCollect || 0}</p>
                                                </div>
                                            </div>

                                            {/* Feature list */}
                                            <div className="flex-1 space-y-2 mb-6">
                                                {FEATURE_KEYS.map(({ key, labelKey }) => {
                                                    const val = (plan.features as any)?.[key];
                                                    if (val === undefined) return null;
                                                    return (
                                                        <div key={key} className="flex items-center gap-2.5 text-sm">
                                                            {val ? (
                                                                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                                    style={{ backgroundColor: `${accent}20`, color: accent }}>
                                                                    <span className="material-symbols-outlined text-[12px]">check</span>
                                                                </span>
                                                            ) : (
                                                                <span className="w-5 h-5 bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                                                </span>
                                                            )}
                                                            <span className={val ? '' : 'text-gray-400 dark:text-gray-500 line-through'}>
                                                                {t(labelKey)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Setup fee note */}
                                            {plan.setupFee > 0 && (
                                                <p className="text-xs text-gray-400 mb-4">
                                                    {t('setupFee')}: {formatCurrency(plan.setupFee, plan.currency || 'EUR')}
                                                </p>
                                            )}

                                            {/* CTA */}
                                            <Link
                                                href="/partner/apply"
                                                className={`w-full text-center py-3.5 rounded-xl font-bold transition-all duration-300 block ${
                                                    plan.highlighted
                                                        ? 'bg-[#ea184a] hover:bg-red-600 text-white shadow-lg shadow-[#ea184a]/20 hover:shadow-xl hover:shadow-[#ea184a]/30'
                                                        : isFree
                                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                                            : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10'
                                                }`}
                                            >
                                                {isFree ? t('getStarted') : plan.monthlyFee >= 99 ? t('contactUs') : t('getStarted')}
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Feature Comparison Table ──────────────────────── */}
            {!loading && plans.length > 1 && (
                <section className="pb-20 px-4 md:px-8">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="text-3xl font-black tracking-tight text-center mb-10">{t('features')}</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left py-4 px-4 text-sm font-bold text-gray-400 uppercase tracking-wider w-[240px]">{t('features')}</th>
                                        {plans.map(p => (
                                            <th key={p.id} className="text-center py-4 px-3">
                                                <div className={`inline-block w-3 h-3 rounded-full bg-gradient-to-r ${planGradient(p.color)} mb-2`} />
                                                <div className="font-bold text-sm">{p.name}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {FEATURE_KEYS.map(({ key, labelKey }, idx) => (
                                        <tr key={key} className={idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-white/[0.015]' : ''}>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{t(labelKey)}</td>
                                            {plans.map(p => {
                                                const val = (p.features as any)?.[key];
                                                return (
                                                    <td key={p.id} className="text-center py-3 px-3">
                                                        {val ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10">
                                                                <span className="material-symbols-outlined text-emerald-500 text-[14px]">check</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-white/5">
                                                                <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-[14px]">close</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}

                                    {/* Limits rows */}
                                    <tr className="border-t-2 border-gray-200 dark:border-white/10">
                                        <td className="py-3 px-4 text-sm font-bold text-gray-400 uppercase tracking-wider">{t('limits')}</td>
                                        {plans.map(p => <td key={p.id} />)}
                                    </tr>
                                    <tr className="bg-gray-50/50 dark:bg-white/[0.015]">
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{t('orders')}</td>
                                        {plans.map(p => (
                                            <td key={p.id} className="text-center py-3 px-3 text-sm font-bold">
                                                {p.orderLimit === null || p.orderLimit === undefined ? t('unlimited') : `${p.orderLimit}/ay`}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{t('products')}</td>
                                        {plans.map(p => (
                                            <td key={p.id} className="text-center py-3 px-3 text-sm font-bold">
                                                {p.productLimit === null || p.productLimit === undefined ? t('unlimited') : p.productLimit}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="bg-gray-50/50 dark:bg-white/[0.015]">
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{t('staff')}</td>
                                        {plans.map(p => (
                                            <td key={p.id} className="text-center py-3 px-3 text-sm font-bold">
                                                {p.personnelLimit === null || p.personnelLimit === undefined ? t('unlimited') : p.personnelLimit}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{t('commission')} (Gel-Al)</td>
                                        {plans.map(p => (
                                            <td key={p.id} className="text-center py-3 px-3 text-sm font-bold">
                                                %{p.commissionClickCollect || 0}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {/* ── FAQ ──────────────────────────────────────────── */}
            <section className="pb-20 px-4 md:px-8 bg-gray-50 dark:bg-[#0a0a0f] py-20">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-black tracking-tight text-center mb-10">{t('faqTitle')}</h2>
                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <div key={index} className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02]">
                                <button
                                    className="w-full flex items-center justify-between p-5 text-left"
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                >
                                    <span className="font-bold text-sm pr-4">{faq.q}</span>
                                    <span className={`material-symbols-outlined text-gray-400 transition-transform duration-300 flex-shrink-0 ${openFaq === index ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === index ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="px-5 pb-5 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                                        {faq.a}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Bottom CTA ───────────────────────────────────── */}
            <section className="py-20 px-4 md:px-8">
                <div className="max-w-4xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ea184a]/10 to-purple-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-gradient-to-br from-[#ea184a]/5 to-purple-500/5 border border-gray-200 dark:border-white/10 rounded-3xl p-12 md:p-16 text-center">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">{t('ctaTitle')}</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-2xl mx-auto">{t('ctaSub')}</p>
                        <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-[#ea184a]/25 transition-all hover:scale-105 active:scale-95">
                            {t('ctaBtn')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </section>

            <PublicFooter themeAware={true} />

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
