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

  return (
    <div className="relative flex min-h-screen flex-col bg-white text-gray-900 font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      <PublicHeader themeAware={false} />

      {/* Modern SaaS Hero Section */}
      <section className="relative pt-40 pb-24 md:pt-52 md:pb-32 overflow-hidden bg-white">
        {/* Soft Mesh Gradient Background */}
        <div className="absolute top-0 inset-x-0 h-[800px] w-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-rose-100 to-rose-50 blur-[100px] opacity-70" />
          <div className="absolute top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-blue-100 to-blue-50 blur-[100px] opacity-70" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 text-center">
          <span className="inline-flex items-center gap-2 bg-rose-50 text-[#ea184a] px-4 py-2 rounded-full text-sm font-bold mb-8 uppercase tracking-widest border border-rose-100">
            <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
            Yeni Nesil Restoran İşletim Sistemi
          </span>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black leading-[1.1] tracking-tight mb-8 text-gray-900">
            Sadece Sipariş Değil,<br />
            <span className="bg-gradient-to-r from-[#ea184a] to-rose-500 bg-clip-text text-transparent">Tüm Ekosistem.</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Masaüstü kasalardan dijital mutfak ekranlarına, mobil terminallerden akıllı terazilere kadar tüm restoran donanımlarınızı tek bir bulut platformunda yönetin.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-gray-900/20 transition-transform hover:-translate-y-1">
              {tx('ctaApply')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <Link href="#ecosystem" className="inline-flex items-center justify-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-xl font-bold text-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
              Donanımları Keşfet
              <span className="material-symbols-outlined">devices</span>
            </Link>
          </div>
        </div>
      </section>

      {/* T3 PRO - Desktop POS (SaaS Split Layout) */}
      <section id="ecosystem" className="py-24 md:py-32 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
            <div className="w-full lg:w-1/2">
              <div className="inline-flex items-center gap-2 text-blue-600 font-bold uppercase tracking-widest text-sm mb-6">
                <span className="w-8 h-px bg-blue-600"></span>
                Masaüstü Kasalar
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 leading-tight">Tezgahın Yeni <br/>Hakimi.</h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Çift ekranlı alüminyum gövdesiyle, siz siparişi mutfağa anında iletirken, müşteriniz kendi ekranından tüm detayları ve QR kodla ödemesini saniyeler içinde tamamlar.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <span className="material-symbols-outlined">monitor</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">15.6" Çift Ekran</h4>
                    <p className="text-gray-500 text-sm">Hem kasiyer hem müşteri için devasa Full HD deneyimi.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">Dahili 80mm Yazıcı</h4>
                    <p className="text-gray-500 text-sm">Saniyede 250mm hızında, otomatik kesicili termal baskı.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full transform scale-90" />
              <img 
                src="https://file.cdn.sunmi.com/newebsite/products/t3-pro/icon/t3-pro-series.png" 
                alt="LOKMA T3 Pro Masaüstü Kasa" 
                className="relative z-10 w-full h-auto drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FLEX 3 - Modular Kiosk (Reverse Split Layout) */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-16 lg:gap-24">
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full transform scale-90" />
              <img 
                src="https://file.cdn.sunmi.com/newebsite/products/flex-3/icon/flex-3.png" 
                alt="LOKMA FLEX 3 Modüler Kiosk" 
                className="relative z-10 w-full h-auto drop-shadow-2xl"
              />
            </div>

            <div className="w-full lg:w-1/2">
              <div className="inline-flex items-center gap-2 text-emerald-600 font-bold uppercase tracking-widest text-sm mb-6">
                <span className="w-8 h-px bg-emerald-600"></span>
                Kiosk & KDS Ekranları
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 leading-tight">Sınırsız <br/>Esneklik.</h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Aynı cihaz mutfakta dev bir KDS (Mutfak Ekranı), kasada bir Self-Checkout kiosku, duvarda ise dijital bir menü panosu olabilir. LOKMA'nın "Tak ve Çalıştır" vizyonunun zirvesi.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-6 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-sm">17mm İnce Profil</span>
                <span className="px-6 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-sm">IP54 Suya Dayanıklı</span>
                <span className="px-6 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-sm">NFC & Barkod Entegre</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* V3 Family - Mobile POS (Card Grid Layout) */}
      <section className="py-24 md:py-32 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 text-purple-600 font-bold uppercase tracking-widest text-sm mb-6">
              <span className="w-8 h-px bg-purple-600"></span>
              Mobil Sipariş Terminalleri
              <span className="w-8 h-px bg-purple-600"></span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6">Masalara Hükmedin.</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Garsonlarınız masada siparişi alsın, anında mutfağa iletsin ve ödemeyi çekip fişi doğrudan masada yazdırsın.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-lg flex flex-col items-center text-center group hover:shadow-xl transition-shadow">
              <div className="h-64 flex items-center justify-center mb-8 w-full relative">
                <div className="absolute inset-0 bg-purple-500/5 blur-2xl rounded-full transform scale-50 group-hover:scale-100 transition-transform duration-700" />
                <img 
                  src="https://file.cdn.sunmi.com/newebsite/products/v3-family/icon/v3-family.png" 
                  alt="V3 POS" 
                  className="relative z-10 h-full object-contain drop-shadow-xl group-hover:-translate-y-2 transition-transform duration-500" 
                />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">Avuç İçi Performans</h3>
              <p className="text-gray-600 text-lg">Hafif, dayanıklı ve gün boyu yetecek devasa batarya kapasitesi. 1.2 metreden düşmelere karşı zırhlı yapı.</p>
            </div>
            
            <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-lg relative group hover:shadow-xl transition-shadow flex flex-col">
              <div className="h-64 w-full relative overflow-hidden">
                <img 
                  src="https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/p7-2.jpg" 
                  alt="V3 Scanner" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
              </div>
              <div className="p-10 flex-1 flex flex-col justify-center items-center text-center">
                <h3 className="text-2xl font-black text-gray-900 mb-4">Işık Hızında Barkod & QR</h3>
                <p className="text-gray-600 text-lg">Karanlık gece kulüplerinde veya loş restoranlarda bile entegre lazer okuyucu ile milisaniyeler içinde işlem yapın.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ESL - Masonry Showcase */}
      <section className="py-24 md:py-32 bg-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-[600px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="w-full lg:w-5/12">
              <div className="inline-flex items-center gap-2 text-sky-600 font-bold uppercase tracking-widest text-sm mb-6 bg-sky-50 px-4 py-2 rounded-full">
                <span className="material-symbols-outlined text-[18px]">price_change</span>
                LOKMA ESL Sistemleri
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8 text-gray-900 leading-tight">
                Kağıt İsrafına Son Verin.
              </h2>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                Raflarınızdaki binlerce fiyatı saniyeler içinde güncelleyin. LOKMA Dijital Etiket (ESL) sistemi sayesinde hem kasiyeriniz hem de müşteriniz her zaman aynı fiyatı görür. 5 yıla varan pil ömrüyle sıfır bakım.
              </p>
              <Link href="/hardware" className="inline-flex items-center justify-center gap-3 bg-sky-600 hover:bg-sky-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-sky-600/20 transition-transform hover:-translate-y-1">
                Etiket Modellerini İncele
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>

            <div className="w-full lg:w-7/12">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-6 mt-12">
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                    <img src="https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png" alt="ESL 1.54" className="h-24 object-contain mb-6 scale-90" />
                    <div className="text-xl font-black text-gray-900 mb-1">1.54"</div>
                    <div className="text-gray-500 text-sm font-medium">Kompakt Etiket</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                    <img src="https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png" alt="ESL 2.60" className="h-24 object-contain mb-6 scale-110" />
                    <div className="text-xl font-black text-gray-900 mb-1">2.60"</div>
                    <div className="text-gray-500 text-sm font-medium">Geniş Raf Etiketi</div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                    <img src="https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png" alt="ESL 2.10" className="h-24 object-contain mb-6 scale-100" />
                    <div className="text-xl font-black text-gray-900 mb-1">2.10"</div>
                    <div className="text-gray-500 text-sm font-medium">Standart Reyon</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                    <img src="https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png" alt="ESL 4.20" className="h-24 object-contain mb-6 scale-125" />
                    <div className="text-xl font-black text-gray-900 mb-1">4.20"</div>
                    <div className="text-gray-500 text-sm font-medium">Meyve / Sebze Bilgi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Scale Section */}
      <section className="py-24 md:py-32 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-blue-500/10 opacity-50" />
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 relative z-10">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[3rem] p-10 md:p-16 flex flex-col md:flex-row items-center gap-16">
            <div className="w-full md:w-1/2">
              <span className="text-[#ea184a] font-bold tracking-widest uppercase text-sm mb-4 block">LOKMA S2 Akıllı Terazi</span>
              <h2 className="text-4xl md:text-5xl font-black mb-8 text-white">Milimetrik Hassasiyet. Saniyelik Aktarım.</h2>
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                Kasap veya şarküteri reyonunuzda tarttığınız ürünün gramajı, anında LOKMA POS sistemine ve elektronik etiketlere aktarılır.
              </p>
              <ul className="space-y-5">
                <li className="flex items-center gap-4 text-white font-medium text-lg">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </div>
                  Çift Ekranlı Sunmi S2 Desteği
                </li>
                <li className="flex items-center gap-4 text-white font-medium text-lg">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </div>
                  Stripe Değişken Ağırlık (Variable Weight)
                </li>
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <img src="https://file.cdn.sunmi.com/newebsite/products/s2/s2-8-en.jpg" alt="Smart Scale" className="w-full max-w-[450px] object-contain drop-shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 bg-[#ea184a] text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 divide-x divide-white/20">
          {stats.map((s, i) => (
            <div key={i} className="text-center px-4">
              <div className="text-4xl md:text-5xl font-black mb-2">{s.value}</div>
              <div className="text-sm text-white/90 font-bold uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-32 px-6 bg-gray-50 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-7xl font-black mb-8 text-gray-900 leading-tight">İşletmenizi Geleceğe Taşıyın</h2>
          <p className="text-gray-600 text-xl md:text-2xl mb-12 font-medium">
            Donanım, yazılım ve tam entegre kermes altyapısıyla LOKMA ekosistemine bugün katılın.
          </p>
          <Link href="/partner/apply" className="inline-flex items-center justify-center gap-4 bg-[#ea184a] hover:bg-rose-600 text-white px-12 py-5 rounded-xl font-black text-xl shadow-2xl shadow-[#ea184a]/20 transition-transform hover:-translate-y-1">
            Hemen Başvurun
            <span className="material-symbols-outlined">rocket_launch</span>
          </Link>
        </div>
      </section>

      <PublicFooter themeAware={false} />
    </div>
  );
}
