'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function PressPage() {
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
                    <h1 className="text-4xl md:text-5xl font-black mb-8">Basın</h1>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12">
                        <h2 className="text-xl font-bold mb-4">Basın İletişim</h2>
                        <p className="text-white/60 mb-6">
                            Medya sorularınız, röportaj talepleri ve basın bültenleri için bizimle iletişime geçin.
                        </p>
                        <a
                            href="mailto:presse@lokma.shop"
                            className="inline-flex items-center gap-2 bg-[#fb335b] hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                        >
                            <span className="material-symbols-outlined">mail</span>
                            presse@lokma.shop
                        </a>
                    </div>

                    <h2 className="text-2xl font-bold mb-6">Basın Kiti</h2>
                    <div className="grid md:grid-cols-2 gap-6 mb-12">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <span className="material-symbols-outlined text-[#fb335b] text-3xl mb-4 block">image</span>
                            <h3 className="font-bold mb-2">Logo & Marka Kılavuzu</h3>
                            <p className="text-sm text-white/60 mb-4">LOKMA logoları ve marka kullanım kılavuzu</p>
                            <button className="text-[#fb335b] font-bold text-sm">İndir (Coming Soon)</button>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <span className="material-symbols-outlined text-[#fb335b] text-3xl mb-4 block">description</span>
                            <h3 className="font-bold mb-2">Şirket Bilgileri</h3>
                            <p className="text-sm text-white/60 mb-4">Şirket profili ve istatistikler</p>
                            <button className="text-[#fb335b] font-bold text-sm">İndir (Coming Soon)</button>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-6">Hakkımızda</h2>
                    <div className="text-white/70 space-y-4">
                        <p>
                            <strong className="text-white">LOKMA</strong>, 2024 yılında Almanya&#39;da kurulan, yerel esnaf ve tüketicileri bir araya getiren dijital bir pazar yeridir.
                        </p>
                        <p>
                            Platform, kasap, market, restoran, çiçekçi ve daha birçok kategoride yüzlerce yerel işletmeyi barındırmaktadır.
                        </p>
                        <p>
                            Misyonumuz, geleneksel ticaretin gücünü modern teknoloji ile birleştirerek adil ve şeffaf bir pazar yeri oluşturmaktır.
                        </p>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
