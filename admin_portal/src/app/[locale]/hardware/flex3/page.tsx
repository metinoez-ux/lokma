'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

export default function Flex3PromoPage() {
  const locale = useLocale();

  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#ea184a]/30">
      <PublicHeader themeAware={true} />

      <main className="flex-1 pb-32">
        {/* Hero Section */}
        <section className="relative pt-40 pb-20 px-6 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[800px] w-full overflow-hidden pointer-events-none">
            <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 blur-[120px] opacity-50" />
          </div>

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <span className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold mb-8 uppercase tracking-widest border border-white/20">
              <span className="material-symbols-outlined text-[18px]">devices</span>
              MASAÜSTÜ KASA & KIOSK
            </span>

            <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-black tracking-tight mb-8">
              Sunmi FLEX 3
            </h1>
            <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-20">
              İşletmenizin her köşesine uyum sağlayan modüler, yapay zeka destekli interaktif ekran. Self-Checkout, Mutfak Ekranı (KDS) veya Bilgi Kiosku olarak kullanılabilir.
            </p>
            
            {/* Main Showcase Image */}
            <div className="relative w-full max-w-4xl mx-auto aspect-video rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.05)] border border-white/10 group bg-[#111]">
               {/* Dark cinematic overlay */}
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
               
               <img 
                  src="https://file.cdn.sunmi.com/newebsite/products/flex-3/icon/flex-3.png"
                  alt="Sunmi FLEX 3"
                  className="w-full h-full object-contain p-8 transition-transform duration-1000 group-hover:scale-105"
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
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black mb-6">Sınırsız Esneklik. Sınırsız.</h2>
              <p className="text-xl text-white/50 max-w-2xl mx-auto">
                Dilediğiniz yerde dilediğiniz gibi konumlandırın. Restoran, kafe veya market için mükemmel çözüm.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 hover:bg-[#222] transition-colors group">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                   <span className="material-symbols-outlined text-3xl">smart_display</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">15.6" Full HD</h3>
                 <p className="text-white/50">Mükemmel renk doğruluğu ve parlaklık ile her açıdan net görüntü.</p>
              </div>
              <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 hover:bg-[#222] transition-colors group">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                   <span className="material-symbols-outlined text-3xl">memory</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">Güçlü İşlemci</h3>
                 <p className="text-white/50">Akıcı Self-Checkout deneyimi için geliştirilmiş AI destekli işlem gücü.</p>
              </div>
              <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 hover:bg-[#222] transition-colors group">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:bg-sky-500/20 group-hover:text-sky-400 transition-colors">
                   <span className="material-symbols-outlined text-3xl">water_drop</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">IP54 Koruması</h3>
                 <p className="text-white/50">Mutfak ortamındaki (KDS) sıçramalara ve toza karşı tam dayanıklılık.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 text-center">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#1a1a1a] to-black p-12 md:p-20 rounded-[3rem] border border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black mb-6 text-white">İşletmenizi Dijitalleştirin</h2>
              <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
                LOKMA donanım ekosistemi ile tam entegre çalışan Sunmi FLEX 3 hakkında daha fazla bilgi almak ve başvuru yapmak için hemen iletişime geçin.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-200 px-8 py-4 rounded-xl font-bold text-lg transition-colors">
                  Hemen Başvur
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link href={`/${locale}/hardware`} className="inline-flex items-center justify-center gap-3 bg-transparent text-white border border-white/20 hover:bg-white/10 px-8 py-4 rounded-xl font-bold text-lg transition-colors">
                  Tüm Donanımları İncele
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter themeAware={true} />
    </div>
  );
}
