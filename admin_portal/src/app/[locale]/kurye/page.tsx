'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function KuryePage() {
    const t = useTranslations('Kurye');

    const benefits = [
        { icon: 'schedule', title: t('benefitFlexTitle'), desc: t('benefitFlexDesc') },
        { icon: 'account_balance_wallet', title: t('benefitEarnTitle'), desc: t('benefitEarnDesc') },
        { icon: 'support_agent', title: t('benefitSupportTitle'), desc: t('benefitSupportDesc') },
    ];

    const requirements = [
        t('req1'),
        t('req2'),
        t('req3'),
        t('req4'),
        t('req5'),
    ];

    const steps = [
        { num: '1', title: t('step1Title'), desc: t('step1Desc') },
        { num: '2', title: t('step2Title'), desc: t('step2Desc') },
        { num: '3', title: t('step3Title'), desc: t('step3Desc') },
        { num: '4', title: t('step4Title'), desc: t('step4Desc') },
    ];

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] pt-24 overflow-x-hidden">
            <PublicHeader themeAware={true} />
            {/* Header handled by root layout, just spacing needed */}

            {/* Hero Section */}
            <section className="relative py-20 px-4 md:px-20 lg:px-40 overflow-hidden min-h-[60vh] flex items-center justify-center">
                <div className="absolute inset-0 z-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-[#120a0a] dark:via-transparent dark:to-[#120a0a] z-10"></div>
                    <div className="w-full h-full bg-emerald-500/20 blur-[100px] transform scale-150 rounded-full"></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-emerald-500/30">
                        <span className="material-symbols-outlined text-[18px]">electric_moped</span>
                        {t('lokmaRider')}
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight mb-6 drop-shadow-2xl">
                        {t('title')}
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 dark:text-white/70 max-w-3xl mx-auto mb-12 font-medium">
                        {t('subtitle')}
                    </p>
                    <a
                        href="mailto:partner@lokma.shop"
                        className="inline-flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-gray-900 dark:text-white px-12 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
                    >
                        {t('applyNow')} <span className="material-symbols-outlined animate-bounce">arrow_downward</span>
                    </a>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-24 px-4 md:px-20 lg:px-40 bg-gray-50 dark:bg-white/[0.02] border-y border-gray-200 dark:border-white/5 relative">
                <div className="max-w-[1200px] mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-black mb-16 tracking-tight">{t('benefitsTitle')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {benefits.map((b, i) => (
                            <div key={i} className="bg-white dark:bg-[#120a0a] p-10 rounded-[2.5rem] border border-gray-200 dark:border-white/10 hover:border-emerald-500/50 transition-colors text-left flex flex-col group hover:-translate-y-2 duration-300 shadow-2xl shadow-black">
                                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-4xl">{b.icon}</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-4">{b.title}</h3>
                                <p className="text-gray-500 dark:text-white/60 text-lg leading-relaxed">{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Requirements & Steps */}
            <section className="py-24 px-4 md:px-20 lg:px-40 bg-white dark:bg-[#120a0a]">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">

                    {/* Requirements */}
                    <div className="bg-gray-50 dark:bg-white/[0.02] p-8 md:p-12 rounded-[3rem] border border-gray-200 dark:border-white/5">
                        <div className="flex items-center gap-5 mb-10">
                            <div className="w-14 h-14 bg-blue-500/10 text-blue-400 flex items-center justify-center rounded-2xl">
                                <span className="material-symbols-outlined text-3xl">verified_user</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">{t('reqTitle')}</h2>
                        </div>
                        <ul className="space-y-4">
                            {requirements.map((req, i) => (
                                <li key={i} className="flex items-start gap-4 bg-gray-100 dark:bg-black/40 p-5 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-blue-500/30 transition-colors">
                                    <span className="material-symbols-outlined text-blue-400 shrink-0">check_circle</span>
                                    <span className="text-gray-700 dark:text-white/80 font-medium text-lg leading-relaxed">{req}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Steps */}
                    <div className="p-4 md:p-8">
                        <div className="flex items-center gap-5 mb-12">
                            <div className="w-14 h-14 bg-[#fb335b]/10 text-[#fb335b] flex items-center justify-center rounded-2xl">
                                <span className="material-symbols-outlined text-3xl">route</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">{t('stepsTitle')}</h2>
                        </div>
                        <div className="space-y-10 relative before:absolute before:inset-0 before:ml-7 before:-translate-x-px before:w-1 before:bg-white/10 before:z-0">
                            {steps.map((step, i) => (
                                <div key={i} className="relative z-10 flex items-start gap-8 group">
                                    <div className="w-14 h-14 shrink-0 bg-white dark:bg-[#120a0a] border-4 border-gray-200 dark:border-white/10 group-hover:border-[#fb335b] transition-colors rounded-full flex items-center justify-center font-black text-2xl text-gray-900 dark:text-white group-hover:text-[#fb335b]">
                                        {step.num}
                                    </div>
                                    <div className="pt-2">
                                        <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                                        <p className="text-gray-500 dark:text-white/60 text-lg leading-relaxed">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
            <PublicFooter themeAware={true} /></div>
    );
}
