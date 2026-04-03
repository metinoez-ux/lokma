'use client';

import Link from 'next/link';
import Image from 'next/image';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

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
 <div className="min-h-screen bg-background dark:bg-[#0f172a] text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
 <PublicHeader themeAware={true} />

 <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
 <div className="max-w-[1200px] mx-auto">
 <h1 className="text-4xl md:text-5xl font-black mb-4">Kategoriler</h1>
 <p className="text-muted-foreground/80 /60 text-lg mb-12">Tum kategorileri kesfedin</p>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {categories.map((cat) => (
 <Link
 key={cat.name}
 href={cat.href}
 className="bg-muted/30 dark:bg-background/5 border border-border/50 rounded-2xl p-6 hover:border-[#ea184a]/50 hover:bg-muted dark:hover:bg-background/10 transition-all group"
 >
 <div className="text-4xl mb-4">{cat.icon}</div>
 <h3 className="text-xl font-bold mb-2 group-hover:text-[#ea184a] transition-colors">{cat.name}</h3>
 <p className="text-sm text-muted-foreground/80 /60 mb-4">{cat.desc}</p>
 <div className="flex items-center justify-between">
 <span className="text-xs text-gray-400 /40">{cat.count} isletme</span>
 <span className="material-symbols-outlined text-gray-400 /40 group-hover:text-[#ea184a] transition-colors">arrow_forward</span>
 </div>
 </Link>
 ))}
 </div>
 </div>
 </main>

 <PublicFooter themeAware={true} />
 <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
 <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
 </div>
 );
}
