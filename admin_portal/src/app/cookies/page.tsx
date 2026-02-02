'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function CookiesPage() {
    const [preferences, setPreferences] = useState({
        necessary: true,
        analytics: false,
        marketing: false,
    });

    const handleSave = () => {
        // Save to localStorage
        localStorage.setItem('lokma_cookies', JSON.stringify(preferences));
        alert('Çerez tercihleriniz kaydedildi!');
    };

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
                    <h1 className="text-4xl md:text-5xl font-black mb-8">Çerez Tercihleri</h1>

                    <p className="text-white/60 mb-8">
                        Bu sayfada web sitemizde kullanılan çerezleri yönetebilirsiniz. Zorunlu çerezler site işlevselliği için gereklidir ve devre dışı bırakılamaz.
                    </p>

                    <div className="space-y-6 mb-12">
                        {/* Necessary Cookies */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-lg">Zorunlu Çerezler</h3>
                                    <p className="text-sm text-white/60">Site işlevselliği için gerekli</p>
                                </div>
                                <div className="bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-xs font-bold">
                                    Her zaman aktif
                                </div>
                            </div>
                            <p className="text-sm text-white/50">
                                Oturum yönetimi, sepet işlemleri ve güvenlik için zorunludur.
                            </p>
                        </div>

                        {/* Analytics Cookies */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-lg">Analitik Çerezler</h3>
                                    <p className="text-sm text-white/60">Site kullanım istatistikleri</p>
                                </div>
                                <button
                                    onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                                    className={`w-12 h-6 rounded-full transition-all ${preferences.analytics ? 'bg-[#ec131e]' : 'bg-white/20'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all ${preferences.analytics ? 'ml-6' : 'ml-0.5'}`} />
                                </button>
                            </div>
                            <p className="text-sm text-white/50">
                                Google Analytics ve benzer araçlar ile site performansını ölçmemize yardımcı olur.
                            </p>
                        </div>

                        {/* Marketing Cookies */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-lg">Pazarlama Çerezleri</h3>
                                    <p className="text-sm text-white/60">Kişiselleştirilmiş reklamlar</p>
                                </div>
                                <button
                                    onClick={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                                    className={`w-12 h-6 rounded-full transition-all ${preferences.marketing ? 'bg-[#ec131e]' : 'bg-white/20'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all ${preferences.marketing ? 'ml-6' : 'ml-0.5'}`} />
                                </button>
                            </div>
                            <p className="text-sm text-white/50">
                                İlgi alanlarınıza göre reklam göstermek için kullanılır.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleSave}
                            className="bg-[#ec131e] hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold transition-all"
                        >
                            Tercihleri Kaydet
                        </button>
                        <button
                            onClick={() => {
                                setPreferences({ necessary: true, analytics: true, marketing: true });
                                localStorage.setItem('lokma_cookies', JSON.stringify({ necessary: true, analytics: true, marketing: true }));
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold transition-all"
                        >
                            Tümünü Kabul Et
                        </button>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
