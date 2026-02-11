'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function PartnerPage() {
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
                    <div className="text-center mb-16">
                        <span className="inline-block bg-[#fb335b]/20 text-[#fb335b] px-4 py-1 rounded-full text-sm font-bold mb-4 tracking-wider uppercase">Esnaf Ortaklığı</span>
                        <h1 className="text-4xl md:text-6xl font-black mb-6">LOKMA Partneri Olun</h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            Binlerce müşteriye ulaşın, satışlarınızı artırın. Adil komisyon, hızlı ödeme, kolay yönetim.
                        </p>
                    </div>

                    {/* Benefits */}
                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                            <div className="w-16 h-16 bg-[#fb335b]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-[#fb335b] text-3xl">payments</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3">En Düşük Komisyon</h3>
                            <p className="text-white/60">Sektörün en düşük komisyon oranları ile kazancınızı koruyun.</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                            <div className="w-16 h-16 bg-[#fb335b]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-[#fb335b] text-3xl">bolt</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3">Hızlı Ödeme</h3>
                            <p className="text-white/60">Haftalık düzenli ödemeler veya anlık ödeme seçeneği.</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                            <div className="w-16 h-16 bg-[#fb335b]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-[#fb335b] text-3xl">trending_up</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3">Dijital Büyüme</h3>
                            <p className="text-white/60">Bölgenizdeki binlerce müşteriye dijital reklam ile ulaşın.</p>
                        </div>
                    </div>

                    {/* How It Works */}
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 md:p-12 mb-16">
                        <h2 className="text-2xl font-bold mb-8 text-center">Nasıl Çalışır?</h2>
                        <div className="grid md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-[#fb335b] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
                                <h4 className="font-bold mb-2">Başvuru</h4>
                                <p className="text-sm text-white/60">Formu doldurun</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-[#fb335b] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
                                <h4 className="font-bold mb-2">Onay</h4>
                                <p className="text-sm text-white/60">24 saat içinde geri dönüş</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-[#fb335b] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
                                <h4 className="font-bold mb-2">Kurulum</h4>
                                <p className="text-sm text-white/60">Ürünlerinizi ekleyin</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-[#fb335b] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">4</div>
                                <h4 className="font-bold mb-2">Satış</h4>
                                <p className="text-sm text-white/60">Sipariş almaya başlayın!</p>
                            </div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="text-center">
                        <Link
                            href="/partner/apply"
                            className="inline-block bg-[#fb335b] hover:bg-red-600 text-white px-12 py-5 rounded-xl font-bold text-xl transition-all shadow-xl shadow-[#fb335b]/20"
                        >
                            Şimdi Başvuru Yap
                        </Link>
                        <p className="text-white/40 text-sm mt-4">Ücretsiz başvuru • 24 saat içinde geri dönüş</p>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
