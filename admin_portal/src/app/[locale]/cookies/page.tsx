'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Cookie-Einstellungen',
        desc: 'Auf dieser Seite können Sie die auf unserer Website verwendeten Cookies verwalten. Notwendige Cookies sind für die Website-Funktionalität erforderlich und können nicht deaktiviert werden.',
        necessary: 'Notwendige Cookies', necessaryDesc: 'Für die Website-Funktionalität erforderlich',
        alwaysActive: 'Immer aktiv',
        necessaryDetail: 'Für Sitzungsverwaltung, Warenkorb und Sicherheit erforderlich.',
        analytics: 'Analytische Cookies', analyticsDesc: 'Website-Nutzungsstatistiken',
        analyticsDetail: 'Helfen uns mit Google Analytics und ähnlichen Tools die Website-Leistung zu messen.',
        marketing: 'Marketing-Cookies', marketingDesc: 'Personalisierte Werbung',
        marketingDetail: 'Werden verwendet, um Ihnen relevante Werbung anzuzeigen.',
        save: 'Einstellungen speichern', acceptAll: 'Alle akzeptieren',
        saved: 'Ihre Cookie-Einstellungen wurden gespeichert!',
    },
    tr: {
        title: 'Çerez Tercihleri',
        desc: 'Bu sayfada web sitemizde kullanılan çerezleri yönetebilirsiniz. Zorunlu çerezler site işlevselliği için gereklidir ve devre dışı bırakılamaz.',
        necessary: 'Zorunlu Çerezler', necessaryDesc: 'Site işlevselliği için gerekli',
        alwaysActive: 'Her zaman aktif',
        necessaryDetail: 'Oturum yönetimi, sepet işlemleri ve güvenlik için zorunludur.',
        analytics: 'Analitik Çerezler', analyticsDesc: 'Site kullanım istatistikleri',
        analyticsDetail: 'Google Analytics ve benzer araçlar ile site performansını ölçmemize yardımcı olur.',
        marketing: 'Pazarlama Çerezleri', marketingDesc: 'Kişiselleştirilmiş reklamlar',
        marketingDetail: 'İlgi alanlarınıza göre reklam göstermek için kullanılır.',
        save: 'Tercihleri Kaydet', acceptAll: 'Tümünü Kabul Et',
        saved: 'Çerez tercihleriniz kaydedildi!',
    },
    en: {
        title: 'Cookie Preferences',
        desc: 'On this page you can manage cookies used on our website. Essential cookies are required for website functionality and cannot be disabled.',
        necessary: 'Essential Cookies', necessaryDesc: 'Required for website functionality',
        alwaysActive: 'Always active',
        necessaryDetail: 'Required for session management, cart operations, and security.',
        analytics: 'Analytics Cookies', analyticsDesc: 'Website usage statistics',
        analyticsDetail: 'Help us measure website performance with Google Analytics and similar tools.',
        marketing: 'Marketing Cookies', marketingDesc: 'Personalized advertising',
        marketingDetail: 'Used to show you relevant ads based on your interests.',
        save: 'Save Preferences', acceptAll: 'Accept All',
        saved: 'Your cookie preferences have been saved!',
    },
    fr: {
        title: 'Préférences de cookies',
        desc: 'Sur cette page, vous pouvez gérer les cookies utilisés sur notre site. Les cookies essentiels sont nécessaires et ne peuvent pas être désactivés.',
        necessary: 'Cookies essentiels', necessaryDesc: 'Nécessaires au fonctionnement du site',
        alwaysActive: 'Toujours actif',
        necessaryDetail: 'Nécessaires pour la gestion de session, le panier et la sécurité.',
        analytics: 'Cookies analytiques', analyticsDesc: 'Statistiques d\'utilisation',
        analyticsDetail: 'Nous aident à mesurer les performances du site.',
        marketing: 'Cookies marketing', marketingDesc: 'Publicité personnalisée',
        marketingDetail: 'Utilisés pour afficher des publicités pertinentes.',
        save: 'Enregistrer', acceptAll: 'Tout accepter',
        saved: 'Vos préférences ont été enregistrées !',
    },
    it: {
        title: 'Preferenze cookie',
        desc: 'In questa pagina puoi gestire i cookie utilizzati sul nostro sito. I cookie essenziali sono necessari e non possono essere disabilitati.',
        necessary: 'Cookie essenziali', necessaryDesc: 'Necessari per il funzionamento del sito',
        alwaysActive: 'Sempre attivo',
        necessaryDetail: 'Necessari per la gestione della sessione, il carrello e la sicurezza.',
        analytics: 'Cookie analitici', analyticsDesc: 'Statistiche di utilizzo',
        analyticsDetail: 'Ci aiutano a misurare le prestazioni del sito.',
        marketing: 'Cookie di marketing', marketingDesc: 'Pubblicità personalizzata',
        marketingDetail: 'Utilizzati per mostrare annunci pertinenti.',
        save: 'Salva preferenze', acceptAll: 'Accetta tutti',
        saved: 'Le tue preferenze sono state salvate!',
    },
    es: {
        title: 'Preferencias de cookies',
        desc: 'En esta página puedes gestionar las cookies utilizadas en nuestro sitio. Las cookies esenciales son necesarias y no pueden desactivarse.',
        necessary: 'Cookies esenciales', necessaryDesc: 'Necesarias para el funcionamiento del sitio',
        alwaysActive: 'Siempre activas',
        necessaryDetail: 'Necesarias para la gestión de sesión, el carrito y la seguridad.',
        analytics: 'Cookies analíticas', analyticsDesc: 'Estadísticas de uso',
        analyticsDetail: 'Nos ayudan a medir el rendimiento del sitio.',
        marketing: 'Cookies de marketing', marketingDesc: 'Publicidad personalizada',
        marketingDetail: 'Se utilizan para mostrar anuncios relevantes.',
        save: 'Guardar preferencias', acceptAll: 'Aceptar todas',
        saved: '¡Tus preferencias han sido guardadas!',
    },
    nl: {
        title: 'Cookie-instellingen',
        desc: 'Op deze pagina kunt u de cookies op onze website beheren. Noodzakelijke cookies zijn vereist voor de websitefunctionaliteit en kunnen niet worden uitgeschakeld.',
        necessary: 'Noodzakelijke cookies', necessaryDesc: 'Vereist voor websitefunctionaliteit',
        alwaysActive: 'Altijd actief',
        necessaryDetail: 'Vereist voor sessiebeheer, winkelwagen en beveiliging.',
        analytics: 'Analytische cookies', analyticsDesc: 'Gebruiksstatistieken van de website',
        analyticsDetail: 'Helpen ons de websiteprestaties te meten.',
        marketing: 'Marketingcookies', marketingDesc: 'Gepersonaliseerde advertenties',
        marketingDetail: 'Worden gebruikt om u relevante advertenties te tonen.',
        save: 'Voorkeuren opslaan', acceptAll: 'Alles accepteren',
        saved: 'Uw cookievoorkeuren zijn opgeslagen!',
    },
};

export default function CookiesPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    const [preferences, setPreferences] = useState({
        necessary: true, analytics: false, marketing: false,
    });

    const handleSave = () => {
        localStorage.setItem('lokma_cookies', JSON.stringify(preferences));
        alert(t('saved'));
    };

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40 flex-1">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">{t('title')}</h1>
                    <p className="text-gray-500 dark:text-white/60 mb-8">{t('desc')}</p>

                    <div className="space-y-6 mb-12">
                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-lg">{t('necessary')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-white/60">{t('necessaryDesc')}</p>
                                </div>
                                <div className="bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-xs font-bold">{t('alwaysActive')}</div>
                            </div>
                            <p className="text-sm text-gray-400 dark:text-white/50">{t('necessaryDetail')}</p>
                        </div>

                        {(['analytics', 'marketing'] as const).map(key => (
                            <div key={key} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg">{t(key)}</h3>
                                        <p className="text-sm text-gray-500 dark:text-white/60">{t(`${key}Desc`)}</p>
                                    </div>
                                    <button
                                        onClick={() => setPreferences({ ...preferences, [key]: !preferences[key] })}
                                        className={`w-12 h-6 rounded-full transition-all ${preferences[key] ? 'bg-[#fb335b]' : 'bg-white/20'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full transition-all ${preferences[key] ? 'ml-6' : 'ml-0.5'}`} />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-400 dark:text-white/50">{t(`${key}Detail`)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={handleSave} className="bg-[#fb335b] hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold transition-all">
                            {t('save')}
                        </button>
                        <button onClick={() => {
                            setPreferences({ necessary: true, analytics: true, marketing: true });
                            localStorage.setItem('lokma_cookies', JSON.stringify({ necessary: true, analytics: true, marketing: true }));
                        }} className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white px-8 py-4 rounded-xl font-bold transition-all">
                            {t('acceptAll')}
                        </button>
                    </div>
                </div>
            </main>

            <PublicFooter themeAware={true} />
        </div>
    );
}
