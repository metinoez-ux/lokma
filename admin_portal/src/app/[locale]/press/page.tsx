'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Presse', contactTitle: 'Pressekontakt',
        contactDesc: 'Für Medienanfragen, Interviewwünsche und Pressemitteilungen kontaktieren Sie uns.',
        kitTitle: 'Pressekit',
        k1: 'Logo & Markenrichtlinien', k1d: 'LOKMA-Logos und Markennutzungsrichtlinien',
        k2: 'Unternehmensinformationen', k2d: 'Unternehmensprofil und Statistiken',
        download: 'Herunterladen (Bald)', aboutTitle: 'Über uns',
        a1: 'LOKMA wurde 2024 in Deutschland gegründet, ein digitaler Marktplatz der lokale Händler und Verbraucher verbindet.',
        a2: 'Die Plattform beherbergt Hunderte lokaler Unternehmen: Metzger, Supermärkte, Restaurants, Floristen und mehr.',
        a3: 'Unsere Mission ist es, traditionellen Handel mit moderner Technologie zu verbinden, um einen fairen und transparenten Marktplatz zu schaffen.',
    },
    tr: {
        title: 'Basın', contactTitle: 'Basın İletişim',
        contactDesc: 'Medya sorularınız, röportaj talepleri ve basın bültenleri için bizimle iletişime geçin.',
        kitTitle: 'Basın Kiti',
        k1: 'Logo & Marka Kılavuzu', k1d: 'LOKMA logoları ve marka kullanım kılavuzu',
        k2: 'Şirket Bilgileri', k2d: 'Şirket profili ve istatistikler',
        download: 'İndir (Yakında)', aboutTitle: 'Hakkımızda',
        a1: 'LOKMA, 2024 yılında Almanya\'da kurulan, yerel esnaf ve tüketicileri bir araya getiren dijital bir pazar yeridir.',
        a2: 'Platform, kasap, market, restoran, çiçekçi ve daha birçok kategoride yüzlerce yerel işletmeyi barındırmaktadır.',
        a3: 'Misyonumuz, geleneksel ticaretin gücünü modern teknoloji ile birleştirerek adil ve şeffaf bir pazar yeri oluşturmaktır.',
    },
    en: {
        title: 'Press', contactTitle: 'Press Contact',
        contactDesc: 'For media inquiries, interview requests, and press releases, contact us.',
        kitTitle: 'Press Kit',
        k1: 'Logo & Brand Guidelines', k1d: 'LOKMA logos and brand usage guidelines',
        k2: 'Company Information', k2d: 'Company profile and statistics',
        download: 'Download (Coming Soon)', aboutTitle: 'About Us',
        a1: 'LOKMA was founded in 2024 in Germany, a digital marketplace connecting local merchants and consumers.',
        a2: 'The platform hosts hundreds of local businesses across categories: butchers, supermarkets, restaurants, florists, and more.',
        a3: 'Our mission is to combine the power of traditional commerce with modern technology to create a fair and transparent marketplace.',
    },
    fr: {
        title: 'Presse', contactTitle: 'Contact Presse',
        contactDesc: 'Pour les demandes médias, interviews et communiqués de presse, contactez-nous.',
        kitTitle: 'Kit Presse',
        k1: 'Logo & Charte graphique', k1d: 'Logos LOKMA et directives d\'utilisation de la marque',
        k2: 'Informations sur l\'entreprise', k2d: 'Profil et statistiques de l\'entreprise',
        download: 'Télécharger (Bientôt)', aboutTitle: 'À propos',
        a1: 'LOKMA a été fondé en 2024 en Allemagne, une marketplace numérique connectant commerçants locaux et consommateurs.',
        a2: 'La plateforme héberge des centaines d\'entreprises locales dans toutes les catégories.',
        a3: 'Notre mission: allier commerce traditionnel et technologie moderne pour un marché équitable et transparent.',
    },
    it: {
        title: 'Stampa', contactTitle: 'Contatto Stampa',
        contactDesc: 'Per richieste media, interviste e comunicati stampa, contattateci.',
        kitTitle: 'Kit Stampa',
        k1: 'Logo & Linee guida del marchio', k1d: 'Logo LOKMA e linee guida per l\'uso del marchio',
        k2: 'Informazioni aziendali', k2d: 'Profilo aziendale e statistiche',
        download: 'Scarica (In arrivo)', aboutTitle: 'Chi siamo',
        a1: 'LOKMA è stato fondato nel 2024 in Germania, un marketplace digitale che collega commercianti locali e consumatori.',
        a2: 'La piattaforma ospita centinaia di imprese locali in tutte le categorie.',
        a3: 'La nostra missione: unire commercio tradizionale e tecnologia moderna per un mercato equo e trasparente.',
    },
    es: {
        title: 'Prensa', contactTitle: 'Contacto de Prensa',
        contactDesc: 'Para consultas de medios, solicitudes de entrevistas y comunicados de prensa, contáctenos.',
        kitTitle: 'Kit de Prensa',
        k1: 'Logo y Guía de Marca', k1d: 'Logos de LOKMA y directrices de uso de marca',
        k2: 'Información de la Empresa', k2d: 'Perfil y estadísticas de la empresa',
        download: 'Descargar (Próximamente)', aboutTitle: 'Sobre Nosotros',
        a1: 'LOKMA fue fundado en 2024 en Alemania, un marketplace digital que conecta comerciantes locales con consumidores.',
        a2: 'La plataforma alberga cientos de negocios locales en todas las categorías.',
        a3: 'Nuestra misión: combinar el comercio tradicional con la tecnología moderna para crear un mercado justo y transparente.',
    },
    nl: {
        title: 'Pers', contactTitle: 'Perscontact',
        contactDesc: 'Voor mediavragen, interviewverzoeken en persberichten kunt u contact met ons opnemen.',
        kitTitle: 'Perspakket',
        k1: 'Logo en merkrichtlijnen', k1d: 'LOKMA-logo\'s en richtlijnen voor merkgebruik',
        k2: 'Bedrijfsinformatie', k2d: 'Bedrijfsprofiel en statistieken',
        download: 'Downloaden (binnenkort)', aboutTitle: 'Over ons',
        a1: 'LOKMA werd in 2024 opgericht in Duitsland, een digitale marktplaats die lokale handelaren en consumenten verbindt.',
        a2: 'Het platform herbergt honderden lokale bedrijven in alle categorieen.',
        a3: 'Onze missie: traditionele handel combineren met moderne technologie voor een eerlijke en transparante marktplaats.',
    },
};

export default function PressPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">{t('title')}</h1>

                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8 mb-12">
                        <h2 className="text-xl font-bold mb-4">{t('contactTitle')}</h2>
                        <p className="text-gray-500 dark:text-white/60 mb-6">{t('contactDesc')}</p>
                        <a href="mailto:presse@lokma.shop" className="inline-flex items-center gap-2 bg-[#fb335b] hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition-all">
                            <span className="material-symbols-outlined">mail</span>presse@lokma.shop
                        </a>
                    </div>

                    <h2 className="text-2xl font-bold mb-6">{t('kitTitle')}</h2>
                    <div className="grid md:grid-cols-2 gap-6 mb-12">
                        {(['k1', 'k2'] as const).map(k => (
                            <div key={k} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6">
                                <span className="material-symbols-outlined text-[#fb335b] text-3xl mb-4 block">{k === 'k1' ? 'image' : 'description'}</span>
                                <h3 className="font-bold mb-2">{t(k)}</h3>
                                <p className="text-sm text-gray-500 dark:text-white/60 mb-4">{t(`${k}d`)}</p>
                                <button className="text-[#fb335b] font-bold text-sm">{t('download')}</button>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-2xl font-bold mb-6">{t('aboutTitle')}</h2>
                    <div className="text-gray-600 dark:text-white/70 space-y-4">
                        <p><strong className="text-gray-900 dark:text-white">LOKMA</strong> — {t('a1')}</p>
                        <p>{t('a2')}</p>
                        <p>{t('a3')}</p>
                    </div>
                </div>
            </main>

            <PublicFooter themeAware={true} />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </div>
    );
}
