'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const faqs = [
    {
        category: 'Genel',
        items: [
            { q: 'LOKMA nedir?', a: 'LOKMA, yerel esnaf ve müşterileri bir araya getiren dijital bir pazar yeridir. Kasaplar, marketler, çiçekçiler ve daha fazlası tek platformda.' },
            { q: 'LOKMA hangi ülkelerde aktif?', a: 'Şu anda Almanya, Avusturya ve İsviçre\'de aktif olarak hizmet veriyoruz. Yakında diğer Avrupa ülkelerinde de açılacağız.' },
            { q: 'Uygulama ücretsiz mi?', a: 'Evet, LOKMA uygulamasını indirmek ve kullanmak tamamen ücretsizdir.' },
        ]
    },
    {
        category: 'Sipariş',
        items: [
            { q: 'Nasıl sipariş verebilirim?', a: 'Uygulamayı indirin, konumunuzu seçin ve size en yakın işletmeleri keşfedin. Ürünleri sepetinize ekleyin ve güvenli ödeme ile siparişinizi tamamlayın.' },
            { q: 'Teslimat ücreti ne kadar?', a: 'Teslimat ücreti bölgeye ve işletmeye göre değişir. Sipariş öncesi teslimat ücreti açıkça gösterilir.' },
            { q: 'Siparişimi iptal edebilir miyim?', a: 'İşletme siparişinizi onaylamadan önce iptal edebilirsiniz. Onaylandıktan sonra iptal için işletme ile iletişime geçmeniz gerekir.' },
            { q: 'Ödeme yöntemleri nelerdir?', a: 'Kredi/banka kartı, PayPal ve kapıda ödeme seçenekleri mevcuttur. Ödeme yöntemleri işletmeye göre değişebilir.' },
        ]
    },
    {
        category: 'Esnaf Ortaklığı',
        items: [
            { q: 'Esnaf olarak nasıl katılabilirim?', a: '"Partnerimiz Olun" butonuna tıklayarak başvuru formunu doldurun. Ekibimiz 24 saat içinde sizinle iletişime geçecektir.' },
            { q: 'Komisyon oranları nedir?', a: 'LOKMA, sektörün en düşük komisyon oranlarını sunar. Detaylı bilgi için iletişime geçin.' },
            { q: 'Ödemeler ne zaman yapılır?', a: 'Ödemeler haftalık olarak banka hesabınıza aktarılır. Anlık ödeme seçeneği de mevcuttur.' },
        ]
    },
];

export default function SupportPage() {
    const [openFaq, setOpenFaq] = useState<string | null>(null);

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
                    <h1 className="text-4xl md:text-5xl font-black mb-4">Destek Merkezi</h1>
                    <p className="text-white/60 text-lg mb-12">Size nasıl yardımcı olabiliriz?</p>

                    {/* Contact Cards */}
                    <div className="grid md:grid-cols-3 gap-6 mb-16">
                        <a href="mailto:destek@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#fb335b] text-4xl mb-4 block">mail</span>
                            <h3 className="font-bold mb-2">E-posta</h3>
                            <p className="text-sm text-white/60">destek@lokma.shop</p>
                        </a>
                        <a href="tel:+4917612345678" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#fb335b] text-4xl mb-4 block">phone</span>
                            <h3 className="font-bold mb-2">Telefon</h3>
                            <p className="text-sm text-white/60">+49 176 123 456 78</p>
                        </a>
                        <a href="https://wa.me/4917612345678" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#fb335b] text-4xl mb-4 block">chat</span>
                            <h3 className="font-bold mb-2">WhatsApp</h3>
                            <p className="text-sm text-white/60">Hızlı destek</p>
                        </a>
                    </div>

                    {/* FAQ */}
                    <h2 className="text-2xl font-bold mb-8">Sıkça Sorulan Sorular</h2>

                    {faqs.map((section) => (
                        <div key={section.category} className="mb-8">
                            <h3 className="text-lg font-bold text-[#fb335b] mb-4">{section.category}</h3>
                            <div className="space-y-3">
                                {section.items.map((faq, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between p-5 text-left"
                                            onClick={() => setOpenFaq(openFaq === `${section.category}-${idx}` ? null : `${section.category}-${idx}`)}
                                        >
                                            <span className="font-medium">{faq.q}</span>
                                            <span className={`material-symbols-outlined transition-transform ${openFaq === `${section.category}-${idx}` ? 'rotate-180' : ''}`}>
                                                expand_more
                                            </span>
                                        </button>
                                        {openFaq === `${section.category}-${idx}` && (
                                            <div className="px-5 pb-5 text-white/70">
                                                {faq.a}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
