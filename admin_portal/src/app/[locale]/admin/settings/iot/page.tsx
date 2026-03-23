'use client';

import { useState, useEffect } from 'react';
import { testPrint as testPrinterPrint, PrinterSettings, DEFAULT_PRINTER_SETTINGS } from '@/services/printerService';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

export default function IoTSettingsPage() {
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

    // Printer State
    const [printerEnabled, setPrinterEnabled] = useState(false);
    const [printerIp, setPrinterIp] = useState('');
    const [printerPort, setPrinterPort] = useState(9100);
    const [autoPrint, setAutoPrint] = useState(false);
    const [printCopies, setPrintCopies] = useState(1);
    const [printTestLoading, setPrintTestLoading] = useState(false);
    const [printTestResult, setPrintTestResult] = useState<string | null>(null);

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
        if (admin?.printerSettings) {
            const ps = admin.printerSettings;
            setPrinterEnabled(ps.enabled ?? false);
            setPrinterIp(ps.printerIp || '');
            setPrinterPort(ps.printerPort || 9100);
            setAutoPrint(ps.autoPrint ?? false);
            setPrintCopies(ps.printCopies || 1);
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
                },
                printerSettings: {
                    enabled: printerEnabled,
                    printerIp,
                    printerPort,
                    autoPrint,
                    printCopies,
                }
            });

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
                    },
                    printerSettings: {
                        enabled: printerEnabled,
                        printerIp,
                        printerPort,
                        autoPrint,
                        printCopies,
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

    return (
        <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
            <div className="max-w-3xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Link href="/admin/settings" className="hover:text-white transition">⚙️ {t('settings') || 'Ayarlar'}</Link>
                    <span>›</span>
                    <span className="text-foreground">🔔 {t('akilli_bildirimler_iot_gateway')}</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-3xl">🔔</span>
                        <div>
                            <h2 className="text-xl font-bold">{t('akilli_bildirimler_iot_gateway')}</h2>
                            <p className="text-muted-foreground text-sm">{t('siparis_geldiginde_alexa_dan_ses_led_den')}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Master Toggle */}
                        <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                            <div>
                                <h3 className="font-bold">{t('sistemi_aktif_et')}</h3>
                                <p className="text-xs text-gray-500">{t('tum_iot_bildirimlerini_acar_kapatir')}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={smartEnabled} onChange={e => setSmartEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card dark:bg-slate-800 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        {/* Gateway URL */}
                        <div className={`${!smartEnabled && 'opacity-50'}`}>
                            <label className="block text-sm font-bold mb-2">🌐 Gateway Sunucu Adresi</label>
                            <input
                                type="text"
                                value={gatewayUrl}
                                onChange={e => setGatewayUrl(e.target.value)}
                                className="w-full bg-background border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
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
                                className="w-full bg-background border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                placeholder="gizli-api-anahtari"
                                disabled={!smartEnabled}
                            />
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-bold text-foreground mb-3">{t('cihaz_ayarlari')}</p>
                        </div>

                        {/* Device Toggles — 2x2 Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">📢 Alexa Duyuru</span>
                                    <p className="text-xs text-gray-500">{t('tts_ile_sesli_siparis_bildirimi')}</p>
                                </div>
                                <input type="checkbox" checked={alexaEnabled} onChange={e => setAlexaEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-blue-500 w-5 h-5" />
                            </label>

                            <label className={`flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">{t('led_serit')}</span>
                                    <p className="text-xs text-gray-500">{t('wled_kayitli_led_flash')}</p>
                                </div>
                                <input type="checkbox" checked={ledEnabled} onChange={e => setLedEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                            </label>

                            <label className={`flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">{t('tarayici_sesi')}</span>
                                    <p className="text-xs text-gray-500">{t('admin_panelde_gong_calar')}</p>
                                </div>
                                <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                            </label>

                            <label className={`flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">🚨 Ekran Flash</span>
                                    <p className="text-xs text-gray-500">{t('kirmizi_ekran_yanip_soner')}</p>
                                </div>
                                <input type="checkbox" checked={flashScreen} onChange={e => setFlashScreen(e.target.checked)} disabled={!smartEnabled} className="accent-red-500 w-5 h-5" />
                            </label>
                        </div>

                        {/* Alexa Language Selector */}
                        {alexaEnabled && smartEnabled && (
                            <div className="p-4 bg-background rounded-xl border border-border">
                                <label className="block text-sm font-bold mb-2">🗣️ Alexa Duyuru Dili</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setAlexaLanguage('de')}
                                        className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${alexaLanguage === 'de' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-gray-700'}`}
                                    >
                                        🇩🇪 Almanca
                                    </button>
                                    <button
                                        onClick={() => setAlexaLanguage('tr')}
                                        className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${alexaLanguage === 'tr' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-gray-700'}`}
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
                            <div className="p-4 bg-background rounded-xl border border-border">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-bold">{t('alexa_baglantisi')}</label>
                                    {alexaStatusLoading ? (
                                        <span className="text-xs text-muted-foreground">⏳ Kontrol ediliyor...</span>
                                    ) : alexaStatus?.connected ? (
                                        <span className="text-xs text-green-800 dark:text-green-400 font-bold">{t('bagli')}</span>
                                    ) : (
                                        <span className="text-xs text-red-800 dark:text-red-400 font-bold">{t('bagli_degil')}</span>
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
                                            className="text-sm text-red-800 dark:text-red-400 hover:text-red-300 underline"
                                        >
                                            {t('baglantiyi_kaldir')}
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        {!showAlexaSetup ? (
                                            <button
                                                onClick={() => setShowAlexaSetup(true)}
                                                className="w-full bg-purple-600 hover:bg-purple-500 text-foreground font-bold py-3 rounded-lg transition text-sm"
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
                                                    className="w-full bg-card border border-gray-600 rounded-lg p-3 text-white text-xs font-mono h-24 focus:border-purple-500 outline-none resize-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleAlexaConnect}
                                                        disabled={alexaConnecting || !alexaCookie.trim()}
                                                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-foreground font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
                                                    >
                                                        {alexaConnecting ? t('baglaniyor') : t('bagla')}
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowAlexaSetup(false); setAlexaCookie(''); }}
                                                        className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 font-bold py-2.5 rounded-lg transition text-sm"
                                                    >
                                                        {t('iptal') || 'İptal'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {alexaMessage && (
                                    <p className={`text-sm mt-3 ${alexaMessage.startsWith('✅') ? 'text-green-800 dark:text-green-400' : alexaMessage.startsWith('🔌') ? 'text-yellow-800 dark:text-yellow-400' : 'text-red-800 dark:text-red-400'}`}>
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
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-foreground font-bold py-3 rounded-lg transition disabled:opacity-50"
                                >
                                    {testLoading ? t('gonderiliyor') : t('test_bildirimi_gonder')}
                                </button>
                                {testResult && (
                                    <p className={`text-sm mt-2 text-center ${testResult.startsWith('✅') ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                                        {testResult}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ═══════════ PRINTER SECTION ═══════════ */}
                        <div className="border-t border-border pt-6 mt-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-3xl">🖨️</span>
                                <div>
                                    <h2 className="text-xl font-bold">{t('yazici_ayarlari') || 'Yazıcı Ayarları'}</h2>
                                    <p className="text-muted-foreground text-sm">{t('termal_bondrucker_wifi_uzerinden') || 'Termal bon yazıcı (WiFi üzerinden)'}</p>
                                </div>
                            </div>

                            {/* Printer Enable */}
                            <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border mb-4">
                                <div>
                                    <h3 className="font-bold">{t('yazici_aktif') || 'Yazıcıyı Aktif Et'}</h3>
                                    <p className="text-xs text-gray-500">{t('siparisler_icin_bon_yazdirma') || 'Siparişler için bon yazdırma'}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={printerEnabled} onChange={e => setPrinterEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card dark:bg-slate-800 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            {printerEnabled && (
                                <div className="space-y-4">
                                    {/* Printer IP */}
                                    <div>
                                        <label className="block text-sm font-bold mb-2">📡 {t('yazici_ip_adresi') || 'Yazıcı IP Adresi'}</label>
                                        <input
                                            type="text"
                                            value={printerIp}
                                            onChange={e => setPrinterIp(e.target.value)}
                                            className="w-full bg-background border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                            placeholder="192.168.1.100"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">{t('yazici_wifi_ip') || 'Yazıcının WiFi ağındaki IP adresi (Yazıcı ayarlarından öğrenebilirsiniz)'}</p>
                                    </div>

                                    {/* Printer Port */}
                                    <div>
                                        <label className="block text-sm font-bold mb-2">🔌 {t('port') || 'Port'}</label>
                                        <input
                                            type="number"
                                            value={printerPort}
                                            onChange={e => setPrinterPort(parseInt(e.target.value) || 9100)}
                                            className="w-full bg-background border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                            placeholder="9100"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">{t('standart_port_9100') || 'Standart ESC/POS port: 9100'}</p>
                                    </div>

                                    {/* Auto Print & Copies Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer">
                                            <div>
                                                <span className="font-bold text-sm">⚡ {t('otomatik_yazdir') || 'Otomatik Yazdır'}</span>
                                                <p className="text-xs text-gray-500">{t('yeni_siparis_gelince_otomatik') || 'Yeni sipariş gelince otomatik bas'}</p>
                                            </div>
                                            <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} className="accent-blue-500 w-5 h-5" />
                                        </label>

                                        <div className="p-4 bg-background rounded-xl border border-border">
                                            <span className="font-bold text-sm">📋 {t('kopya_sayisi') || 'Kopya Sayısı'}</span>
                                            <p className="text-xs text-gray-500 mb-2">{t('mutfak_surucü_kasa') || 'Mutfak + Sürücü + Kasa'}</p>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                                                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 font-bold"
                                                >−</button>
                                                <span className="text-xl font-bold font-mono w-8 text-center">{printCopies}</span>
                                                <button
                                                    onClick={() => setPrintCopies(Math.min(5, printCopies + 1))}
                                                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 font-bold"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Test Print Button */}
                                    {printerIp && (
                                        <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl">
                                            <button
                                                onClick={async () => {
                                                    setPrintTestLoading(true);
                                                    setPrintTestResult(null);
                                                    const result = await testPrinterPrint(
                                                        { enabled: true, printerIp, printerPort, autoPrint, printCopies, printServerUrl: '' },
                                                        admin?.businessName || 'LOKMA'
                                                    );
                                                    setPrintTestResult(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                                                    setPrintTestLoading(false);
                                                }}
                                                disabled={printTestLoading}
                                                className="w-full bg-amber-600 hover:bg-amber-500 text-foreground font-bold py-3 rounded-lg transition disabled:opacity-50"
                                            >
                                                {printTestLoading ? (t('yazici_test') || 'Test ediliyor...') : `🖨️ ${t('test_yazdir') || 'Test Yazdır'}`}
                                            </button>
                                            {printTestResult && (
                                                <p className={`text-sm mt-2 text-center ${printTestResult.startsWith('✅') ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                                                    {printTestResult}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-foreground font-bold py-4 rounded-xl transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
                    >
                        {loading ? t('kaydediliyor') || 'Kaydediliyor...' : success ? '✅ Kaydedildi!' : t('iot_ayarlarini_kaydet')}
                    </button>
                </div>
            </div>
        </div>
    );
}
