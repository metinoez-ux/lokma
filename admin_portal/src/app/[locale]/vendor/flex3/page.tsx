'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';

export default function Flex3Page() {
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-black text-white font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#ea184a]/30">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/90 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase">MASAÜSTÜ KASA & KIOSK</span>
            <span className="text-sm font-bold text-white">Sunmi FLEX 3</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-white">€299.00</span>
              <span className="text-[10px] text-white/50">oder €19.00 / Monat mieten</span>
            </div>
            <Link 
              href={`/${locale}/vendor`}
              className="bg-white hover:bg-gray-200 text-black px-6 py-2 rounded-full font-bold text-sm transition-colors"
            >
              Geri Dön
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-32">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-black tracking-tight mb-8">
              Sunmi FLEX 3
            </h1>
            <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-20">
              İşletmenizin her köşesine uyum sağlayan modüler, yapay zeka destekli interaktif ekran. Self-Checkout, Mutfak Ekranı (KDS) veya Bilgi Kiosku olarak kullanılabilir.
            </p>
            
            {/* Main Showcase Image/Video */}
            <div className="relative w-full max-w-4xl mx-auto aspect-video rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.05)] border border-white/10 group">
               {/* Dark cinematic overlay */}
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
               
               <video 
                  src="/videos/flex-3-demo.mp4" 
                  poster="https://file.cdn.sunmi.com/newebsite/products/flex-3/icon/flex-3.png"
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                
                <div className="absolute right-10 top-1/2 -translate-y-1/2 z-20">
                   <div className="text-right">
                     <div className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl">400-nit</div>
                     <div className="text-xl text-white/80 font-medium">Brightness</div>
                   </div>
                </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 px-6 bg-[#111111]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black mb-6">Sınırsız Esneklik. Sınırsız.</h2>
              <p className="text-xl text-white/50 max-w-2xl mx-auto">
                Dilediğiniz yerde dilediğiniz gibi konumlandırın.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 hover:bg-[#222] transition-colors">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white">
                   <span className="material-symbols-outlined text-3xl">smart_display</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">15.6" Full HD</h3>
                 <p className="text-white/50">Mükemmel renk doğruluğu ve parlaklık ile her açıdan net görüntü.</p>
              </div>
              <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 hover:bg-[#222] transition-colors">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white">
                   <span className="material-symbols-outlined text-3xl">memory</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">Güçlü İşlemci</h3>
                 <p className="text-white/50">Akıcı Self-Checkout deneyimi için geliştirilmiş AI destekli işlem gücü.</p>
              </div>
              <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 hover:bg-[#222] transition-colors">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white">
                   <span className="material-symbols-outlined text-3xl">water_drop</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">IP54 Koruması</h3>
                 <p className="text-white/50">Mutfak ortamındaki (KDS) sıçramalara ve toza karşı tam dayanıklılık.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
