'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../../i18n/routing';
import Image from 'next/image';

// Countries with their default languages and flags
const countries = [
    { code: 'DE', name: 'Deutschland', flag: '🇩🇪', defaultLang: 'de' },
    { code: 'TR', name: 'Türkiye', flag: '🇹🇷', defaultLang: 'tr' },
    { code: 'AT', name: 'Österreich', flag: '🇦🇹', defaultLang: 'de' },
    { code: 'CH', name: 'Schweiz', flag: '🇨🇭', defaultLang: 'de' },
    { code: 'NL', name: 'Nederland', flag: '🇳🇱', defaultLang: 'en' },
    { code: 'BE', name: 'België', flag: '🇧🇪', defaultLang: 'fr' },
    { code: 'FR', name: 'France', flag: '🇫🇷', defaultLang: 'fr' },
    { code: 'IT', name: 'Italia', flag: '🇮🇹', defaultLang: 'it' },
    { code: 'ES', name: 'España', flag: '🇪🇸', defaultLang: 'es' },
    { code: 'MX', name: 'México', flag: '🇲🇽', defaultLang: 'es' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultLang: 'en' },
    { code: 'US', name: 'United States', flag: '🇺🇸', defaultLang: 'en' },
];

const languages = [
    { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸' },
];

export default function PublicHeader({ themeAware = false }: { themeAware?: boolean }) {
    const [langMenuOpen, setLangMenuOpen] = useState(false);
    const [countryMenuOpen, setCountryMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Refs for dropdown menus
    const countryRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);

    // Default to Turkish language, auto-detect country
    const [currentLang, setCurrentLang] = useState('tr');
    const [currentCountry, setCurrentCountry] = useState('DE');
    const [isLoading, setIsLoading] = useState(true);

    const router = useRouter();
    const pathname = usePathname();

    // Get translations
    const t = useTranslations('Landing');

    // Click outside handler for dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryRef.current && !countryRef.current.contains(event.target as Node)) {
                setCountryMenuOpen(false);
            }
            if (langRef.current && !langRef.current.contains(event.target as Node)) {
                setLangMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-detect country on mount
    useEffect(() => {
        const detectCountry = async () => {
            try {
                // Try to get country from browser timezone or IP
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();
                if (data.country_code) {
                    const country = countries.find(c => c.code === data.country_code);
                    if (country) {
                        setCurrentCountry(data.country_code);
                    }
                }
            } catch {
                // Default to Germany if detection fails
                setCurrentCountry('DE');
            } finally {
                setIsLoading(false);
            }
        };

        // Check localStorage first
        const savedLang = localStorage.getItem('lokma_lang');
        const savedCountry = localStorage.getItem('lokma_country');

        if (savedLang) setCurrentLang(savedLang);
        if (savedCountry) {
            setCurrentCountry(savedCountry);
            setIsLoading(false);
        } else {
            detectCountry();
        }
    }, []);

    // Save preferences
    const handleLangChange = (lang: string) => {
        setCurrentLang(lang);
        localStorage.setItem('lokma_lang', lang);
        setLangMenuOpen(false);

        // next-intl routing
        router.replace(pathname, { locale: lang });
    };

    const handleCountryChange = (code: string) => {
        setCurrentCountry(code);
        localStorage.setItem('lokma_country', code);
        setCountryMenuOpen(false);
    };

    const currentCountryData = countries.find(c => c.code === currentCountry) || countries[0];
    const currentLangData = languages.find(l => l.code === currentLang) || languages[0];

    const headerBg = themeAware ? 'bg-white/80 dark:bg-[#120a0a]/80 border-gray-200 dark:border-white/10' : 'bg-[#120a0a]/80 border-white/10';
    const textColor = themeAware ? 'text-gray-900 dark:text-white' : 'text-white';
    const menuBg = themeAware ? 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white' : 'bg-[#1a1a1a] border-white/10 text-white';
    const itemHover = themeAware ? 'hover:bg-gray-100 dark:hover:bg-white/10' : 'hover:bg-white/10';
    const mutedText = themeAware ? 'text-gray-500 dark:text-white/50' : 'text-white/50';

    if (isLoading) {
        return (
            <header className={`fixed top-0 z-50 w-full backdrop-blur-xl border-b ${headerBg} px-4 md:px-20 lg:px-40 py-4`}>
                <div className="max-w-[1200px] mx-auto flex items-center h-9">
                </div>
            </header>
        );
    }

    return (
        <header className={`fixed top-0 z-50 w-full backdrop-blur-xl border-b ${headerBg} ${textColor} px-4 md:px-20 lg:px-40 py-4`}>
            <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3">
                    {/* If themeAware, we might want to swap logo based on theme, but for now we keep the same logo but use filters in dark mode if needed. Actually lokma_logo_wide has white text? Let's check. Assuming lokma_logo_wide has white text, in light mode we might need to filter it. Or keep it as is. Let's use it as is for now. */}
                    <div className={`${themeAware ? 'dark:block' : 'block'}`}>
                        <Image src="/lokma_logo_wide.png" alt="LOKMA" width={140} height={36} className="object-contain" />
                    </div>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/">{t('home')}</Link>
                    <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/about">{t('about')}</Link>
                    <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/vendor">{t('vendorPortal')}</Link>
                    <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/support">{t('support')}</Link>
                </nav>

                <div className="flex items-center gap-3">
                    {/* Unified Region & Language Selector */}
                    <div className="relative" ref={countryRef}>
                        <button
                            className={`flex items-center gap-2 bg-black/5 dark:bg-white/5 ${itemHover} px-3 py-2 rounded-lg transition-all border border-transparent dark:border-white/10`}
                            onClick={() => setCountryMenuOpen(!countryMenuOpen)}
                        >
                            <span className="text-lg">{currentCountryData.flag}</span>
                            <span className="text-sm font-medium hidden sm:block">{currentLangData.name}</span>
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </button>
                        {countryMenuOpen && (
                            <div className={`absolute right-0 top-full mt-2 w-80 ${menuBg} border rounded-2xl overflow-hidden z-50 shadow-2xl`}>
                                {/* Header */}
                                <div className={`px-5 py-4 border-b ${themeAware ? 'border-gray-200 dark:border-white/10' : 'border-white/10'} bg-gradient-to-r from-[#fb335b]/10 to-transparent`}>
                                    <h3 className="font-bold text-base">{t('regionLangSettings')}</h3>
                                    <p className={`text-xs ${mutedText} mt-1`}>{t('selectPreferences')}</p>
                                </div>

                                <div className="p-4">
                                    {/* Language Section */}
                                    <div className="mb-5">
                                        <label className={`text-xs ${mutedText} uppercase tracking-wider font-semibold mb-3 flex items-center gap-2`}>
                                            <span className="material-symbols-outlined text-[14px]">language</span>
                                            {t('selectLanguage')}
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {languages.map((lang) => (
                                                <button
                                                    key={lang.code}
                                                    className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all text-left ${currentLang === lang.code
                                                        ? 'bg-[#fb335b]/20 border border-[#fb335b]/50 text-[#fb335b] dark:text-white'
                                                        : `bg-transparent ${itemHover} border border-transparent`
                                                        }`}
                                                    onClick={() => handleLangChange(lang.code)}
                                                >
                                                    <span className="text-base">{lang.flag}</span>
                                                    <span className={`${themeAware ? 'text-gray-900 dark:text-gray-200' : 'text-gray-200'} font-medium`}>{lang.name}</span>
                                                    {currentLang === lang.code && (
                                                        <span className="material-symbols-outlined text-[#fb335b] ml-auto text-[14px]">check_circle</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Country/Region Section */}
                                    <div>
                                        <label className={`text-xs ${mutedText} uppercase tracking-wider font-semibold mb-3 flex items-center gap-2`}>
                                            <span className="material-symbols-outlined text-[14px]">public</span>
                                            {t('regionCountry')}
                                        </label>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                            {countries.map((country) => (
                                                <button
                                                    key={country.code}
                                                    className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all text-left ${currentCountry === country.code
                                                        ? 'bg-[#fb335b]/20 border border-[#fb335b]/50 text-[#fb335b] dark:text-white'
                                                        : `bg-transparent ${itemHover} border border-transparent`
                                                        }`}
                                                    onClick={() => handleCountryChange(country.code)}
                                                >
                                                    <span className="text-base">{country.flag}</span>
                                                    <span className={`${themeAware ? 'text-gray-900 dark:text-gray-200' : 'text-gray-200'} font-medium truncate`}>{country.name}</span>
                                                    {currentCountry === country.code && (
                                                        <span className="material-symbols-outlined text-[#fb335b] ml-auto text-[14px] flex-shrink-0">check_circle</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className={`px-5 py-3 border-t ${themeAware ? 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5' : 'border-white/10 bg-white/5'}`}>
                                    <p className={`text-xs ${mutedText} text-center`}>
                                        {currentCountryData.flag} {currentCountryData.name} • {currentLangData.name}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <Link href="/login" className="hidden sm:flex bg-[#fb335b] hover:bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all">
                        {t('login')}
                    </Link>

                    {/* Mobile Menu Button */}
                    <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>
            </div >

            {/* Mobile Menu */}
            {
                mobileMenuOpen && (
                    <div className={`md:hidden absolute top-full left-0 right-0 ${menuBg} border-b ${themeAware ? 'border-gray-200 dark:border-white/10' : 'border-white/10'} p-4`}>
                        <nav className="flex flex-col gap-4">
                            <Link className="text-sm font-medium py-2" href="/">{t('home')}</Link>
                            <Link className="text-sm font-medium py-2" href="/about">{t('about')}</Link>
                            <Link className="text-sm font-medium py-2" href="/vendor">{t('vendorPortal')}</Link>
                            <Link className="text-sm font-medium py-2" href="/support">{t('support')}</Link>
                            <Link className="bg-[#fb335b] text-white text-center py-3 rounded-lg font-bold" href="/login">{t('login')}</Link>
                        </nav>
                    </div>
                )
            }
        </header >
    );
}
