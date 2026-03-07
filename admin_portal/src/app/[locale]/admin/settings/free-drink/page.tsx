'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

export default function FreeDrinkSettingsPage() {
    const t = useTranslations('AdminSettings');
    const { admin } = useAdmin();

    // Form State — Free Drink Promotion
    const [freeDrinkEnabled, setFreeDrinkEnabled] = useState(true);
    const [maxDrinksPerOrder, setMaxDrinksPerOrder] = useState(1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Load settings from Firestore
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'platformSettings', 'freeDrink'));
                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setFreeDrinkEnabled(data.enabled ?? true);
                    setMaxDrinksPerOrder(data.maxDrinksPerOrder ?? 1);
                }
            } catch (error) {
                console.error('Error loading free drink settings:', error);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (!admin?.id) return;
        setLoading(true);
        try {
            await setDoc(doc(db, 'platformSettings', 'freeDrink'), {
                enabled: freeDrinkEnabled,
                maxDrinksPerOrder,
                updatedAt: serverTimestamp(),
                updatedBy: admin.id,
            }, { merge: true });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving free drink settings:', error);
            alert(t('hata_olustu') || 'Hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-3xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                    <Link href="/admin/settings" className="hover:text-white transition">⚙️ {t('settings') || 'Ayarlar'}</Link>
                    <span>›</span>
                    <span className="text-white">🥤 {t('gratis_icecek') || 'Gratis İçecek'}</span>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-3xl">🥤</span>
                        <div>
                            <h2 className="text-xl font-bold">{t('gratis_icecek') || 'Gratis İçecek'}</h2>
                            <p className="text-gray-400 text-sm">{t('gratis_icecek_desc') || 'Her siparişe 1 içecek bedava — platformun USP özelliği'}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Global Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                            <div>
                                <h3 className="font-bold">{t('ozelligi_aktif_et') || 'Özelliği Aktif Et'}</h3>
                                <p className="text-xs text-gray-500">{t('gratis_icecek_toggle_desc') || 'Tüm işletmelerde sepette bedava içecek bölümü gösterilir'}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={freeDrinkEnabled} onChange={e => setFreeDrinkEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>

                        {/* Max Drinks Per Order */}
                        <div className={`${!freeDrinkEnabled && 'opacity-50'}`}>
                            <label className="block text-sm font-bold mb-2">{t('siparis_basi_max_icecek') || 'Sipariş başı max bedava içecek'}</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={maxDrinksPerOrder}
                                    onChange={e => setMaxDrinksPerOrder(parseInt(e.target.value) || 1)}
                                    className="w-24 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none font-mono text-lg text-center"
                                    disabled={!freeDrinkEnabled}
                                />
                                <span className="text-gray-400 text-sm">{t('icecek_siparis') || 'İçecek / Sipariş'}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {t('gratis_icecek_max_desc') || 'Müşteri her siparişte bu kadar bedava içecek seçebilir'}
                            </p>
                        </div>

                        {/* Preview */}
                        {freeDrinkEnabled && (
                            <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
                                <p className="text-emerald-300 text-sm font-medium">{t('onizleme') || 'Önizleme'}</p>
                                <p className="text-emerald-200/70 text-xs mt-1">
                                    {t('gratis_icecek_preview_1') || 'Müşteriler sepetlerinde'} <strong>{maxDrinksPerOrder}</strong> {t('gratis_icecek_preview_2') || 'adet bedava içecek seçebilir. İçecek kategorisindeki tüm ürünler sunulur.'}
                                </p>
                            </div>
                        )}

                        {/* How it works info */}
                        <div className="p-4 bg-blue-950/30 border border-blue-800/40 rounded-xl">
                            <p className="text-blue-300 text-sm font-bold mb-2">ℹ️ {t('nasil_calisir') || 'Nasıl çalışır?'}</p>
                            <ul className="text-blue-200/70 text-xs space-y-1 list-disc list-inside">
                                <li>{t('gratis_icecek_info_1') || 'Müşteri sepete ürün ekledikten sonra İçecek kategorisinden bedava seçim yapar'}</li>
                                <li>{t('gratis_icecek_info_2') || 'Seçilen içecek 0,00 € ile sepete eklenir, orijinal fiyat üstü çizili gösterilir'}</li>
                                <li>{t('gratis_icecek_info_3') || 'Siparişte \"Gratis İçecek\" olarak işaretlenir, işletme siparişi hazırlarken görür'}</li>
                                <li>{t('gratis_icecek_info_4') || 'İçecek maliyeti platform tarafından karşılanır (restoran komisyon farkından düşülür)'}</li>
                            </ul>
                        </div>

                        {/* USP Marketing Info */}
                        <div className="p-4 bg-purple-950/30 border border-purple-800/40 rounded-xl">
                            <p className="text-purple-300 text-sm font-bold mb-2">🎯 {t('pazarlama_notu') || 'Pazarlama Notu'}</p>
                            <p className="text-purple-200/70 text-xs">
                                {t('gratis_icecek_usp') || '\"LOKMA\'da her siparişe 1 içecek bedava!\" — Bu özellik, rakiplerden farklı olarak platform tarafından yönetilir ve tüm işletmelerde geçerlidir. App Store, Google Play ve sosyal medya kampanyalarında USP olarak kullanılabilir.'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                    >
                        {loading ? t('kaydediliyor') || 'Kaydediliyor...' : success ? '✅ Kaydedildi!' : t('gratis_icecek_kaydet') || 'Gratis İçecek Ayarlarını Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}
