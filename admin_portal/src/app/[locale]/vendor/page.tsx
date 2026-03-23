'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

// Translations inline for vendor page (not yet in messages files)
export default function VendorPage() {
    const tx = useTranslations('Vendor');

    const advantages = [
        { icon: 'hub', title: tx('why1Title'), desc: tx('why1Desc') },
        { icon: 'handshake', title: tx('why2Title'), desc: tx('why2Desc') },
        { icon: 'sync', title: tx('why3Title'), desc: tx('why3Desc') },
        { icon: 'local_shipping', title: tx('why4Title'), desc: tx('why4Desc') },
        { icon: 'support_agent', title: tx('why5Title'), desc: tx('why5Desc') },
        { icon: 'analytics', title: tx('why6Title'), desc: tx('why6Desc') },
    ];

    const stats = [
        { value: tx('stat1'), label: tx('stat1Label') },
        { value: tx('stat2'), label: tx('stat2Label') },
        { value: tx('stat3'), label: tx('stat3Label') },
        { value: tx('stat4'), label: tx('stat4Label') },
    ];

    const steps = [
        { num: '01', title: tx('step1Title'), desc: tx('step1Desc'), icon: 'edit_note' },
        { num: '02', title: tx('step2Title'), desc: tx('step2Desc'), icon: 'build' },
        { num: '03', title: tx('step3Title'), desc: tx('step3Desc'), icon: 'rocket_launch' },
    ];

    return (
        <div className="relative flex min-h-screen flex-col bg-white text-gray-900 font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={false} />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#ea184a]/5 rounded-full blur-[120px]" />
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
                    <div className="text-center">
                        <span className="inline-flex items-center gap-2 bg-[#ea184a]/10 text-[#ea184a] px-5 py-2 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#ea184a]/20">
                            <span className="material-symbols-outlined text-[18px]">storefront</span>
                            {tx('heroTag')}
                        </span>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-8">
                            {tx('heroTitle')}<br />
                            <span className="bg-gradient-to-r from-[#ea184a] to-[#ff6b6b] bg-clip-text text-transparent">{tx('heroHighlight')}</span>
                        </h1>

                        <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto mb-12 leading-relaxed">
                            {tx('heroSub')}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                            <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-[#ea184a]/25 transition-all hover:scale-105 active:scale-95">
                                {tx('ctaApply')}
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </Link>
                            <Link href="#features" className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900 px-10 py-4 rounded-2xl font-bold text-lg transition-all">
                                {tx('ctaLearnMore')}
                                <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            </Link>
                            <Link href="/vendor/pricing" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border-2 border-[#ea184a]/30 text-[#ea184a] px-10 py-4 rounded-2xl font-bold text-lg transition-all hover:border-[#ea184a]">
                                <span className="material-symbols-outlined text-[18px]">payments</span>
                                {tx('pricingLink')}
                            </Link>
                        </div>
                        <p className="text-gray-400 text-sm font-medium mb-4">{tx('ctaSub')}</p>
                        <Link href="/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-[#ea184a] text-sm font-medium transition-colors">
                            <span className="material-symbols-outlined text-[16px]">login</span>
                            {tx('loginLink')}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="relative z-10 py-8 border-y border-gray-100 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl md:text-4xl font-black text-[#ea184a]">{s.value}</div>
                            <div className="text-sm text-gray-500 font-medium mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Why LOKMA */}
            <section id="features" className="py-24 px-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{tx('whyTitle')}</h2>
                        <p className="text-gray-500 text-lg">{tx('whySub')}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {advantages.map((a, i) => (
                            <div key={i} className="group bg-gray-50 border border-gray-200 hover:border-[#ea184a]/30 p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1">
                                <div className="w-14 h-14 bg-[#ea184a]/10 text-[#ea184a] rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">{a.icon}</span>
                                </div>
                                <h3 className="text-xl font-bold mb-3">{a.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{a.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* POS System */}
            <section className="py-24 px-4 md:px-8 bg-gradient-to-b from-transparent via-gray-50 to-transparent">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="inline-flex items-center gap-2 text-[#ea184a] text-sm font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                                POS System
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{tx('posTitle')}</h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">{tx('posSub')}</p>
                            <ul className="space-y-4 mb-10">
                                {[tx('posF1'), tx('posF2'), tx('posF3'), tx('posF4')].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                        <span className="w-6 h-6 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/hardware" className="inline-flex items-center gap-2 text-[#ea184a] font-bold hover:underline">
                                {tx('posLink')} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#ea184a]/5 to-purple-500/5 rounded-3xl blur-xl" />
                            <div className="relative bg-gray-50 border border-gray-200 rounded-3xl p-8 overflow-hidden">
                                <Image src="/images/hardware/sunmi_d3_pro_1.jpg" alt="POS Terminal" width={500} height={400} className="rounded-2xl w-full h-auto object-cover" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ESL System */}
            <section className="py-24 px-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-3xl blur-xl" />
                            <div className="relative bg-gray-50 border border-gray-200 rounded-3xl p-8 overflow-hidden">
                                <Image src="/images/hardware/esl_market_fruits.jpg" alt="ESL Digital Labels" width={500} height={400} className="rounded-2xl w-full h-auto object-cover" />
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <span className="inline-flex items-center gap-2 text-blue-600 text-sm font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-[18px]">price_change</span>
                                ESL Technology
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{tx('eslTitle')}</h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">{tx('eslSub')}</p>
                            <ul className="space-y-4 mb-10">
                                {[tx('eslF1'), tx('eslF2'), tx('eslF3'), tx('eslF4')].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                        <span className="w-6 h-6 bg-blue-500/20 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/hardware" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline">
                                {tx('eslLink')} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Delivery & Logistics */}
            <section className="py-24 px-4 md:px-8 bg-gradient-to-b from-transparent via-gray-50 to-transparent">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="inline-flex items-center gap-2 text-emerald-600 text-sm font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                Delivery
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{tx('deliveryTitle')}</h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">{tx('deliverySub')}</p>
                            <ul className="space-y-4 mb-10">
                                {[tx('deliveryF1'), tx('deliveryF2'), tx('deliveryF3'), tx('deliveryF4')].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                        <span className="w-6 h-6 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/kurye" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline">
                                {tx('deliveryLink')} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-3xl blur-xl" />
                            <div className="relative bg-gray-50 border border-gray-200 rounded-3xl p-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">gps_fixed</span>
                                        <p className="text-sm text-gray-500">{tx('deliveryF1')}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">route</span>
                                        <p className="text-sm text-gray-500">{tx('deliveryF2')}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">schedule</span>
                                        <p className="text-sm text-gray-500">{tx('deliveryF3')}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">photo_camera</span>
                                        <p className="text-sm text-gray-500">{tx('deliveryF4')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Steps */}
            <section className="py-24 px-4 md:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{tx('stepsTitle')}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((step, i) => (
                            <div key={i} className="relative group text-center">
                                {i < steps.length - 1 && (
                                    <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-gray-200 to-transparent z-0" />
                                )}
                                <div className="relative z-10">
                                    <div className="w-24 h-24 mx-auto mb-6 bg-[#ea184a]/10 border-2 border-[#ea184a]/20 group-hover:border-[#ea184a] rounded-2xl flex items-center justify-center transition-all duration-300">
                                        <span className="material-symbols-outlined text-4xl text-[#ea184a]">{step.icon}</span>
                                    </div>
                                    <div className="text-[#ea184a] font-black text-sm mb-3 tracking-widest">{step.num}</div>
                                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-gray-500">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-24 px-4 md:px-8">
                <div className="max-w-4xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ea184a]/10 to-purple-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-gradient-to-br from-[#ea184a]/5 to-purple-500/5 border border-gray-200 rounded-3xl p-12 md:p-16 text-center">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">{tx('bottomCta')}</h2>
                        <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">{tx('bottomCtaSub')}</p>
                        <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-red-600 text-white px-12 py-5 rounded-2xl font-bold text-xl shadow-2xl shadow-[#ea184a]/25 transition-all hover:scale-105 active:scale-95">
                            {tx('bottomCtaBtn')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </section>

            <PublicFooter themeAware={false} />
        </div>
    );
}
