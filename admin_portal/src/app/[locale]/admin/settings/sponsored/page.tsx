'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

export default function SponsoredProductsSettingsPage() {
 const t = useTranslations('AdminSettings');
 const { admin } = useAdmin();

 // Form State — Sponsored Products
 const [sponsoredEnabled, setSponsoredEnabled] = useState(true);
 const [feePerConversion, setFeePerConversion] = useState(0.40);
 const [maxProductsPerBusiness, setMaxProductsPerBusiness] = useState(5);
 const [sponsoredLoading, setSponsoredLoading] = useState(false);
 const [sponsoredSuccess, setSponsoredSuccess] = useState(false);

 // Load sponsored settings from Firestore
 useEffect(() => {
 const loadSponsoredSettings = async () => {
 try {
 const sponsoredDoc = await getDoc(doc(db, 'platformSettings', 'sponsored'));
 if (sponsoredDoc.exists()) {
 const data = sponsoredDoc.data();
 setSponsoredEnabled(data.enabled ?? true);
 setFeePerConversion(data.feePerConversion ?? 0.40);
 setMaxProductsPerBusiness(data.maxProductsPerBusiness ?? 5);
 }
 } catch (error) {
 console.error('Error loading sponsored settings:', error);
 }
 };
 loadSponsoredSettings();
 }, []);

 const handleSaveSponsored = async () => {
 if (!admin?.id) return;
 setSponsoredLoading(true);
 try {
 await setDoc(doc(db, 'platformSettings', 'sponsored'), {
 enabled: sponsoredEnabled,
 feePerConversion,
 maxProductsPerBusiness,
 updatedAt: serverTimestamp(),
 updatedBy: admin.id,
 }, { merge: true });
 setSponsoredSuccess(true);
 setTimeout(() => setSponsoredSuccess(false), 3000);
 } catch (error) {
 console.error('Error saving sponsored settings:', error);
 alert(t('hata_olustu'));
 } finally {
 setSponsoredLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
 <div className="max-w-3xl mx-auto">
 {/* Breadcrumb */}
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
 <Link href="/admin/settings" className="hover:text-white transition">⚙️ {t('settings') || 'Ayarlar'}</Link>
 <span>›</span>
 <span className="text-foreground">⭐ {t('one_cikan_urunler_sponsored')}</span>
 </div>

 <div className="bg-card border border-border rounded-2xl p-8">
 <div className="flex items-center gap-3 mb-6">
 <span className="text-3xl">⭐</span>
 <div>
 <h2 className="text-xl font-bold">{t('one_cikan_urunler_sponsored')}</h2>
 <p className="text-muted-foreground text-sm">{t('i_sletmelerin_sepette_urunlerini_tanitma')}</p>
 </div>
 </div>

 <div className="space-y-6">
 {/* Global Toggle */}
 <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
 <div>
 <h3 className="font-bold">{t('ozelligi_aktif_et')}</h3>
 <p className="text-xs text-muted-foreground/80">{t('tum_isletmeler_icin_bir_sey_mi_unuttun_b')}</p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input type="checkbox" checked={sponsoredEnabled} onChange={e => setSponsoredEnabled(e.target.checked)} className="sr-only peer" />
 <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
 </label>
 </div>

 {/* Fee Per Conversion */}
 <div className={`${!sponsoredEnabled && 'opacity-50'}`}>
 <label className="block text-sm font-bold mb-2">{t('siparis_basi_ucret')}</label>
 <div className="flex items-center gap-3">
 <input
 type="number"
 step="0.01"
 min="0"
 value={feePerConversion}
 onChange={e => setFeePerConversion(parseFloat(e.target.value) || 0)}
 className="w-32 bg-background border border-gray-600 rounded-lg p-3 text-white focus:border-amber-500 outline-none font-mono text-lg text-center"
 disabled={!sponsoredEnabled}
 />
 <span className="text-muted-foreground text-sm">€ / {t('siparis')}</span>
 </div>
 <p className="text-xs text-muted-foreground/80 mt-2">
 {t('sponsored_urun_uzerinden_siparis_geldigi')}
 </p>
 </div>

 {/* Max Products Per Business */}
 <div className={`${!sponsoredEnabled && 'opacity-50'}`}>
 <label className="block text-sm font-bold mb-2">{t('i_sletme_basi_max_urun_sayisi')}</label>
 <div className="flex items-center gap-3">
 <input
 type="number"
 min="1"
 max="20"
 value={maxProductsPerBusiness}
 onChange={e => setMaxProductsPerBusiness(parseInt(e.target.value) || 5)}
 className="w-24 bg-background border border-gray-600 rounded-lg p-3 text-white focus:border-amber-500 outline-none font-mono text-lg text-center"
 disabled={!sponsoredEnabled}
 />
 <span className="text-muted-foreground text-sm">{t('urun')}</span>
 </div>
 <p className="text-xs text-muted-foreground/80 mt-2">
 {t('bir_isletmenin_one_cikan_olarak_secebile')}
 </p>
 </div>

 {/* Preview */}
 {sponsoredEnabled && (
 <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl">
 <p className="text-amber-300 text-sm font-medium">{t('onizleme')}</p>
 <p className="text-amber-200/70 text-xs mt-1">
 {t('her_isletme_max')} <strong>{maxProductsPerBusiness}</strong> {t('urun_secebilir_sponsored_urun_uzerinden_')} <strong>{feePerConversion.toFixed(2)} €</strong> {t('ucret_kesilir')}
 </p>
 </div>
 )}

 {/* How it works info */}
 <div className="p-4 bg-blue-950/30 border border-blue-800/40 rounded-xl">
 <p className="text-blue-300 text-sm font-bold mb-2">ℹ️ {t('nasil_calisir') || 'Nasıl çalışır?'}</p>
 <ul className="text-blue-200/70 text-xs space-y-1 list-disc list-inside">
 <li>{t('isletmeler_urun_yonetiminden_one_cikan_u') || 'İşletmeler ürün yönetiminden öne çıkan ürün seçer'}</li>
 <li>{t('musteri_sepette_bir_sey_mi_unuttun_alani') || 'Müşteri sepette "Bir şey mi unuttun?" alanında bu ürünleri görür'}</li>
 <li>{t('musteri_bu_urunlerden_sepete_ekleyip_sip') || 'Müşteri bu ürünlerden sepete ekleyip sipariş verirse conversion kaydedilir'}</li>
 </ul>
 </div>
 </div>

 <button
 onClick={handleSaveSponsored}
 disabled={sponsoredLoading || !sponsoredEnabled}
 className="w-full mt-6 bg-amber-600 hover:bg-amber-500 text-foreground font-bold py-4 rounded-xl transition shadow-lg shadow-amber-900/20 disabled:opacity-50"
 >
 {sponsoredLoading ? t('kaydediliyor') || 'Kaydediliyor...' : sponsoredSuccess ? '✅ Kaydedildi!' : t('sponsored_ayarlarini_kaydet')}
 </button>
 </div>
 </div>
 </div>
 );
}
