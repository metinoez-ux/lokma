'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        badge: 'Bald verfügbar', heroTitle1: 'Vom Feld', heroTitle2: 'auf den Tisch',
        heroSub: 'Ohne Zwischenhändler, frisch, günstig. Unterstütze türkische Bauern und genieße Produkte direkt vom Feld.',
        problemTitle: 'Die Situation der Bauern 2026',
        problemDesc: 'Türkische Bauern erhalten nur **20-30%** des Endpreises. Zwischenhändler und Großhändler nehmen den Großteil, während die Verbraucher hohe Preise zahlen.',
        s1: '%70', s1d: 'Anteil der Zwischenhändler', s2: '3-5x', s2d: 'Preisanstieg (Feld → Markt)', s3: '%40', s3d: 'Lebensmittelverschwendung',
        solTitle: 'Die LOKMA-Lösung',
        solDesc: 'LOKMA verbindet Bauern direkt mit Verbrauchern. Der Bauer verdient fair, der Verbraucher erhält frische Produkte zu günstigen Preisen.',
        f1: 'Direktverkauf', f1d: 'Der Bauer lädt seine Produkte direkt auf die Plattform.', f2: 'Kühlketten-Logistik', f2d: 'Frische Produkte, optimierte Lieferrouten.',
        f3: 'Faire Preise', f3d: 'Transparente Provision, 80%+ für den Bauern.', f4: 'Qualitätsgarantie', f4d: 'Jedes Produkt wird kontrolliert, Zufriedenheitsgarantie.',
        productsTitle: 'Bald verfügbare Produkte',
        p1: 'Obst', p2: 'Gemüse', p3: 'Milchprodukte', p4: 'Eier', p5: 'Honig', p6: 'Olivenöl', p7: 'Hülsenfrüchte', p8: 'Getreide',
        appBadge: 'In der App bestellen', appTitle: 'Laden Sie die', appTitle2: 'App herunter, um zu bestellen',
        appDesc: 'Frische Produkte vom Feld, Bauernmarkt und Sonderangebote in unserer App. Jetzt herunterladen!',
        farmerQ: 'Sind Sie Landwirt?', farmerDesc: 'Melden Sie sich jetzt an, um der LOKMA-Plattform beizutreten. Exklusive Vorteile für Frühregistrierungen!', farmerCta: 'Frühregistrierung',
    },
    tr: {
        badge: 'Yakında Geliyor', heroTitle1: 'Tarladan', heroTitle2: 'Sofraya',
        heroSub: 'Aracısız, taze, uygun fiyat. Türk çiftçilerini destekle, tarladan sofrana direkt ulaşan ürünlerle tanış.',
        problemTitle: '2026\'da Çiftçilerin Durumu',
        problemDesc: 'Türkiye\'de çiftçiler, ürettikleri ürünlerin sadece **%20-30\'unu** alabiliyorlar. Aracılar, komisyoncular ve toptancılar arasında kaybolurken, tüketiciler de pahalı fiyatlarla karşı karşıya kalıyor.',
        s1: '%70', s1d: 'Aracılara giden pay', s2: '3-5x', s2d: 'Fiyat artışı (tarladan markete)', s3: '%40', s3d: 'Ürün israfı oranı',
        solTitle: 'LOKMA Çözümü',
        solDesc: 'LOKMA olarak çiftçilerimizi aracısız bir şekilde tüketiciye bağlıyoruz. Hem çiftçi adil kazanç elde ediyor, hem de tüketici taze ve uygun fiyatlı ürünlere ulaşıyor.',
        f1: 'Doğrudan Satış', f1d: 'Çiftçi ürününü direkt platforma yükler, aracı yok.', f2: 'Soğuk Zincir Lojistik', f2d: 'Taze ürünler, optimize edilmiş teslimat rotaları.',
        f3: 'Adil Fiyatlandırma', f3d: 'Şeffaf komisyon, çiftçiye %80+ pay.', f4: 'Kalite Garantisi', f4d: 'Her ürün kontrol edilir, memnuniyet garantisi.',
        productsTitle: 'Yakında Gelecek Ürünler',
        p1: 'Meyve', p2: 'Sebze', p3: 'Süt Ürünleri', p4: 'Yumurta', p5: 'Bal', p6: 'Zeytinyağı', p7: 'Baklagil', p8: 'Tahıl',
        appBadge: 'Alışveriş Uygulamada', appTitle: 'Sipariş vermek için', appTitle2: 'uygulamasını indir',
        appDesc: 'Tarladan sofraya taze ürünler, çiftçi pazarı ve özel kampanyalar uygulamamızda. Hemen indir, siparişe başla!',
        farmerQ: 'Çiftçi misiniz?', farmerDesc: 'LOKMA platformuna katılmak için şimdiden başvurun. Lansman öncesi kaydolan çiftçilere özel avantajlar!', farmerCta: 'Erken Kayıt Yap',
    },
    en: {
        badge: 'Coming Soon', heroTitle1: 'From Farm', heroTitle2: 'to Table',
        heroSub: 'No middlemen, fresh, affordable. Support local farmers and enjoy products direct from the field.',
        problemTitle: 'The Situation of Farmers in 2026',
        problemDesc: 'Farmers receive only **20-30%** of the final price. Middlemen and wholesalers take the majority, while consumers face high prices.',
        s1: '70%', s1d: 'Goes to middlemen', s2: '3-5x', s2d: 'Price markup (field → market)', s3: '40%', s3d: 'Food waste rate',
        solTitle: 'The LOKMA Solution',
        solDesc: 'LOKMA connects farmers directly with consumers. Fair earnings for farmers, fresh and affordable products for consumers.',
        f1: 'Direct Sales', f1d: 'Farmers upload products directly to the platform.', f2: 'Cold Chain Logistics', f2d: 'Fresh products, optimized delivery routes.',
        f3: 'Fair Pricing', f3d: 'Transparent commission, 80%+ goes to the farmer.', f4: 'Quality Guarantee', f4d: 'Every product is inspected, satisfaction guaranteed.',
        productsTitle: 'Products Coming Soon',
        p1: 'Fruits', p2: 'Vegetables', p3: 'Dairy', p4: 'Eggs', p5: 'Honey', p6: 'Olive Oil', p7: 'Legumes', p8: 'Grains',
        appBadge: 'Order in the App', appTitle: 'Download the', appTitle2: 'app to order',
        appDesc: 'Fresh farm products, farmer\'s market and special offers in our app. Download now and start ordering!',
        farmerQ: 'Are you a farmer?', farmerDesc: 'Apply now to join the LOKMA platform. Exclusive benefits for early registrations!', farmerCta: 'Early Registration',
    },
    fr: {
        badge: 'Bientôt disponible', heroTitle1: 'De la ferme', heroTitle2: 'à la table',
        heroSub: 'Sans intermédiaire, frais, abordable. Soutenez les agriculteurs locaux et profitez de produits du champ.',
        problemTitle: 'La situation des agriculteurs en 2026', problemDesc: 'Les agriculteurs ne reçoivent que **20-30%** du prix final.',
        s1: '70%', s1d: 'Part des intermédiaires', s2: '3-5x', s2d: 'Majoration (champ → marché)', s3: '40%', s3d: 'Gaspillage',
        solTitle: 'La solution LOKMA', solDesc: 'LOKMA connecte directement agriculteurs et consommateurs.',
        f1: 'Vente directe', f1d: 'L\'agriculteur publie directement sur la plateforme.', f2: 'Chaîne du froid', f2d: 'Produits frais, itinéraires optimisés.',
        f3: 'Prix équitables', f3d: 'Commission transparente, 80%+ pour l\'agriculteur.', f4: 'Garantie qualité', f4d: 'Chaque produit est contrôlé.',
        productsTitle: 'Produits à venir',
        p1: 'Fruits', p2: 'Légumes', p3: 'Produits laitiers', p4: 'Œufs', p5: 'Miel', p6: 'Huile d\'olive', p7: 'Légumineuses', p8: 'Céréales',
        appBadge: 'Commander dans l\'appli', appTitle: 'Téléchargez l\'appli', appTitle2: 'pour commander',
        appDesc: 'Produits frais, marché et offres spéciales dans notre application.',
        farmerQ: 'Vous êtes agriculteur ?', farmerDesc: 'Inscrivez-vous dès maintenant ! Avantages exclusifs pour les inscriptions anticipées !', farmerCta: 'Inscription anticipée',
    },
    it: {
        badge: 'In arrivo', heroTitle1: 'Dal campo', heroTitle2: 'alla tavola',
        heroSub: 'Senza intermediari, fresco, conveniente. Sostieni gli agricoltori locali.',
        problemTitle: 'La situazione degli agricoltori nel 2026', problemDesc: 'Gli agricoltori ricevono solo il **20-30%** del prezzo finale.',
        s1: '70%', s1d: 'Va agli intermediari', s2: '3-5x', s2d: 'Aumento di prezzo', s3: '40%', s3d: 'Spreco alimentare',
        solTitle: 'La soluzione LOKMA', solDesc: 'LOKMA connette direttamente agricoltori e consumatori.',
        f1: 'Vendita diretta', f1d: 'L\'agricoltore carica i prodotti direttamente.', f2: 'Catena del freddo', f2d: 'Prodotti freschi, consegne ottimizzate.',
        f3: 'Prezzi equi', f3d: 'Commissione trasparente, 80%+ per l\'agricoltore.', f4: 'Garanzia di qualità', f4d: 'Ogni prodotto è controllato.',
        productsTitle: 'Prodotti in arrivo',
        p1: 'Frutta', p2: 'Verdura', p3: 'Latticini', p4: 'Uova', p5: 'Miele', p6: 'Olio d\'oliva', p7: 'Legumi', p8: 'Cereali',
        appBadge: 'Ordina nell\'app', appTitle: 'Scarica l\'app', appTitle2: 'per ordinare',
        appDesc: 'Prodotti freschi, mercato e offerte speciali nella nostra app.',
        farmerQ: 'Sei un agricoltore?', farmerDesc: 'Iscriviti ora! Vantaggi esclusivi per le iscrizioni anticipate!', farmerCta: 'Iscrizione anticipata',
    },
    es: {
        badge: 'Próximamente', heroTitle1: 'Del campo', heroTitle2: 'a la mesa',
        heroSub: 'Sin intermediarios, fresco, asequible. Apoya a los agricultores locales.',
        problemTitle: 'La situación de los agricultores en 2026', problemDesc: 'Los agricultores solo reciben el **20-30%** del precio final.',
        s1: '70%', s1d: 'Para intermediarios', s2: '3-5x', s2d: 'Aumento de precio', s3: '40%', s3d: 'Desperdicio',
        solTitle: 'La solución LOKMA', solDesc: 'LOKMA conecta directamente a agricultores y consumidores.',
        f1: 'Venta directa', f1d: 'El agricultor sube sus productos directamente.', f2: 'Cadena de frío', f2d: 'Productos frescos, rutas optimizadas.',
        f3: 'Precios justos', f3d: 'Comisión transparente, 80%+ para el agricultor.', f4: 'Garantía de calidad', f4d: 'Cada producto es inspeccionado.',
        productsTitle: 'Productos próximos',
        p1: 'Frutas', p2: 'Verduras', p3: 'Lácteos', p4: 'Huevos', p5: 'Miel', p6: 'Aceite de oliva', p7: 'Legumbres', p8: 'Cereales',
        appBadge: 'Pedir en la app', appTitle: 'Descarga la app', appTitle2: 'para pedir',
        appDesc: 'Productos frescos, mercado y ofertas especiales en nuestra aplicación.',
        farmerQ: '¿Eres agricultor?', farmerDesc: '¡Inscríbete ahora! ¡Beneficios exclusivos para inscripciones anticipadas!', farmerCta: 'Inscripción anticipada',
    },
};

const productIcons = ['🍎', '🥬', '🧀', '🥚', '🍯', '🫒', '🫘', '🌾'];
const featureIcons = ['agriculture', 'local_shipping', 'payments', 'verified'];

export default function CiftcidenPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    return (
        <div className="relative flex min-h-screen flex-col bg-[#0a0a0f] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[1000px] mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <span className="material-symbols-outlined text-[18px]">eco</span>
                            {t('badge')}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6">
                            <span className="text-green-400">{t('heroTitle1')}</span> {t('heroTitle2')}
                        </h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">{t('heroSub')}</p>
                    </div>

                    <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-red-400">{t('problemTitle')}</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">{t('problemDesc')}</p>
                        <div className="grid md:grid-cols-3 gap-6">
                            {(['s1', 's2', 's3'] as const).map(k => (
                                <div key={k} className="text-center p-4 bg-white/5 rounded-xl">
                                    <div className="text-3xl font-black text-red-400 mb-2">{t(k)}</div>
                                    <p className="text-sm text-white/60">{t(`${k}d`)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-green-400">{t('solTitle')}</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">{t('solDesc')}</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            {(['f1', 'f2', 'f3', 'f4'] as const).map((f, i) => (
                                <div key={f} className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-green-400">{featureIcons[i]}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-1">{t(f)}</h3>
                                        <p className="text-sm text-white/60">{t(`${f}d`)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 text-center">{t('productsTitle')}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Array.from({ length: 8 }, (_, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <div className="text-3xl mb-2">{productIcons[i]}</div>
                                    <p className="font-medium text-sm">{t(`p${i + 1}`)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/20 rounded-2xl p-8 mb-12 text-center">
                        <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <span className="material-symbols-outlined text-[18px]">smartphone</span>
                            {t('appBadge')}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">
                            {t('appTitle')} <span className="text-[#fb335b]">LOKMA</span> {t('appTitle2')}
                        </h2>
                        <p className="text-white/60 mb-8 max-w-xl mx-auto">{t('appDesc')}</p>
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">
                                <span className="text-2xl"></span> App Store
                            </a>
                            <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">
                                <span className="text-2xl">▶️</span> Google Play
                            </a>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('farmerQ')}</h2>
                        <p className="text-white/90 mb-6 max-w-xl mx-auto">{t('farmerDesc')}</p>
                        <Link href="/partner/apply" className="inline-block bg-white text-green-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">
                            {t('farmerCta')}
                        </Link>
                    </div>
                </div>
            </main>

            <PublicFooter />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </div>
    );
}
