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
    { code: 'nl', name: 'Nederlands', nativeName: 'Nederlands', flag: '🇳🇱' },
];

export default function PublicFooter({ themeAware = false }: { themeAware?: boolean }) {
    const t = useTranslations('Landing');

    const footerBg = themeAware ? 'bg-gray-50 dark:bg-[#0a0505] border-gray-200 dark:border-white/5' : 'bg-gray-50 border-gray-200';
    const textColor = themeAware ? 'text-gray-600 dark:text-white/40' : 'text-gray-500';
    const headingColor = themeAware ? 'text-gray-900 dark:text-white' : 'text-gray-900';
    const linkColor = themeAware ? 'text-gray-600 dark:text-white/50 hover:text-[#ea184a] dark:hover:text-[#ea184a]' : 'text-gray-600 hover:text-[#ea184a]';

    return (
        <footer className={`${footerBg} border-t py-12 px-4 md:px-20 lg:px-40`}>
            <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="space-y-6">
                    <Link href="/" className="flex items-center gap-2">
                        {themeAware ? (
                            <>
                                <Image src="/lokma_logo_red_web.png" alt="LOKMA" width={120} height={30} className="object-contain dark:hidden" />
                                <Image src="/lokma_logo_red_web.png" alt="LOKMA" width={120} height={30} className="object-contain hidden dark:block" />
                            </>
                        ) : (
                            <Image src="/lokma_logo_red_web.png" alt="LOKMA" width={120} height={30} className="object-contain" />
                        )}
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

            <div className={`max-w-[1200px] mx-auto mt-20 pt-8 border-t ${themeAware ? 'border-gray-200 dark:border-white/5' : 'border-gray-200'} flex flex-col md:flex-row items-center justify-between gap-4`}>
                <p className={`text-xs ${textColor}`}>{t('copyright')}</p>
                <div className={`flex items-center gap-2 text-xs ${textColor}`}>
                    <span className="material-symbols-outlined text-[14px]">language</span>
                    {languages.length} {t('langSupport')}
                </div>
            </div>
        </footer>
    );
}
