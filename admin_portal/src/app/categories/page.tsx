'use client';

import Link from 'next/link';
import Image from 'next/image';

const categories = [
    { name: 'Market', desc: 'Taze meyve, sebze ve günlük ihtiyaçlarınız', href: '/categories/market', icon: '🛒', count: 45 },
    { name: 'Kasap', desc: 'Helal ve taze et ürünleri', href: '/categories/butcher', icon: '🥩', count: 32 },
    { name: 'Restoran', desc: 'Ev yemekleri ve leziz tatlar', href: '/categories/restaurant', icon: '🍽️', count: 78 },
    { name: 'Fast Food', desc: 'Döner, lahmacun ve sokak lezzetleri', href: '/categories/fastfood', icon: '🌯', count: 56 },
    { name: 'Çiçekçi', desc: 'Taze çiçek ve buket aranjmanları', href: '/categories/florist', icon: '💐', count: 18 },
    { name: 'Catering', desc: 'Düğün, nişan ve özel günler için', href: '/categories/catering', icon: '🍱', count: 24 },
    { name: 'Fırın & Pastane', desc: 'Taze ekmek, börek ve tatlılar', href: '/categories/bakery', icon: '🥐', count: 41 },
    { name: 'Kermes', desc: 'Mahalle kermesleri ve dayanışma', href: '/kermes', icon: '🎪', count: 12 },
    { name: 'Manav', desc: 'Organik sebze ve meyve', href: '/categories/greengrocer', icon: '🥬', count: 29 },
    { name: 'Kuruyemişçi', desc: 'Kuruyemiş ve bakliyat', href: '/categories/nuts', icon: '🥜', count: 15 },
    { name: 'Şarküteri', desc: 'Peynir, zeytin ve kahvaltılıklar', href: '/categories/deli', icon: '🧀', count: 22 },
    { name: 'İçecek', desc: 'Meşrubat ve içecek çeşitleri', href: '/categories/beverages', icon: '🥤', count: 19 },
];

export default function CategoriesPage() {
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
                <div className="max-w-[1200px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-4">Kategoriler</h1>
                    <p className="text-white/60 text-lg mb-12">Tüm kategorileri keşfedin</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {categories.map((cat) => (
                            <Link
                                key={cat.name}
                                href={cat.href}
                                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#fb335b]/50 hover:bg-white/10 transition-all group"
                            >
                                <div className="text-4xl mb-4">{cat.icon}</div>
                                <h3 className="text-xl font-bold mb-2 group-hover:text-[#fb335b] transition-colors">{cat.name}</h3>
                                <p className="text-sm text-white/60 mb-4">{cat.desc}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-white/40">{cat.count} işletme</span>
                                    <span className="material-symbols-outlined text-white/40 group-hover:text-[#fb335b] transition-colors">arrow_forward</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
