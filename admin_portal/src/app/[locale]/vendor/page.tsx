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
    <div className="relative flex min-h-screen flex-col bg-background dark:bg-[#0f172a] text-foreground font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      <PublicHeader themeAware={true} />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#ea184a]/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 bg-[#ea184a]/10 text-[#ea184a] px-5 py-2 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#ea184a]/20">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Sadece Bir Yemek Uygulaması Değil
            </span>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-8">
              İşletmenizin Yeni<br />
              <span className="bg-gradient-to-r from-[#ea184a] to-[#ff6b6b] bg-clip-text text-transparent">İşletim Sistemi.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground/80 dark:text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Donanımdan yazılıma, online siparişten kurye yönetimine kadar her şey tek ekranda, tek sistemde. 
              LOKMA ile tanışın; işletmenizin uçtan uca dijital dönüşümü başlıyor.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-[#ea184a]/25 transition-all hover:scale-105 active:scale-95">
                {tx('ctaApply')}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <Link href="#ecosystem" className="inline-flex items-center justify-center gap-2 bg-muted dark:bg-background/10 hover:bg-muted/50 dark:hover:bg-background/20 border border-border/50 text-foreground px-10 py-4 rounded-2xl font-bold text-lg transition-all">
                Ekosistemi Keşfet
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Massive Hardware Intro Statement */}
      <section id="ecosystem" className="py-24 md:py-40 px-4 text-center bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
            Parça Parça Çözümlere Elveda Deyin.
          </h2>
          <p className="text-xl md:text-3xl font-light text-gray-400 leading-relaxed">
            Masaüstü kasalar, mobil sipariş terminalleri, dijital mutfak ekranları, akıllı teraziler ve elektronik fiyat etiketleri...
            Tümü LOKMA altyapısıyla kusursuz senkronize çalışır. Donanım ve yazılımın kusursuz uyumuyla tanışın.
          </p>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: T3 PRO (Desktop POS) */}
      <section className="relative w-full min-h-[80vh] flex items-center overflow-hidden bg-black">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source src="https://file.cdn.sunmi.com/newebsite/products/t3-pro/lg/tvc-poster.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16">
          <div className="max-w-xl">
            <span className="text-[#ea184a] font-bold tracking-widest uppercase text-sm mb-4 block">Masaüstü Gücü</span>
            <h2 className="text-5xl md:text-7xl font-black text-white mb-6 leading-none">Tezgahın Yeni<br/>Hakimi.</h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Çift ekranlı yapısı, alüminyum alaşım gövdesi ve durdurulamaz performansıyla işletmenizin merkez üssü. 
              Müşterilerinize şeffaf bir kasa deneyimi sunarken, siparişleri saniyeler içinde mutfağa iletin.
            </p>
            <div className="flex gap-4">
              <span className="px-4 py-2 border border-white/20 rounded-full text-white text-sm backdrop-blur-md">15.6" Full HD</span>
              <span className="px-4 py-2 border border-white/20 rounded-full text-white text-sm backdrop-blur-md">Çift Ekran</span>
              <span className="px-4 py-2 border border-white/20 rounded-full text-white text-sm backdrop-blur-md">80mm Tümleşik Yazıcı</span>
            </div>
          </div>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: FLEX 3 (Modular) */}
      <section className="relative w-full min-h-[80vh] flex items-center justify-end overflow-hidden bg-white dark:bg-[#111]">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/tvc-poster.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-l from-white/90 via-white/50 to-transparent dark:from-black/90 dark:via-black/50" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 flex justify-end text-right">
          <div className="max-w-xl">
            <span className="text-blue-600 font-bold tracking-widest uppercase text-sm mb-4 block">Sınırsız Modülerlik</span>
            <h2 className="text-5xl md:text-7xl font-black text-black dark:text-white mb-6 leading-none">İstediğiniz<br/>Yere Takın.</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              Mutfakta bir KDS ekranı, duvarda bir Self-Checkout kiosku veya kasada bir müşteri bilgilendirme paneli.
              13 TOPS Yapay Zeka gücüne sahip ultra ince ekran ile işletmenizin her köşesini dijitalleştirin.
            </p>
            <div className="flex gap-4 justify-end">
              <span className="px-4 py-2 bg-black/5 dark:bg-white/10 rounded-full text-black dark:text-white text-sm font-medium">17mm İnce Profil</span>
              <span className="px-4 py-2 bg-black/5 dark:bg-white/10 rounded-full text-black dark:text-white text-sm font-medium">IP54 Koruma</span>
            </div>
          </div>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: V3 Family (Mobile POS) */}
      <section className="relative w-full min-h-[80vh] flex items-center overflow-hidden bg-[#0f172a]">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        >
          <source src="https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/tvc-poster.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 text-center">
          <span className="text-emerald-400 font-bold tracking-widest uppercase text-sm mb-4 block">Masalara Hükmedin</span>
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">Özgürlük<br/>Avucunuzun İçinde.</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Siparişi masada alın, ödemeyi kapıda çekin. Dahili barkod okuyucusu, entegre fiş yazıcısı ve düşmelere dayanıklı endüstriyel zırhıyla personelinizin en yakın dostu. Priz arama derdine son veren güçlü bataryasıyla tüm vardiyayı çıkarın.
          </p>
        </div>
      </section>

      {/* IMMERSIVE SHOWCASE: ESL (Electronic Shelf Labels) */}
      <section className="py-24 md:py-32 px-4 bg-muted/30 dark:bg-black border-y border-border/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative rounded-3xl overflow-hidden shadow-2xl">
              <img src="https://file.cdn.sunmi.com/newebsite/products/esl/p1.jpg" alt="ESL Digital Labels" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 text-blue-600 text-sm font-bold uppercase tracking-widest mb-6">
                <span className="material-symbols-outlined text-[18px]">price_change</span>
                ESL Etiket Teknolojisi
              </span>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-foreground">Fiyatları Tek Tıkla Güncelleyin.</h2>
              <p className="text-muted-foreground text-lg md:text-xl mb-8 leading-relaxed">
                Kağıt etiket israfına ve fiyat uyumsuzluklarına son verin. LOKMA paneli üzerinden değiştirdiğiniz bir fiyat, saniyeler içinde fiziksel mağazanızdaki dijital raflara yansır.
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3 text-lg font-medium">
                  <span className="w-8 h-8 bg-blue-500/20 text-blue-600 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">bolt</span></span>
                  Saniyelik Senkronizasyon
                </li>
                <li className="flex items-center gap-3 text-lg font-medium">
                  <span className="w-8 h-8 bg-blue-500/20 text-blue-600 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">battery_charging_full</span></span>
                  5 Yıla Varan Pil Ömrü
                </li>
                <li className="flex items-center gap-3 text-lg font-medium">
                  <span className="w-8 h-8 bg-blue-500/20 text-blue-600 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">palette</span></span>
                  Çok Renkli (Kırmızı/Beyaz/Siyah) E-Mürekkep
                </li>
              </ul>
              <Link href="/hardware" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline text-lg">
                Dijital Etiketleri İncele <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10 py-16 bg-[#ea184a] text-white">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl md:text-5xl font-black mb-2">{s.value}</div>
              <div className="text-sm md:text-base text-white/80 font-medium uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-4 md:px-8 bg-background dark:bg-[#0f172a]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{tx('stepsTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative group text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-border to-transparent z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-24 h-24 mx-auto mb-6 bg-[#ea184a]/10 border-2 border-[#ea184a]/20 group-hover:border-[#ea184a] rounded-2xl flex items-center justify-center transition-all duration-300">
                    <span className="material-symbols-outlined text-4xl text-[#ea184a]">{step.icon}</span>
                  </div>
                  <div className="text-[#ea184a] font-black text-sm mb-3 tracking-widest">{step.num}</div>
                  <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-4xl mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#ea184a]/10 to-purple-500/10 rounded-3xl blur-xl" />
          <div className="relative bg-gradient-to-br from-[#ea184a]/5 to-purple-500/5 border border-border/50 rounded-3xl p-12 md:p-16 text-center">
            <h2 className="text-4xl md:text-5xl font-black mb-6">{tx('bottomCta')}</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">{tx('bottomCtaSub')}</p>
            <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#ea184a] hover:bg-red-600 text-white px-12 py-5 rounded-2xl font-bold text-xl shadow-2xl shadow-[#ea184a]/25 transition-all hover:scale-105 active:scale-95">
              {tx('bottomCtaBtn')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter themeAware={true} />
    </div>
  );
}
