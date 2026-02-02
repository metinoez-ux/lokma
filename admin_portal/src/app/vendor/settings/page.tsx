'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface BusinessSettings {
    companyName: string;
    brand?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: {
        street?: string;
        city?: string;
        postalCode?: string;
    };
    openingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
    deliveryConfig?: {
        enabled: boolean;
        radiusKm: number;
        fee: number;
        minOrder: number;
    };
    services?: {
        delivery: boolean;
        pickup: boolean;
        dineIn: boolean;
    };
}

const daysOfWeek = [
    { key: 'monday', label: 'Pazartesi' },
    { key: 'tuesday', label: 'Salı' },
    { key: 'wednesday', label: 'Çarşamba' },
    { key: 'thursday', label: 'Perşembe' },
    { key: 'friday', label: 'Cuma' },
    { key: 'saturday', label: 'Cumartesi' },
    { key: 'sunday', label: 'Pazar' },
];

export default function VendorSettingsPage() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [settings, setSettings] = useState<BusinessSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'hours' | 'delivery' | 'services'>('general');

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Get business ID and settings
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    const bId = data.butcherId || data.businessId;
                    setBusinessId(bId);

                    // Load business settings
                    if (bId) {
                        const businessDoc = await getDoc(doc(db, 'businesses', bId));
                        if (businessDoc.exists()) {
                            setSettings(businessDoc.data() as BusinessSettings);
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!businessId || !settings) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, 'businesses', businessId), {
                ...settings,
                updatedAt: new Date(),
            });
            showToast('Ayarlar kaydedildi', 'success');
        } catch (error) {
            console.error('Error:', error);
            showToast('Kaydedilirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-6 text-center">
                <p className="text-gray-400">İşletme bilgileri yüklenemedi</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">⚙️ Ayarlar</h1>
                    <p className="text-gray-400">{settings.companyName}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium disabled:opacity-50"
                >
                    {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { key: 'general', label: '📋 Genel', icon: '📋' },
                    { key: 'hours', label: '🕐 Çalışma Saatleri', icon: '🕐' },
                    { key: 'delivery', label: '🚚 Teslimat', icon: '🚚' },
                    { key: 'services', label: '🛎️ Hizmetler', icon: '🛎️' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`px-4 py-2 rounded-xl ${activeTab === tab.key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">İşletme Adı</label>
                            <input
                                type="text"
                                value={settings.companyName}
                                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                            />
                        </div>
                        {/* Marka alanı kaldırıldı - sadece Super Admin değiştirebilir */}
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Telefon</label>
                            <input
                                type="tel"
                                value={settings.phone || ''}
                                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">E-posta</label>
                            <input
                                type="email"
                                value={settings.email || ''}
                                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-gray-400 text-sm mb-1">Adres</label>
                            <input
                                type="text"
                                value={settings.address?.street || ''}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    address: { ...settings.address, street: e.target.value }
                                })}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 mb-2"
                                placeholder="Sokak/Cadde"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={settings.address?.postalCode || ''}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        address: { ...settings.address, postalCode: e.target.value }
                                    })}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="PLZ"
                                />
                                <input
                                    type="text"
                                    value={settings.address?.city || ''}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        address: { ...settings.address, city: e.target.value }
                                    })}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="Şehir"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hours Tab */}
            {activeTab === 'hours' && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="space-y-3">
                        {daysOfWeek.map(day => {
                            const hours = settings.openingHours?.[day.key] || { open: '09:00', close: '18:00', closed: false };
                            return (
                                <div key={day.key} className="flex items-center gap-4">
                                    <span className="text-white w-24">{day.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={!hours.closed}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            openingHours: {
                                                ...settings.openingHours,
                                                [day.key]: { ...hours, closed: !e.target.checked }
                                            }
                                        })}
                                    />
                                    <input
                                        type="time"
                                        value={hours.open}
                                        disabled={hours.closed}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            openingHours: {
                                                ...settings.openingHours,
                                                [day.key]: { ...hours, open: e.target.value }
                                            }
                                        })}
                                        className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 disabled:opacity-50"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="time"
                                        value={hours.close}
                                        disabled={hours.closed}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            openingHours: {
                                                ...settings.openingHours,
                                                [day.key]: { ...hours, close: e.target.value }
                                            }
                                        })}
                                        className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 disabled:opacity-50"
                                    />
                                    {hours.closed && <span className="text-red-400 text-sm">Kapalı</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Delivery Tab */}
            {activeTab === 'delivery' && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <input
                                type="checkbox"
                                id="deliveryEnabled"
                                checked={settings.deliveryConfig?.enabled ?? false}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    deliveryConfig: { ...settings.deliveryConfig, enabled: e.target.checked } as any
                                })}
                                className="w-5 h-5"
                            />
                            <label htmlFor="deliveryEnabled" className="text-white">🚚 Kurye Teslimatı Aktif</label>
                        </div>

                        {settings.deliveryConfig?.enabled && (
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Teslimat Yarıçapı (km)</label>
                                    <input
                                        type="number"
                                        value={settings.deliveryConfig?.radiusKm || 5}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            deliveryConfig: { ...settings.deliveryConfig, radiusKm: parseFloat(e.target.value) } as any
                                        })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Teslimat Ücreti (€)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={settings.deliveryConfig?.fee || 0}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            deliveryConfig: { ...settings.deliveryConfig, fee: parseFloat(e.target.value) } as any
                                        })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Minimum Sipariş (€)</label>
                                    <input
                                        type="number"
                                        step="5"
                                        value={settings.deliveryConfig?.minOrder || 0}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            deliveryConfig: { ...settings.deliveryConfig, minOrder: parseFloat(e.target.value) } as any
                                        })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="space-y-4">
                        {[
                            { key: 'delivery', label: '🚚 Kurye Teslimatı', desc: 'Müşterinin adresine teslimat' },
                            { key: 'pickup', label: '🏃 Gel Al', desc: 'Müşteri işletmeden teslim alır' },
                            { key: 'dineIn', label: '🍽️ Yerinde Yeme', desc: 'Müşteri işletmede yer' },
                        ].map(service => (
                            <div key={service.key} className="flex items-center justify-between bg-gray-700/50 rounded-xl p-4">
                                <div>
                                    <p className="text-white">{service.label}</p>
                                    <p className="text-gray-400 text-sm">{service.desc}</p>
                                </div>
                                <button
                                    onClick={() => setSettings({
                                        ...settings,
                                        services: {
                                            ...settings.services,
                                            [service.key]: !settings.services?.[service.key as keyof typeof settings.services]
                                        } as any
                                    })}
                                    className={`px-4 py-2 rounded-xl ${settings.services?.[service.key as keyof typeof settings.services]
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-600 text-gray-300'
                                        }`}
                                >
                                    {settings.services?.[service.key as keyof typeof settings.services] ? '✓ Aktif' : 'Pasif'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
