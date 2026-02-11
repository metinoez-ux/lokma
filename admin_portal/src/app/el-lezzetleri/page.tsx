'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function ElLezzetleriPage() {
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
                        <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <span className="material-symbols-outlined text-[18px]">restaurant</span>
                            Yöresel Tatlar
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6">
                            <span className="text-orange-400">El Lezzetleri</span>
                        </h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
                            Annelerimizin, ninelerimizin elinden çıkan yöresel tatlar.
                            Ev yapımı, doğal, katkısız ve her biri bir hikâye.
                        </p>
                    </div>

                    {/* What is El Lezzetleri */}
                    <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-orange-400">El Lezzetleri Nedir?</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">
                            Her yörenin kendine has bir lezzeti var. Karadeniz'in hamsi tuzlaması, Hatay'ın künefesi,
                            Gaziantep'in baklavası, Ege'nin tulum peyniri... Bu tatları evlerinde özenle hazırlayan
                            <strong className="text-white"> yerel üreticileri</strong> sizinle buluşturuyoruz.
                        </p>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <div className="text-3xl mb-2">🏡</div>
                                <h3 className="font-bold mb-1">Ev Yapımı</h3>
                                <p className="text-sm text-white/60">Fabrika değil, ev mutfağından</p>
                            </div>
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <div className="text-3xl mb-2">🌿</div>
                                <h3 className="font-bold mb-1">Doğal</h3>
                                <p className="text-sm text-white/60">Katkısız, koruyucusuz</p>
                            </div>
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <div className="text-3xl mb-2">⭐</div>
                                <h3 className="font-bold mb-1">Puanlı</h3>
                                <p className="text-sm text-white/60">Güvenilir üretici sistemi</p>
                            </div>
                        </div>
                    </div>

                    {/* Trust System */}
                    <div className="bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-2xl p-8 mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-yellow-400">Güven Sistemi</h2>
                        <p className="text-white/70 mb-6 leading-relaxed">
                            El Lezzetleri'nde güven ve kalite her şeyin başında gelir. Her üretici,
                            müşteri puanlarıyla değerlendirilir ve yalnızca kaliteyi ispatlayan üreticiler platformda kalabilir.
                        </p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-yellow-400">verified_user</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Kimlik Doğrulama</h3>
                                    <p className="text-sm text-white/60">Her üretici kimlik ve hijyen belgesi ile kayıt olur.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-yellow-400">star</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">5 Yıldız Puanlama</h3>
                                    <p className="text-sm text-white/60">Her sipariş sonrası müşteri değerlendirmesi.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-yellow-400">photo_camera</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Fotoğraf Zorunluluğu</h3>
                                    <p className="text-sm text-white/60">Gerçek ürün fotoğrafları, stok görsel yok.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-yellow-400">support_agent</span>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-1">Memnuniyet Garantisi</h3>
                                    <p className="text-sm text-white/60">Beğenmezseniz iade veya yeniden gönderim.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Turkish Regional Products by City */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-center">Türkiye'nin Yöresel Hazineleri</h2>
                        <p className="text-white/60 text-center mb-8 max-w-2xl mx-auto">
                            Uzun raf ömürlü, el yapımı, kuşaktan kuşağa aktarılan geleneksel tatlar
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { city: 'Gaziantep', products: ['Antep Baklavası', 'Antep Fıstığı', 'Biber Salçası'], icon: '🥜' },
                                { city: 'Çorum', products: ['Leblebi', 'Kızılcık Pestili'], icon: '🫘' },
                                { city: 'Gemlik', products: ['Gemlik Zeytini', 'Natürel Zeytinyağı'], icon: '🫒' },
                                { city: 'Kastamonu', products: ['Kastamonu Sarımsağı', 'Cide Balı'], icon: '🧄' },
                                { city: 'Malatya', products: ['Kuru Kayısı', 'Kayısı Pestili'], icon: '🍑' },
                                { city: 'Aydın', products: ['Kuru İncir', 'İncir Reçeli'], icon: '🍇' },
                                { city: 'Kars', products: ['Kars Kaşarı', 'Kars Gravyeri', 'Küflü Peynir'], icon: '🧀' },
                                { city: 'Trabzon', products: ['Fındık', 'Fındık Ezmesi', 'Kuymak Unu'], icon: '🌰' },
                                { city: 'Van', products: ['Van Otlu Peyniri', 'Van Balı'], icon: '🧈' },
                                { city: 'Afyon', products: ['Afyon Kaymağı', 'Afyon Sucuğu', 'Haşhaş'], icon: '🥛' },
                                { city: 'Ezine', products: ['Ezine Peyniri', 'Keçi Peyniri'], icon: '🐐' },
                                { city: 'Safranbolu', products: ['Lokum', 'Safran'], icon: '🍬' },
                                { city: 'Antakya', products: ['Künefe', 'Zahter', 'Defne Sabunu'], icon: '🌿' },
                                { city: 'Rize', products: ['Siyah Çay', 'Organik Yeşil Çay'], icon: '🍵' },
                                { city: 'Anadolu', products: ['Tarhana', 'Erişte', 'Bulgur'], icon: '🌾' },
                            ].map((item) => (
                                <div key={item.city} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="text-2xl">{item.icon}</div>
                                        <h3 className="font-bold text-orange-400">{item.city}</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {item.products.map((product) => (
                                            <span key={product} className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/70">
                                                {product}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Product Categories */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 text-center">Ürün Kategorileri</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { name: 'Peynirler', icon: '🧀', examples: 'Kaşar, Tulum, Küflü, Otlu' },
                                { name: 'Kurutulmuş', icon: '🍇', examples: 'İncir, Kayısı, Üzüm' },
                                { name: 'Salçalar', icon: '🍅', examples: 'Biber, Domates, Nar Ekşisi' },
                                { name: 'Bal & Pekmez', icon: '🍯', examples: 'Çam, Çiçek, Üzüm Pekmezi' },
                                { name: 'Zeytinyağı', icon: '🫒', examples: 'Natürel, Riviera, Erken Hasat' },
                                { name: 'Baharatlar', icon: '🌶️', examples: 'Pul Biber, Sumak, Zahter' },
                                { name: 'Tatlılar', icon: '🍬', examples: 'Lokum, Pestil, Cevizli Sucuk' },
                                { name: 'Hamur İşi', icon: '🥖', examples: 'Tarhana, Erişte, Mantı' },
                            ].map((item) => (
                                <div key={item.name} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer">
                                    <div className="text-3xl mb-2">{item.icon}</div>
                                    <h3 className="font-bold text-sm mb-1">{item.name}</h3>
                                    <p className="text-xs text-white/50">{item.examples}</p>
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
                            Sipariş vermek için <span className="text-[#fb335b]">LOKMA</span> uygulamasını indir
                        </h2>
                        <p className="text-white/60 mb-8 max-w-xl mx-auto">
                            Tüm yöresel ürünler, taze lezzetler ve özel kampanyalar uygulamamızda.
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

                    {/* CTA for Producers */}
                    <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">Ev yapımı lezzetler mi üretiyorsunuz?</h2>
                        <p className="text-white/90 mb-6 max-w-xl mx-auto">
                            Annenizin, anneannenizin tariflerini binlerce kişiye ulaştırın.
                            LOKMA El Lezzetleri'ne katılın, emeğinizi değerlendirin.
                        </p>
                        <Link
                            href="/partner/apply"
                            className="inline-block bg-white text-orange-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all"
                        >
                            Üretici Başvurusu Yap
                        </Link>
                    </div>
                </div>
            </main>

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
}
