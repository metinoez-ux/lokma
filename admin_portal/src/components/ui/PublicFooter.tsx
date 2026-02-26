'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

const languages = [
    { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸' },
];

export default function PublicFooter({ themeAware = false }: { themeAware?: boolean }) {
    const t = useTranslations('Landing');

    const footerBg = themeAware ? 'bg-gray-50 dark:bg-[#0a0505] border-gray-200 dark:border-white/5' : 'bg-[#0a0505] border-white/5';
    const textColor = themeAware ? 'text-gray-600 dark:text-white/40' : 'text-white/40';
    const headingColor = themeAware ? 'text-gray-900 dark:text-white' : 'text-white';
    const linkColor = themeAware ? 'text-gray-600 dark:text-white/50 hover:text-[#fb335b] dark:hover:text-[#fb335b]' : 'text-white/50 hover:text-[#fb335b]';

    return (
        <footer className={`${footerBg} border-t py-12 px-4 md:px-20 lg:px-40`}>
            <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="space-y-6">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/lokma_logo_wide.png" alt="LOKMA" width={120} height={30} className="object-contain" />
                    </Link>
                    <p className={`text-sm ${textColor} leading-relaxed`}>
                        LOKMA, geleneksel ticaretin gücünü modern teknolojiyle birleştiren adil bir pazar yeridir.
                    </p>
                </div>

                <div className="space-y-4">
                    <h4 className={`font-bold uppercase text-xs tracking-widest ${headingColor}`}>{t('footerPlatform')}</h4>
                    <ul className="space-y-2 text-sm">
                        <li><Link className={`transition-colors ${linkColor}`} href="/how-it-works">{t('howItWorks')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/categories">{t('categories')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/popular">{t('popularShops')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/deals">{t('deals')}</Link></li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h4 className={`font-bold uppercase text-xs tracking-widest ${headingColor}`}>{t('footerCorporate')}</h4>
                    <ul className="space-y-2 text-sm">
                        <li><Link className={`transition-colors ${linkColor}`} href="/about">{t('about')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/careers">{t('career')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/press">{t('press')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/contact">{t('contact')}</Link></li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h4 className={`font-bold uppercase text-xs tracking-widest ${headingColor}`}>{t('footerLegal')}</h4>
                    <ul className="space-y-2 text-sm">
                        <li><Link className={`transition-colors ${linkColor}`} href="/agb">{t('terms')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/datenschutz">{t('privacy')}</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/impressum">Impressum</Link></li>
                        <li><Link className={`transition-colors ${linkColor}`} href="/widerruf">Widerruf</Link></li>
                    </ul>
                </div>
            </div>

            <div className={`max-w-[1200px] mx-auto mt-20 pt-8 border-t ${themeAware ? 'border-gray-200 dark:border-white/5' : 'border-white/5'} flex flex-col md:flex-row items-center justify-between gap-4`}>
                <p className={`text-xs ${textColor}`}>{t('copyright')}</p>
                <div className={`flex items-center gap-2 text-xs ${textColor}`}>
                    <span className="material-symbols-outlined text-[14px]">language</span>
                    {languages.length} {t('langSupport')}
                </div>
            </div>
        </footer>
    );
}
