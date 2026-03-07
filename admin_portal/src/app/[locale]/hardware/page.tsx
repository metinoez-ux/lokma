'use client';

import Image from 'next/image';
import Link from 'next/link';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function HardwarePage() {
    return (
        <div className="relative flex min-h-screen flex-col bg-[#0a0a0f] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            {/* ═══════════════════════════════════════ */}
            {/* HERO SECTION                           */}
            {/* ═══════════════════════════════════════ */}
            <section className="relative min-h-[90vh] flex items-center justify-center pt-24 overflow-hidden">
                {/* Background image */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/images/hardware/ecosystem-hero.png"
                        alt="LOKMA Donanım Ekosistemi"
                        fill
                        className="object-cover opacity-40"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/80 via-transparent to-[#0a0a0f]/80" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto text-center px-4 py-20">
                    <span className="inline-flex items-center gap-2 bg-[#fb335b]/10 text-[#fb335b] px-5 py-2.5 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#fb335b]/30 backdrop-blur-sm">
                        <span className="material-symbols-outlined text-[18px]">devices</span>
                        LOKMA Hardware Ekosistemi
                    </span>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-8">
                        İşletmenin{' '}
                        <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">
                            Tüm Teknolojisi
                        </span>
                        <br />
                        Tek Platformda
                    </h1>

                    <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
                        Kasa sistemi, elektronik raf etiketleri, akıllı terazi ve mobil sipariş —
                        hepsi LOKMA ekosistemiyle entegre, hepsi tek panelden yönetiliyor.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/partner/apply"
                            className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95"
                        >
                            Ücretsiz Demo Talep Et
                            <span className="material-symbols-outlined animate-bounce">arrow_forward</span>
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all backdrop-blur-sm"
                        >
                            <span className="material-symbols-outlined">call</span>
                            Bizi Arayın
                        </Link>
                    </div>

                    {/* Stats bar */}
                    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                        {[
                            { value: '360°', label: 'Entegrasyon' },
                            { value: '<5sn', label: 'Fiyat Senkronizasyonu' },
                            { value: '99.9%', label: 'Uptime Garantisi' },
                            { value: '24/7', label: 'Teknik Destek' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                                <div className="text-2xl md:text-3xl font-black text-[#fb335b]">{stat.value}</div>
                                <div className="text-xs text-white/50 font-medium mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* UNIFIED PLATFORM ADVANTAGE              */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            Neden{' '}
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">
                                Tek Platform?
                            </span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
                            Geleneksel sistemlerde kasa, etiket ve online sipariş ayrı ayrı çalışır.
                            LOKMA ile hepsi tek bir ekosistemde birleşir — fiyat değişikliğinden stok takibine,
                            siparişten rapora her şey anında senkronize olur.
                        </p>
                    </div>

                    {/* Problem vs Solution */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                        {/* Problem */}
                        <div className="bg-gradient-to-br from-red-950/40 to-red-900/10 border border-red-500/20 rounded-3xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-red-400 text-2xl">warning</span>
                                </div>
                                <h3 className="text-2xl font-black text-red-400">Geleneksel Yaklaşım</h3>
                            </div>
                            <ul className="space-y-4 text-white/70">
                                {[
                                    'Kasa sistemi ayrı yazılım, ayrı lisans ücreti',
                                    'Fiyat etiketleri elle tek tek değiştirilmeli',
                                    'Online sipariş platformuyla senkronizasyon yok',
                                    'Stok bilgisi güncel değil, manuel güncelleme',
                                    'Her sistem için ayrı destek hattı',
                                    'Farklı sağlayıcılar arası uyumsuzluk',
                                    'İndirim kampanyası için 3 ayrı yerde güncelleme',
                                    'Veri analizi için manuel raporlama',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-red-400 text-lg mt-0.5 shrink-0">close</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Solution */}
                        <div className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 border border-emerald-500/20 rounded-3xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-emerald-400 text-2xl">check_circle</span>
                                </div>
                                <h3 className="text-2xl font-black text-emerald-400">LOKMA Ekosistemi</h3>
                            </div>
                            <ul className="space-y-4 text-white/70">
                                {[
                                    'Kasa, etiket, online — hepsi tek lisans, tek platform',
                                    'Fiyat değişince raf etiketi saniyeler içinde güncellenir',
                                    'Mobil uygulama ve web siparişleri anlık senkronize',
                                    'Gerçek zamanlı stok takibi tüm kanallarda',
                                    'Tek destek hattı, tek muhatap',
                                    'Donanımlar birbiriyle sorunsuz çalışır',
                                    'Bir tıkla tüm kanallarda kampanya aktif',
                                    'Otomatik raporlar ve gelir analitiği',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5 shrink-0">check</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Flow diagram */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-12">
                        <h3 className="text-2xl font-black text-center mb-10">
                            <span className="material-symbols-outlined text-[#fb335b] text-3xl align-middle mr-2">sync</span>
                            Fiyat Değişikliği = Otomatik Senkronizasyon
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            {[
                                { icon: 'edit', label: 'Admin Paneli', desc: 'Fiyat değiştir', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                                { icon: 'arrow_forward', label: '', desc: '', color: 'text-white/20', bg: '' },
                                { icon: 'point_of_sale', label: 'Kasa (POS)', desc: 'Otomatik güncellenir', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
                                { icon: 'label', label: 'Raf Etiketi (ESL)', desc: 'Saniyeler içinde yansır', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                                { icon: 'phone_android', label: 'Mobil Uygulama', desc: 'Anında aktif', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
                            ].map((step, i) => (
                                step.label === '' ? (
                                    <div key={i} className="hidden md:flex justify-center">
                                        <span className="material-symbols-outlined text-white/20 text-4xl">arrow_forward</span>
                                    </div>
                                ) : (
                                    <div key={i} className={`${step.bg} border rounded-2xl p-6 text-center transition-all hover:scale-105`}>
                                        <span className={`material-symbols-outlined ${step.color} text-4xl mb-3 block`}>{step.icon}</span>
                                        <div className="font-bold text-sm">{step.label}</div>
                                        <div className="text-xs text-white/50 mt-1">{step.desc}</div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* POS KASA SİSTEMİ                        */}
            {/* ═══════════════════════════════════════ */}
            <section id="pos" className="py-24 px-4 md:px-20 bg-gradient-to-b from-[#0a0a0f] via-[#0f0a15] to-[#0a0a0f] relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-amber-500/20">
                            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                            LOKMA Kasa Sistemi
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            Akıllı POS Kasa{' '}
                            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Terminalleri</span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto">
                            Restoranlar, kasaplar, marketler ve daha fazlası için özel olarak yapılandırılmış
                            profesyonel kasa donanımları. LOKMA yazılımı ile entegre, kutudan çıkar çıkmaz çalışır.
                        </p>
                    </div>

                    {/* Desktop POS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/sunmi_d3_pro_1.jpg"
                                    alt="LOKMA Desktop POS Terminal"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
                                <span className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-amber-400 text-2xl">desktop_windows</span>
                                </span>
                                Masaüstü POS Terminal
                            </h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                15.6 inç Full HD dokunmatik ekran, 10 inç müşteri ekranı, NFC ödeme desteği ve
                                modüler aluminyum gövde. Restoran, kafe ve marketler için ideal.
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                {[
                                    { icon: 'monitor', text: '15.6" FHD Dokunmatik Ana Ekran' },
                                    { icon: 'tablet', text: '10" Müşteri Ekranı (NFC)' },
                                    { icon: 'memory', text: '4GB RAM + 64GB Depolama' },
                                    { icon: 'fingerprint', text: 'Parmak İzi ile Giriş' },
                                    { icon: 'print', text: 'Entegre Fiş Yazıcı' },
                                    { icon: 'wifi', text: 'WiFi + Ethernet + Bluetooth' },
                                    { icon: 'contactless', text: 'NFC / SoftPOS Ödeme' },
                                    { icon: 'cable', text: 'Gizli Kablo Yönetimi' },
                                ].map((spec, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                                        <span className="material-symbols-outlined text-amber-400 text-xl">{spec.icon}</span>
                                        <span className="text-sm text-white/70">{spec.text}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                                <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">restaurant</span>
                                    LOKMA Entegrasyonu
                                </h4>
                                <p className="text-white/60 text-sm leading-relaxed">
                                    Siparişler, masa yönetimi, garson çağırma, indirim kampanyaları ve tüm
                                    ödeme yöntemleri LOKMA admin panelinden yönetilir. Online siparişler
                                    doğrudan kasaya düşer — ekstra cihaz veya yazılım gerekmez.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Handheld POS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
                        <div className="order-2 lg:order-1">
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
                                <span className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-purple-400 text-2xl">smartphone</span>
                                </span>
                                Mobil POS Terminal
                            </h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                Garsonlar için cep boyutunda, taşınabilir POS cihazı. Masa başında sipariş alma,
                                ödeme tahsilat ve fiş yazdırma — hepsi tek cihazda.
                            </p>

                            <div className="space-y-4 mb-8">
                                {[
                                    { title: 'Masa Başı Sipariş', desc: 'Garson doğrudan masada sipariş girer, anında mutfağa iletilir', icon: 'restaurant_menu' },
                                    { title: 'Temassız Ödeme', desc: 'Kart, NFC ve QR kod ile masa başında ödeme alın', icon: 'contactless' },
                                    { title: 'Fiş & Fatura', desc: 'Entegre termal yazıcı ile anında fiş çıktısı', icon: 'receipt_long' },
                                    { title: 'Vardiya Sistemi', desc: 'Garson giriş-çıkış ve performans takibi', icon: 'schedule' },
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-start gap-4 bg-white/[0.03] rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-colors">
                                        <span className="material-symbols-outlined text-purple-400 text-2xl mt-0.5 shrink-0">{feature.icon}</span>
                                        <div>
                                            <h4 className="font-bold text-sm">{feature.title}</h4>
                                            <p className="text-white/50 text-sm">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="order-1 lg:order-2 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/sunmi_d3_pro_3.jpg"
                                    alt="LOKMA Mobil POS Terminal"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Smart Scale */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/sunmi_s2_1.png"
                                    alt="LOKMA Akıllı Terazi"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
                                <span className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-teal-400 text-2xl">scale</span>
                                </span>
                                Akıllı Terazi
                            </h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                Kasap, şarküteri, manav ve taze gıda reyonları için dokunmatik ekranlı akıllı terazi.
                                Tartım, fiyatlandırma ve etiket basımı tek cihazda. LOKMA ile entegre çalışır.
                            </p>

                            <div className="grid grid-cols-1 gap-3 mb-8">
                                {[
                                    { title: 'Otomatik Fiyatlandırma', desc: 'Ürün seçildiğinde birim fiyat LOKMA\'dan otomatik çekilir', icon: 'price_change' },
                                    { title: 'Etiket Basımı', desc: 'Entegre yazıcı ile barkodlu etiket anında basılır', icon: 'label' },
                                    { title: 'Stok Entegrasyonu', desc: 'Tartılan her gram gerçek zamanlı stoktan düşülür', icon: 'inventory_2' },
                                    { title: 'Gramaj Doğrulama', desc: 'Online siparişlerde gramaj farkı otomatik hesaplanır', icon: 'straighten' },
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-start gap-4 bg-white/[0.03] rounded-xl p-4 border border-white/5 hover:border-teal-500/30 transition-colors">
                                        <span className="material-symbols-outlined text-teal-400 text-2xl mt-0.5 shrink-0">{feature.icon}</span>
                                        <div>
                                            <h4 className="font-bold text-sm">{feature.title}</h4>
                                            <p className="text-white/50 text-sm">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* ESL ELEKTRONİK RAF ETİKETLERİ           */}
            {/* ═══════════════════════════════════════ */}
            <section id="esl" className="py-24 px-4 md:px-20 bg-gradient-to-b from-[#0a0a0f] via-[#0a100f] to-[#0a0a0f] relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-emerald-500/20">
                            <span className="material-symbols-outlined text-[16px]">label</span>
                            Elektronik Raf Etiketi Sistemi
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            Dijital{' '}
                            <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Fiyat Etiketleri</span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto">
                            Kağıt etiketlerle vedalaşın. Elektronik raf etiketleri (ESL) ile fiyatlarınızı
                            saniyeler içinde tüm ürünlerde, tüm kanallarda güncelleyin.
                        </p>
                    </div>

                    {/* ESL Image + Features */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
                                <Image
                                    src="/images/hardware/minew_esl_shelf.jpg"
                                    alt="Elektronik Raf Etiketleri"
                                    width={600}
                                    height={500}
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-black mb-6">E-Ink Teknolojisi ile Dayanıklı Etiketler</h3>
                            <p className="text-white/60 text-lg mb-8 leading-relaxed">
                                Düşük enerji tüketen e-mürekkep (E-Ink) ekranlar sayesinde tek pil ile
                                5+ yıl kesintisiz çalışma. Güneş ışığında bile mükemmel okunabilirlik.
                            </p>

                            <div className="space-y-3">
                                {[
                                    { title: '1.54" Küçük Etiket', desc: 'Raf kenarı ürünler için kompakt çözüm', specs: '152×152 piksel • Siyah-Beyaz' },
                                    { title: '2.13" Standart Etiket', desc: 'En popüler boyut — market rafları için ideal', specs: '250×122 piksel • Siyah-Beyaz-Kırmızı' },
                                    { title: '2.9" Geniş Etiket', desc: 'Detaylı bilgi gösterimi, barkod desteği', specs: '296×128 piksel • 3 Renk' },
                                    { title: '4.2" Büyük Etiket', desc: 'Promosyon ve kampanya vurgusu için', specs: '400×300 piksel • Tam Renkli' },
                                    { title: '7.5" Jumbo Etiket', desc: 'Vitrin ve endcap gösterimi', specs: '800×480 piksel • Tam Renkli' },
                                ].map((size, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-emerald-500/30 transition-all group/item">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-sm">{size.title}</h4>
                                                <p className="text-white/50 text-xs mt-0.5">{size.desc}</p>
                                            </div>
                                            <span className="text-xs text-emerald-400/60 font-mono">{size.specs}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ESL Advantages Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: 'bolt',
                                title: 'Anında Fiyat Güncellemesi',
                                desc: 'LOKMA panelinden fiyat değiştirin, saniyeler içinde tüm raf etiketleri otomatik güncellenir. Kasa ve mobil uygulama da eş zamanlı yansır.',
                                color: 'text-yellow-400',
                                border: 'border-yellow-500/20',
                            },
                            {
                                icon: 'eco',
                                title: 'Çevre Dostu & Tasarruf',
                                desc: 'Kağıt etiket basımı tarih olsun. Yılda ortalama 5.000+ etiket tasarrufu — hem çevreye hem bütçeye katkı.',
                                color: 'text-emerald-400',
                                border: 'border-emerald-500/20',
                            },
                            {
                                icon: 'timer',
                                title: 'İş Gücü Tasarrufu',
                                desc: 'Etiket değiştirmek için saatlerce uğraşmayın. Tek tıkla binlerce ürünün fiyatını güncelleyin — personel değerli işlere odaklansın.',
                                color: 'text-blue-400',
                                border: 'border-blue-500/20',
                            },
                            {
                                icon: 'campaign',
                                title: 'Dinamik Kampanyalar',
                                desc: 'Happy Hour, gün sonu indirimi, haftalık kampanya — etiketler otomatik güncellenir, kampanya bitince eski fiyata döner.',
                                color: 'text-pink-400',
                                border: 'border-pink-500/20',
                            },
                            {
                                icon: 'gavel',
                                title: 'Yasal Uyumluluk',
                                desc: 'PAngV (Preisangabenverordnung) ve LMIV gereği doğru fiyat gösterimi garanti altında. Birim fiyat hesaplama otomatik.',
                                color: 'text-orange-400',
                                border: 'border-orange-500/20',
                            },
                            {
                                icon: 'battery_charging_full',
                                title: '5+ Yıl Pil Ömrü',
                                desc: 'E-Ink teknolojisi sayesinde ultra-düşük güç tüketimi. Pilin bitmesini beklemeden yıllar boyu kesintisiz kullanım.',
                                color: 'text-cyan-400',
                                border: 'border-cyan-500/20',
                            },
                        ].map((adv, i) => (
                            <div key={i} className={`bg-white/[0.03] border ${adv.border} rounded-2xl p-6 hover:scale-[1.02] transition-all duration-300`}>
                                <span className={`material-symbols-outlined ${adv.color} text-3xl mb-4 block`}>{adv.icon}</span>
                                <h4 className="font-bold text-lg mb-2">{adv.title}</h4>
                                <p className="text-white/50 text-sm leading-relaxed">{adv.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* TAM ENTEGRASYON DETAYLARI                */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 bg-gradient-to-b from-[#0a0a0f] via-[#100a0f] to-[#0a0a0f] relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            Bir Platformda{' '}
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">Her Şey</span>
                        </h2>
                        <p className="text-xl text-white/50 max-w-3xl mx-auto">
                            LOKMA ekosistemi ile işletmenizin tüm dijital ve fiziksel operasyonları
                            tek bir merkezden yönetilir.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                icon: 'shopping_cart',
                                title: 'Online Sipariş ↔ Kasa',
                                desc: 'Müşteri mobil uygulamadan ya da webden sipariş verdiğinde, sipariş doğrudan kasa ekranına düşer. Ekstra tablet veya yazılım gerekmez.',
                                gradient: 'from-blue-600/20 to-blue-800/5',
                            },
                            {
                                icon: 'inventory',
                                title: 'Stok ↔ Tüm Kanallar',
                                desc: 'Ürün satıldığında — ister kasadan, ister online — stok tüm kanallarda otomatik güncellenir. "Stokta Yok" durumu anında yansır.',
                                gradient: 'from-amber-600/20 to-amber-800/5',
                            },
                            {
                                icon: 'receipt_long',
                                title: 'TSE / Finanzamt Uyumlu',
                                desc: 'Alman mali mevzuatı gereği TSE (Kassensicherungstechnik) uyumlu altyapı. Dijital fiş, Z-Raporu ve GoBD muhasebe standartları entegre.',
                                gradient: 'from-red-600/20 to-red-800/5',
                            },
                            {
                                icon: 'table_restaurant',
                                title: 'Masa Yönetimi & QR Sipariş',
                                desc: 'Restoranlarda masalara QR kod ile sipariş. Müşteriler kendi telefonundan menüyü görür, sipariş verir — doğrudan kasa ve mutfağa yansır.',
                                gradient: 'from-violet-600/20 to-violet-800/5',
                            },
                            {
                                icon: 'local_shipping',
                                title: 'Kurye Yönetimi',
                                desc: 'Sipariş kabul edildiğinde en yakın uygun kuryeye otomatik atanır. Müşteri gerçek zamanlı konum takibi yapar.',
                                gradient: 'from-teal-600/20 to-teal-800/5',
                            },
                            {
                                icon: 'analytics',
                                title: 'Gelir & Performans Raporları',
                                desc: 'Tüm kanallardan gelen satış verileri tek panelde birleşir. Günlük, haftalık, aylık raporlar — ürün bazlı ve kanal bazlı analiz.',
                                gradient: 'from-emerald-600/20 to-emerald-800/5',
                            },
                            {
                                icon: 'payments',
                                title: 'Ödeme Entegrasyonu',
                                desc: 'Nakit, EC-Kart, Kreditkarte, Apple Pay, Google Pay, SEPA — tüm ödeme yöntemleri tek altyapıda. Stripe Connect ile otomatik uzlaşma.',
                                gradient: 'from-pink-600/20 to-pink-800/5',
                            },
                            {
                                icon: 'groups',
                                title: 'Personel & Vardiya',
                                desc: 'Garson, kasiyer ve kurye ekibini yönetin. Vardiya planlama, performans takibi ve yetkilendirme — tek panelden.',
                                gradient: 'from-indigo-600/20 to-indigo-800/5',
                            },
                        ].map((item, i) => (
                            <div key={i} className={`bg-gradient-to-br ${item.gradient} border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all`}>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-white/80 text-2xl">{item.icon}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                                        <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* SEKTÖRLERE GÖRE ÇÖZÜMLER                */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                            Her Sektöre{' '}
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">Özel Çözüm</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                emoji: '🍕',
                                title: 'Restoran & Pizzeria',
                                features: ['Masa başı sipariş alma', 'Mutfak ekranı entegrasyonu', 'QR menü & dine-in', 'Happy Hour otomasyonu'],
                            },
                            {
                                emoji: '🥩',
                                title: 'Kasap & Şarküteri',
                                features: ['Akıllı terazi entegrasyonu', 'Gramaj bazlı fiyatlandırma', 'Etiket basım sistemi', 'Soğuk zincir takibi'],
                            },
                            {
                                emoji: '🛒',
                                title: 'Market & Bakkal',
                                features: ['ESL elektronik etiketler', 'Barkod tarama', 'Stok yönetimi & uyarılar', 'Tedarik zinciri entegrasyonu'],
                            },
                            {
                                emoji: '🧁',
                                title: 'Pastane & Fırın',
                                features: ['Ürün vitrini yönetimi', 'Günlük üretim takibi', 'Özel sipariş modülü', 'Alerjen bilgisi gösterimi'],
                            },
                            {
                                emoji: '☕',
                                title: 'Kafe & Bistro',
                                features: ['Hızlı sipariş ekranı', 'Sadakat programı', 'Take-away optimizasyonu', 'Barista performans takibi'],
                            },
                            {
                                emoji: '🕌',
                                title: 'Kermes & Topluluk',
                                features: ['Etkinlik bazlı menü', 'Topluluk sipariş sistemi', 'Gönüllü vardiya planı', 'Bağış & satış raporları'],
                            },
                        ].map((sector, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#fb335b]/30 hover:scale-[1.02] transition-all duration-300">
                                <div className="text-4xl mb-4">{sector.emoji}</div>
                                <h4 className="font-bold text-xl mb-4">{sector.title}</h4>
                                <ul className="space-y-2">
                                    {sector.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-2 text-white/60 text-sm">
                                            <span className="material-symbols-outlined text-[#fb335b] text-sm">check</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════ */}
            {/* CTA SECTION                             */}
            {/* ═══════════════════════════════════════ */}
            <section className="py-24 px-4 md:px-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#fb335b]/10 via-[#ff6b35]/5 to-[#fb335b]/10" />
                <div className="absolute inset-0 bg-[url('/images/hardware/ecosystem-hero.png')] bg-cover bg-center opacity-5" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
                        İşletmenizi{' '}
                        <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b35] bg-clip-text text-transparent">
                            Dijitalleştirin
                        </span>
                    </h2>
                    <p className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
                        LOKMA donanım ekosistemi ile işletmenizi geleceğe taşıyın. POS kasa, elektronik etiket
                        ve akıllı terazi — hepsi tek platformda, hepsi tek lisansta.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                        <Link
                            href="/partner/apply"
                            className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-white px-12 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95"
                        >
                            Hemen Başvur
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white px-12 py-5 rounded-2xl font-bold text-xl transition-all"
                        >
                            <span className="material-symbols-outlined">mail</span>
                            İletişime Geçin
                        </Link>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 text-white/40 text-sm">
                        {['✓ Ücretsiz kurulum desteği', '✓ 30 gün deneme süresi', '✓ 7/24 teknik destek', '✓ Eğitim dahil'].map((item, i) => (
                            <span key={i}>{item}</span>
                        ))}
                    </div>
                </div>
            </section>

            <PublicFooter themeAware={true} />
        </div>
    );
}
