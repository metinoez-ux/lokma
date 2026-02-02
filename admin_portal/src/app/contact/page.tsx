'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function ContactPage() {
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
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">İletişim</h1>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-4 block">location_on</span>
                            <h3 className="font-bold text-lg mb-2">Merkez Ofis</h3>
                            <p className="text-white/60">
                                LOKMA GmbH<br />
                                Musterstraße 123<br />
                                10115 Berlin<br />
                                Deutschland
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-4 block">schedule</span>
                            <h3 className="font-bold text-lg mb-2">Çalışma Saatleri</h3>
                            <p className="text-white/60">
                                Pazartesi - Cuma: 09:00 - 18:00<br />
                                Cumartesi: 10:00 - 14:00<br />
                                Pazar: Kapalı
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <a href="mailto:info@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#ec131e]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">mail</span>
                            <h4 className="font-bold mb-1">Genel Bilgi</h4>
                            <p className="text-sm text-white/60">info@lokma.shop</p>
                        </a>
                        <a href="mailto:destek@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#ec131e]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">support_agent</span>
                            <h4 className="font-bold mb-1">Müşteri Desteği</h4>
                            <p className="text-sm text-white/60">destek@lokma.shop</p>
                        </a>
                        <a href="mailto:partner@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#ec131e]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ec131e] text-3xl mb-3 block">handshake</span>
                            <h4 className="font-bold mb-1">İş Ortaklığı</h4>
                            <p className="text-sm text-white/60">partner@lokma.shop</p>
                        </a>
                    </div>

                    <div className="bg-gradient-to-br from-[#ec131e]/10 to-transparent border border-[#ec131e]/20 rounded-2xl p-8 text-center">
                        <h3 className="text-xl font-bold mb-4">Esnaf mısınız?</h3>
                        <p className="text-white/60 mb-6">LOKMA platformuna katılmak için hemen başvurun.</p>
                        <Link
                            href="/partner/apply"
                            className="inline-block bg-[#ec131e] hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-all"
                        >
                            Partner Başvurusu
                        </Link>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
