'use client';

import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
 const t = useTranslations('AdminSettings');
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
 <h1 className="text-3xl font-bold mb-8">{admin?.adminType === 'super' ? 'IoT Einstellungen' : t('settings') || 'Ayarlar'}</h1>

 {/* 📋 AYARLAR MENÜSÜ - Only for non-super admins */}
 {admin?.adminType !== 'super' && (
 <div className="bg-card border border-border rounded-2xl p-8 mb-8">
 <div className="flex items-center gap-3 mb-6">
 <span className="text-3xl">📋</span>
 <div>
 <h2 className="text-xl font-bold">{t('i_sletme_yonetimi')}</h2>
 <p className="text-muted-foreground text-sm">{t('i_sletme_ayarlari_personel_masa_ve_hesap')}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Menü ve Ürünler */}
 <Link
 href="/admin/products"
 className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-emerald-600 hover:bg-emerald-950/20 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-emerald-900/50 flex items-center justify-center text-2xl group-hover:bg-emerald-800/50 transition">
 🍔
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-emerald-300 transition">{t('menu_ve_urunler')}</h3>
 <p className="text-xs text-muted-foreground/80">{t('urun_ve_kategori_yonetimi')}</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-emerald-800 dark:text-emerald-400 transition text-xl">→</span>
 </Link>

 {/* Personel */}
 <Link
 href="/admin/staff-dashboard"
 className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-slate-500 hover:bg-slate-950/20 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-slate-600/50 transition">
 👥
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-foreground transition">{t('personel') || 'Personel'}</h3>
 <p className="text-xs text-muted-foreground/80">{t('personel_listesi_ve_yonetimi')}</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-muted-foreground transition text-xl">→</span>
 </Link>

 {/* Kermes Kategorileri */}
 <Link
 href="/admin/settings/kermes-categories"
 className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-indigo-600 hover:bg-indigo-950/20 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-indigo-900/50 flex items-center justify-center text-2xl group-hover:bg-indigo-800/50 transition">
 🏷️
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-indigo-300 transition">Kategori Yönetimi</h3>
 <p className="text-xs text-muted-foreground/80">Menüler için evrensel kategoriler</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-indigo-400 transition text-xl">→</span>
 </Link>

 {/* Teslimat */}
 <Link
 href="/admin/delivery-settings"
 className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-amber-900/50 flex items-center justify-center text-2xl group-hover:bg-amber-800/50 transition">
 🚚
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-amber-300 transition">{t('teslimat') || 'Teslimat'}</h3>
 <p className="text-xs text-muted-foreground/80">{t('kurye_teslimat_ucreti_ve_siparis_saatler')}</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-amber-800 dark:text-amber-400 transition text-xl">→</span>
 </Link>

 {/* Abonelik & Plan */}
 <Link
 href="/admin/subscription"
 className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-violet-600 hover:bg-violet-950/20 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-violet-900/50 flex items-center justify-center text-2xl group-hover:bg-violet-800/50 transition">
 💳
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-violet-300 transition">{t('abonelik_plan') || 'Abonelik & Plan'}</h3>
 <p className="text-xs text-muted-foreground/80">{t('abonelik_plani_ve_ozellikler')}</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-violet-400 transition text-xl">→</span>
 </Link>

 {/* Bon Yazıcı */}
 <Link
 href="/admin/settings/printer"
 className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-cyan-600 hover:bg-cyan-950/20 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-cyan-900/50 flex items-center justify-center text-2xl group-hover:bg-cyan-800/50 transition">
 🖨️
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-cyan-300 transition">Bon-Drucker</h3>
 <p className="text-xs text-muted-foreground/80">IP-Adresse, Port und Druckerverbindung</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-cyan-800 dark:text-cyan-400 transition text-xl">→</span>
 </Link>
 </div>

 {/* Hesabım - Alt bölümler */}
 <div className="mt-6 bg-background rounded-xl border border-border p-6">
 <div className="flex items-center gap-3 mb-4">
 <span className="text-2xl">💼</span>
 <h3 className="text-lg font-bold">{t('hesabim')}</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <Link
 href="/admin/invoices"
 className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
 >
 <div className="w-10 h-10 rounded-xl bg-amber-900/50 flex items-center justify-center text-xl group-hover:bg-amber-800/50 transition">
 📄
 </div>
 <div>
 <h3 className="font-bold text-sm text-foreground group-hover:text-amber-300 transition">{t('faturalarim') || 'Faturalarım'}</h3>
 <p className="text-xs text-muted-foreground/80">{t('platform_faturalari_ve_abonelik_odemeler') || 'Platform faturaları'}</p>
 </div>
 <span className="ml-auto text-muted-foreground group-hover:text-amber-800 dark:text-amber-400 transition">→</span>
 </Link>
 </div>
 </div>
 </div>
 )}

 {/* GÖRÜNÜM AYARLARI (APPEARANCE) - Common for all Admins */}
 <div className="bg-card border border-border rounded-2xl p-8 mb-8">
 <div className="flex items-center gap-3 mb-6">
 <span className="text-3xl">🎨</span>
 <div>
 <h2 className="text-xl font-bold">{t('gorunum') || 'Görünüm Ayarları'}</h2>
 <p className="text-muted-foreground text-sm">{t('ekran_goruntusu_tercihleri') || 'Ekran görüntüsünü Otomatik, Aydınlık veya Karanlık olarak belirleyin'}</p>
 </div>
 </div>
 {mounted && (
 <div className="flex flex-wrap gap-4">
 <button
 onClick={() => setTheme('system')}
 className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-card text-foreground'}`}
 >
 <div className="text-2xl mb-2">⚙️</div>
 <div className="font-semibold">{t('otomatik') || 'Otomatik'}</div>
 </button>
 <button
 onClick={() => setTheme('light')}
 className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-card text-foreground'}`}
 >
 <div className="text-2xl mb-2">☀️</div>
 <div className="font-semibold">{t('aydinlik') || 'Gündüz'}</div>
 </button>
 <button
 onClick={() => setTheme('dark')}
 className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-card text-foreground'}`}
 >
 <div className="text-2xl mb-2">🌙</div>
 <div className="font-semibold">{t('karanlik') || 'Gece'}</div>
 </button>
 </div>
 )}
 </div>

 
  {/* SUPER ADMIN - Kermes Einstellungen */}
  {admin?.adminType === 'super' && (
  <div className="mb-8 bg-card border border-border rounded-2xl p-8">
  <div className="flex items-center gap-3 mb-6">
    <span className="text-3xl">🎪</span>
    <div>
      <h2 className="text-xl font-bold">Kermes Yönetim Ayarları</h2>
      <p className="text-muted-foreground text-sm">Tüm platformdaki kermes altyapısını yönetin</p>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Link
      href="/admin/settings/kermes-menus"
      className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-pink-600 hover:bg-pink-950/20 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-pink-900/50 flex items-center justify-center text-2xl group-hover:bg-pink-800/50 transition">
        🍔
      </div>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-pink-300 transition">Kermes Menüleri</h3>
        <p className="text-xs text-muted-foreground/80">Kermeslere özel ürün paketleri</p>
      </div>
      <span className="ml-auto text-muted-foreground group-hover:text-pink-400 transition text-xl">→</span>
    </Link>
    <Link
      href="/admin/settings/kermes-features"
      className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-pink-600 hover:bg-pink-950/20 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-pink-900/50 flex items-center justify-center text-2xl group-hover:bg-pink-800/50 transition">
        🏷️
      </div>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-pink-300 transition">Kermes Özellikleri</h3>
        <p className="text-xs text-muted-foreground/80">Filtre ve donanım etiketleri</p>
      </div>
      <span className="ml-auto text-muted-foreground group-hover:text-pink-400 transition text-xl">→</span>
    </Link>
    <Link
      href="/admin/settings/donation-funds"
      className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-pink-600 hover:bg-pink-950/20 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-pink-900/50 flex items-center justify-center text-2xl group-hover:bg-pink-800/50 transition">
        🤝
      </div>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-pink-300 transition">Bağış Fonları</h3>
        <p className="text-xs text-muted-foreground/80">Checkout bağış projeleri</p>
      </div>
      <span className="ml-auto text-muted-foreground group-hover:text-pink-400 transition text-xl">→</span>
    </Link>
    <Link
      href="/admin/settings/kermes-gender-types"
      className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-pink-600 hover:bg-pink-950/20 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-pink-900/50 flex items-center justify-center text-2xl group-hover:bg-pink-800/50 transition">
        👥
      </div>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-pink-300 transition">Bölüm Tipleri</h3>
        <p className="text-xs text-muted-foreground/80">Kadın/Erkek vb. tahsisler</p>
      </div>
      <span className="ml-auto text-muted-foreground group-hover:text-pink-400 transition text-xl">→</span>
    </Link>
    <Link
      href="/admin/settings/kermes-stock-images"
      className="flex items-center gap-4 p-5 bg-background rounded-xl border border-border hover:border-pink-600 hover:bg-pink-950/20 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-pink-900/50 flex items-center justify-center text-2xl group-hover:bg-pink-800/50 transition">
        🖼️
      </div>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-pink-300 transition">Stok Görseller</h3>
        <p className="text-xs text-muted-foreground/80">Hazır banner arşivleri</p>
      </div>
      <span className="ml-auto text-muted-foreground group-hover:text-pink-400 transition text-xl">→</span>
    </Link>
  </div>
  </div>
  )}

  {/* SUPER ADMIN - IoT Einstellungen */}
 {admin?.adminType === 'super' && (
 <div className="mb-8">
 <h2 className="text-lg font-semibold text-foreground mb-1">IoT Einstellungen</h2>
 <p className="text-muted-foreground/80 text-sm mb-6">IoT-Gateway, API, Drucker und Benachrichtigungen</p>

 <div className="space-y-2">
 <Link
 href="/admin/settings/iot"
 className="flex items-center justify-between p-4 bg-card rounded-lg hover:bg-gray-750 transition-colors group"
 >
 <div>
 <h3 className="text-sm font-medium text-foreground">IoT-Gateway</h3>
 <p className="text-xs text-muted-foreground/80 mt-0.5">Alexa, LED, Browser-Sound Einstellungen</p>
 </div>
 <span className="text-muted-foreground group-hover:text-muted-foreground transition">&#8250;</span>
 </Link>

 <Link
 href="/admin/settings/api-keys"
 className="flex items-center justify-between p-4 bg-card rounded-lg hover:bg-gray-750 transition-colors group"
 >
 <div>
 <h3 className="text-sm font-medium text-foreground">API-Schluessel</h3>
 <p className="text-xs text-muted-foreground/80 mt-0.5">Verschluesselte API-Schluesselverwaltung</p>
 </div>
 <span className="text-muted-foreground group-hover:text-muted-foreground transition">&#8250;</span>
 </Link>

 <Link
 href="/admin/settings/notification-sound"
 className="flex items-center justify-between p-4 bg-card rounded-lg hover:bg-gray-750 transition-colors group"
 >
 <div>
 <h3 className="text-sm font-medium text-foreground">Benachrichtigungston</h3>
 <p className="text-xs text-muted-foreground/80 mt-0.5">Push-Benachrichtigungston konfigurieren</p>
 </div>
 <span className="text-muted-foreground group-hover:text-muted-foreground transition">&#8250;</span>
 </Link>

 <Link
 href="/admin/settings/printer"
 className="flex items-center justify-between p-4 bg-card rounded-lg hover:bg-gray-750 transition-colors group"
 >
 <div>
 <h3 className="text-sm font-medium text-foreground">Bon-Drucker</h3>
 <p className="text-xs text-muted-foreground/80 mt-0.5">IP-Adresse, Port und Druckerverbindung</p>
 </div>
 <span className="text-muted-foreground group-hover:text-muted-foreground transition">&#8250;</span>
 </Link>
 </div>
 </div>
 )}

 </div>
 </div>
 );
}
