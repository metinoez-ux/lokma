'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
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
 { code: 'nl', name: 'Nederlands', nativeName: 'Nederlands', flag: '🇳🇱' },
];

export default function PublicHeader({ themeAware = false }: { themeAware?: boolean }) {
 const [langMenuOpen, setLangMenuOpen] = useState(false);
 const [countryMenuOpen, setCountryMenuOpen] = useState(false);
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 const [scrolled, setScrolled] = useState(false);

 useEffect(() => {
 const handleScroll = () => setScrolled(window.scrollY > 20);
 window.addEventListener('scroll', handleScroll);
 handleScroll();
 return () => window.removeEventListener('scroll', handleScroll);
 }, []);


 // Refs for dropdown menus
 const countryRef = useRef<HTMLDivElement>(null);
 const langRef = useRef<HTMLDivElement>(null);

 // Sync language with next-intl active locale - URL is the source of truth
 const activeLocale = useLocale();
 const [currentLang, setCurrentLang] = useState(activeLocale);
 const [currentCountry, setCurrentCountry] = useState('DE');
 const [isLoading, setIsLoading] = useState(true);

 const router = useRouter();
 const pathname = usePathname();

 // Get translations
 const t = useTranslations('Landing');

 // Always sync currentLang with the active URL locale
 useEffect(() => {
 setCurrentLang(activeLocale);
 }, [activeLocale]);

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

 // Check localStorage for country only (language is from URL)
 const savedCountry = localStorage.getItem('lokma_country');

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

 // Navigate first, then close dropdown with slight delay
 // so the router.replace is not blocked by the re-render from closing
 router.replace(pathname, { locale: lang });
 setTimeout(() => setLangMenuOpen(false), 100);
 };

 const handleCountryChange = (code: string) => {
 setCurrentCountry(code);
 localStorage.setItem('lokma_country', code);
 setCountryMenuOpen(false);
 };

 const currentCountryData = countries.find(c => c.code === currentCountry) || countries[0];
 const currentLangData = languages.find(l => l.code === currentLang) || languages[0];

 const headerBg = themeAware
 ? (scrolled ? 'bg-background dark:bg-[#0f172a]/80 backdrop-blur-xl border-border/50 shadow-sm' : 'bg-background dark:bg-[#0f172a]/80 border-transparent')
 : (scrolled ? 'bg-background backdrop-blur-xl border-border/50 shadow-sm' : 'bg-background border-transparent');
 const textColor = themeAware ? 'text-foreground ' : 'text-foreground';
 const menuBg = themeAware ? 'bg-background dark:bg-[#1a1a1a] border-border/50 text-foreground ' : 'bg-background border-border/50 text-foreground';
 const itemHover = themeAware ? 'hover:bg-muted dark:hover:bg-background/10' : 'hover:bg-muted';
 const mutedText = themeAware ? 'text-muted-foreground/80 /50' : 'text-muted-foreground/80';

 if (isLoading) {
 return (
 <header className={`fixed top-0 z-50 w-full transition-all duration-300 border-b ${headerBg} px-4 md:px-20 lg:px-40 py-4`}>
 <div className="max-w-[1200px] mx-auto flex items-center h-9">
 </div>
 </header>
 );
 }

 return (
 <header className={`fixed top-0 z-50 w-full transition-all duration-300 border-b ${headerBg} ${textColor} px-4 md:px-20 lg:px-40 py-4`}>
 <div className="max-w-[1200px] mx-auto flex items-center justify-between">
 {/* Logo */}
 <Link href="/" className="flex items-center gap-3">
 {/* If themeAware, we might want to swap logo based on theme, but for now we keep the same logo but use filters in dark mode if needed. Actually lokma_logo_wide has white text? Let's check. Assuming lokma_logo_wide has white text, in light mode we might need to filter it. Or keep it as is. Let's use it as is for now. */}
 <div className={`${themeAware ? 'dark:block' : 'block'}`}>
 <Image src="/lokma_logo_red_web.png" alt="LOKMA" width={140} height={36} className="object-contain" />
 </div>
 </Link>

 {/* Desktop Nav */}
 <nav className="hidden md:flex items-center gap-8">
 <Link className="text-sm font-medium hover:text-[#ea184a] transition-colors" href="/">{t('home')}</Link>
 <Link className="text-sm font-medium hover:text-[#ea184a] transition-colors" href="/about">{t('about')}</Link>
 <Link className="text-sm font-medium hover:text-[#ea184a] transition-colors" href="/vendor">{t('vendorPortal')}</Link>
 <Link className="text-sm font-medium hover:text-[#ea184a] transition-colors" href="/support">{t('support')}</Link>
 </nav>

 <div className="flex items-center gap-3">
 {/* Unified Region & Language Selector */}
 <div className="relative" ref={countryRef}>
 <button
 className={`flex items-center gap-1.5 ${itemHover} px-2 py-1.5 rounded-lg transition-all`}
 onClick={() => setCountryMenuOpen(!countryMenuOpen)}
 >
 <span className="text-lg">{currentLangData.flag}</span>
 <span className="text-sm font-semibold hidden sm:block">{currentLang.toUpperCase()}</span>
 <span className="material-symbols-outlined text-[16px]">expand_more</span>
 </button>
 {countryMenuOpen && (
 <div className={`absolute right-0 top-full mt-2 w-72 ${menuBg} border rounded-xl overflow-hidden z-50 shadow-2xl`}>
 {/* Language Section */}
 <div className="px-3 pt-3 pb-2">
 <label className={`text-[10px] ${mutedText} uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5 px-1`}>
 <span className="material-symbols-outlined text-[12px]">language</span>
 {t('selectLanguage')}
 </label>
 <div className="grid grid-cols-2 gap-1">
 {languages.map((lang) => (
 <button
 key={lang.code}
 className={`flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-all text-left ${currentLang === lang.code
 ? 'bg-[#ea184a]/10 text-[#ea184a] font-semibold'
 : `${itemHover} ${themeAware ? 'text-foreground dark:text-gray-200' : 'text-foreground'} font-medium`
 }`}
 onClick={() => handleLangChange(lang.code)}
 >
 <span className="text-base">{lang.flag}</span>
 <span className="text-sm">{lang.name}</span>
 {currentLang === lang.code && (
 <span className="material-symbols-outlined text-[#ea184a] ml-auto text-[14px]">check_circle</span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Divider */}
 <div className={`mx-3 border-t ${themeAware ? 'border-border/50 ' : 'border-border/50'}`} />

 {/* Country/Region Section */}
 <div className="px-3 pt-2 pb-3">
 <label className={`text-[10px] ${mutedText} uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5 px-1`}>
 <span className="material-symbols-outlined text-[12px]">public</span>
 {t('regionCountry')}
 </label>
 <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
 {countries.map((country) => (
 <button
 key={country.code}
 className={`flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-all text-left ${currentCountry === country.code
 ? 'bg-[#ea184a]/10 text-[#ea184a] font-semibold'
 : `${itemHover} ${themeAware ? 'text-foreground dark:text-gray-200' : 'text-foreground'} font-medium`
 }`}
 onClick={() => handleCountryChange(country.code)}
 >
 <span className="text-base">{country.flag}</span>
 <span className="text-sm truncate">{country.name}</span>
 {currentCountry === country.code && (
 <span className="material-symbols-outlined text-[#ea184a] ml-auto text-[14px] flex-shrink-0">check_circle</span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Footer */}
 <div className={`px-3 py-2 border-t ${themeAware ? 'border-border/50 bg-muted/30 dark:bg-background/5' : 'border-border/30 bg-muted/30'}`}>
 <p className={`text-xs ${mutedText} text-center`}>
 {currentCountryData.flag} {currentCountryData.name} • {currentLangData.name}
 </p>
 </div>
 </div>
 )}
 </div>



 {/* Mobile Menu Button */}
 <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
 <span className="material-symbols-outlined">menu</span>
 </button>
 </div>
 </div >

 {/* Mobile Menu */}
 {
 mobileMenuOpen && (
 <div className={`md:hidden absolute top-full left-0 right-0 ${menuBg} border-b ${themeAware ? 'border-border/50 ' : 'border-white/10'} p-4`}>
 <nav className="flex flex-col gap-4">
 <Link className="text-sm font-medium py-2" href="/">{t('home')}</Link>
 <Link className="text-sm font-medium py-2" href="/about">{t('about')}</Link>
 <Link className="text-sm font-medium py-2" href="/vendor">{t('vendorPortal')}</Link>
 <Link className="text-sm font-medium py-2" href="/support">{t('support')}</Link>

 </nav>
 </div>
 )
 }
 </header >
 );
}
