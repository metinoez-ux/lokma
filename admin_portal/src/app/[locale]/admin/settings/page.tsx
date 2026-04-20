'use client';

import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { 
    Settings, Store, Utensils, Users, CalendarDays, Tags, 
    Truck, CreditCard, Printer, Briefcase, FileText, Palette, 
    Sun, Moon, Tent, HandHeart, Image as ImageIcon, Settings2, Shield 
} from 'lucide-react';

export default function SettingsPage() {
    const rawT = useTranslations('AdminSettings');
    const t = (key: string) => {
        const val = rawT(key as any);
        return val === `AdminSettings.${key}` || val === key ? '' : val;
    };
    const { admin } = useAdmin();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
            <div className="max-w-3xl mx-auto">
                <header className="mb-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{admin?.adminType === 'super' ? 'Sistem Ayarları' : t('settings') || 'Ayarlar'}</h1>
                        <p className="text-sm text-muted-foreground mt-1">Platform, donanım ve personel yapılandırmaları</p>
                    </div>
                </header>

                {/* NORMAL ADMIN BÖLÜMLERİ */}
                {admin?.adminType !== 'super' && (
                    <div className="space-y-10 mb-10">

                        {/* BÖLÜM 1: İŞLETME & LOJİSTİK */}
                        <section>
                            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                <Store className="w-5 h-5 text-muted-foreground" />
                                İşletme & Teslimat
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">Temel işletme profili ve lojistik kuralları</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link href="/admin/settings/company?target=bilgiler" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-red-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                        <Store className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('isletmeBilgileri') || 'İşletme Bilgileri'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('isletmeProfilAdresIletisim') || 'Profil, adres ve iletişim'}</p>
                                    </div>
                                </Link>

                                <Link href="/admin/settings/company?target=teslimat" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-amber-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                                        <Truck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('teslimat') || 'Teslimat Ayarları'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('kurye_teslimat_ucreti_ve_siparis_saatler') || 'Kurye yönetimi ve süreler'}</p>
                                    </div>
                                </Link>
                            </div>
                        </section>

                        {/* BÖLÜM 2: MENÜ & ÜRÜNLER */}
                        <section>
                            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                <Utensils className="w-5 h-5 text-muted-foreground" />
                                Katalog Yönetimi
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">Ürünler, kategoriler ve sipariş opsiyonları</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link href="/admin/products" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-emerald-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                        <Utensils className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('menu_ve_urunler') || 'Menü & Ürünler'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('urun_ve_kategori_yonetimi') || 'Toplu ürün yönetimi'}</p>
                                    </div>
                                </Link>

                                <Link href="/admin/settings/kermes-categories" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-indigo-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                        <Tags className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">Kategori Yönetimi</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Menüler için global filtre tipleri</p>
                                    </div>
                                </Link>
                            </div>
                        </section>

                        {/* BÖLÜM 3: PERSONEL & VARDİYA */}
                        <section>
                            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                <Users className="w-5 h-5 text-muted-foreground" />
                                Personel Düzeni
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">Kasa erişimleri, takım izinleri ve zaman çizelgeleri</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link href="/admin/staff-dashboard" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-blue-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('personel') || 'Personel'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('personel_listesi_ve_yonetimi') || 'Ekip listesi yönetimi'}</p>
                                    </div>
                                </Link>

                                <Link href="/admin/staff-shifts" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-teal-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500 group-hover:scale-110 transition-transform">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('shifts') || 'Vardiya Yönetimi'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('vardiya_planlama_ve_takibi') || 'Kasaya giriş çıkış analizleri'}</p>
                                    </div>
                                </Link>
                            </div>
                        </section>

                        {/* BÖLÜM 4: HESABIM & DONANIM */}
                        <section>
                            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-muted-foreground" />
                                Abonelik & Donanım
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">Faturalandırma döngüleri ve fiziksel donanımlar</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link href="/admin/subscription" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-violet-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-transform">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('abonelik_plan') || 'Abonelik Paketi'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('abonelik_plani_ve_ozellikler') || 'Mevcut plan özellikleri'}</p>
                                    </div>
                                </Link>

                                <Link href="/admin/invoices" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-amber-600/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-amber-600/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">{t('faturalarim') || 'Faturalar'}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('platform_faturalari_ve_abonelik_odemeler') || 'Platform makbuzları'}</p>
                                    </div>
                                </Link>

                                <Link href="/admin/settings/printer" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-cyan-500/50 hover:bg-accent transition-all group shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                                        <Printer className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">Bon-Drucker</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Yazıcı konfigürasyonları</p>
                                    </div>
                                </Link>
                            </div>
                        </section>

                    </div>
                )}

                {/* GÖRÜNÜM AYARLARI (APPEARANCE) */}
                <section className="mb-12">
                    <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-muted-foreground" />
                        {t('gorunum') || 'Arayüz Tercihleri'}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">{t('ekran_goruntusu_tercihleri') || 'Sistem geneli tema ayarınız'}</p>
                    
                    {mounted && (
                        <div className="grid grid-cols-3 gap-3">
                            <button onClick={() => setTheme('system')} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${theme === 'system' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-card hover:bg-accent text-foreground'}`}>
                                <Settings2 className="w-6 h-6 mb-2" />
                                <span className="text-xs font-semibold">{t('otomatik') || 'Sistem'}</span>
                            </button>
                            <button onClick={() => setTheme('light')} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${theme === 'light' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-card hover:bg-accent text-foreground'}`}>
                                <Sun className="w-6 h-6 mb-2" />
                                <span className="text-xs font-semibold">{t('aydinlik') || 'Gündüz'}</span>
                            </button>
                            <button onClick={() => setTheme('dark')} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-card hover:bg-accent text-foreground'}`}>
                                <Moon className="w-6 h-6 mb-2" />
                                <span className="text-xs font-semibold">{t('karanlik') || 'Gece'}</span>
                            </button>
                        </div>
                    )}
                </section>


                {/* SUPER ADMIN - KERMES YÖNETİMİ */}
                {admin?.adminType === 'super' && (
                    <section className="mb-10 pt-10 border-t border-border">
                        <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-pink-500">
                            <Tent className="w-5 h-5" />
                            Kermes Ekosistem Ayarları
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">Super Admin yetkisi altındaki global kermes operasyonları</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link href="/admin/settings/kermes-menus" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-pink-500/50 hover:bg-accent transition-all group shadow-sm">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                                    <Utensils className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-foreground">Kermes Menüleri</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Etkinliklere özel ürün paketleri</p>
                                </div>
                            </Link>

                            <Link href="/admin/settings/kermes-features" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-pink-500/50 hover:bg-accent transition-all group shadow-sm">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-foreground">Özellik & Cihazlar</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Donanım izinleri ve flaglar</p>
                                </div>
                            </Link>

                            <Link href="/admin/settings/donation-funds" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-pink-500/50 hover:bg-accent transition-all group shadow-sm">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                                    <HandHeart className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-foreground">Bağış Fonları</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Checkout yuvarlama projeleri</p>
                                </div>
                            </Link>

                            <Link href="/admin/settings/kermes-gender-types" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-pink-500/50 hover:bg-accent transition-all group shadow-sm">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-foreground">Bölüm Tipleri</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Kadın/Erkek vb. alan yönlendirmeleri</p>
                                </div>
                            </Link>

                            <Link href="/admin/settings/kermes-stock-images" className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-pink-500/50 hover:bg-accent transition-all group shadow-sm">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                                    <ImageIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-foreground">Stok Afişleri</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Hazır banner şablonları galerisi</p>
                                </div>
                            </Link>
                        </div>
                    </section>
                )}


                {/* SUPER ADMIN - IOT EINSTELLUNGEN */}
                {admin?.adminType === 'super' && (
                    <section className="mb-10 pt-8 border-t border-border">
                        <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-cyan-500">
                            <Settings2 className="w-5 h-5" />
                            IoT & Haberleşme
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">Donanım köprüleri, API ve bildirim sunucuları</p>

                        <div className="space-y-3">
                            <Link href="/admin/settings/iot" className="flex items-center justify-between p-4 bg-card rounded-xl hover:bg-accent transition-colors border border-border group shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                                        <Settings2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">IoT-Gateway Merkezi</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Alexa, LED & Browser-Sound entegrasyonu</p>
                                    </div>
                                </div>
                                <span className="text-muted-foreground group-hover:text-foreground transition">→</span>
                            </Link>

                            <Link href="/admin/settings/api-keys" className="flex items-center justify-between p-4 bg-card rounded-xl hover:bg-accent transition-colors border border-border group shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Sistem API-Schluessel</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Şifreli Token & Harici Gateway yetkileri</p>
                                    </div>
                                </div>
                                <span className="text-muted-foreground group-hover:text-foreground transition">→</span>
                            </Link>

                            <Link href="/admin/settings/notification-sound" className="flex items-center justify-between p-4 bg-card rounded-xl hover:bg-accent transition-colors border border-border group shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                                        <Sun className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Cloud Bildirim Sesleri</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Push-Benachrichtigungston ayarları</p>
                                    </div>
                                </div>
                                <span className="text-muted-foreground group-hover:text-foreground transition">→</span>
                            </Link>

                            <Link href="/admin/settings/printer" className="flex items-center justify-between p-4 bg-card rounded-xl hover:bg-accent transition-colors border border-border group shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                                        <Printer className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Kasa Bon-Drucker</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">IP-Adresse, Port und lokales Netzwerk</p>
                                    </div>
                                </div>
                                <span className="text-muted-foreground group-hover:text-foreground transition">→</span>
                            </Link>
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
}
