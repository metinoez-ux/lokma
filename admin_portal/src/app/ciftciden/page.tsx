'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function CiftcidenPage() {
    return (
        <div className="min-h-screen bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full bg-[#120a0a]/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-20 lg:px-40 py-4">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image src="/lokma_logo.png" alt="LOKMA" width={40} height={40} className="rounded-lg" />
                        <h2 className="text-2xl font-extrabold tracking-tighter uppercase">LOKMA</h2>
                    </Link>
                    <Link href="/" className="text-sm text-white/60 hover:text-white">← Ana Sayfa</Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[1000px] mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <span className="material-symbols-outlined text-[18px]">eco</span>
                            Yakında Geliyor
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6">
                            <span className="text-green-400">Tarladan</span> Sofraya
                        </h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
                            Aracısız, taze, uygun fiyat. Türk çiftçilerini destekle,
                            tarladan sofrana direkt ulaşan ürünlerle tanış.
                        </p>
                    </div>

                    {/* Problem Statement */}
                    <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-red-400">2026'da Çiftçilerin Durumu</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">
                            Türkiye'de çiftçiler, ürettikleri ürünlerin sadece <strong className="text-white">%20-30'unu</strong> alabiliyorlar.
                            Aracılar, komisyoncular ve toptancılar arasında kaybolurken, tüketiciler de pahalı fiyatlarla karşı karşıya kalıyor.
                        </p>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <div className="text-3xl font-black text-red-400 mb-2">%70</div>
                                <p className="text-sm text-white/60">Aracılara giden pay</p>
                            </div>
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <div className="text-3xl font-black text-red-400 mb-2">3-5x</div>
                                <p className="text-sm text-white/60">Fiyat artışı (tarladan markete)</p>
                            </div>
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <div className="text-3xl font-black text-red-400 mb-2">%40</div>
                                <p className="text-sm text-white/60">Ürün israfı oranı</p>
                            </div>
                        </div>
                    </div>

                    {/* Our Solution */}
                    <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-green-400">LOKMA Çözümü</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">
                            LOKMA olarak çiftçilerimizi aracısız bir şekilde tüketiciye bağlıyoruz.
                            Hem çiftçi adil kazanç elde ediyor, hem de tüketici taze ve uygun fiyatlı ürünlere ulaşıyor.
                        </p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-green-400">agriculture</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Doğrudan Satış</h3>
                                    <p className="text-sm text-white/60">Çiftçi ürününü direkt platforma yükler, aracı yok.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-green-400">local_shipping</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Soğuk Zincir Lojistik</h3>
                                    <p className="text-sm text-white/60">Taze ürünler, optimize edilmiş teslimat rotaları.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-green-400">payments</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Adil Fiyatlandırma</h3>
                                    <p className="text-sm text-white/60">Şeffaf komisyon, çiftçiye %80+ pay.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-green-400">verified</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Kalite Garantisi</h3>
                                    <p className="text-sm text-white/60">Her ürün kontrol edilir, memnuniyet garantisi.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Product Categories Coming */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 text-center">Yakında Gelecek Ürünler</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { name: 'Meyve', icon: '🍎' },
                                { name: 'Sebze', icon: '🥬' },
                                { name: 'Süt Ürünleri', icon: '🧀' },
                                { name: 'Yumurta', icon: '🥚' },
                                { name: 'Bal', icon: '🍯' },
                                { name: 'Zeytinyağı', icon: '🫒' },
                                { name: 'Baklagil', icon: '🫘' },
                                { name: 'Tahıl', icon: '🌾' },
                            ].map((item) => (
                                <div key={item.name} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <div className="text-3xl mb-2">{item.icon}</div>
                                    <p className="font-medium text-sm">{item.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* App Download CTA */}
                    <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/20 rounded-2xl p-8 mb-12 text-center">
                        <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <span className="material-symbols-outlined text-[18px]">smartphone</span>
                            Alışveriş Uygulamada
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">
                            Sipariş vermek için <span className="text-[#ec131e]">LOKMA</span> uygulamasını indir
                        </h2>
                        <p className="text-white/60 mb-8 max-w-xl mx-auto">
                            Tarladan sofraya taze ürünler, çiftçi pazarı ve özel kampanyalar uygulamamızda.
                            Hemen indir, siparişe başla!
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                <img
                                    src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                                    alt="App Store'dan İndir"
                                    className="h-12"
                                />
                            </a>
                            <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                <img
                                    src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                                    alt="Google Play'den İndir"
                                    className="h-12"
                                />
                            </a>
                        </div>
                    </div>

                    {/* CTA for Farmers */}
                    <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">Çiftçi misiniz?</h2>
                        <p className="text-white/90 mb-6 max-w-xl mx-auto">
                            LOKMA platformuna katılmak için şimdiden başvurun.
                            Lansman öncesi kaydolan çiftçilere özel avantajlar!
                        </p>
                        <Link
                            href="/partner/apply"
                            className="inline-block bg-white text-green-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all"
                        >
                            Erken Kayıt Yap
                        </Link>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
