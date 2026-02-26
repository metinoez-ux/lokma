'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function PartnerPage() {
    const t = useTranslations('Partner');

    const benefits = [
        { icon: 'percent', title: t('benefitCommTitle'), desc: t('benefitCommDesc') },
        { icon: 'speed', title: t('benefitPayTitle'), desc: t('benefitPayDesc') },
        { icon: 'dashboard_customize', title: t('benefitControlTitle'), desc: t('benefitControlDesc') },
        { icon: 'visibility', title: t('benefitVisTitle'), desc: t('benefitVisDesc') },
    ];

    const steps = [
        { num: '1', title: t('step1Title'), desc: t('step1Desc') },
        { num: '2', title: t('step2Title'), desc: t('step2Desc') },
        { num: '3', title: t('step3Title'), desc: t('step3Desc') },
    ];

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] pt-24 overflow-x-hidden">
            <PublicHeader themeAware={true} />
            {/* Hero Section */}
            <section className="relative py-20 px-4 md:px-20 lg:px-40 overflow-hidden min-h-[60vh] flex items-center justify-center">
                <div className="absolute inset-0 z-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-[#120a0a] dark:via-transparent dark:to-[#120a0a] z-10"></div>
                    <div className="w-full h-full bg-[#fb335b]/20 blur-[100px] transform scale-150 rounded-full"></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <span className="inline-flex items-center gap-2 bg-[#fb335b]/10 text-[#fb335b] px-5 py-2 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#fb335b]/30">
                        <span className="material-symbols-outlined text-[18px]">storefront</span>
                        {t('esnafMap')}
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight mb-6 drop-shadow-2xl">
                        {t('title')}
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 dark:text-white/70 max-w-3xl mx-auto mb-12 font-medium">
                        {t('subtitle')}
                    </p>
                    <Link
                        href="/partner/apply"
                        className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-gray-900 dark:text-white px-12 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95"
                    >
                        {t('applyNow')} <span className="material-symbols-outlined animate-bounce">rocket_launch</span>
                    </Link>
                    <p className="text-gray-400 dark:text-white/40 text-sm mt-6 font-medium tracking-wide">{t('ctaSubtext')}</p>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-24 px-4 md:px-20 lg:px-40 bg-gray-50 dark:bg-white/[0.02] border-y border-gray-200 dark:border-white/5 relative">
                <div className="max-w-[1200px] mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-black mb-16 tracking-tight">{t('benefitsTitle')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {benefits.map((b, i) => (
                            <div key={i} className="bg-white dark:bg-[#120a0a] p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 hover:border-[#fb335b]/50 transition-colors text-center flex flex-col items-center group hover:-translate-y-2 duration-300 shadow-2xl shadow-black">
                                <div className="w-16 h-16 bg-[#fb335b]/10 text-[#fb335b] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-3xl">{b.icon}</span>
                                </div>
                                <h3 className="text-xl font-bold mb-3">{b.title}</h3>
                                <p className="text-gray-500 dark:text-white/60 text-base leading-relaxed">{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Layer */}
            <section className="py-24 px-4 md:px-20 lg:px-40 bg-white dark:bg-[#120a0a]">
                <div className="max-w-[1000px] mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{t('howItWorksTitle')}</h2>
                        <div className="w-24 h-1 bg-[#fb335b] mx-auto rounded-full"></div>
                    </div>

                    <div className="relative">
                        {/* Connecting line for desktop */}
                        <div className="hidden md:block absolute top-[45px] left-[10%] right-[10%] h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent z-0"></div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                            {steps.map((step, i) => (
                                <div key={i} className="text-center group">
                                    <div className="w-24 h-24 bg-white dark:bg-[#120a0a] border-4 border-gray-200 dark:border-white/10 group-hover:border-[#fb335b] transition-colors rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black">
                                        <span className="text-4xl font-black text-gray-900 dark:text-white group-hover:text-[#fb335b] transition-colors">{step.num}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-gray-500 dark:text-white/60 text-lg">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-20 text-center">
                        <Link
                            href="/partner/apply"
                            className="inline-block bg-gray-100 dark:bg-white/5 hover:bg-white/10 border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white px-10 py-4 rounded-xl font-bold transition-all shadow-lg"
                        >
                            {t('applyNow')}
                        </Link>
                    </div>
                </div>
            </section>
            <PublicFooter themeAware={true} /></div>
    );
}
