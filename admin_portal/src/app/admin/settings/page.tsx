'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function SettingsPage() {
    const { admin } = useAdmin();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form State
    const [webhookUrl, setWebhookUrl] = useState('');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [flashScreen, setFlashScreen] = useState(true);
    const [smartEnabled, setSmartEnabled] = useState(true);

    useEffect(() => {
        if (admin?.smartNotifications) {
            setWebhookUrl(admin.smartNotifications.webhookUrl || '');
            setSoundEnabled(admin.smartNotifications.soundEnabled ?? true);
            setFlashScreen(admin.smartNotifications.flashScreen ?? true);
            setSmartEnabled(admin.smartNotifications.enabled ?? true);
        }
    }, [admin]);

    const handleSave = async () => {
        if (!admin?.id) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'admins', admin.id), {
                smartNotifications: {
                    enabled: smartEnabled,
                    webhookUrl,
                    soundEnabled,
                    flashScreen
                }
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error(error);
            alert('Hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Mağaza Ayarları</h1>

                {/* IOT & SMART ALERTS */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-3xl">🔔</span>
                        <div>
                            <h2 className="text-xl font-bold">Akıllı Bildirimler (IoT)</h2>
                            <p className="text-gray-400 text-sm">Sipariş geldiğinde mağazadaki cihazların nasıl tepki vereceğini seçin.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Master Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                            <div>
                                <h3 className="font-bold">Sistemi Aktif Et</h3>
                                <p className="text-xs text-gray-500">Tüm sesli ve görsel uyarıları açar/kapatır.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={smartEnabled} onChange={e => setSmartEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        {/* Webhook Configuration */}
                        <div>
                            <label className="block text-sm font-bold mb-2">Webhook URL (IFTTT / Home Assistant)</label>
                            <input
                                type="text"
                                value={webhookUrl}
                                onChange={e => setWebhookUrl(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                placeholder="https://maker.ifttt.com/trigger/new_order/with/key/..."
                                disabled={!smartEnabled}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Sipariş geldiğinde bu adrese POST isteği atılır. Philips Hue, Alexa vb. sistemleri tetiklemek için kullanın.
                            </p>
                        </div>

                        {/* Visual & Audio Toggles */}
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <span className="font-bold">🔊 Sesli Gong</span>
                                <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} disabled={!smartEnabled} className="accent-green-500 w-5 h-5" />
                            </label>
                            <label className={`flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer ${!smartEnabled && 'opacity-50'}`}>
                                <span className="font-bold">🚨 Ekran Flaşı</span>
                                <input type="checkbox" checked={flashScreen} onChange={e => setFlashScreen(e.target.checked)} disabled={!smartEnabled} className="accent-red-500 w-5 h-5" />
                            </label>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
                >
                    {loading ? 'Kaydediliyor...' : success ? '✅ Kaydedildi!' : 'Ayarları Kaydet'}
                </button>
            </div>
        </div>
    );
}
