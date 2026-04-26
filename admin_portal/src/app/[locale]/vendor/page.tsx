'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function VendorPage() {
  const tx = useTranslations('Vendor');

  const stats = [
    { value: tx('stat1'), label: tx('stat1Label') },
    { value: tx('stat2'), label: tx('stat2Label') },
    { value: tx('stat3'), label: tx('stat3Label') },
    { value: tx('stat4'), label: tx('stat4Label') },
  ];

  const steps = [
    { num: '01', title: tx('step1Title'), desc: tx('step1Desc'), icon: 'edit_note' },
    { num: '02', title: tx('step2Title'), desc: tx('step2Desc'), icon: 'build' },
    { num: '03', title: tx('step3Title'), desc: tx('step3Desc'), icon: 'rocket_launch' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-white text-black font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      <PublicHeader themeAware={false} />

      {/* Hero Section - Aydinlik ve Ferah (Karanlik Mod Kapatildi) */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#ea184a]/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 bg-[#ea184a]/10 text-[#ea184a] px-5 py-2 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#ea184a]/20">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Sadece Bir Yemek Uygulaması Değil
            </span>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-8 text-black">
              İşletmenizin Yeni<br />
              <span className="bg-gradient-to-r from-[#ea184a] to-[#ff6b6b] bg-clip-text text-transparent">İşletim Sistemi.</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
              LOKMA, sipariş almanın ötesine geçer. Masaüstü kasalardan dijital mutfak ekranlarına, mobil sipariş terminallerinden akıllı terazilere ve dijital fiyat etiketlerine (ESL) kadar tüm restoran donanımlarınızı tek bir bulut ekosisteminde birleştirir.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-[#ea184a]/20 transition-all hover:scale-105 active:scale-95">
                {tx('ctaApply')}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <Link href="#ecosystem" className="inline-flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-black hover:bg-gray-100 px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-sm hover:shadow-md">
                Donanım Ekosistemini Keşfet
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: T3 PRO (Desktop POS) - Tamamen Görsel Arkaplan */}
      <section id="ecosystem" className="relative w-full min-h-[90vh] flex items-center overflow-hidden bg-gray-100">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="https://file.cdn.sunmi.com/newebsite/products/t3-pro/lg/tvc-poster.mp4" type="video/mp4" />
        </video>
        {/* Beyaz, seffaf bir perde atarak videonun aydinlik kalmasini sagliyoruz. Simsiyah degil! */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 flex flex-col lg:flex-row items-center">
          <div className="w-full lg:w-1/2 lg:pr-16">
            <span className="text-[#ea184a] font-black tracking-widest uppercase text-sm mb-4 block">LOKMA MASAÜSTÜ KASALARI</span>
            <h2 className="text-5xl md:text-7xl font-black text-black mb-6 leading-tight">Tezgahın Yeni<br/>Hakimi.</h2>
            <p className="text-xl text-gray-700 mb-8 leading-relaxed font-medium">
              Çift ekranlı alüminyum gövdesiyle, siz siparişi mutfağa saniyeler içinde iletirken, müşteriniz kendi ekranından tüm detayları ve QR kodla ödemesini saniyeler içinde tamamlar. LOKMA altyapısıyla sıfır gecikme.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-black font-bold text-sm shadow-sm">15.6" Full HD Çift Ekran</span>
              <span className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-black font-bold text-sm shadow-sm">80mm Hızlı Yazıcı</span>
            </div>
          </div>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: FLEX 3 (Modular) - Aydinlik ve Genis */}
      <section className="relative w-full min-h-[90vh] flex items-center overflow-hidden bg-white">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/tvc-poster.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-l from-white/95 via-white/80 to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 flex justify-end items-center">
          <div className="max-w-xl text-right">
            <span className="text-blue-600 font-black tracking-widest uppercase text-sm mb-4 block">LOKMA MÜŞTERİ KİOSKLARI & KDS</span>
            <h2 className="text-6xl md:text-8xl font-black text-black mb-6 leading-none">Sınırsız<br/>Esneklik.</h2>
            <p className="text-xl text-gray-700 mb-8 leading-relaxed font-medium">
              Aynı cihaz mutfakta dev bir KDS (Mutfak Ekranı), kasada bir Self-Checkout kiosku, duvarda ise dijital bir menü panosu olabilir. LOKMA'nın "Tak ve Çalıştır" vizyonunun zirvesi.
            </p>
            <div className="flex flex-wrap gap-3 justify-end">
              <span className="px-5 py-2.5 bg-black text-white rounded-full font-bold text-sm shadow-xl">17mm İnce Profil</span>
              <span className="px-5 py-2.5 bg-black text-white rounded-full font-bold text-sm shadow-xl">IP54 Suya Dayanıklı</span>
            </div>
          </div>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: V3 Family (Mobile POS) - Temiz, Aydinlik Galeri */}
      <section className="relative w-full py-32 overflow-hidden bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <span className="text-emerald-500 font-bold tracking-widest uppercase text-sm mb-4 block">LOKMA MOBİL SİPARİŞ TERMİNALLERİ</span>
            <h2 className="text-5xl md:text-7xl font-black text-black mb-6">Masalara Hükmedin.</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-medium">
              Müşterinizi kasanın önünde bekletmeyin. Garsonlarınız masada siparişi alsın, anında mutfağa iletsin ve ödemeyi çekip fişi masada yazdırsın.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-[3rem] overflow-hidden bg-white border border-gray-200 shadow-2xl relative h-[500px]">
              <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                <source src="https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/tvc-poster.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-10">
                <h3 className="text-3xl font-bold text-white mb-2">Avuç İçi Performans</h3>
                <p className="text-white/90 font-medium">Zorlu ortamlar için 1.2 metreden düşmelere dayanıklı zırh.</p>
              </div>
            </div>
            
            <div className="rounded-[3rem] overflow-hidden bg-white border border-gray-200 shadow-2xl relative h-[500px]">
              <img src="https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/p7-2.jpg" alt="V3 Scanner" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent flex flex-col justify-end p-10">
                <h3 className="text-3xl font-bold text-black mb-2">Işık Hızında Barkod</h3>
                <p className="text-gray-800 font-bold">Karanlık gece kulüplerinde veya loş restoranlarda bile QR kodları milisaniyeler içinde okur.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: ESL (Electronic Shelf Labels) - Homojen ve Bembeyaz */}
      <section className="py-32 px-4 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px]" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 text-blue-600 font-black uppercase tracking-widest text-sm mb-6 bg-blue-50 px-4 py-2 rounded-full">
              <span className="material-symbols-outlined text-[18px]">price_change</span>
              LOKMA DİJİTAL ETİKET SİSTEMİ (ESL)
            </span>
            <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-8 text-black leading-tight">
              Kağıt İsrafına Son Verin.
            </h2>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed font-medium max-w-3xl mx-auto">
              Süpermarket, kasap veya fırın reyonlarınızdaki binlerce fiyatı tek tek kağıda basmaktan kurtulun. LOKMA ESL (Electronic Shelf Labels) ekosistemi sayesinde fiyatlarınız 5 yıla varan pil ömrüyle dijital raflara yansır.
            </p>
          </div>

          {/* Homojen Gorsel Grid (Ayni Sunmi ESL Iconunun Farki Boyutlarda Homojen Sergilenmesi) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            {[
              { size: '1.54"', desc: 'Kompakt Boyut', scale: 'scale-75' },
              { size: '2.10"', desc: 'Standart Raf', scale: 'scale-90' },
              { size: '2.60"', desc: 'Geniş Raf', scale: 'scale-100' },
              { size: '4.20"', desc: 'Meyve/Sebze', scale: 'scale-110' },
            ].map((tag, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-2xl transition-all duration-500">
                <div className="h-40 flex items-center justify-center mb-6">
                  <img 
                    src="https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png" 
                    alt={`LOKMA ESL ${tag.size}`} 
                    className={`w-full object-contain transition-transform duration-700 group-hover:-translate-y-2 ${tag.scale}`} 
                  />
                </div>
                <div className="text-2xl font-black text-black mb-1">{tag.size}</div>
                <div className="text-gray-500 font-medium">{tag.desc}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Link href="/hardware" className="inline-flex items-center justify-center gap-3 bg-black text-white px-10 py-5 rounded-2xl font-bold text-xl hover:scale-105 transition-transform shadow-2xl">
              Tüm Modelleri İncele
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* LOKMA Scale & Integration Ecosystem - Aydinlik */}
      <section className="py-32 px-4 bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-[#ea184a] font-bold tracking-widest uppercase text-sm mb-4 block">Akıllı Tartım Sistemleri</span>
          <h2 className="text-4xl md:text-6xl font-black mb-16 text-black">Tam Entegre Terazi Altyapısı.</h2>
          <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center gap-12 text-left hover:shadow-2xl transition-shadow duration-500">
            <div className="w-full md:w-1/2">
              <h3 className="text-3xl font-black mb-6 text-black">Milimetrik Hassasiyet. Saniyelik Aktarım.</h3>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Kasap veya şarküteri reyonunuzda tarttığınız ürünün gramajı, anında LOKMA POS sistemine ve elektronik etiketlere aktarılır. Stripe Pre-Auth altyapısı sayesinde müşteri uygulamada 1 KG seçer, siz 1.1 KG tarttığınızda sistem ödemeyi otomatik düzeltir.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-800 font-bold text-lg"><span className="material-symbols-outlined text-emerald-500 text-2xl">check_circle</span> Çift Ekranlı Sunmi S2 Desteği</li>
                <li className="flex items-center gap-3 text-gray-800 font-bold text-lg"><span className="material-symbols-outlined text-emerald-500 text-2xl">check_circle</span> Değişken Ağırlıklı (Variable Weight) Modu</li>
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <img src="https://file.cdn.sunmi.com/newebsite/products/s2/s2-8-en.jpg" alt="Smart Scale" className="w-full max-w-[450px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10 py-20 bg-[#ea184a] text-white">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-12">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-5xl md:text-6xl font-black mb-4">{s.value}</div>
              <div className="text-sm md:text-lg text-white/90 font-bold uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA - Bembeyaz ve Cok Ferah */}
      <section className="py-40 px-4 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#ea184a]/5 to-blue-500/5 rounded-[4rem] blur-3xl" />
          <div className="relative bg-white border border-gray-100 rounded-[4rem] p-16 md:p-24 text-center shadow-2xl">
            <h2 className="text-5xl md:text-7xl font-black mb-8 text-black leading-tight">Yolculuğa <br/>Hazır Mısınız?</h2>
            <p className="text-gray-600 text-xl md:text-2xl mb-12 max-w-3xl mx-auto font-medium">
              Restoranınızı, marketinizi veya kafenizi dijitalleştirin. Donanım, yazılım, teslimat ve kermes altyapısıyla LOKMA ailesine katılın.
            </p>
            <Link href="/partner/apply" className="inline-flex items-center justify-center gap-4 bg-[#ea184a] hover:bg-red-600 text-white px-14 py-6 rounded-full font-black text-2xl shadow-2xl shadow-[#ea184a]/30 transition-all hover:scale-105 active:scale-95">
              Hemen Başvurun
              <span className="material-symbols-outlined text-3xl">rocket_launch</span>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter themeAware={false} />
    </div>
  );
}
