'use client';

import React, { useState, useEffect } from 'react';
import PublicHeader from '@/components/ui/PublicHeader';

export default function FestivalModernRedesign() {
    const [isParkingSheetOpen, setIsParkingSheetOpen] = useState(false);

    // ESC to close sheet
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsParkingSheetOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    return (
        <div className="font-sans bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#F3F4F6] antialiased selection:bg-[#D32F2F]/30 min-h-[max(884px,100dvh)] transition-colors duration-300">
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .modern-card {
                    backdrop-filter: blur(12px);
                    border-radius: 24px;
                    transition: all 0.15s ease-out;
                }
                .modern-card:active {
                    transform: scale(0.99);
                }
                .material-symbols-outlined {
                    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
                    font-family: 'Material Symbols Outlined';
                }
                .material-symbols-outlined.fill-1 {
                    font-variation-settings: 'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24;
                }
            `}</style>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            `}} />

            {/* Existing Navbar integrated */}
            <PublicHeader themeAware={true} />

            <div className="mx-auto max-w-md min-h-screen relative pb-32 bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
                
                <div className="relative h-[480px] w-full">
                    <div className="absolute inset-0 overflow-hidden rounded-b-[40px]">
                        <img 
                            alt="Festival Hero" 
                            className="w-full h-full object-cover opacity-80" 
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTzen4tmTwSsPkqYZhWLeUT974LYp_IJtcZsiVRKnmShwrrZPx5ZdOVWEtTuCey7w6hLxHIAzr7nZky9onAVd017H2AGBOZHpDZ6w48ej-XAfyIkqgGztvCDRrDBJQvmnrbCJQ7WqGc4slmnQR37X66Vi2_BvEvdujs3XbiwBXOlIn_c3biqlYkTY5bm9b7c34GNnsUBp_I_cKbLlGc5eikhvfL730VFIOcIKPfRdiYS4hbEB9tPIacFyz8ctR4bjIYOXM_83pe1id"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-gray-50/40 dark:from-[#050505] dark:via-[#050505]/40 to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent h-32"></div>
                    </div>

                    <div className="absolute top-0 left-0 right-0 px-6 pt-24 flex justify-between items-center z-20">
                        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md border border-white/20 dark:border-white/10 text-white hover:bg-black/30 dark:hover:bg-white/20 transition">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </button>
                        <div className="flex gap-3">
                            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md border border-white/20 dark:border-white/10 text-white hover:bg-black/30 dark:hover:bg-white/20 transition group">
                                <span className="material-symbols-outlined text-[20px] group-hover:text-[#D32F2F] transition-colors">favorite</span>
                            </button>
                            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md border border-white/20 dark:border-white/10 text-white hover:bg-black/30 dark:hover:bg-white/20 transition">
                                <span className="material-symbols-outlined text-[20px]">share</span>
                            </button>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 z-20">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-full bg-[#D32F2F]/90 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm shadow-md">München</span>
                            <span className="text-xs text-gray-800 dark:text-white/80 font-semibold drop-shadow-md">Almanya 🇩🇪</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-2 tracking-tight drop-shadow-sm">München Büyük Türk Festivali</h1>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D32F2F] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D32F2F]"></span>
                                </span>
                                <span className="text-xs font-semibold text-gray-800 dark:text-white/90 tracking-wide drop-shadow-sm">4 GÜN KALDI</span>
                            </div>
                        </div>

                        <div className="bg-white/90 dark:bg-[#18181b]/80 backdrop-blur-xl border border-gray-200 dark:border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-xl">
                            <div className="flex items-center gap-3 pl-1">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-700 dark:text-white/90">
                                    <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF] font-medium uppercase tracking-wider">Tarih</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">25.1 - 1.2.2026</p>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-gray-200 dark:bg-white/10"></div>
                            <div className="flex items-center gap-3 pr-1 text-right flex-row-reverse">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-700 dark:text-white/90">
                                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF] font-medium uppercase tracking-wider">Saat</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">10:00 - 22:00</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="px-5 mt-6 space-y-5 relative z-30">
                    <button className="relative w-full h-80 rounded-3xl overflow-hidden group modern-card p-0 border-0 shadow-lg block">
                        <img 
                            alt="Street food" 
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJbRi7Loz4DMKqPn8OxdwybssRuCj0euEnxEc2C3sIHp6PFPWFIxOz6Cl1hciT95IosE2iL3AOdQZla7X1RwTK4ZloveV5PhHcDz2MIcFPkRk1fYTc6j15pKLPVi4nGg1p2FgfsHwmyUCs8CHb-DA_fXZbgYlwwXOLlYtl3y2Zsk3SbNm8_lHiurj651KmrmAse3uiJELB_Abh3LbqDqyDFQdnjAdhne_sjvjeNEnJDhq6P7tR33_Z97ZDVPbNUCIT78xhXY9zlnQM"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90"></div>
                        <div className="absolute top-5 right-5">
                            <div className="bg-[#D32F2F]/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider shadow-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px] fill-1">star</span> Popüler
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                            <div className="flex items-end justify-between">
                                <div className="space-y-1 text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#D32F2F]"></span>
                                        <span className="text-[11px] font-semibold text-white/90 uppercase tracking-widest">Lezzet Şöleni</span>
                                    </div>
                                    <h2 className="text-3xl font-bold text-white leading-none tracking-tight">Menü ve<br/>Sipariş</h2>
                                    <p className="text-xs text-white/80 pt-2 font-medium max-w-[200px] leading-relaxed">Kebaplar, tatlılar ve sokak lezzetlerini keşfet.</p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-white text-[#050505] flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                                    <span className="material-symbols-outlined text-2xl text-[#D32F2F] font-medium">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                    </button>

                    <div className="overflow-x-auto no-scrollbar py-1">
                        <div className="flex gap-3">
                            <div className="pl-1 flex gap-2.5">
                                <div className="flex items-center gap-2 py-2 px-4 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white/90 shadow-sm whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[16px]">child_care</span>
                                    <span className="text-[11px] font-medium tracking-wide">Çocuk</span>
                                </div>
                                <div className="flex items-center gap-2 py-2 px-4 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white/90 shadow-sm whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[16px]">camping</span>
                                    <span className="text-[11px] font-medium tracking-wide">Çadır</span>
                                </div>
                                <div className="flex items-center gap-2 py-2 px-4 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white/90 shadow-sm whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                                    <span className="text-[11px] font-medium tracking-wide">Alışveriş</span>
                                </div>
                                <div className="flex items-center gap-2 py-2 px-4 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white/90 shadow-sm whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[16px]">music_note</span>
                                    <span className="text-[11px] font-medium tracking-wide">Müzik</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modern-card bg-white/80 dark:bg-[rgba(20,20,22,0.9)] border border-gray-200 dark:border-white/5 shadow-lg p-6 space-y-5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white">
                                    <span className="material-symbols-outlined text-[20px]">location_on</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-500 dark:text-[#9CA3AF] font-semibold uppercase tracking-widest block mb-0.5">Lokasyon</span>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">München, Bavyera</p>
                                </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 rounded-full px-3 py-1 border border-gray-200 dark:border-white/5 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px] text-gray-500 dark:text-[#9CA3AF]">near_me</span>
                                <span className="text-[10px] font-bold text-gray-900 dark:text-white">2.1 km</span>
                            </div>
                        </div>
                        <div className="pt-1">
                            <p className="text-base font-medium text-gray-800 dark:text-white/90 leading-snug">Marienplatz 1, 80331 München</p>
                        </div>
                        <button className="w-full bg-[#D32F2F] hover:bg-red-700 py-3.5 rounded-2xl text-white text-[11px] font-bold tracking-[0.15em] uppercase shadow-lg shadow-red-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">navigation</span>
                            Yol Tarifi Al
                        </button>
                    </div>

                    {/* Parking Info Card - Triggers Bottom Sheet */}
                    <button 
                        onClick={() => setIsParkingSheetOpen(true)}
                        className="relative w-full h-32 rounded-3xl overflow-hidden group modern-card border border-gray-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-[#D32F2F] shadow-lg text-left block"
                    >
                        <div className="absolute inset-0">
                            <img alt="Parking Lot" className="h-full w-full object-cover grayscale opacity-30 dark:opacity-50 mix-blend-overlay" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCghDSwUkHQ0hd_B-McJJ4fZPGP8zjK929y42shgv2J-MhJ392FInWVjplw_iuK_8Us9DBl_U8KTvA_Ta8idIJiKv_mnOJBrLM_A9DJmJYQA5p0PG-nI6sW97x-t_mZlqnsqwl9JFl73dwWa--SMG6BWh3zFYa31muxxpjbsG95nxmIWM6pz_B_90aqy3LThEiqT5dvrKWS3KmdN9GFxNmQo0oEx3uX6n4BA_0EGwpo6KT0wuFf9qJ6XjOUlIn9_HK_uE8PQkwHbrae"/>
                            <div className="absolute inset-0 bg-white/80 dark:bg-[#141416]/80"></div>
                        </div>
                        <div className="relative p-6 h-full flex items-center justify-between z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Otopark Durumu</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Park Bilgisi</h3>
                                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">Boş Yer: <span className="text-gray-900 dark:text-white font-semibold">150+</span></p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined text-2xl text-gray-700 dark:text-white/80">local_parking</span>
                            </div>
                        </div>
                    </button>

                    <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#9CA3AF]">Hava Durumu</h3>
                            <span className="text-[10px] text-gray-400 dark:text-[#9CA3AF]/60 font-medium">3 Günlük Tahmin</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                            <div className="min-w-[140px] shadow-sm bg-white dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/5 p-4 rounded-3xl flex flex-col justify-between h-36 relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-[0.03] text-gray-900 dark:text-white">
                                    <span className="material-symbols-outlined text-8xl">wb_sunny</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-[#9CA3AF] uppercase mb-2">Pazartesi</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-yellow-500 text-2xl">wb_sunny</span>
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">20°</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-auto relative z-10">
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                                        <span className="material-symbols-outlined text-[14px]">water_drop</span>
                                        <span>10%</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                                        <span className="material-symbols-outlined text-[14px]">air</span>
                                        <span>15</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="min-w-[140px] shadow-sm bg-white dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/5 p-4 rounded-3xl flex flex-col justify-between h-36 relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-[0.03] text-gray-900 dark:text-white">
                                    <span className="material-symbols-outlined text-8xl">partly_cloudy_day</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-[#9CA3AF] uppercase mb-2">Salı</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-2xl">partly_cloudy_day</span>
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">18°</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-auto relative z-10">
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                                        <span className="material-symbols-outlined text-[14px]">water_drop</span>
                                        <span>30%</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                                        <span className="material-symbols-outlined text-[14px]">air</span>
                                        <span>18</span>
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-[140px] shadow-sm bg-white dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/5 p-4 rounded-3xl flex flex-col justify-between h-36 relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-[0.03] text-gray-900 dark:text-white">
                                    <span className="material-symbols-outlined text-8xl">cloud</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-[#9CA3AF] uppercase mb-2">Çarşamba</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-gray-400 dark:text-gray-400 text-2xl">cloud</span>
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">16°</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-auto relative z-10">
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                                        <span className="material-symbols-outlined text-[14px]">water_drop</span>
                                        <span>60%</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                                        <span className="material-symbols-outlined text-[14px]">air</span>
                                        <span>22</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modern-card bg-white/80 dark:bg-[rgba(20,20,22,0.9)] border border-gray-200 dark:border-white/5 shadow-lg p-5 mb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/5">
                                    <span className="material-symbols-outlined text-gray-700 dark:text-white/80 text-[24px]">person</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-[#9CA3AF] uppercase tracking-widest mb-0.5">Yetkili</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Ahmet Yılmaz</p>
                                    <p className="text-xs text-gray-600 dark:text-white/50">+49 89 123 4567</p>
                                </div>
                            </div>
                            <button className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white flex items-center justify-center border border-gray-200 dark:border-white/5 active:scale-90 transition-transform hover:bg-gray-200 dark:hover:bg-white/10">
                                <span className="material-symbols-outlined text-[20px]">call</span>
                            </button>
                        </div>
                    </div>
                </main>

                <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-[#0A0C10]/95 backdrop-blur-3xl border-t border-gray-200 dark:border-white/5 px-6 pb-8 pt-4 z-40 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-none">
                    <div className="flex justify-between items-end">
                        <button className="flex flex-col items-center gap-1.5 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition group w-14">
                            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">restaurant</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Yemek</span>
                        </button>
                        <button className="flex flex-col items-center gap-1.5 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition group w-14">
                            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">storefront</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Pazar</span>
                        </button>
                        <button className="relative -top-6 group">
                            <div className="w-14 h-14 rounded-full bg-[#D32F2F] flex items-center justify-center shadow-[0_4px_20px_rgba(220,38,38,0.4)] border-4 border-white dark:border-[#0A0C10] group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-white text-[24px]">festival</span>
                            </div>
                        </button>
                        <button className="flex flex-col items-center gap-1.5 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition group w-14">
                            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">shopping_bag</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Sepet</span>
                        </button>
                        <button className="flex flex-col items-center gap-1.5 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition group w-14">
                            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">account_circle</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Profil</span>
                        </button>
                    </div>
                </nav>

                {/* Bottom Sheet for Parking (Slide up modal) */}
                <div 
                    className={`fixed inset-0 z-50 transition-opacity duration-300 ${isParkingSheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                    aria-hidden={!isParkingSheetOpen}
                >
                    {/* Backdrop */}
                    <div 
                        className={`absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity ${isParkingSheetOpen ? 'opacity-100' : 'opacity-0'}`}
                        onClick={() => setIsParkingSheetOpen(false)}
                    />
                    
                    {/* Sheet Content */}
                    <div className={`absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-[#121214] rounded-t-[32px] shadow-2xl transition-transform duration-300 transform ${isParkingSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                        {/* Drag Handle Area */}
                        <div 
                            className="w-full pt-4 pb-2 flex justify-center cursor-pointer"
                            onClick={() => setIsParkingSheetOpen(false)}
                        >
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full" />
                        </div>

                        <div className="px-6 pb-8 pt-2 max-h-[80vh] overflow-y-auto no-scrollbar">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Park Bilgisi</h2>
                                    <p className="text-sm text-gray-500 dark:text-[#9CA3AF]">Festival alanı otopark detayları</p>
                                </div>
                                <button 
                                    onClick={() => setIsParkingSheetOpen(false)}
                                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 flex gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">local_parking</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white mb-0.5">Ana Otopark</h4>
                                        <p className="text-xs text-gray-600 dark:text-white/70 mb-2">Marienplatz Messe Alanı Otoparkı - 150+ boş yer</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">MÜSAİT</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl p-4 flex gap-4 opacity-80">
                                    <div className="w-12 h-12 rounded-full bg-white dark:bg-white/5 shadow-sm dark:shadow-none flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-white/50">
                                        <span className="material-symbols-outlined text-2xl">directions_car</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white mb-0.5">Alternatif P2 (Doldu)</h4>
                                        <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">Karlsplatz Yeraltı Otoparkı</p>
                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-2">KAPASİTE DOLU</p>
                                    </div>
                                </div>

                                <button className="w-full mt-4 bg-gray-900 dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg">
                                    <span className="material-symbols-outlined">map</span>
                                    Google Haritalarda Aç
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
