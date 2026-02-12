'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full bg-[#120a0a]/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-20 lg:px-40 py-4">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image src="/lokma_logo_wide.png" alt="LOKMA" width={140} height={36} className="object-contain" />
                    </Link>
                    <Link href="/" className="text-sm text-white/60 hover:text-white">← Ana Sayfa</Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">Hakkımızda</h1>

                    <div className="space-y-8 text-white/80 text-lg leading-relaxed">
                        <p>
                            <strong className="text-white">LOKMA</strong>, 2024 yılında Almanya&#39;da kurulan, yerel esnafı dijital dünya ile buluşturan yenilikçi bir platformdur.
                        </p>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">Misyonumuz</h2>
                            <p>
                                Geleneksel ticaretin gücünü modern teknoloji ile birleştirerek, adil ve şeffaf bir pazar yeri oluşturmak. Esnafımızın alın terinin karşılığını almasını sağlamak.
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">Vizyonumuz</h2>
                            <p>
                                Avrupa&#39;nın her köşesinde yerel esnafı destekleyen, topluluk odaklı, sürdürülebilir bir dijital ekosistem kurmak.
                            </p>
                        </div>

                        <h2 className="text-2xl font-bold text-white mt-12 mb-6">Değerlerimiz</h2>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-[#fb335b]/10 border border-[#fb335b]/20 rounded-xl p-6">
                                <h3 className="font-bold text-[#fb335b] mb-2">Adalet</h3>
                                <p className="text-sm">Sektörün en düşük komisyon oranları ile esnafın kazancını koruyoruz.</p>
                            </div>
                            <div className="bg-[#fb335b]/10 border border-[#fb335b]/20 rounded-xl p-6">
                                <h3 className="font-bold text-[#fb335b] mb-2">Şeffaflık</h3>
                                <p className="text-sm">Gizli ücret yok, karmaşık sözleşme yok. Her şey açık ve net.</p>
                            </div>
                            <div className="bg-[#fb335b]/10 border border-[#fb335b]/20 rounded-xl p-6">
                                <h3 className="font-bold text-[#fb335b] mb-2">Topluluk</h3>
                                <p className="text-sm">Mahalle kültürünü dijital dünyada yaşatıyoruz.</p>
                            </div>
                            <div className="bg-[#fb335b]/10 border border-[#fb335b]/20 rounded-xl p-6">
                                <h3 className="font-bold text-[#fb335b] mb-2">Yenilikçilik</h3>
                                <p className="text-sm">En son teknolojiler ile esnafımızın işini kolaylaştırıyoruz.</p>
                            </div>
                        </div>

                        <div className="mt-12 text-center">
                            <Link
                                href="/partner"
                                className="inline-block bg-[#fb335b] hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold transition-all"
                            >
                                Partnerimiz Olun
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
