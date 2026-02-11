'use client';

import Link from 'next/link';
import Image from 'next/image';

const steps = [
    {
        number: '01',
        title: 'Uygulamayı İndir',
        description: 'App Store veya Google Play\'den LOKMA uygulamasını ücretsiz indirin.',
        icon: 'download',
    },
    {
        number: '02',
        title: 'Konumunuzu Seçin',
        description: 'Konum izni verin veya adresinizi manuel olarak girin. Size en yakın işletmeleri bulalım.',
        icon: 'location_on',
    },
    {
        number: '03',
        title: 'Kategorileri Keşfedin',
        description: 'Market, kasap, restoran, çiçekçi ve daha fazla kategoriden dilediğinizi seçin.',
        icon: 'category',
    },
    {
        number: '04',
        title: 'Ürünleri Sepete Ekleyin',
        description: 'İstediğiniz ürünleri seçin, miktarları belirleyin ve sepetinize ekleyin.',
        icon: 'shopping_cart',
    },
    {
        number: '05',
        title: 'Güvenli Ödeme',
        description: 'Kredi kartı, PayPal veya kapıda ödeme seçeneklerinden birini tercih edin.',
        icon: 'payment',
    },
    {
        number: '06',
        title: 'Teslimatı Bekleyin',
        description: 'Siparişinizi canlı takip edin. Kapınıza kadar teslimat yapılır.',
        icon: 'local_shipping',
    },
];

export default function HowItWorksPage() {
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
                        <h1 className="text-4xl md:text-5xl font-black mb-6">Nasıl Çalışır?</h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            LOKMA ile sipariş vermek çok kolay. 6 basit adımda yerel esnaftan alışveriş yapın.
                        </p>
                    </div>

                    <div className="space-y-8">
                        {steps.map((step, index) => (
                            <div
                                key={step.number}
                                className={`flex flex-col md:flex-row items-start gap-8 p-8 rounded-2xl ${index % 2 === 0 ? 'bg-white/5' : 'bg-[#fb335b]/5'
                                    } border border-white/10`}
                            >
                                <div className="flex-shrink-0">
                                    <div className="w-16 h-16 bg-[#fb335b] rounded-2xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-3xl">{step.icon}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[#fb335b] font-bold text-sm mb-2">{step.number}</div>
                                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-white/60 text-lg">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 text-center">
                        <h3 className="text-2xl font-bold mb-6">Hemen Başlayın!</h3>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="https://apps.apple.com/app/lokma"
                                className="flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all"
                            >
                                <span className="text-2xl"></span>
                                App Store
                            </a>
                            <a
                                href="https://play.google.com/store/apps/details?id=com.lokma.app"
                                className="flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all"
                            >
                                <span className="text-2xl">▶️</span>
                                Google Play
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
