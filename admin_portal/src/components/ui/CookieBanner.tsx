'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';

// EU-conformant cookie consent translations
const translations: Record<string, {
    title: string;
    description: string;
    essential: string;
    essentialDesc: string;
    analytics: string;
    analyticsDesc: string;
    marketing: string;
    marketingDesc: string;
    acceptAll: string;
    rejectAll: string;
    settings: string;
    save: string;
    privacyPolicy: string;
    imprint: string;
    cookiePolicy: string;
    alwaysActive: string;
}> = {
    de: {
        title: 'Wir respektieren Ihre Privatsphäre',
        description: 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern, den Website-Verkehr zu analysieren und Inhalte zu personalisieren. Gemäß der EU-DSGVO und ePrivacy-Richtlinie benötigen wir Ihre Zustimmung für nicht-essentielle Cookies.',
        essential: 'Essentielle Cookies',
        essentialDesc: 'Notwendig für die Grundfunktionen der Website. Ohne diese Cookies kann die Website nicht richtig funktionieren.',
        analytics: 'Analyse-Cookies',
        analyticsDesc: 'Helfen uns zu verstehen, wie Besucher mit der Website interagieren. Alle Daten werden anonymisiert.',
        marketing: 'Marketing-Cookies',
        marketingDesc: 'Werden verwendet, um Besuchern relevante Werbung und Marketingkampagnen anzuzeigen.',
        acceptAll: 'Alle akzeptieren',
        rejectAll: 'Nur Essentielle',
        settings: 'Einstellungen',
        save: 'Auswahl speichern',
        privacyPolicy: 'Datenschutz',
        imprint: 'Impressum',
        cookiePolicy: 'Cookie-Richtlinie',
        alwaysActive: 'Immer aktiv',
    },
    tr: {
        title: 'Gizliliğinize Saygı Duyuyoruz',
        description: 'Deneyiminizi iyileştirmek, site trafiğini analiz etmek ve içerikleri kişiselleştirmek için çerezler kullanıyoruz. AB-KVKK ve ePrivacy yönergeleri gereği, zorunlu olmayan çerezler için onayınıza ihtiyacımız var.',
        essential: 'Zorunlu Çerezler',
        essentialDesc: 'Web sitesinin temel işlevleri için gereklidir. Bu çerezler olmadan site düzgün çalışamaz.',
        analytics: 'Analiz Çerezleri',
        analyticsDesc: 'Ziyaretçilerin siteyle nasıl etkileşim kurduğunu anlamamıza yardımcı olur. Tüm veriler anonimleştirilir.',
        marketing: 'Pazarlama Çerezleri',
        marketingDesc: 'Ziyaretçilere ilgili reklam ve pazarlama kampanyalarını göstermek için kullanılır.',
        acceptAll: 'Tümünü Kabul Et',
        rejectAll: 'Sadece Zorunlu',
        settings: 'Ayarlar',
        save: 'Seçimi Kaydet',
        privacyPolicy: 'Gizlilik Politikası',
        imprint: 'Künye',
        cookiePolicy: 'Çerez Politikası',
        alwaysActive: 'Her zaman aktif',
    },
    en: {
        title: 'We Respect Your Privacy',
        description: 'We use cookies to improve your experience, analyze site traffic, and personalize content. In accordance with the EU GDPR and ePrivacy Directive, we need your consent for non-essential cookies.',
        essential: 'Essential Cookies',
        essentialDesc: 'Necessary for the basic functions of the website. The site cannot function properly without these cookies.',
        analytics: 'Analytics Cookies',
        analyticsDesc: 'Help us understand how visitors interact with the website. All data is anonymized.',
        marketing: 'Marketing Cookies',
        marketingDesc: 'Used to show visitors relevant advertising and marketing campaigns.',
        acceptAll: 'Accept All',
        rejectAll: 'Essential Only',
        settings: 'Settings',
        save: 'Save Preferences',
        privacyPolicy: 'Privacy Policy',
        imprint: 'Imprint',
        cookiePolicy: 'Cookie Policy',
        alwaysActive: 'Always active',
    },
};

interface CookiePreferences {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    timestamp: string;
}

export default function CookieBanner() {
    const locale = useLocale();
    const t = translations[locale] || translations['de'];

    const [isVisible, setIsVisible] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [preferences, setPreferences] = useState<CookiePreferences>({
        essential: true, // Always true, cannot be disabled
        analytics: false,
        marketing: false,
        timestamp: '',
    });

    useEffect(() => {
        // Check if user has already made a choice
        const saved = localStorage.getItem('lokma_cookie_consent');
        if (!saved) {
            // Small delay for better UX - don't show immediately on page load
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const savePreferences = (prefs: CookiePreferences) => {
        const withTimestamp = { ...prefs, timestamp: new Date().toISOString() };
        localStorage.setItem('lokma_cookie_consent', JSON.stringify(withTimestamp));
        setIsVisible(false);

        // Dispatch custom event so other scripts can react
        window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: withTimestamp }));
    };

    const handleAcceptAll = () => {
        savePreferences({ essential: true, analytics: true, marketing: true, timestamp: '' });
    };

    const handleRejectAll = () => {
        savePreferences({ essential: true, analytics: false, marketing: false, timestamp: '' });
    };

    const handleSaveSettings = () => {
        savePreferences(preferences);
    };

    if (!isVisible) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    zIndex: 99998,
                    animation: 'fadeIn 0.3s ease-out',
                }}
            />

            {/* Cookie Banner */}
            <div
                style={{
                    position: 'fixed',
                    bottom: showSettings ? '50%' : '0',
                    left: '50%',
                    transform: showSettings ? 'translate(-50%, 50%)' : 'translateX(-50%)',
                    width: showSettings ? 'min(560px, 92vw)' : 'min(680px, 94vw)',
                    zIndex: 99999,
                    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                <div
                    style={{
                        background: 'linear-gradient(145deg, #1a1a2e 0%, #16162a 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '20px',
                        padding: showSettings ? '28px' : '24px 28px',
                        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    }}
                >

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #fb335b, #ff6b6b)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                flexShrink: 0,
                            }}
                        >
                            🍪
                        </div>
                        <div>
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: '17px',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {t.title}
                            </h3>
                        </div>
                    </div>

                    {/* Description */}
                    {!showSettings && (
                        <p
                            style={{
                                margin: '0 0 20px 0',
                                fontSize: '13.5px',
                                lineHeight: '1.6',
                                color: 'rgba(255, 255, 255, 0.55)',
                            }}
                        >
                            {t.description}
                        </p>
                    )}

                    {/* Settings Panel */}
                    {showSettings && (
                        <div style={{ margin: '0 0 20px 0' }}>
                            {/* Essential Cookies */}
                            <div
                                style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '14px',
                                    padding: '16px',
                                    marginBottom: '10px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                                            🔒 {t.essential}
                                        </span>
                                        <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.5' }}>
                                            {t.essentialDesc}
                                        </p>
                                    </div>
                                    <span
                                        style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#4ade80',
                                            background: 'rgba(74, 222, 128, 0.1)',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            whiteSpace: 'nowrap',
                                            marginLeft: '16px',
                                        }}
                                    >
                                        {t.alwaysActive}
                                    </span>
                                </div>
                            </div>

                            {/* Analytics Cookies */}
                            <div
                                style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '14px',
                                    padding: '16px',
                                    marginBottom: '10px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                                            📊 {t.analytics}
                                        </span>
                                        <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.5' }}>
                                            {t.analyticsDesc}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                                        style={{
                                            width: '48px',
                                            height: '26px',
                                            borderRadius: '13px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: preferences.analytics
                                                ? 'linear-gradient(135deg, #fb335b, #ff6b6b)'
                                                : 'rgba(255, 255, 255, 0.1)',
                                            position: 'relative',
                                            transition: 'background 0.3s ease',
                                            flexShrink: 0,
                                            marginLeft: '16px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '10px',
                                                background: '#fff',
                                                position: 'absolute',
                                                top: '3px',
                                                left: preferences.analytics ? '25px' : '3px',
                                                transition: 'left 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                            }}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Marketing Cookies */}
                            <div
                                style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '14px',
                                    padding: '16px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                                            📢 {t.marketing}
                                        </span>
                                        <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.5' }}>
                                            {t.marketingDesc}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPreferences(p => ({ ...p, marketing: !p.marketing }))}
                                        style={{
                                            width: '48px',
                                            height: '26px',
                                            borderRadius: '13px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: preferences.marketing
                                                ? 'linear-gradient(135deg, #fb335b, #ff6b6b)'
                                                : 'rgba(255, 255, 255, 0.1)',
                                            position: 'relative',
                                            transition: 'background 0.3s ease',
                                            flexShrink: 0,
                                            marginLeft: '16px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '10px',
                                                background: '#fff',
                                                position: 'absolute',
                                                top: '3px',
                                                left: preferences.marketing ? '25px' : '3px',
                                                transition: 'left 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                            }}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}
                    >
                        {showSettings ? (
                            <>
                                <button
                                    onClick={handleSaveSettings}
                                    style={{
                                        flex: 1,
                                        padding: '13px 20px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #fb335b, #e6294f)',
                                        color: '#fff',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {t.save}
                                </button>
                                <button
                                    onClick={handleAcceptAll}
                                    style={{
                                        flex: 1,
                                        padding: '13px 20px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        color: '#fff',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {t.acceptAll}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleAcceptAll}
                                    style={{
                                        flex: 1,
                                        padding: '13px 20px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #fb335b, #e6294f)',
                                        color: '#fff',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {t.acceptAll}
                                </button>
                                <button
                                    onClick={handleRejectAll}
                                    style={{
                                        flex: 1,
                                        padding: '13px 20px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        color: '#fff',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {t.rejectAll}
                                </button>
                                <button
                                    onClick={() => setShowSettings(true)}
                                    style={{
                                        flex: 1,
                                        padding: '13px 20px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        background: 'transparent',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    ⚙️ {t.settings}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Footer Links */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '20px',
                            marginTop: '16px',
                            paddingTop: '14px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                    >
                        <a
                            href={`/${locale}/privacy`}
                            style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.35)',
                                textDecoration: 'none',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')}
                        >
                            {t.privacyPolicy}
                        </a>
                        <a
                            href={`/${locale}/imprint`}
                            style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.35)',
                                textDecoration: 'none',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')}
                        >
                            {t.imprint}
                        </a>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: ${showSettings ? 'translate(-50%, calc(50% + 30px))' : 'translateX(-50%) translateY(30px)'}; }
          to { opacity: 1; transform: ${showSettings ? 'translate(-50%, 50%)' : 'translateX(-50%) translateY(0)'}; }
        }
      `}</style>
        </>
    );
}
