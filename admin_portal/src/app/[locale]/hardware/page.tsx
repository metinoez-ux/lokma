'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';
import { hwTexts } from './translations';

export default function HardwarePage() {
    const locale = useLocale();
    const tx = (hwTexts[locale] || hwTexts['en'] || hwTexts['de']) as Record<string, unknown>;
    const t = (key: string) => (tx[key] as string) || key;
    const tArr = (key: string) => (tx[key] as string[]) || [];
    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            {/* ═══════════════════════════════════════ */}
            {/* HERO SECTION                           */}
            {/* ═══════════════════════════════════════ */}
            <section className="relative min-h-[90vh] flex items-center justify-center pt-24 overflow-hidden">
                {/* Background image */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/images/hardware/ecosystem-hero.png"
                        alt="LOKMA Donanım Ekosistemi"
                        fill
                        className="object-cover opacity-40"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/80 via-transparent to-[#0a0a0f]/80" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto text-center px-4 py-20">
                    <span className="inline-flex items-center gap-2 bg-[#fb335b]/10 text-[#fb335b] px-5 py-2.5 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#fb335b]/30 backdrop-blur-sm">
                        <span className="material-symbols-outlined text-[18px]">devices</span>
                        {t('ecosystemTag')}
                    </span>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-8">
                        {t('heroTitle1')}{' '}
                        <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">
                            {t('heroTitle2')}
                        </span>
                        <br />
                        {t('heroTitle3')}
                    </h1>

                    <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
                        {t('heroSub')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/partner/apply"
                            className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95"
                        >
                            {t('ctaDemo')}
                            <span className="material-symbols-outlined animate-bounce">arrow_forward</span>
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all backdrop-blur-sm"
                        >
                            <span className="material-symbols-outlined">call</span>
                            {t('ctaCall')}
                        </Link>
                    </div>

                    {/* Stats bar */}
                    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                        {[
                            { value: t('stat1'), label: t('stat1Label') },
                            { value: t('stat2'), label: t('stat2Label') },
                            { value: t('stat3'), label: t('stat3Label') },
                            { value: t('stat4'), label: t('stat4Label') },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                                <div className="text-2xl md:text-3xl font-black text-[#fb335b]">{stat.value}</div>
                                <div className="text-xs text-white/50 font-medium mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* UNIFIED PLATFORM ADVANTAGE              */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            {t('whyTitle1')}{' '}
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">
                                {t('whyTitle2')}
                            </span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
                            {t('whySub')}
                        </p>
                    </div>

                    {/* Problem vs Solution */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                        {/* Problem */}
                        <div className="bg-gradient-to-br from-red-950/40 to-red-900/10 border border-red-500/20 rounded-3xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-red-400 text-2xl">warning</span>
                                </div>
                                <h3 className="text-2xl font-black text-red-400">{t('oldTitle')}</h3>
                            </div>
                            <ul className="space-y-4 text-white/70">
                                {[
                                    t('old1'),
                                    t('old2'),
                                    t('old3'),
                                    t('old4'),
                                    t('old5'),
                                    t('old6'),
                                    t('old7'),
                                    t('old8'),
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-red-400 text-lg mt-0.5 shrink-0">close</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Solution */}
                        <div className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 border border-emerald-500/20 rounded-3xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-emerald-400 text-2xl">check_circle</span>
                                </div>
                                <h3 className="text-2xl font-black text-emerald-400">{t('newTitle')}</h3>
                            </div>
                            <ul className="space-y-4 text-white/70">
                                {[
                                    t('new1'),
                                    t('new2'),
                                    t('new3'),
                                    t('new4'),
                                    t('new5'),
                                    t('new6'),
                                    t('new7'),
                                    t('new8'),
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5 shrink-0">check</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Flow diagram */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-12">
                        <h3 className="text-2xl font-black text-center mb-10">
                            <span className="material-symbols-outlined text-[#fb335b] text-3xl align-middle mr-2">sync</span>
                            {t('syncTitle')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            {[
                                { icon: 'edit', label: t('syncAdmin'), desc: t('syncAdminDesc'), color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                                { icon: 'arrow_forward', label: '', desc: '', color: 'text-white/20', bg: '' },
                                { icon: 'point_of_sale', label: t('syncPOS'), desc: t('syncPOSDesc'), color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
                                { icon: 'label', label: t('syncESL'), desc: t('syncESLDesc'), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                                { icon: 'phone_android', label: t('syncApp'), desc: t('syncAppDesc'), color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
                            ].map((step, i) => (
                                step.label === '' ? (
                                    <div key={i} className="hidden md:flex justify-center">
                                        <span className="material-symbols-outlined text-white/20 text-4xl">arrow_forward</span>
                                    </div>
                                ) : (
                                    <div key={i} className={`${step.bg} border rounded-2xl p-6 text-center transition-all hover:scale-105`}>
                                        <span className={`material-symbols-outlined ${step.color} text-4xl mb-3 block`}>{step.icon}</span>
                                        <div className="font-bold text-sm">{step.label}</div>
                                        <div className="text-xs text-white/50 mt-1">{step.desc}</div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            </section >

            {/* ═══════════════════════════════════════ */}
            {/* POS KASA SİSTEMİ                        */}
            {/* ═══════════════════════════════════════ */}
            <section id="pos" className="py-24 px-4 md:px-20 bg-gradient-to-b from-[#0a0a0f] via-[#0f0a15] to-[#0a0a0f] relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-amber-500/20">
                            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                            {t('posTag')}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            {t('posTitle1')}{' '}
                            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">{t('posTitle2')}</span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto">
                            {t('posSub')}
                        </p>
                    </div>

                    {/* Desktop POS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/sunmi_d3_pro_1.jpg"
                                    alt="LOKMA Desktop POS Terminal"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
                                <span className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-amber-400 text-2xl">desktop_windows</span>
                                </span>
                                {t('desktopTitle')}
                            </h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                {t('desktopDesc')}
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                {[
                                    { icon: 'monitor', text: t('spec1') },
                                    { icon: 'tablet', text: t('spec2') },
                                    { icon: 'memory', text: t('spec3') },
                                    { icon: 'fingerprint', text: t('spec4') },
                                    { icon: 'print', text: t('spec5') },
                                    { icon: 'wifi', text: t('spec6') },
                                    { icon: 'contactless', text: t('spec7') },
                                    { icon: 'cable', text: t('spec8') },
                                ].map((spec, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                                        <span className="material-symbols-outlined text-amber-400 text-xl">{spec.icon}</span>
                                        <span className="text-sm text-white/70">{spec.text}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                                <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">restaurant</span>
                                    {t('integrationTitle')}
                                </h4>
                                <p className="text-white/60 text-sm leading-relaxed">
                                    {t('integrationDesc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Handheld POS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
                        <div className="order-2 lg:order-1">
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
                                <span className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-purple-400 text-2xl">smartphone</span>
                                </span>
                                {t('mobileTitle')}
                            </h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                {t('mobileDesc')}
                            </p>

                            <div className="space-y-4 mb-8">
                                {[
                                    { title: t('mobileF1'), desc: t('mobileF1Desc'), icon: 'restaurant_menu' },
                                    { title: t('mobileF2'), desc: t('mobileF2Desc'), icon: 'contactless' },
                                    { title: t('mobileF3'), desc: t('mobileF3Desc'), icon: 'receipt_long' },
                                    { title: t('mobileF4'), desc: t('mobileF4Desc'), icon: 'schedule' },
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-start gap-4 bg-white/[0.03] rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-colors">
                                        <span className="material-symbols-outlined text-purple-400 text-2xl mt-0.5 shrink-0">{feature.icon}</span>
                                        <div>
                                            <h4 className="font-bold text-sm">{feature.title}</h4>
                                            <p className="text-white/50 text-sm">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="order-1 lg:order-2 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/sunmi_d3_pro_3.jpg"
                                    alt="LOKMA Mobil POS Terminal"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Smart Scale */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/sunmi_s2_1.png"
                                    alt="LOKMA Akıllı Terazi"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
                                <span className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-teal-400 text-2xl">scale</span>
                                </span>
                                {t('scaleTitle')}
                            </h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                {t('scaleDesc')}
                            </p>

                            <div className="grid grid-cols-1 gap-3 mb-8">
                                {[
                                    { title: t('scaleF1'), desc: t('scaleF1Desc'), icon: 'price_change' },
                                    { title: t('scaleF2'), desc: t('scaleF2Desc'), icon: 'label' },
                                    { title: t('scaleF3'), desc: t('scaleF3Desc'), icon: 'inventory_2' },
                                    { title: t('scaleF4'), desc: t('scaleF4Desc'), icon: 'straighten' },
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-start gap-4 bg-white/[0.03] rounded-xl p-4 border border-white/5 hover:border-teal-500/30 transition-colors">
                                        <span className="material-symbols-outlined text-teal-400 text-2xl mt-0.5 shrink-0">{feature.icon}</span>
                                        <div>
                                            <h4 className="font-bold text-sm">{feature.title}</h4>
                                            <p className="text-white/50 text-sm">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* ESL ELEKTRONİK RAF ETİKETLERİ           */}
            {/* ═══════════════════════════════════════ */}
            <section id="esl" className="py-24 px-4 md:px-20 bg-gradient-to-b from-[#0a0a0f] via-[#0a100f] to-[#0a0a0f] relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-emerald-500/20">
                            <span className="material-symbols-outlined text-[16px]">label</span>
                            {t('eslTag')}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            {t('eslTitle1')}{' '}
                            <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">{t('eslTitle2')}</span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto">
                            {t('eslSub')}
                        </p>
                    </div>

                    {/* ESL Image + Features */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/esl_manav_hero.png"
                                    alt="Elektronik Raf Etiketleri"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-black mb-6">{t('eslTechTitle')}</h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                {t('eslTechDesc')}
                            </p>

                            <div className="space-y-3">
                                {[
                                    { title: t('eslSize1'), desc: t('eslSize1Desc'), specs: t('eslSize1Spec') },
                                    { title: t('eslSize2'), desc: t('eslSize2Desc'), specs: t('eslSize2Spec') },
                                    { title: t('eslSize3'), desc: t('eslSize3Desc'), specs: t('eslSize3Spec') },
                                    { title: t('eslSize4'), desc: t('eslSize4Desc'), specs: t('eslSize4Spec') },
                                    { title: t('eslSize5'), desc: t('eslSize5Desc'), specs: t('eslSize5Spec') },
                                ].map((size, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-emerald-500/30 transition-all group/item">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-sm">{size.title}</h4>
                                                <p className="text-white/50 text-xs mt-0.5">{size.desc}</p>
                                            </div>
                                            <span className="text-xs text-emerald-400/60 font-mono">{size.specs}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ESL Advantages Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: 'bolt',
                                title: t('eslAdv1'),
                                desc: t('eslAdv1Desc'),
                                color: 'text-yellow-400',
                                border: 'border-yellow-500/20',
                            },
                            {
                                icon: 'eco',
                                title: t('eslAdv2'),
                                desc: t('eslAdv2Desc'),
                                color: 'text-emerald-400',
                                border: 'border-emerald-500/20',
                            },
                            {
                                icon: 'timer',
                                title: t('eslAdv3'),
                                desc: t('eslAdv3Desc'),
                                color: 'text-blue-400',
                                border: 'border-blue-500/20',
                            },
                            {
                                icon: 'campaign',
                                title: t('eslAdv4'),
                                desc: t('eslAdv4Desc'),
                                color: 'text-pink-400',
                                border: 'border-pink-500/20',
                            },
                            {
                                icon: 'gavel',
                                title: t('eslAdv5'),
                                desc: t('eslAdv5Desc'),
                                color: 'text-orange-400',
                                border: 'border-orange-500/20',
                            },
                            {
                                icon: 'battery_charging_full',
                                title: t('eslAdv6'),
                                desc: t('eslAdv6Desc'),
                                color: 'text-cyan-400',
                                border: 'border-cyan-500/20',
                            },
                        ].map((adv, i) => (
                            <div key={i} className={`bg-white/[0.03] border ${adv.border} rounded-2xl p-6 hover:scale-[1.02] transition-all duration-300`}>
                                <span className={`material-symbols-outlined ${adv.color} text-3xl mb-4 block`}>{adv.icon}</span>
                                <h4 className="font-bold text-lg mb-2">{adv.title}</h4>
                                <p className="text-white/50 text-sm leading-relaxed">{adv.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* TAM ENTEGRASYON DETAYLARI                */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 bg-gradient-to-b from-[#0a0a0f] via-[#100a0f] to-[#0a0a0f] relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            {t('fullIntTitle1')}{' '}
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">{t('fullIntTitle2')}</span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto">
                            {t('fullIntSub')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                icon: 'shopping_cart',
                                title: t('int1'),
                                desc: t('int1Desc'),
                                gradient: 'from-blue-600/20 to-blue-800/5',
                            },
                            {
                                icon: 'inventory',
                                title: t('int2'),
                                desc: t('int2Desc'),
                                gradient: 'from-amber-600/20 to-amber-800/5',
                            },
                            {
                                icon: 'receipt_long',
                                title: t('int3'),
                                desc: t('int3Desc'),
                                gradient: 'from-red-600/20 to-red-800/5',
                            },
                            {
                                icon: 'table_restaurant',
                                title: t('int4'),
                                desc: t('int4Desc'),
                                gradient: 'from-violet-600/20 to-violet-800/5',
                            },
                            {
                                icon: 'local_shipping',
                                title: t('int5'),
                                desc: t('int5Desc'),
                                gradient: 'from-teal-600/20 to-teal-800/5',
                            },
                            {
                                icon: 'analytics',
                                title: t('int6'),
                                desc: t('int6Desc'),
                                gradient: 'from-emerald-600/20 to-emerald-800/5',
                            },
                            {
                                icon: 'payments',
                                title: t('int7'),
                                desc: t('int7Desc'),
                                gradient: 'from-pink-600/20 to-pink-800/5',
                            },
                            {
                                icon: 'groups',
                                title: t('int8'),
                                desc: t('int8Desc'),
                                gradient: 'from-indigo-600/20 to-indigo-800/5',
                            },
                        ].map((item, i) => (
                            <div key={i} className={`bg-gradient-to-br ${item.gradient} border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all`}>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-white/80 text-2xl">{item.icon}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                                        <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* SEKTÖRLERE GÖRE ÇÖZÜMLER                */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                            {t('sectorTitle1')}{' '}
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">{t('sectorTitle2')}</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                emoji: '🍕',
                                title: t('sector1'),
                                features: tArr('sector1F'),
                            },
                            {
                                emoji: '🥩',
                                title: t('sector2'),
                                features: tArr('sector2F'),
                            },
                            {
                                emoji: '🛒',
                                title: t('sector3'),
                                features: tArr('sector3F'),
                            },
                            {
                                emoji: '🧁',
                                title: t('sector4'),
                                features: tArr('sector4F'),
                            },
                            {
                                emoji: '☕',
                                title: t('sector5'),
                                features: tArr('sector5F'),
                            },
                            {
                                emoji: '🕌',
                                title: t('sector6'),
                                features: tArr('sector6F'),
                            },
                        ].map((sector, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#fb335b]/30 hover:scale-[1.02] transition-all duration-300">
                                <div className="text-4xl mb-4">{sector.emoji}</div>
                                <h4 className="font-bold text-xl mb-4">{sector.title}</h4>
                                <ul className="space-y-2">
                                    {sector.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-2 text-white/60 text-sm">
                                            <span className="material-symbols-outlined text-[#fb335b] text-sm">check</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* ═══════════════════════════════════════ */}
            {/* CTA SECTION                             */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#fb335b]/10 via-[#ff6b35]/5 to-[#fb335b]/10" />
                <div className="absolute inset-0 bg-[url('/images/hardware/ecosystem-hero.png')] bg-cover bg-center opacity-5" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
                        {t('ctaTitle1')}{' '}
                        <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">
                            {t('ctaTitle2')}
                        </span>
                    </h2>
                    <p className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
                        {t('ctaSub')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                        <Link
                            href="/partner/apply"
                            className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-white px-12 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95"
                        >
                            {t('ctaApply')}
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white px-12 py-5 rounded-2xl font-bold text-xl transition-all"
                        >
                            <span className="material-symbols-outlined">mail</span>
                            {t('ctaContact')}
                        </Link>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 text-white/40 text-sm">
                        {[t('ctaF1'), t('ctaF2'), t('ctaF3'), t('ctaF4')].map((item, i) => (
                            <span key={i}>{item}</span>
                        ))}
                    </div>
                </div>
            </section>

            <PublicFooter themeAware={true} />
        </div >
    );
}
