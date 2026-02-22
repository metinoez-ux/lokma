'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

export default function SettingsPage() {
    
  const t = useTranslations('AdminSettings');
const { admin } = useAdmin();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);

    // Alexa Connection State
    const [alexaCookie, setAlexaCookie] = useState('');
    const [alexaConnecting, setAlexaConnecting] = useState(false);
    const [alexaStatus, setAlexaStatus] = useState<{ connected: boolean; devices: { name: string; serialNumber: string }[] } | null>(null);
    const [alexaStatusLoading, setAlexaStatusLoading] = useState(false);
    const [alexaMessage, setAlexaMessage] = useState<string | null>(null);
    const [showAlexaSetup, setShowAlexaSetup] = useState(false);

    // Form State — IoT Gateway
    const [smartEnabled, setSmartEnabled] = useState(true);
    const [gatewayUrl, setGatewayUrl] = useState('');
    const [gatewayApiKey, setGatewayApiKey] = useState('');
    const [alexaEnabled, setAlexaEnabled] = useState(true);
    const [alexaLanguage, setAlexaLanguage] = useState<'tr' | 'de'>('de');
    const [ledEnabled, setLedEnabled] = useState(true);
    const [hueEnabled, setHueEnabled] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [flashScreen, setFlashScreen] = useState(true);

    // Form State — Sponsored Products (Öne Çıkan Ürünler)
    const [sponsoredEnabled, setSponsoredEnabled] = useState(true);
    const [feePerConversion, setFeePerConversion] = useState(0.40);
    const [maxProductsPerBusiness, setMaxProductsPerBusiness] = useState(5);
    const [sponsoredLoading, setSponsoredLoading] = useState(false);
    const [sponsoredSuccess, setSponsoredSuccess] = useState(false);

    useEffect(() => {
        if (admin?.smartNotifications) {
            const sn = admin.smartNotifications;
            setSmartEnabled(sn.enabled ?? true);
            setGatewayUrl(sn.gatewayUrl || '');
            setGatewayApiKey(sn.gatewayApiKey || '');
            setAlexaEnabled(sn.alexaEnabled ?? true);
            setAlexaLanguage(sn.alexaLanguage || 'de');
            setLedEnabled(sn.ledEnabled ?? true);
            setHueEnabled(sn.hueEnabled ?? false);
            setSoundEnabled(sn.soundEnabled ?? true);
            setFlashScreen(sn.flashScreen ?? true);
        }
    }, [admin]);

    // Check Alexa connection status when gateway URL is set
    useEffect(() => {
        if (gatewayUrl && gatewayApiKey && admin?.businessId) {
            checkAlexaStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gatewayUrl, gatewayApiKey, admin?.businessId]);

    const checkAlexaStatus = async () => {
        const businessId = admin?.businessId || admin?.id;
        if (!gatewayUrl || !gatewayApiKey || !businessId) return;
        setAlexaStatusLoading(true);
        try {
            const res = await fetch(`${gatewayUrl}/alexa/status/${businessId}`, {
                headers: { 'x-api-key': gatewayApiKey },
            });
            if (res.ok) {
                const data = await res.json();
                setAlexaStatus(data);
            }
        } catch (err) {
            console.error('Alexa status check failed:', err);
        } finally {
            setAlexaStatusLoading(false);
        }
    };

    const handleAlexaConnect = async () => {
        const businessId = admin?.businessId || admin?.id;
        if (!gatewayUrl || !gatewayApiKey || !businessId || !alexaCookie.trim()) return;
        setAlexaConnecting(true);
        setAlexaMessage(null);
        try {
            const res = await fetch(`${gatewayUrl}/alexa/setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': gatewayApiKey,
                },
                body: JSON.stringify({ businessId, cookie: alexaCookie.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setAlexaMessage(`✅ ${data.message}`);
                setAlexaCookie('');
                setShowAlexaSetup(false);
                await checkAlexaStatus();
            } else {
                setAlexaMessage(`❌ ${data.message || t('baglanti_basarisiz')}`);
            }
        } catch (err: any) {
            setAlexaMessage(`❌ Bağlantı hatası: ${err.message}`);
        } finally {
            setAlexaConnecting(false);
        }
    };

    const handleAlexaDisconnect = async () => {
        const businessId = admin?.businessId || admin?.id;
        if (!gatewayUrl || !gatewayApiKey || !businessId) return;
        if (!confirm(t('alexa_baglantisini_kaldirmak_istediginiz'))) return;
        try {
            await fetch(`${gatewayUrl}/alexa/disconnect/${businessId}`, {
                method: 'DELETE',
                headers: { 'x-api-key': gatewayApiKey },
            });
            setAlexaStatus(null);
            setAlexaMessage(t('alexa_baglantisi_kaldirildi'));
        } catch (err: any) {
            setAlexaMessage(`❌ Hata: ${err.message}`);
        }
    };

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

    const handleSave = async () => {
        if (!admin?.id) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'admins', admin.id), {
                smartNotifications: {
                    enabled: smartEnabled,
                    gatewayUrl,
                    gatewayApiKey,
                    alexaEnabled,
                    alexaLanguage,
                    ledEnabled,
                    hueEnabled,
                    soundEnabled,
                    flashScreen
                }
            });

            // Also update on the businesses collection if this admin has a businessId
            if (admin.businessId) {
                await updateDoc(doc(db, 'businesses', admin.businessId), {
                    smartNotifications: {
                        enabled: smartEnabled,
                        gatewayUrl,
                        gatewayApiKey,
                        alexaEnabled,
                        alexaLanguage,
                        ledEnabled,
                        hueEnabled,
                        soundEnabled,
                        flashScreen
                    }
                });
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error(error);
            alert(t('hata_olustu'));
        } finally {
            setLoading(false);
        }
    };

    const handleTestNotification = async () => {
        if (!gatewayUrl) {
            setTestResult(t('gateway_url_girilmemis'));
            return;
        }
        setTestLoading(true);
        setTestResult(null);
        try {
            const res = await fetch(gatewayUrl + '/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': gatewayApiKey,
                },
                body: JSON.stringify({
                    businessId: admin?.businessId || admin?.id,
                    language: alexaLanguage,
                }),
            });
            if (res.ok) {
                setTestResult(t('test_bildirimi_gonderildi_alexa_ve_led_k'));
            } else {
                setTestResult(`❌ Gateway hatası: ${res.status}`);
            }
        } catch (err: any) {
            setTestResult(`❌ Bağlantı hatası: ${err.message}`);
        } finally {
            setTestLoading(false);
        }
    };

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
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">{admin?.adminType === 'super' ? t('platform_ayarlari') : 'Ayarlar'}</h1>

                {/* 📋 AYARLAR MENÜSÜ - Only for non-super admins */}
                {admin?.adminType !== 'super' && (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">📋</span>
                            <div>
                                <h2 className="text-xl font-bold">{t('i_sletme_yonetimi')}</h2>
                                <p className="text-gray-400 text-sm">{t('i_sletme_ayarlari_personel_masa_ve_hesap')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Menü ve Ürünler */}
                            <Link
                                href="/admin/products"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-emerald-600 hover:bg-emerald-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-900/50 flex items-center justify-center text-2xl group-hover:bg-emerald-800/50 transition">
                                    🍔
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-emerald-300 transition">{t('menu_ve_urunler')}</h3>
                                    <p className="text-xs text-gray-500">{t('urun_ve_kategori_yonetimi')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-emerald-400 transition text-xl">→</span>
                            </Link>

                            {/* Personel */}
                            <Link
                                href="/admin/staff-dashboard"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-slate-500 hover:bg-slate-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-slate-600/50 transition">
                                    👥
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-slate-300 transition">Personel</h3>
                                    <p className="text-xs text-gray-500">{t('personel_listesi_ve_yonetimi')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-slate-400 transition text-xl">→</span>
                            </Link>

                            {/* Masa */}
                            <Link
                                href={`/admin/table-orders${admin?.butcherId ? `?businessId=${admin.butcherId}` : ''}`}
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-teal-600 hover:bg-teal-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-teal-900/50 flex items-center justify-center text-2xl group-hover:bg-teal-800/50 transition">
                                    🪑
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-teal-300 transition">Masa</h3>
                                    <p className="text-xs text-gray-500">{t('masa_oturumlari_ve_gruplari')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-teal-400 transition text-xl">→</span>
                            </Link>

                            {/* Teslimat */}
                            <Link
                                href="/admin/delivery-settings"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-amber-900/50 flex items-center justify-center text-2xl group-hover:bg-amber-800/50 transition">
                                    🚚
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-amber-300 transition">Teslimat</h3>
                                    <p className="text-xs text-gray-500">{t('kurye_teslimat_ucreti_ve_siparis_saatler')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition text-xl">→</span>
                            </Link>

                            {/* Abonelik & Plan */}
                            <Link
                                href="/admin/subscription"
                                className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-violet-600 hover:bg-violet-950/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-violet-900/50 flex items-center justify-center text-2xl group-hover:bg-violet-800/50 transition">
                                    💳
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-violet-300 transition">Abonelik & Plan</h3>
                                    <p className="text-xs text-gray-500">{t('abonelik_plani_ve_ozellikler')}</p>
                                </div>
                                <span className="ml-auto text-gray-600 group-hover:text-violet-400 transition text-xl">→</span>
                            </Link>
                        </div>

                        {/* Hesabım - Alt bölümler */}
                        <div className="mt-6 bg-gray-900 rounded-xl border border-gray-700 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-2xl">💼</span>
                                <h3 className="text-lg font-bold">{t('hesabim')}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Link
                                    href="/admin/invoices"
                                    className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-amber-900/50 flex items-center justify-center text-xl group-hover:bg-amber-800/50 transition">
                                        📄
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-white group-hover:text-amber-300 transition text-sm">{t('faturalarim')}</h4>
                                        <p className="text-xs text-gray-500">{t('fatura_gecmisi_ve_detaylari')}</p>
                                    </div>
                                    <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition">→</span>
                                </Link>
                                <Link
                                    href="/admin/account"
                                    className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-amber-600 hover:bg-amber-950/20 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-amber-900/50 flex items-center justify-center text-xl group-hover:bg-amber-800/50 transition">
                                        💰
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-white group-hover:text-amber-300 transition text-sm">{t('odeme_bilgileri')}</h4>
                                        <p className="text-xs text-gray-500">{t('komisyon_bakiye_ve_odeme_detaylari')}</p>
                                    </div>
                                    <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition">→</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* IOT & SMART ALERTS - Super Admin only */}
                {admin?.adminType === 'super' && (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">🔔</span>
                            <div>
                                <h2 className="text-xl font-bold">{t('akilli_bildirimler_iot_gateway')}</h2>
                                <p className="text-gray-400 text-sm">{t('siparis_geldiginde_alexa_dan_ses_led_den')}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Master Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                                <div>
                                    <h3 className="font-bold">{t('sistemi_aktif_et')}</h3>
                                    <p className="text-xs text-gray-500">{t('tum_iot_bildirimlerini_acar_kapatir')}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={smartEnabled} onChange={e => setSmartEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            {/* Gateway URL */}
                            <div className={`${!smartEnabled && 'opacity-50'}`}>
                                <label className="block text-sm font-bold mb-2">🌐 Gateway Sunucu Adresi</label>
                                <input
                                    type="text"
                                    value={gatewayUrl}
                                    onChange={e => setGatewayUrl(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                    placeholder="https://iot.lokma.shop"
                                    disabled={!smartEnabled}
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('lokma_iot_gateway_in_calistigi_sunucu_ad')}</p>
                            </div>

                            {/* API Key */}
                            <div className={`${!smartEnabled && 'opacity-50'}`}>
                                <label className="block text-sm font-bold mb-2">{t('gateway_api_key')}</label>
                                <input
                                    type="password"
                                    value={gatewayApiKey}
                                    onChange={e => setGatewayApiKey(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                    placeholder="gizli-api-anahtari"
                                    disabled={!smartEnabled}
                                />
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-700 pt-4">
                                <p className="text-sm font-bold text-gray-300 mb-3">{t('cihaz_ayarlari')}</p>
                            </div>

                            {/* Device Toggles — 2x2 Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Alexa */}
                                <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                    <div>
                                        <span className="font-bold text-sm">📢 Alexa Duyuru</span>
                                        <p className="text-xs text-gray-500">{t('tts_ile_sesli_siparis_bildirimi')}</p>
                                    </div>
                                    <input type="checkbox" checked={alexaEnabled} onChange={e => setAlexaEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-blue-500 w-5 h-5" />
                                </label>

                                {/* WLED LED */}
                                <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                    <div>
                                        <span className="font-bold text-sm">{t('led_serit')}</span>
                                        <p className="text-xs text-gray-500">{t('wled_kayitli_led_flash')}</p>
                                    </div>
                                    <input type="checkbox" checked={ledEnabled} onChange={e => setLedEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                                </label>

                                {/* Browser Sound */}
                                <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                    <div>
                                        <span className="font-bold text-sm">{t('tarayici_sesi')}</span>
                                        <p className="text-xs text-gray-500">{t('admin_panelde_gong_calar')}</p>
                                    </div>
                                    <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                                </label>

                                {/* Screen Flash */}
                                <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                    <div>
                                        <span className="font-bold text-sm">🚨 Ekran Flash</span>
                                        <p className="text-xs text-gray-500">{t('kirmizi_ekran_yanip_soner')}</p>
                                    </div>
                                    <input type="checkbox" checked={flashScreen} onChange={e => setFlashScreen(e.target.checked)} disabled={!smartEnabled} className="accent-red-500 w-5 h-5" />
                                </label>
                            </div>

                            {/* Alexa Language Selector */}
                            {alexaEnabled && smartEnabled && (
                                <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
                                    <label className="block text-sm font-bold mb-2">🗣️ Alexa Duyuru Dili</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setAlexaLanguage('de')}
                                            className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${alexaLanguage === 'de' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                        >
                                            🇩🇪 Almanca
                                        </button>
                                        <button
                                            onClick={() => setAlexaLanguage('tr')}
                                            className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${alexaLanguage === 'tr' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                        >
                                            {t('turkce')}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {t('ornek')} {alexaLanguage === 'tr'
                                            ? t('yeni_siparis_geldi_siparis_numarasi_42_t')
                                            : '"Neue Bestellung eingegangen! Bestellnummer 42, Gesamt 24 Euro 50 Cent"'
                                        }
                                    </p>
                                </div>
                            )}

                            {/* Alexa Connection Manager */}
                            {alexaEnabled && smartEnabled && gatewayUrl && gatewayApiKey && (
                                <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-bold">{t('alexa_baglantisi')}</label>
                                        {alexaStatusLoading ? (
                                            <span className="text-xs text-gray-400">⏳ Kontrol ediliyor...</span>
                                        ) : alexaStatus?.connected ? (
                                            <span className="text-xs text-green-400 font-bold">{t('bagli')}</span>
                                        ) : (
                                            <span className="text-xs text-red-400 font-bold">{t('bagli_degil')}</span>
                                        )}
                                    </div>

                                    {alexaStatus?.connected ? (
                                        <div>
                                            <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-3 mb-3">
                                                <p className="text-green-300 text-sm font-medium mb-1">{t('bagli_cihazlar')}</p>
                                                {alexaStatus.devices.length > 0 ? (
                                                    <ul className="text-green-200/70 text-xs space-y-1">
                                                        {alexaStatus.devices.map((d, i) => (
                                                            <li key={i}>• {d.name}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-green-200/70 text-xs">{t('echo_cihaz_bulundu_detaylar_yukleniyor')}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={handleAlexaDisconnect}
                                                className="text-sm text-red-400 hover:text-red-300 underline"
                                            >
                                                {t('baglantiyi_kaldir')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            {!showAlexaSetup ? (
                                                <button
                                                    onClick={() => setShowAlexaSetup(true)}
                                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition text-sm"
                                                >
                                                    {t('alexa_bagla')}
                                                </button>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-3">
                                                        <p className="text-blue-300 text-sm font-bold mb-2">{t('amazon_cookie_nasil_alinir')}</p>
                                                        <ol className="text-blue-200/70 text-xs space-y-1 list-decimal list-inside">
                                                            <li>{t('bilgisayarinizda')} <strong>alexa.amazon.de</strong> adresine gidin</li>
                                                            <li>{t('amazon_hesabinizla_giris_yapin')}</li>
                                                            <li><strong>F12</strong> {t('tusuna_basarak_devtools_acin')}</li>
                                                            <li><strong>Application</strong> → <strong>Cookies</strong> sekmesine gidin</li>
                                                            <li>{t('tum_cookie_degerlerini_kopyalayin_veya')} <strong>Console</strong> sekmesinde <code className="bg-blue-900/50 px-1 rounded">document.cookie</code> {t('yazin')}</li>
                                                            <li>{t('asagidaki_alana_yapistirin')}</li>
                                                        </ol>
                                                    </div>
                                                    <textarea
                                                        value={alexaCookie}
                                                        onChange={e => setAlexaCookie(e.target.value)}
                                                        placeholder={t('amazon_cookie_string_ini_buraya_yapistir')}
                                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white text-xs font-mono h-24 focus:border-purple-500 outline-none resize-none"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={handleAlexaConnect}
                                                            disabled={alexaConnecting || !alexaCookie.trim()}
                                                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
                                                        >
                                                            {alexaConnecting ? t('baglaniyor') : t('bagla')}
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowAlexaSetup(false); setAlexaCookie(''); }}
                                                            className="px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2.5 rounded-lg transition text-sm"
                                                        >
                                                            İptal
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {alexaMessage && (
                                        <p className={`text-sm mt-3 ${alexaMessage.startsWith('✅') ? 'text-green-400' : alexaMessage.startsWith('🔌') ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {alexaMessage}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Test Button */}
                            {smartEnabled && gatewayUrl && (
                                <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
                                    <button
                                        onClick={handleTestNotification}
                                        disabled={testLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                                    >
                                        {testLoading ? t('gonderiliyor') : t('test_bildirimi_gonder')}
                                    </button>
                                    {testResult && (
                                        <p className={`text-sm mt-2 text-center ${testResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                                            {testResult}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
                        >
                            {loading ? 'Kaydediliyor...' : success ? '✅ Kaydedildi!' : t('iot_ayarlarini_kaydet')}
                        </button>
                    </div>
                )}

                {/* 🏷️ SPONSORED PRODUCTS - Super Admin Only */}
                {admin?.adminType === 'super' && (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">⭐</span>
                            <div>
                                <h2 className="text-xl font-bold">{t('one_cikan_urunler_sponsored')}</h2>
                                <p className="text-gray-400 text-sm">{t('i_sletmelerin_sepette_urunlerini_tanitma')}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Global Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                                <div>
                                    <h3 className="font-bold">{t('ozelligi_aktif_et')}</h3>
                                    <p className="text-xs text-gray-500">{t('tum_isletmeler_icin_bir_sey_mi_unuttun_b')}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={sponsoredEnabled} onChange={e => setSponsoredEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
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
                                        className="w-32 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-amber-500 outline-none font-mono text-lg text-center"
                                        disabled={!sponsoredEnabled}
                                    />
                                    <span className="text-gray-400 text-sm">{t('siparis')}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
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
                                        className="w-24 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-amber-500 outline-none font-mono text-lg text-center"
                                        disabled={!sponsoredEnabled}
                                    />
                                    <span className="text-gray-400 text-sm">{t('urun')}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
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
                        </div>

                        <button
                            onClick={handleSaveSponsored}
                            disabled={sponsoredLoading || !sponsoredEnabled}
                            className="w-full mt-6 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-amber-900/20 disabled:opacity-50"
                        >
                            {sponsoredLoading ? 'Kaydediliyor...' : sponsoredSuccess ? '✅ Kaydedildi!' : t('sponsored_ayarlarini_kaydet')}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
