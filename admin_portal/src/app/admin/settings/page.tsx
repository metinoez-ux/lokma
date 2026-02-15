'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function SettingsPage() {
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
                setAlexaMessage(`❌ ${data.message || 'Bağlantı başarısız'}`);
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
        if (!confirm('Alexa bağlantısını kaldırmak istediğinize emin misiniz?')) return;
        try {
            await fetch(`${gatewayUrl}/alexa/disconnect/${businessId}`, {
                method: 'DELETE',
                headers: { 'x-api-key': gatewayApiKey },
            });
            setAlexaStatus(null);
            setAlexaMessage('🔌 Alexa bağlantısı kaldırıldı.');
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
            alert('Hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleTestNotification = async () => {
        if (!gatewayUrl) {
            setTestResult('❌ Gateway URL girilmemiş!');
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
                setTestResult('✅ Test bildirimi gönderildi! Alexa ve LED kontrol edin.');
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
            alert('Hata oluştu');
        } finally {
            setSponsoredLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Platform Ayarları</h1>

                {/* IOT & SMART ALERTS */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-3xl">🔔</span>
                        <div>
                            <h2 className="text-xl font-bold">Akıllı Bildirimler (IoT Gateway)</h2>
                            <p className="text-gray-400 text-sm">Sipariş geldiğinde Alexa&apos;dan ses + LED&apos;den ışık bildirimi.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Master Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                            <div>
                                <h3 className="font-bold">Sistemi Aktif Et</h3>
                                <p className="text-xs text-gray-500">Tüm IoT bildirimlerini açar/kapatır.</p>
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
                            <p className="text-xs text-gray-500 mt-1">LOKMA IoT Gateway&apos;in çalıştığı sunucu adresi.</p>
                        </div>

                        {/* API Key */}
                        <div className={`${!smartEnabled && 'opacity-50'}`}>
                            <label className="block text-sm font-bold mb-2">🔑 Gateway API Key</label>
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
                            <p className="text-sm font-bold text-gray-300 mb-3">📡 Cihaz Ayarları</p>
                        </div>

                        {/* Device Toggles — 2x2 Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Alexa */}
                            <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">📢 Alexa Duyuru</span>
                                    <p className="text-xs text-gray-500">TTS ile sesli sipariş bildirimi</p>
                                </div>
                                <input type="checkbox" checked={alexaEnabled} onChange={e => setAlexaEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-blue-500 w-5 h-5" />
                            </label>

                            {/* WLED LED */}
                            <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">💡 LED Şerit</span>
                                    <p className="text-xs text-gray-500">WLED kayıtlı LED flash</p>
                                </div>
                                <input type="checkbox" checked={ledEnabled} onChange={e => setLedEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                            </label>

                            {/* Browser Sound */}
                            <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">🔊 Tarayıcı Sesi</span>
                                    <p className="text-xs text-gray-500">Admin panelde gong çalar</p>
                                </div>
                                <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                            </label>

                            {/* Screen Flash */}
                            <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <div>
                                    <span className="font-bold text-sm">🚨 Ekran Flash</span>
                                    <p className="text-xs text-gray-500">Kırmızı ekran yanıp söner</p>
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
                                        🇹🇷 Türkçe
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Örnek: {alexaLanguage === 'tr'
                                        ? '"Yeni sipariş geldi! Sipariş numarası 42, toplam 24 euro 50 cent"'
                                        : '"Neue Bestellung eingegangen! Bestellnummer 42, Gesamt 24 Euro 50 Cent"'
                                    }
                                </p>
                            </div>
                        )}

                        {/* Alexa Connection Manager */}
                        {alexaEnabled && smartEnabled && gatewayUrl && gatewayApiKey && (
                            <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-bold">🔗 Alexa Bağlantısı</label>
                                    {alexaStatusLoading ? (
                                        <span className="text-xs text-gray-400">⏳ Kontrol ediliyor...</span>
                                    ) : alexaStatus?.connected ? (
                                        <span className="text-xs text-green-400 font-bold">● Bağlı</span>
                                    ) : (
                                        <span className="text-xs text-red-400 font-bold">● Bağlı Değil</span>
                                    )}
                                </div>

                                {alexaStatus?.connected ? (
                                    <div>
                                        <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-3 mb-3">
                                            <p className="text-green-300 text-sm font-medium mb-1">📢 Bağlı Cihazlar:</p>
                                            {alexaStatus.devices.length > 0 ? (
                                                <ul className="text-green-200/70 text-xs space-y-1">
                                                    {alexaStatus.devices.map((d, i) => (
                                                        <li key={i}>• {d.name}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-green-200/70 text-xs">Echo cihaz bulundu (detaylar yükleniyor...)</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleAlexaDisconnect}
                                            className="text-sm text-red-400 hover:text-red-300 underline"
                                        >
                                            🔌 Bağlantıyı Kaldır
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        {!showAlexaSetup ? (
                                            <button
                                                onClick={() => setShowAlexaSetup(true)}
                                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition text-sm"
                                            >
                                                📢 Alexa Bağla
                                            </button>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-3">
                                                    <p className="text-blue-300 text-sm font-bold mb-2">📋 Amazon Cookie Nasıl Alınır?</p>
                                                    <ol className="text-blue-200/70 text-xs space-y-1 list-decimal list-inside">
                                                        <li>Bilgisayarınızda <strong>alexa.amazon.de</strong> adresine gidin</li>
                                                        <li>Amazon hesabınızla giriş yapın</li>
                                                        <li><strong>F12</strong> tuşuna basarak DevTools açın</li>
                                                        <li><strong>Application</strong> → <strong>Cookies</strong> sekmesine gidin</li>
                                                        <li>Tüm cookie değerlerini kopyalayın (veya <strong>Console</strong> sekmesinde <code className="bg-blue-900/50 px-1 rounded">document.cookie</code> yazın)</li>
                                                        <li>Aşağıdaki alana yapıştırın</li>
                                                    </ol>
                                                </div>
                                                <textarea
                                                    value={alexaCookie}
                                                    onChange={e => setAlexaCookie(e.target.value)}
                                                    placeholder="Amazon cookie string'ini buraya yapıştırın..."
                                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white text-xs font-mono h-24 focus:border-purple-500 outline-none resize-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleAlexaConnect}
                                                        disabled={alexaConnecting || !alexaCookie.trim()}
                                                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
                                                    >
                                                        {alexaConnecting ? '⏳ Bağlanıyor...' : '🔗 Bağla'}
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
                                    {testLoading ? '⏳ Gönderiliyor...' : '🔔 Test Bildirimi Gönder'}
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
                        {loading ? 'Kaydediliyor...' : success ? '✅ Kaydedildi!' : 'IoT Ayarlarını Kaydet'}
                    </button>
                </div>

                {/* 🌟 SPONSORED PRODUCTS (Öne Çıkan Ürünler) */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-3xl">⭐</span>
                        <div>
                            <h2 className="text-xl font-bold">Öne Çıkan Ürünler (Sponsored)</h2>
                            <p className="text-gray-400 text-sm">İşletmelerin sepette ürünlerini tanıtmasını sağlayan ücretli özellik.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Global Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                            <div>
                                <h3 className="font-bold">Özelliği Aktif Et</h3>
                                <p className="text-xs text-gray-500">Tüm işletmeler için &quot;Bir şey mi unuttun?&quot; bölümünü açar/kapatır.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={sponsoredEnabled} onChange={e => setSponsoredEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        {/* Fee Per Conversion */}
                        <div className={`${!sponsoredEnabled && 'opacity-50'}`}>
                            <label className="block text-sm font-bold mb-2">Sipariş Başı Ücret (€)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={feePerConversion}
                                    onChange={e => setFeePerConversion(parseFloat(e.target.value) || 0)}
                                    className="w-32 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-orange-500 outline-none font-mono text-lg text-center"
                                    disabled={!sponsoredEnabled}
                                />
                                <span className="text-gray-400 text-sm">€ / sipariş</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Sponsored ürün üzerinden sipariş geldiğinde işletmeden kesilecek ücret.
                            </p>
                        </div>

                        {/* Max Products Per Business */}
                        <div className={`${!sponsoredEnabled && 'opacity-50'}`}>
                            <label className="block text-sm font-bold mb-2">İşletme Başı Max Ürün Sayısı</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={maxProductsPerBusiness}
                                    onChange={e => setMaxProductsPerBusiness(parseInt(e.target.value) || 5)}
                                    className="w-24 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-orange-500 outline-none font-mono text-lg text-center"
                                    disabled={!sponsoredEnabled}
                                />
                                <span className="text-gray-400 text-sm">ürün</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Bir işletmenin &quot;Öne Çıkan&quot; olarak seçebileceği maksimum ürün sayısı.
                            </p>
                        </div>

                        {/* Preview */}
                        {sponsoredEnabled && (
                            <div className="p-4 bg-orange-950/30 border border-orange-800/40 rounded-xl">
                                <p className="text-orange-300 text-sm font-medium">📊 Önizleme</p>
                                <p className="text-orange-200/70 text-xs mt-1">
                                    Her işletme max <strong>{maxProductsPerBusiness}</strong> ürün seçebilir.
                                    Sponsored ürün üzerinden sipariş geldiğinde <strong>{feePerConversion.toFixed(2)} €</strong> ücret kesilir.
                                </p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSaveSponsored}
                        disabled={sponsoredLoading || !sponsoredEnabled}
                        className="w-full mt-6 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-orange-900/20 disabled:opacity-50"
                    >
                        {sponsoredLoading ? 'Kaydediliyor...' : sponsoredSuccess ? '✅ Kaydedildi!' : 'Sponsored Ayarlarını Kaydet'}
                    </button>
                </div>

                {/* 🪑 MASA GRUPLARI (Table Groups) */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl">🪑</span>
                        <div>
                            <h2 className="text-xl font-bold">Masa Grupları & Personel Atama</h2>
                            <p className="text-gray-400 text-sm">Masalarınızı yönetin, personel atayın ve aktif masa oturumlarını takip edin.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <a
                            href={`/admin/table-orders${admin?.butcherId ? `?businessId=${admin.butcherId}` : ''}`}
                            className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-teal-600 hover:bg-teal-950/20 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-teal-900/50 flex items-center justify-center text-2xl group-hover:bg-teal-800/50 transition">
                                🪑
                            </div>
                            <div>
                                <h3 className="font-bold text-white group-hover:text-teal-300 transition">Masa Oturumları</h3>
                                <p className="text-xs text-gray-500">Aktif ve geçmiş masa oturumlarını görüntüle</p>
                            </div>
                            <span className="ml-auto text-gray-600 group-hover:text-teal-400 transition text-xl">→</span>
                        </a>

                        <a
                            href={`/admin/reservations${admin?.butcherId ? `?businessId=${admin.butcherId}` : ''}`}
                            className="flex items-center gap-4 p-5 bg-gray-900 rounded-xl border border-gray-700 hover:border-rose-600 hover:bg-rose-950/20 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-rose-900/50 flex items-center justify-center text-2xl group-hover:bg-rose-800/50 transition">
                                🍽️
                            </div>
                            <div>
                                <h3 className="font-bold text-white group-hover:text-rose-300 transition">Rezervasyonlar</h3>
                                <p className="text-xs text-gray-500">Masa rezervasyonlarını yönet</p>
                            </div>
                            <span className="ml-auto text-gray-600 group-hover:text-rose-400 transition text-xl">→</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
