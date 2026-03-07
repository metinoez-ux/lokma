'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        badge: 'Regionale Spezialitäten', heroTitle: 'Hausspezialitäten',
        heroSub: 'Traditionelle Rezepte unserer Mütter und Großmütter. Hausgemacht, natürlich, ohne Zusatzstoffe.',
        whatTitle: 'Was sind Hausspezialitäten?',
        whatDesc: 'Jede Region hat ihre eigene kulinarische Tradition. Wir bringen die lokalen Handwerksproduzenten zu Ihnen nach Hause.',
        c1: 'Hausgemacht', c1d: 'Aus der Heimküche, nicht aus der Fabrik',
        c2: 'Natürlich', c2d: 'Ohne Zusatzstoffe und Konservierungsmittel',
        c3: 'Bewertet', c3d: 'Vertrauenswürdiges Produzentensystem',
        trustTitle: 'Vertrauenssystem',
        trustDesc: 'Qualität und Vertrauen stehen bei Hausspezialitäten an erster Stelle.',
        t1: 'Identitätsprüfung', t1d: 'Jeder Produzent registriert sich mit ID und Hygienezertifikat.',
        t2: '5-Sterne-Bewertung', t2d: 'Kundenbewertung nach jeder Bestellung.',
        t3: 'Fotopflicht', t3d: 'Echte Produktfotos, keine Stockbilder.',
        t4: 'Zufriedenheitsgarantie', t4d: 'Rückgabe oder Neulieferung bei Unzufriedenheit.',
        catTitle: 'Produktkategorien',
        producerQ: 'Stellen Sie Hausspezialitäten her?',
        producerDesc: 'Bringen Sie die Rezepte Ihrer Familie zu Tausenden von Menschen. Treten Sie LOKMA Hausspezialitäten bei!',
        producerCta: 'Produzenten-Bewerbung',
        appBadge: 'In der App bestellen', appTitle: 'Laden Sie die', appTitle2: 'App herunter',
        appDesc: 'Alle regionalen Produkte, frische Spezialitäten und Sonderangebote in unserer App.',
    },
    tr: {
        badge: 'Yöresel Tatlar', heroTitle: 'El Lezzetleri',
        heroSub: 'Annelerimizin, ninelerimizin elinden çıkan yöresel tatlar. Ev yapımı, doğal, katkısız ve her biri bir hikâye.',
        whatTitle: 'El Lezzetleri Nedir?',
        whatDesc: 'Her yörenin kendine has bir lezzeti var. Bu tatları evlerinde özenle hazırlayan yerel üreticileri sizinle buluşturuyoruz.',
        c1: 'Ev Yapımı', c1d: 'Fabrika değil, ev mutfağından',
        c2: 'Doğal', c2d: 'Katkısız, koruyucusuz',
        c3: 'Puanlı', c3d: 'Güvenilir üretici sistemi',
        trustTitle: 'Güven Sistemi',
        trustDesc: 'El Lezzetleri\'nde güven ve kalite her şeyin başında gelir.',
        t1: 'Kimlik Doğrulama', t1d: 'Her üretici kimlik ve hijyen belgesi ile kayıt olur.',
        t2: '5 Yıldız Puanlama', t2d: 'Her sipariş sonrası müşteri değerlendirmesi.',
        t3: 'Fotoğraf Zorunluluğu', t3d: 'Gerçek ürün fotoğrafları, stok görsel yok.',
        t4: 'Memnuniyet Garantisi', t4d: 'Beğenmezseniz iade veya yeniden gönderim.',
        catTitle: 'Ürün Kategorileri',
        producerQ: 'Ev yapımı lezzetler mi üretiyorsunuz?',
        producerDesc: 'Annenizin, anneannenizin tariflerini binlerce kişiye ulaştırın. LOKMA El Lezzetleri\'ne katılın!',
        producerCta: 'Üretici Başvurusu Yap',
        appBadge: 'Alışveriş Uygulamada', appTitle: 'Sipariş vermek için', appTitle2: 'uygulamasını indir',
        appDesc: 'Tüm yöresel ürünler, taze lezzetler ve özel kampanyalar uygulamamızda.',
    },
    en: {
        badge: 'Regional Specialties', heroTitle: 'Artisan Foods',
        heroSub: 'Traditional recipes from our mothers and grandmothers. Homemade, natural, additive-free, each with a story.',
        whatTitle: 'What are Artisan Foods?',
        whatDesc: 'Every region has its own unique flavor. We connect local artisan producers with you.',
        c1: 'Homemade', c1d: 'From home kitchens, not factories',
        c2: 'Natural', c2d: 'No additives, no preservatives',
        c3: 'Rated', c3d: 'Trusted producer rating system',
        trustTitle: 'Trust System',
        trustDesc: 'Quality and trust come first in Artisan Foods.',
        t1: 'Identity Verification', t1d: 'Every producer registers with ID and hygiene certificate.',
        t2: '5-Star Rating', t2d: 'Customer review after every order.',
        t3: 'Photo Required', t3d: 'Real product photos, no stock images.',
        t4: 'Satisfaction Guarantee', t4d: 'Return or reship if not satisfied.',
        catTitle: 'Product Categories',
        producerQ: 'Do you make homemade foods?',
        producerDesc: 'Bring your family recipes to thousands. Join LOKMA Artisan Foods!',
        producerCta: 'Producer Application',
        appBadge: 'Order in the App', appTitle: 'Download the', appTitle2: 'app to order',
        appDesc: 'All regional products, fresh delicacies and special offers in our app.',
    },
    fr: {
        badge: 'Spécialités régionales', heroTitle: 'Fait Maison',
        heroSub: 'Recettes traditionnelles de nos mères et grands-mères. Artisanal, naturel, sans additifs.',
        whatTitle: 'Qu\'est-ce que Fait Maison ?', whatDesc: 'Chaque région a sa propre saveur unique.',
        c1: 'Fait maison', c1d: 'De la cuisine, pas de l\'usine', c2: 'Naturel', c2d: 'Sans additifs', c3: 'Évalué', c3d: 'Système de confiance',
        trustTitle: 'Système de confiance', trustDesc: 'La qualité et la confiance avant tout.',
        t1: 'Vérification d\'identité', t1d: 'Inscription avec pièce d\'identité.', t2: 'Notation 5 étoiles', t2d: 'Avis client après chaque commande.',
        t3: 'Photos requises', t3d: 'Vraies photos de produits.', t4: 'Garantie satisfaction', t4d: 'Retour ou renvoi si insatisfait.',
        catTitle: 'Catégories de produits',
        producerQ: 'Vous faites des plats maison ?', producerDesc: 'Partagez vos recettes familiales avec des milliers de personnes !', producerCta: 'Candidature producteur',
        appBadge: 'Commander dans l\'appli', appTitle: 'Téléchargez l\'appli', appTitle2: 'pour commander',
        appDesc: 'Tous les produits régionaux et offres spéciales dans notre application.',
    },
    it: {
        badge: 'Specialità regionali', heroTitle: 'Fatto in Casa',
        heroSub: 'Ricette tradizionali delle nostre mamme e nonne. Artigianale, naturale, senza additivi.',
        whatTitle: 'Cos\'è Fatto in Casa?', whatDesc: 'Ogni regione ha il suo sapore unico.',
        c1: 'Fatto in casa', c1d: 'Dalla cucina, non dalla fabbrica', c2: 'Naturale', c2d: 'Senza additivi', c3: 'Valutato', c3d: 'Sistema di fiducia',
        trustTitle: 'Sistema di fiducia', trustDesc: 'Qualità e fiducia al primo posto.',
        t1: 'Verifica identità', t1d: 'Registrazione con documento.', t2: 'Valutazione 5 stelle', t2d: 'Recensione dopo ogni ordine.',
        t3: 'Foto obbligatorie', t3d: 'Foto reali dei prodotti.', t4: 'Garanzia soddisfazione', t4d: 'Reso o rinvio se insoddisfatto.',
        catTitle: 'Categorie di prodotti',
        producerQ: 'Produci cibi fatti in casa?', producerDesc: 'Condividi le ricette di famiglia con migliaia di persone!', producerCta: 'Candidatura produttore',
        appBadge: 'Ordina nell\'app', appTitle: 'Scarica l\'app', appTitle2: 'per ordinare',
        appDesc: 'Tutti i prodotti regionali e offerte speciali nella nostra app.',
    },
    es: {
        badge: 'Especialidades regionales', heroTitle: 'Hecho en Casa',
        heroSub: 'Recetas tradicionales de nuestras madres y abuelas. Artesanal, natural, sin aditivos.',
        whatTitle: '¿Qué es Hecho en Casa?', whatDesc: 'Cada región tiene su sabor único.',
        c1: 'Hecho en casa', c1d: 'De la cocina, no de la fábrica', c2: 'Natural', c2d: 'Sin aditivos', c3: 'Calificado', c3d: 'Sistema de confianza',
        trustTitle: 'Sistema de confianza', trustDesc: 'Calidad y confianza ante todo.',
        t1: 'Verificación de identidad', t1d: 'Registro con identificación.', t2: 'Calificación 5 estrellas', t2d: 'Reseña después de cada pedido.',
        t3: 'Fotos requeridas', t3d: 'Fotos reales de productos.', t4: 'Garantía de satisfacción', t4d: 'Devolución o reenvío si no estás satisfecho.',
        catTitle: 'Categorías de productos',
        producerQ: '¿Haces comida casera?', producerDesc: '¡Comparte las recetas de tu familia con miles de personas!', producerCta: 'Solicitud de productor',
        appBadge: 'Pedir en la app', appTitle: 'Descarga la app', appTitle2: 'para pedir',
        appDesc: 'Todos los productos regionales y ofertas especiales en nuestra aplicación.',
    },
};

const trustIcons = ['verified_user', 'star', 'photo_camera', 'support_agent'];

const categories = [
    { icon: '🧀', de: 'Käse', tr: 'Peynirler', en: 'Cheese', fr: 'Fromages', it: 'Formaggi', es: 'Quesos' },
    { icon: '🍇', de: 'Trockenfrüchte', tr: 'Kurutulmuş', en: 'Dried Fruits', fr: 'Fruits secs', it: 'Frutta secca', es: 'Frutas secas' },
    { icon: '🍅', de: 'Pasten', tr: 'Salçalar', en: 'Sauces', fr: 'Sauces', it: 'Salse', es: 'Salsas' },
    { icon: '🍯', de: 'Honig & Sirup', tr: 'Bal & Pekmez', en: 'Honey & Syrup', fr: 'Miel & Sirop', it: 'Miele & Sciroppo', es: 'Miel & Jarabe' },
    { icon: '🫒', de: 'Olivenöl', tr: 'Zeytinyağı', en: 'Olive Oil', fr: 'Huile d\'olive', it: 'Olio d\'oliva', es: 'Aceite de oliva' },
    { icon: '🌶️', de: 'Gewürze', tr: 'Baharatlar', en: 'Spices', fr: 'Épices', it: 'Spezie', es: 'Especias' },
    { icon: '🍬', de: 'Süßigkeiten', tr: 'Tatlılar', en: 'Sweets', fr: 'Confiseries', it: 'Dolci', es: 'Dulces' },
    { icon: '🥖', de: 'Teigwaren', tr: 'Hamur İşi', en: 'Pastries', fr: 'Pâtes', it: 'Pasta', es: 'Masas' },
];

export default function ElLezzetleriPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    return (
        <div className="relative flex min-h-screen flex-col bg-[#0a0a0f] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[1000px] mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <span className="material-symbols-outlined text-[18px]">restaurant</span>{t('badge')}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6"><span className="text-amber-400">{t('heroTitle')}</span></h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">{t('heroSub')}</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-amber-400">{t('whatTitle')}</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">{t('whatDesc')}</p>
                        <div className="grid md:grid-cols-3 gap-6">
                            {(['c1', 'c2', 'c3'] as const).map(c => (
                                <div key={c} className="text-center p-4 bg-white/5 rounded-xl">
                                    <h3 className="font-bold mb-1">{t(c)}</h3>
                                    <p className="text-sm text-white/60">{t(`${c}d`)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-yellow-400">{t('trustTitle')}</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">{t('trustDesc')}</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            {(['t1', 't2', 't3', 't4'] as const).map((tk, i) => (
                                <div key={tk} className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-yellow-400">{trustIcons[i]}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-1">{t(tk)}</h3>
                                        <p className="text-sm text-white/60">{t(`${tk}d`)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 text-center">{t('catTitle')}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {categories.map(cat => (
                                <div key={cat.icon} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer text-center">
                                    <div className="text-3xl mb-2">{cat.icon}</div>
                                    <h3 className="font-bold text-sm">{cat[locale as keyof typeof cat] || cat.en}</h3>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/20 rounded-2xl p-8 mb-12 text-center">
                        <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <span className="material-symbols-outlined text-[18px]">smartphone</span>{t('appBadge')}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('appTitle')} <span className="text-[#fb335b]">LOKMA</span> {t('appTitle2')}</h2>
                        <p className="text-white/60 mb-8 max-w-xl mx-auto">{t('appDesc')}</p>
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">App Store</a>
                            <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">Google Play</a>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('producerQ')}</h2>
                        <p className="text-white/90 mb-6 max-w-xl mx-auto">{t('producerDesc')}</p>
                        <Link href="/partner/apply" className="inline-block bg-white text-amber-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">
                            {t('producerCta')}
                        </Link>
                    </div>
                </div>
            </main>

            <PublicFooter />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </div>
    );
}
