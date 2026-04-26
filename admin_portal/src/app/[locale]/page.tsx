'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../../i18n/routing';
import Image from 'next/image';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const countries = [
 { code: 'DE', name: 'Deutschland', flag: '🇩🇪', defaultLang: 'de' },
 { code: 'TR', name: 'Türkiye', flag: '🇹🇷', defaultLang: 'tr' },
 { code: 'AT', name: 'Österreich', flag: '🇦🇹', defaultLang: 'de' },
 { code: 'CH', name: 'Schweiz', flag: '🇨🇭', defaultLang: 'de' },
 { code: 'NL', name: 'Nederland', flag: '🇳🇱', defaultLang: 'nl' },
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

export default function LandingPage() {
 const [langMenuOpen, setLangMenuOpen] = useState(false);
 const [countryMenuOpen, setCountryMenuOpen] = useState(false);
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 const [faqOpen, setFaqOpen] = useState<number | null>(null);

 const countryRef = useRef<HTMLDivElement>(null);
 const langRef = useRef<HTMLDivElement>(null);

 const [currentLang, setCurrentLang] = useState('tr');
 const [currentCountry, setCurrentCountry] = useState('DE');
 const [isLoading, setIsLoading] = useState(true);

 const router = useRouter();
 const pathname = usePathname();
 const t = useTranslations('Landing');

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

 useEffect(() => {
 const detectCountry = async () => {
 try {
 const response = await fetch('https://ipapi.co/json/');
 const data = await response.json();
 if (data.country_code) {
 const country = countries.find(c => c.code === data.country_code);
 if (country) setCurrentCountry(data.country_code);
 }
 } catch {
 setCurrentCountry('DE');
 } finally {
 setIsLoading(false);
 }
 };

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

 const handleLangChange = (lang: string) => {
 setCurrentLang(lang);
 localStorage.setItem('lokma_lang', lang);
 setLangMenuOpen(false);
 router.replace(pathname, { locale: lang });
 };

 const handleCountryChange = (code: string) => {
 setCurrentCountry(code);
 localStorage.setItem('lokma_country', code);
 setCountryMenuOpen(false);
 };

 const categories = [
 { name: t('market'), desc: t('marketDesc'), href: '/categories/market', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEVs9F1p-MauF5eNVA5eYldgqFpE207b2eUycOdE0Uyr_CqLuTg-L8jHJfA2MapdFAsgKuscHd815tjfnDTb0r09kbgyUo0qCeV_pdArR78YGmWV4Ah7gImVt0eglMLTefRbnnIRHlc2Wn-DDBswILQM34KAG0dHhSBr_nGBf77YX0Tp8XJyygy72UBCsJr12piLHGPcsnKUZntLIaWwL5GnXuEDLIXEg8zJlj2wR0czCyrtkrN1k2av-KFNptTEM0FkAO2V7BkWk' },
 { name: t('butcher'), desc: t('butcherDesc'), href: '/categories/butcher', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArw-TkI2-SzpObLta2IQwojPsIP3VeIb78vV1IvBMdZe2dyV7_lQ3ejmcKzmRW_qI_AY3dvMowCaJQGjOBTWD__v0TJDuKOIWPMQUB0OByMsff8xDw_3EhTca9SfbfP2aljgaBfA5HWa9FksjyRI_XMnkZj809dOi1CSpn2bjA8lZKvZ0UvaPuMnrK2FkEINZ_l902_fWpxTpsjiv1SnxG9pTaUMr0fG6RwsJmdsGiQQ_wd17fZ4dUQnDkPF6aO50W4YikUgcgKcM' },
 { name: t('catering'), desc: t('cateringDesc'), href: '/categories/catering', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6p0c2Yu4v2xu5b5_oWKBYFUaEbjFub1JTnbRD4umr449cO38ryv7h55GzrDk5EYhI73-ZF9qzi0BKdtrFWNqP6hrJ0Yr1Tld8Gsz49uXLf29gGddlUathh8DkVu4Z6tL9DmIbOmLxnL52f1Am60XBC8bVmTMNjlly5mZag0jUEHS2-QYmGZSy6gOdZlAU3ip5UxbJFm7V5qs1OJLcvtMuDsQg-DRdLFtToh0woYl3NnQNO1G17fYm3TfZUOTYjBGGczhirbx-poE' },
 { name: t('florist'), desc: t('floristDesc'), href: '/categories/florist', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQpcy6BGPQ6eU9911vrabfP4EqYYFKxKc4mjpbRnbTrog2lUWY6g4emwly6xjlPYKn7lbIWK-R_1bHOG93YJmXJxgGskqSKnW-9Zb2S8t_t_x--ugIlPjsGEcZkjQVxXyqutg8pQ3HwjOgO8d_Wml9yG4ViXjFydYFeQHPMbxxr4tckWaitFQVMzRB1iTV1ogl1HU0HnO9Vo5nMoGLTYssJy72z8aB9WEtaIU6QJcFIpc7wShj7BVwvDySvDPwK3ih2a5o_OALWog' },
 { name: t('kermes'), desc: t('kermesDesc'), href: '/kermes', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCN09M8elc_C8OsSIqRq-4dpdi0B-qBOhsauyUuAp91K2z0i5sTqYiSW45WkV5wgkkse8HanK1NKfhP0vWQqKQ9_epsxzAdfWJC0I-ArkTqSakmgGaAJmggZCP49tE8O-2sb6ieERfa8FWONxW2CzC_UJqCjhWmydjDGGoSwurrb4PCXDMh-_Z2Kpau2YrdXVG99DoqL6hJ0d0BVQEN3K_6yopBcWsWfdzTZtz4slgoekRrrgG-KFEq6d6fCwpFay9xvuR37QDm_qk' },
 { name: t('dining'), desc: t('diningDesc'), href: '/categories/dining', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop' },
 { name: t('elLezzetleri'), desc: t('elLezzetleriDesc'), href: '/el-lezzetleri', img: 'https://images.unsplash.com/photo-1512485800893-b08ec1ea59b1?w=400&h=300&fit=crop' },
 { name: t('farmer'), desc: t('farmerDesc'), href: '/ciftciden', img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&h=300&fit=crop' },
 ];

 const faqs = [
 { q: t('faq1Q'), a: t('faq1A') },
 { q: t('faq2Q'), a: t('faq2A') },
 { q: t('faq3Q'), a: t('faq3A') },
 { q: t('faq4Q'), a: t('faq4A') },
 ];

 if (isLoading) {
 return (
 <div className="min-h-screen bg-white dark:bg-[#0f172a] flex items-center justify-center">
 <div className="animate-pulse">
 <Image src="/lokma_logo_red_web.png" alt="LOKMA" width={160} height={40} className="object-contain" />
 </div>
 </div>
 );
 }

 return (
 <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0f172a] text-foreground font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden selection:bg-[#ea184a]/30">
 <PublicHeader themeAware={true} />

  {/* Modern SaaS Split Hero Section */}
  <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden bg-background">
    {/* Subtle Mesh Gradient Background */}
    <div className="absolute top-0 inset-x-0 h-full w-full overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ea184a]/5 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/5 blur-[120px]" />
    </div>

    <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
      {/* Left: Text content */}
      <div className="flex-1 w-full text-center md:text-left mt-8 md:mt-0">
        <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black leading-[1.1] tracking-tight mb-8 text-foreground">
          {t('heroTitle')}<br />
          <span className="bg-gradient-to-r from-[#ea184a] to-rose-500 bg-clip-text text-transparent">
            {t('heroTitleEnd')}
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto md:mx-0 mb-10 leading-relaxed font-medium">
          {t('heroSubtitle')}
        </p>

        {/* Trust Badge */}
        <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 mb-10">
          <div className="flex -space-x-4">
            <div className="w-10 h-10 rounded-full border-2 border-background bg-gray-200 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" alt="User" />
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-background bg-gray-200 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop" alt="User" />
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-background bg-[#ea184a] flex items-center justify-center text-xs font-bold text-white">
              +10k
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="flex justify-center sm:justify-start text-yellow-400 text-sm">★★★★★</div>
            <div className="text-sm font-bold text-foreground">
              4.8/5.0 <span className="text-muted-foreground font-normal">({t('heroOrderCount')})</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 mb-12">
          <Link href="/login" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-rose-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-[#ea184a]/20 transition-transform hover:-translate-y-1 w-full sm:w-auto">
            {t('exploreBtn')}
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </Link>
          <Link href="/vendor" className="inline-flex items-center justify-center gap-3 bg-muted/50 text-foreground px-8 py-4 rounded-xl font-bold text-lg border border-border shadow-sm hover:bg-muted transition-colors w-full sm:w-auto">
            {t('splitPartnerTitle')}
          </Link>
        </div>

        <div className="flex items-center justify-center md:justify-start gap-4">
          <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-all hover:scale-105">
            <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="App Store" className="h-[40px]" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-all hover:scale-105">
            <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Google Play" className="h-[58px] -my-2" />
          </a>
        </div>
      </div>

        {/* Right: Premium Floating Visual */}
        <div className="w-full md:flex-1 relative mt-4 md:mt-0 mb-8 md:mb-0 flex items-center justify-center min-h-[300px] md:min-h-[600px]">
          
          {/* Subtle Mobile Glow to anchor the pizza */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div className="w-[80%] max-w-[250px] md:max-w-[500px] aspect-square bg-[#ea184a]/20 blur-[60px] md:blur-[100px] rounded-full mix-blend-screen" />
          </div>

          {/* Floating Transparent Pizza */}
          <div className="relative w-[85%] sm:w-[70%] md:w-[130%] lg:w-[140%] max-w-[320px] md:max-w-[750px] aspect-square flex items-center justify-center z-10 mx-auto md:-ml-8 lg:-ml-12 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] md:drop-shadow-[0_40px_60px_rgba(0,0,0,0.6)]">
            <Image
              src="/herp_pizza_3_transparent.png"
              alt="LOKMA Premium Food Delivery"
              fill
              className="object-contain transition-transform duration-700 hover:scale-[1.02] md:hover:scale-105"
              priority
            />
          </div>
        </div>

      </div>
  </section>

 {/* Feature Cards — Lexware style (light background) */}
 <section className="bg-background py-20 px-4 md:px-8">
 <div className="max-w-[1200px] mx-auto">
 <div className="mb-14">
 <p className="text-[#F51736] font-bold text-sm tracking-wider uppercase mb-3 flex items-center gap-2">
 <span className="material-symbols-outlined text-base">restaurant</span>
 All-in-One
 </p>
 <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
 <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground max-w-lg leading-tight">
 {t('whyLokmaTitle')}
 </h2>
 <Link className="text-[#F51736] font-bold flex items-center gap-1 group hover:gap-2 transition-all" href="/categories">
 {t('seeAll')}
 <span className="material-symbols-outlined text-sm">arrow_forward</span>
 </Link>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
 {/* Card 1 */}
 <div className="group p-6 rounded-2xl border border-border/50 hover:border-[#F51736]/30 hover:shadow-lg hover:shadow-[#F51736]/5 transition-all duration-300 bg-card">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-5 group-hover:bg-[#F51736] group-hover:text-white transition-colors duration-300">
 <span className="material-symbols-outlined text-[28px]">bolt</span>
 </div>
 <h3 className="text-xl font-bold text-foreground mb-3">{t('whyFastTitle')}</h3>
 <p className="text-muted-foreground dark:text-gray-400 leading-relaxed text-sm">{t('whyFastDesc')}</p>
 </div>

 {/* Card 2 */}
 <div className="group p-6 rounded-2xl border border-border/50 hover:border-[#F51736]/30 hover:shadow-lg hover:shadow-[#F51736]/5 transition-all duration-300 bg-card">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-5 group-hover:bg-[#F51736] group-hover:text-white transition-colors duration-300">
 <span className="material-symbols-outlined text-[28px]">handshake</span>
 </div>
 <h3 className="text-xl font-bold text-foreground mb-3">{t('whyFairTitle')}</h3>
 <p className="text-muted-foreground dark:text-gray-400 leading-relaxed text-sm">{t('whyFairDesc')}</p>
 </div>

 {/* Card 3 */}
 <div className="group p-6 rounded-2xl border border-border/50 hover:border-[#F51736]/30 hover:shadow-lg hover:shadow-[#F51736]/5 transition-all duration-300 bg-card">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-5 group-hover:bg-[#F51736] group-hover:text-white transition-colors duration-300">
 <span className="material-symbols-outlined text-[28px]">storefront</span>
 </div>
 <h3 className="text-xl font-bold text-foreground mb-3">{t('whyWideTitle')}</h3>
 <p className="text-muted-foreground dark:text-gray-400 leading-relaxed text-sm">{t('whyWideDesc')}</p>
 </div>

 {/* Card 4 */}
 <div className="group p-6 rounded-2xl border border-border/50 hover:border-[#F51736]/30 hover:shadow-lg hover:shadow-[#F51736]/5 transition-all duration-300 bg-card">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-5 group-hover:bg-[#F51736] group-hover:text-white transition-colors duration-300">
 <span className="material-symbols-outlined text-[28px]">eco</span>
 </div>
 <h3 className="text-xl font-bold text-foreground mb-3">{t('market')}</h3>
 <p className="text-muted-foreground dark:text-gray-400 leading-relaxed text-sm">{t('marketDesc')}</p>
 </div>
 </div>
 </div>
 </section>


 {/* Manifesto Section - Anti-Exploitation */}
 <section className="bg-muted/20 py-24 px-4 md:px-8 border-y border-border/50 relative overflow-hidden">
 {/* Abstract background elements */}
 <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
 <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#F51736]/5 blur-[120px]"></div>
 <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#F51736]/5 blur-[120px]"></div>
 </div>

 <div className="max-w-[1200px] mx-auto relative z-10">
 <div className="max-w-3xl mx-auto text-center mb-16">
 <div className="inline-flex items-center justify-center bg-[#F51736]/10 text-[#F51736] px-4 py-2 rounded-full text-sm font-bold mb-6 uppercase tracking-widest border border-[#F51736]/20">
 <span className="material-symbols-outlined text-[18px] mr-2">flag</span>
 Manifesto
 </div>
 <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground mb-8 leading-[1.1] tracking-tight">
 {t('manifestoTitle')}
 </h2>
 <p className="text-lg md:text-xl text-muted-foreground dark:text-gray-400 leading-relaxed font-medium">
 {t('manifestoSubtitle')}
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 {/* Card 1 */}
 <div className="bg-card p-8 rounded-3xl border border-border/50 shadow-xl shadow-black/5 hover:border-[#F51736]/30 transition-colors">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-6">
 <span className="material-symbols-outlined text-[28px]">balance</span>
 </div>
 <h3 className="text-2xl font-bold text-foreground mb-4">{t('manifestoCard1Title')}</h3>
 <p className="text-muted-foreground leading-relaxed">{t('manifestoCard1Desc')}</p>
 </div>

 {/* Card 2 */}
 <div className="bg-card p-8 rounded-3xl border border-border/50 shadow-xl shadow-black/5 hover:border-[#F51736]/30 transition-colors">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-6">
 <span className="material-symbols-outlined text-[28px]">lock_open</span>
 </div>
 <h3 className="text-2xl font-bold text-foreground mb-4">{t('manifestoCard2Title')}</h3>
 <p className="text-muted-foreground leading-relaxed">{t('manifestoCard2Desc')}</p>
 </div>

 {/* Card 3 */}
 <div className="bg-card p-8 rounded-3xl border border-border/50 shadow-xl shadow-black/5 hover:border-[#F51736]/30 transition-colors">
 <div className="w-14 h-14 bg-[#F51736]/10 text-[#F51736] flex items-center justify-center rounded-2xl mb-6">
 <span className="material-symbols-outlined text-[28px]">receipt_long</span>
 </div>
 <h3 className="text-2xl font-bold text-foreground mb-4">{t('manifestoCard3Title')}</h3>
 <p className="text-muted-foreground leading-relaxed">{t('manifestoCard3Desc')}</p>
 </div>
 </div>
 </div>
 </section>

 {/* Partner CTA — Lexware-style clean banner */}
 <section className="bg-background py-20 px-4 md:px-8">
 <div className="max-w-[1200px] mx-auto relative bg-gradient-to-br from-[#F51736] to-[#c9183d] rounded-3xl p-10 md:p-16 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
 <div className="absolute -top-20 -right-20 w-[300px] h-[300px] bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
 <div className="relative z-10 flex-1">
 <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
 {t('b2bPartnerBadge')}
 </div>
 <h3 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">{t('splitPartnerTitle')}</h3>
 <p className="text-white/85 text-lg max-w-md leading-relaxed">{t('splitPartnerDesc')}</p>
 </div>
 <div className="relative z-10 flex-shrink-0">
 <Link href="/vendor" className="inline-flex items-center gap-2 bg-white text-[#F51736] px-8 py-4 rounded-xl font-bold text-lg hover:bg-muted transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]">
 {t('splitPartnerBtn')}
 <span className="material-symbols-outlined">arrow_forward</span>
 </Link>
 </div>
 </div>
 </section>

 {/* FAQ Section */}
 <section className="bg-background py-20 px-4 md:px-8">
 <div className="max-w-[1000px] mx-auto">
 <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12 text-foreground ">{t('faqTitle')}</h2>
 <div className="space-y-4">
 {faqs.map((faq, index) => (
 <div key={index} className="border border-border/50 rounded-2xl overflow-hidden hover:border-[#F51736]/20 transition-colors">
 <button
 className="w-full flex items-center justify-between p-6 text-left"
 onClick={() => setFaqOpen(faqOpen === index ? null : index)}
 >
 <span className="font-bold text-lg md:text-xl pr-4 text-foreground ">{faq.q}</span>
 <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${faqOpen === index ? 'rotate-180 bg-[#F51736]/10 text-[#F51736]' : 'text-muted-foreground/80'}`}>
 <span className="material-symbols-outlined text-[20px]">expand_more</span>
 </div>
 </button>
 <div
 className={`overflow-hidden transition-all duration-300 ease-in-out ${faqOpen === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
 >
 <div className="px-6 pb-6 pt-0 text-muted-foreground dark:text-gray-400 text-lg">
 {faq.a}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>

 <PublicFooter themeAware={true} />
 
 {/* Required CSS for hiding horizontal scrollbar */}
 <style dangerouslySetInnerHTML={{__html: `
 .hide-scrollbar::-webkit-scrollbar {
 display: none;
 }
 .hide-scrollbar {
 -ms-overflow-style: none;
 scrollbar-width: none;
 }
 `}} />
 </div>
 );
}
