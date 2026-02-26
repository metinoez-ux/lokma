'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../../i18n/routing';
import Image from 'next/image';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

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


export default function LandingPage() {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

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

  const categories = [
    { name: t('market'), desc: t('marketDesc'), href: '/categories/market', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEVs9F1p-MauF5eNVA5eYldgqFpE207b2eUycOdE0Uyr_CqLuTg-L8jHJfA2MapdFAsgKuscHd815tjfnDTb0r09kbgyUo0qCeV_pdArR78YGmWV4Ah7gImVt0eglMLTefRbnnIRHlc2Wn-DDBswILQM34KAG0dHhSBr_nGBf77YX0Tp8XJyygy72UBCsJr12piLHGPcsnKUZntLIaWwL5GnXuEDLIXEg8zJlj2wR0czCyrtkrN1k2av-KFNptTEM0FkAO2V7BkWk' },
    { name: t('butcher'), desc: t('butcherDesc'), href: '/categories/butcher', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArw-TkI2-SzpObLta2IQwojPsIP3VeIb78vV1IvBMdZe2dyV7_lQ3ejmcKzmRW_qI_AY3dvMowCaJQGjOBTWD__v0TJDuKOIWPMQUB0OByMsff8xDw_3EhTca9SfbfP2aljgaBfA5HWa9FksjyRI_XMnkZj809dOi1CSpn2bjA8lZKvZ0UvaPuMnrK2FkEINZ_l902_fWpxTpsjiv1SnxG9pTaUMr0fG6RwsJmdsGiQQ_wd17fZ4dUQnDkPF6aO50W4YikUgcgKcM' },
    { name: t('catering'), desc: t('cateringDesc'), href: '/categories/catering', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6p0c2Yu4v2xu5b5_oWKBYFUaEbjFub1JTnbRD4umr449cO38ryv7h55GzrDk5EYhI73-ZF9qzi0BKdtrFWNqP6hrJ0Yr1Tld8Gsz49uXLf29gGddlUathh8DkVu4Z6tL9DmIbOmLxnL52f1Am60XBC8bVmTMNjlly5mZag0jUEHS2-QYmGZSy6gOdZlAU3ip5UxbJFm7V5qs1OJLcvtMuDsQg-DRdLFtToh0woYl3NnQNO1G17fYm3TfZUOTYjBGGczhirbx-poE' },
    { name: t('florist'), desc: t('floristDesc'), href: '/categories/florist', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQpcy6BGPQ6eU9911vrabfP4EqYYFKxKc4mjpbRnbTrog2lUWY6g4emwly6xjlPYKn7lbIWK-R_1bHOG93YJmXJxgGskqSKnW-9Zb2S8t_t_x--ugIlPjsGEcZkjQVxXyqutg8pQ3HwjOgO8d_Wml9yG4ViXjFydYFeQHPMbxxr4tckWaitFQVMzRB1iTV1ogl1HU0HnO9Vo5nMoGLTYssJy72z8aB9WEtaIU6QJcFIpc7wShj7BVwvDySvDPwK3ih2a5o_OALWog' },
    { name: t('kermes'), desc: t('kermesDesc'), href: '/kermes', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCN09M8elc_C8OsSIqRq-4dpdi0B-qBOhsauyUuAp91K2z0i5sTqYiSW45WkV5wgkkse8HanK1NKfhP0vWQqKQ9_epsxzAdfWJC0I-ArkTqSakmgGaAJmggZCP49tE8O-2sb6ieERfa8FWONxW2CzC_UJqCjhWmydjDGGoSwurrb4PCXDMh-_Z2Kpau2YrdXVG99DoqL6hJ0d0BVQEN3K_6yopBcWsWfdzTZtz4slgoekRrrgG-KFEq6d6fCwpFay9xvuR37QDm_qk' },
    { name: t('dining'), desc: t('diningDesc'), href: '/categories/dining', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2Tm8hx8ZWjL9LUYjxUcedhtjUX68PIeLaZvkaT6nt9_NB6pVHJYBVlSFL-8o1dWUcMOlQaFkjCFI4-hFGy96FuZF1ESb8Bhbe7tDu3wq6DnBpK-6UOOu8k2LEjcZkLcsEMe7RlZFJGJk-ZlLqrUoK68i7Orf8PLMRTnJDyIWYxAxBBlJ97DWYt_nwAb74kA4wEUVBSmC6IbiyMjOUDjewpKHVse2j62g80G8XUYlZVQAj8Rlc77oPKcWs8yX6H8R0WL059U0n7X8' },
    { name: t('elLezzetleri'), desc: t('elLezzetleriDesc'), href: '/el-lezzetleri', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop' },
    { name: t('farmer'), desc: t('farmerDesc'), href: '/ciftciden', img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&h=300&fit=crop' },
  ];


  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
  ];

  const scrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#120a0a] flex items-center justify-center">
        <div className="animate-pulse">
          <Image src="/lokma_logo_wide.png" alt="LOKMA" width={160} height={40} className="object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      <PublicHeader themeAware={true} />

      {/* Hero Section */}
      <section className="relative pt-24 min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#120a0a]/80 via-[#120a0a]/60 to-[#120a0a] z-10"></div>
          <div
            className="w-full h-full bg-cover bg-center scale-105"
            style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxlIp_cD3tTcUm8UmL7N2cZGr6NZqZCJ7RasQV4R1B59JtwYF5moSxLKUhfuAOnjMNjfJO8TP77IfY4Aejq4ei3S6lHURkI5hp5WUFhkDsRxP2ecyP17Lwdk4VKiX1R0F7nbq6cYJIlYZ1KhBE-KzdUuD14p-x3rJkNNohha-fPWqb0IXnNIeA7Nqmsrh19-FCKclMewBfYiG6KQIziWAuCqaK4LBNzZzhVQOzdHqWijWivs5NQOILJAemBnnJNF_rfjiROKELPMI')` }}
          />
        </div>

        <div className="relative z-20 container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight drop-shadow-2xl">
              {t('heroTitle')} <span className="text-[#fb335b] italic">{t('heroHighlight')}</span> {t('heroTitleEnd')}
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-medium">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 max-w-xl mx-auto relative text-left">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity transform hover:scale-105">
                  <img
                    src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                    alt={t('appStoreButton')}
                    className="h-14"
                  />
                </a>
                <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity transform hover:scale-105">
                  <img
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                    alt={t('playStoreButton')}
                    className="h-14"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <main className="relative z-20 bg-[#120a0a] px-4 md:px-20 lg:px-40 pb-20">
        <section id="categories" className="max-w-[1200px] mx-auto py-20">
          <div className="flex items-end justify-between mb-10 px-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('discoverTitle')}</h2>
              <p className="text-white/60 mt-2">{t('discoverSubtitle')}</p>
            </div>
            <Link className="text-[#fb335b] font-bold flex items-center gap-1 group" href="/categories">
              {t('seeAll')}
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">chevron_right</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
            {categories.map((cat) => (
              <Link key={cat.name} href={cat.href} className="group relative aspect-square overflow-hidden rounded-2xl cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10"></div>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${cat.img}')` }}
                />
                <div className="absolute bottom-6 left-6 z-20">
                  <h3 className="text-2xl font-bold">{cat.name}</h3>
                  <p className="text-sm text-white/70">{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Why Lokma Section */}
        <section className="max-w-[1200px] mx-auto py-20 px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">{t('whyLokmaTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] text-center hover:bg-white/10 transition-colors">
              <div className="w-16 h-16 mx-auto bg-[#fb335b]/20 text-[#fb335b] rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl">handshake</span>
              </div>
              <h3 className="text-xl font-bold mb-4">{t('whyFairTitle')}</h3>
              <p className="text-white/60">{t('whyFairDesc')}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] text-center hover:bg-white/10 transition-colors">
              <div className="w-16 h-16 mx-auto bg-[#fb335b]/20 text-[#fb335b] rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl">local_shipping</span>
              </div>
              <h3 className="text-xl font-bold mb-4">{t('whyFastTitle')}</h3>
              <p className="text-white/60">{t('whyFastDesc')}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] text-center hover:bg-white/10 transition-colors">
              <div className="w-16 h-16 mx-auto bg-[#fb335b]/20 text-[#fb335b] rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl">storefront</span>
              </div>
              <h3 className="text-xl font-bold mb-4">{t('whyWideTitle')}</h3>
              <p className="text-white/60">{t('whyWideDesc')}</p>
            </div>
          </div>
        </section>

        {/* Split Section (Partners & Couriers) */}
        <section className="max-w-[1200px] mx-auto py-10 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-[#fb335b]/20 to-transparent border border-[#fb335b]/30 p-10 flex flex-col justify-between rounded-[2rem] min-h-[300px]">
              <div>
                <h3 className="text-3xl font-black mb-4">{t('splitPartnerTitle')}</h3>
                <p className="text-white/70 text-lg mb-8">{t('splitPartnerDesc')}</p>
              </div>
              <div>
                <Link href="/partner" className="inline-flex items-center gap-2 bg-[#fb335b] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-[#fb335b]/20">
                  {t('splitPartnerBtn')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/30 p-10 flex flex-col justify-between rounded-[2rem] min-h-[300px]">
              <div>
                <h3 className="text-3xl font-black mb-4">{t('splitCourierTitle')}</h3>
                <p className="text-white/70 text-lg mb-8">{t('splitCourierDesc')}</p>
              </div>
              <div>
                <Link href="/kurye" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20">
                  {t('splitCourierBtn')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-[1200px] mx-auto py-20 px-4">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-12">{t('faqTitle')}</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-6 text-left"
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                >
                  <span className="font-bold text-lg">{faq.q}</span>
                  <span className={`material-symbols-outlined transition-transform ${faqOpen === index ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {faqOpen === index && (
                  <div className="px-6 pb-6 text-white/70">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* App Download CTA */}
      <section className="py-16 px-4 md:px-20 lg:px-40 bg-gradient-to-b from-gray-100 to-white dark:from-[#120a0a] dark:to-[#0a0505]">
        <div className="max-w-[800px] mx-auto bg-gradient-to-br from-white/10 to-transparent border border-white/20 rounded-3xl p-8 md:p-12 text-center">
          <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="material-symbols-outlined text-[18px]">smartphone</span>
            Alışveriş Uygulamada
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            <span className="text-[#fb335b]">LOKMA</span> Uygulamasını İndir
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto text-lg">
            Tüm kategoriler, özel kampanyalar ve anlık teslimat takibi uygulamamızda.
            <span className="text-white font-medium"> Fresh. Fast. Local.</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="App Store'dan İndir"
                className="h-14"
              />
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Google Play'den İndir"
                className="h-14"
              />
            </a>
          </div>
        </div>
      </section>

      <PublicFooter themeAware={true} />
    </div>
  );
}
