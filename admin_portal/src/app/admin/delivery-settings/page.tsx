'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { subscriptionService } from '@/services/subscriptionService';

// Helper: convert various time formats to 24h for <input type="time">
function formatTo24h(timeStr: string): string {
    if (!timeStr) return '';
    // Already in HH:MM format
    if (/^\d{2}:\d{2}$/.test(timeStr.trim())) return timeStr.trim();
    // Try AM/PM parsing
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
        let h = parseInt(match[1]);
        const m = match[2];
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m}`;
    }
    // Try plain number extraction
    const numMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (numMatch) return `${numMatch[1].padStart(2, '0')}:${numMatch[2]}`;
    return timeStr;
}

const DAYS = [
    { tr: 'Pazartesi', en: 'Monday' },
    { tr: 'Salı', en: 'Tuesday' },
    { tr: 'Çarşamba', en: 'Wednesday' },
    { tr: 'Perşembe', en: 'Thursday' },
    { tr: 'Cuma', en: 'Friday' },
    { tr: 'Cumartesi', en: 'Saturday' },
    { tr: 'Pazar', en: 'Sunday' },
];

export default function DeliverySettingsPage() {
    const { admin, loading: adminLoading } = useAdmin();

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [successMsg, setSuccessMsg] = useState('');

    // Plan gating
    const [planHasDelivery, setPlanHasDelivery] = useState(false);
    const [planName, setPlanName] = useState('');

    // Combined form data: opening hours + delivery settings
    const [formData, setFormData] = useState({
        // Opening hours
        openingHours: '',
        // Delivery settings
        supportsDelivery: false,
        minDeliveryOrder: 0,
        deliveryFee: 0,
        deliveryStartTime: '',
        deliveryEndTime: '',
        pickupStartTime: '',
        pickupEndTime: '',
        freeDeliveryThreshold: 0,
        preOrderEnabled: false,
        // Driver configuration
        hasOwnCourier: false,
        lokmaDriverEnabled: true,
        deliveryPreference: 'hybrid' as 'own_only' | 'lokma_only' | 'hybrid',
    });

    // Commission rates from plan (read-only display)
    const [commissionRates, setCommissionRates] = useState({
        clickCollect: 0,
        ownCourier: 0,
        lokmaCourier: 0,
    });

    // Resolve business ID
    const businessId = admin
        ? (admin as any).butcherId
        || (admin as any).restaurantId
        || (admin as any).marketId
        || (admin as any).kermesId
        || (admin as any).businessId
        : null;

    // Load business data + plan info
    useEffect(() => {
        if (!businessId || adminLoading) return;

        const loadBusiness = async () => {
            setLoadingData(true);
            try {
                const docRef = doc(db, 'businesses', businessId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const d = docSnap.data();

                    // Parse opening hours
                    let openingHoursStr = '';
                    if (Array.isArray(d.openingHours)) {
                        openingHoursStr = d.openingHours.join('\n');
                    } else if (typeof d.openingHours === 'string') {
                        openingHoursStr = d.openingHours;
                    }

                    setFormData({
                        openingHours: openingHoursStr,
                        supportsDelivery: d.supportsDelivery || d.hasDelivery || false,
                        minDeliveryOrder: d.minDeliveryOrder || d.minOrder || 0,
                        deliveryFee: d.deliveryFee || 0,
                        deliveryStartTime: d.deliveryStartTime || '',
                        deliveryEndTime: d.deliveryEndTime || '',
                        pickupStartTime: d.pickupStartTime || '',
                        pickupEndTime: d.pickupEndTime || '',
                        freeDeliveryThreshold: d.freeDeliveryThreshold || 0,
                        preOrderEnabled: d.preOrderEnabled || false,
                        // Driver configuration
                        hasOwnCourier: d.hasOwnCourier || false,
                        lokmaDriverEnabled: d.lokmaDriverEnabled !== false, // opt-out model
                        deliveryPreference: d.deliveryPreference || 'hybrid',
                    });

                    // Check plan for delivery feature
                    const planCode = d.subscriptionPlan || d.plan || 'free';
                    try {
                        const plans = await subscriptionService.getAllPlans();
                        const activePlan = plans.find((p: any) => p.id === planCode || p.code === planCode);
                        if (activePlan) {
                            setPlanHasDelivery(!!activePlan.features?.delivery);
                            setPlanName(activePlan.name || planCode);
                            setCommissionRates({
                                clickCollect: activePlan.commissionClickCollect || 5,
                                ownCourier: activePlan.commissionOwnCourier || 4,
                                lokmaCourier: activePlan.commissionLokmaCourier || 7,
                            });
                        } else {
                            setPlanHasDelivery(false);
                            setPlanName(planCode);
                        }
                    } catch {
                        // If plan service fails, allow delivery by default
                        setPlanHasDelivery(true);
                        setPlanName(planCode);
                    }
                }
            } catch (err) {
                console.error('Error loading business:', err);
            }
            setLoadingData(false);
        };

        loadBusiness();
    }, [businessId, adminLoading]);

    // Opening hours helpers
    const getDayLine = (dayObj: typeof DAYS[0]) => {
        return formData.openingHours?.split('\n').find((l) => {
            return l.startsWith(dayObj.tr + ':') || l.startsWith(dayObj.tr + ' ') ||
                l.startsWith(dayObj.en + ':') || l.startsWith(dayObj.en + ' ');
        }) || '';
    };

    const parseDayTime = (line: string) => {
        const isClosed = line.toLowerCase().includes('kapalı') || line.toLowerCase().includes('closed');
        let startTime = '';
        let endTime = '';
        if (!isClosed && line.includes(': ')) {
            const timePart = line.split(': ').slice(1).join(': ').trim();
            const separator = timePart.includes('–') ? '–' : '-';
            const parts = timePart.split(separator).map(p => p.trim());
            if (parts.length >= 2) {
                startTime = formatTo24h(parts[0]);
                endTime = formatTo24h(parts[1]);
            }
        }
        return { isClosed, startTime, endTime };
    };

    const updateDayHours = (targetDay: typeof DAYS[0], newStart: string, newEnd: string, newClosed: boolean) => {
        const newLines = DAYS.map((d) => {
            const existingLine = formData.openingHours?.split('\n').find((l) => {
                return l.startsWith(d.tr + ':') || l.startsWith(d.tr + ' ') ||
                    l.startsWith(d.en + ':') || l.startsWith(d.en + ' ');
            }) || '';
            if (d.tr === targetDay.tr) {
                if (newClosed) return `${d.tr}: Kapalı`;
                return `${d.tr}: ${newStart} - ${newEnd}`;
            }
            // Convert English day names to Turkish if needed
            if (existingLine.startsWith(d.en)) {
                const content = existingLine.split(': ').slice(1).join(': ');
                return `${d.tr}: ${content}`;
            }
            return existingLine || `${d.tr}: Kapalı`;
        });
        setFormData({ ...formData, openingHours: newLines.join('\n') });
    };

    // Save handler
    const handleSave = async () => {
        if (!businessId) return;
        setSaving(true);
        try {
            const docRef = doc(db, 'businesses', businessId);
            const updates: any = {
                // Opening hours
                openingHours: formData.openingHours ? formData.openingHours.split('\n') : [],
                // Delivery settings
                supportsDelivery: formData.supportsDelivery,
                minDeliveryOrder: formData.minDeliveryOrder,
                deliveryFee: formData.deliveryFee,
                deliveryStartTime: formData.deliveryStartTime || null,
                deliveryEndTime: formData.deliveryEndTime || null,
                pickupStartTime: formData.pickupStartTime || null,
                pickupEndTime: formData.pickupEndTime || null,
                freeDeliveryThreshold: formData.freeDeliveryThreshold,
                preOrderEnabled: formData.preOrderEnabled,
                // Driver configuration
                hasOwnCourier: formData.hasOwnCourier,
                lokmaDriverEnabled: formData.lokmaDriverEnabled,
                deliveryPreference: formData.deliveryPreference,
                updatedAt: serverTimestamp(),
            };
            await updateDoc(docRef, updates);
            setIsEditing(false);
            setSuccessMsg('✅ Ayarlar kaydedildi!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Kayıt sırasında hata oluştu!');
        }
        setSaving(false);
    };

    if (adminLoading || loadingData) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin text-4xl">⏳</div>
            </div>
        );
    }

    if (!admin || !businessId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">🔒 Bu sayfaya erişim yetkiniz yok</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-4 md:p-6">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <a href="/admin/settings" className="text-gray-400 hover:text-white text-sm transition">← Ayarlar</a>
                        </div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            🚚 Teslimat & Saat Ayarları
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Kurye Status Badge */}
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${formData.supportsDelivery
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                            {formData.supportsDelivery ? '🛵 Kurye Aktif' : '❌ Kurye Kapalı'}
                        </span>

                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition flex items-center gap-2"
                            >
                                🔧 Düzenle
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Success Message */}
                {successMsg && (
                    <div className="bg-emerald-900/30 border border-emerald-600/50 rounded-lg p-3 mb-6 text-emerald-300 text-sm">
                        {successMsg}
                    </div>
                )}

                {/* ═══════ Section 1: Açılış Saatleri ═══════ */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        🕐 Çalışma Saatleri
                    </h4>
                    {isEditing ? (
                        <div className="space-y-2">
                            {DAYS.map((dayObj) => {
                                const currentLine = getDayLine(dayObj);
                                const { isClosed, startTime, endTime } = parseDayTime(currentLine);
                                return (
                                    <div key={dayObj.tr} className="flex items-center gap-3">
                                        <span className="w-24 text-sm text-gray-400 font-medium">{dayObj.tr}</span>
                                        <input
                                            type="time"
                                            value={formatTo24h(startTime)}
                                            disabled={isClosed}
                                            onChange={(e) => updateDayHours(dayObj, e.target.value, endTime, false)}
                                            className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                                        />
                                        <span className="text-gray-500 font-bold">–</span>
                                        <input
                                            type="time"
                                            value={formatTo24h(endTime)}
                                            disabled={isClosed}
                                            onChange={(e) => updateDayHours(dayObj, startTime, e.target.value, false)}
                                            className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                                        />
                                        <label className="flex items-center cursor-pointer ml-auto relative">
                                            <input
                                                type="checkbox"
                                                checked={isClosed}
                                                onChange={(e) => updateDayHours(dayObj, startTime || '09:00', endTime || '22:00', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                                            <span className="ml-2 text-xs text-gray-400 font-medium w-10">{isClosed ? 'Kapalı' : 'Açık'}</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    ) : formData.openingHours ? (
                        <ul className="space-y-1">
                            {formData.openingHours.split('\n').filter(l => l.trim()).map((line, i) => {
                                const parts = line.split(': ');
                                const dayName = parts[0];
                                const content = parts.length > 1 ? parts.slice(1).join(': ').trim() : '';
                                const isClosed = content.toLowerCase().includes('kapalı') || content.toLowerCase().includes('closed');
                                return (
                                    <li key={i} className="flex justify-between items-center border-b border-gray-700/50 pb-1.5 last:border-0">
                                        <span className="font-medium text-gray-400 text-sm w-24">{dayName}</span>
                                        <span className={`font-mono text-sm ${isClosed ? 'text-red-400' : 'text-gray-300'}`}>
                                            {isClosed ? '🔴 Kapalı' : content || '-'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="text-center py-4">
                            <span className="text-gray-500 italic text-sm">Çalışma saatleri henüz belirlenmemiş.</span>
                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="block mx-auto mt-2 text-blue-400 hover:text-blue-300 text-sm"
                                >
                                    + Saat Ekle
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══════ Section 2: Teslimat Ayarları ═══════ */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-6">

                    {/* Kurye Desteği */}
                    <div className="space-y-4">
                        <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                            🚚 Teslimat Ayarları
                        </h4>

                        {/* Plan gating warning */}
                        {!planHasDelivery && (
                            <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-700/50">
                                <p className="text-amber-300 text-sm flex items-center gap-2">
                                    ⚠️ Mevcut planınız (<strong>{planName}</strong>) kurye modülünü içermiyor.
                                </p>
                                <p className="text-amber-400/70 text-xs mt-1">
                                    Kurye desteğini aktifleştirmek için planınızı yükseltmeniz gerekmektedir.
                                    <a href="/account" className="underline ml-1 hover:text-amber-300">Plan Değiştir →</a>
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.supportsDelivery}
                                onChange={(e) => setFormData({ ...formData, supportsDelivery: e.target.checked })}
                                disabled={!isEditing || !planHasDelivery}
                                className="w-5 h-5"
                                title={!planHasDelivery ? 'Planınız kurye modülü içermiyor' : ''}
                            />
                            <span className={`text-white ${!planHasDelivery ? 'opacity-50' : ''}`}>Kurye Desteği Var</span>
                            {!planHasDelivery && (
                                <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">🔒 Plan Gerekli</span>
                            )}
                        </div>

                        {formData.supportsDelivery && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm">Min. Sipariş (€)</label>
                                    <input
                                        type="number"
                                        value={formData.minDeliveryOrder}
                                        onChange={(e) => setFormData({ ...formData, minDeliveryOrder: parseFloat(e.target.value) || 0 })}
                                        disabled={!isEditing}
                                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm">Teslimat Ücreti (€)</label>
                                    <input
                                        type="number"
                                        value={formData.deliveryFee}
                                        onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })}
                                        disabled={!isEditing}
                                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Gelişmiş Sipariş Saatleri */}
                    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <h5 className="text-white font-medium mb-3 flex items-center gap-2">
                            ⏰ Gelişmiş Sipariş Saatleri
                            <span className="text-xs text-gray-500">(Opsiyonel)</span>
                        </h5>
                        <p className="text-xs text-gray-400 mb-4">
                            İşletme açık olsa bile kurye/gel al hizmetinin başlama saatini belirleyebilirsiniz.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Kurye Başlangıç */}
                            <div>
                                <label className="text-gray-400 text-sm flex items-center gap-1">🛵 Kurye Başlangıç</label>
                                <input
                                    type="time"
                                    value={formData.deliveryStartTime || ''}
                                    onChange={(e) => setFormData({ ...formData, deliveryStartTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">Boş = açılış saati</p>
                            </div>

                            {/* Kurye Bitiş */}
                            <div>
                                <label className="text-gray-400 text-sm flex items-center gap-1">🛵 Kurye Bitiş</label>
                                <input
                                    type="time"
                                    value={formData.deliveryEndTime || ''}
                                    onChange={(e) => setFormData({ ...formData, deliveryEndTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">Boş = kapanış saati</p>
                            </div>

                            {/* Gel Al Başlangıç */}
                            <div>
                                <label className="text-gray-400 text-sm flex items-center gap-1">🏃 Gel Al Başlangıç</label>
                                <input
                                    type="time"
                                    value={formData.pickupStartTime || ''}
                                    onChange={(e) => setFormData({ ...formData, pickupStartTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">Boş = açılış saati</p>
                            </div>

                            {/* Gel Al Bitiş */}
                            <div>
                                <label className="text-gray-400 text-sm flex items-center gap-1">🏃 Gel Al Bitiş</label>
                                <input
                                    type="time"
                                    value={formData.pickupEndTime || ''}
                                    onChange={(e) => setFormData({ ...formData, pickupEndTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">Boş = kapanış saati</p>
                            </div>
                        </div>

                        {/* Ücretsiz Teslimat Eşiği */}
                        <div className="mt-4">
                            <label className="text-gray-400 text-sm flex items-center gap-1">
                                🎁 Ücretsiz Teslimat Eşiği (€)
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="number"
                                    value={formData.freeDeliveryThreshold || 0}
                                    onChange={(e) => setFormData({ ...formData, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })}
                                    disabled={!isEditing}
                                    className="w-32 bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                                    min="0"
                                    step="0.01"
                                />
                                <span className="text-gray-400 text-sm">€ üzeri siparişlerde teslimat ücretsiz</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">0 = her zaman teslimat ücreti uygulanır</p>
                        </div>

                        {/* Ön Sipariş */}
                        <div className="mt-4 flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.preOrderEnabled}
                                onChange={(e) => setFormData({ ...formData, preOrderEnabled: e.target.checked })}
                                disabled={!isEditing}
                                className="w-5 h-5 accent-orange-500"
                            />
                            <div>
                                <span className="text-white">📅 Ön Sipariş Kabul Et</span>
                                <p className="text-xs text-gray-400">
                                    İşletme kapalıyken de ertesi gün için sipariş alabilir
                                </p>
                            </div>
                        </div>

                        {/* Info Banner */}
                        {(formData.deliveryStartTime || formData.pickupStartTime) && (
                            <div className="mt-3 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                                <p className="text-xs text-blue-300">
                                    ℹ️ Mobil uygulamada işletme kartında &quot;Teslimat {formData.deliveryStartTime || '...'}&apos;ten sonra&quot; /
                                    &quot;Gel Al {formData.pickupStartTime || '...'}&apos;dan itibaren&quot; şeklinde badge gösterilecek.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════ Section 3: Kurye Yapılandırması ═══════ */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mt-6 space-y-6">
                    <h4 className="text-white font-medium border-b border-gray-700 pb-2 flex items-center gap-2">
                        🏍️ Kurye Yapılandırması
                    </h4>

                    {/* Kendi Kuryem Var */}
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                            <p className="text-white font-medium flex items-center gap-2">🧑‍💼 Kendi Kuryem Var</p>
                            <p className="text-xs text-gray-400 mt-1">İşletmenizin kendi teslimat personeli var mı?</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.hasOwnCourier}
                                onChange={(e) => setFormData({ ...formData, hasOwnCourier: e.target.checked })}
                                disabled={!isEditing}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                            <span className={`ml-2 text-sm font-medium ${formData.hasOwnCourier ? 'text-emerald-300' : 'text-gray-400'}`}>
                                {formData.hasOwnCourier ? 'Evet' : 'Hayır'}
                            </span>
                        </label>
                    </div>

                    {/* LOKMA Sürücü Desteği */}
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-blue-700/30">
                        <div>
                            <p className="text-white font-medium flex items-center gap-2">🔵 LOKMA Sürücü Desteği</p>
                            <p className="text-xs text-gray-400 mt-1">LOKMA platform kuryelerinden destek almak ister misiniz?</p>
                            <p className="text-xs text-blue-400/70 mt-0.5">Aktifleştiğinde LOKMA kuryelerine siparişleriniz bildirilir</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.lokmaDriverEnabled}
                                onChange={(e) => setFormData({ ...formData, lokmaDriverEnabled: e.target.checked })}
                                disabled={!isEditing}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                            <span className={`ml-2 text-sm font-medium ${formData.lokmaDriverEnabled ? 'text-blue-300' : 'text-gray-400'}`}>
                                {formData.lokmaDriverEnabled ? 'Aktif' : 'Kapalı'}
                            </span>
                        </label>
                    </div>

                    {/* Teslimat Tercihi */}
                    {(formData.hasOwnCourier && formData.lokmaDriverEnabled) && (
                        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <label className="text-white font-medium flex items-center gap-2 mb-2">
                                ⚡ Bildirim Tercihi
                            </label>
                            <p className="text-xs text-gray-400 mb-3">Yeni teslimat siparişlerinde kimlere bildirim gönderilsin?</p>
                            <select
                                value={formData.deliveryPreference}
                                onChange={(e) => setFormData({ ...formData, deliveryPreference: e.target.value as any })}
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg disabled:opacity-50 border border-gray-600 focus:border-blue-500 outline-none"
                            >
                                <option value="hybrid">🔄 Hybrid — Hem kendi ekibime hem LOKMA kuryelerine</option>
                                <option value="own_only">🧑‍💼 Sadece Kendi Ekibim</option>
                                <option value="lokma_only">🔵 Sadece LOKMA Kuryeleri</option>
                            </select>
                        </div>
                    )}

                    {/* Komisyon Bilgisi (Read-only) */}
                    <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
                        <h5 className="text-gray-300 font-medium mb-3 flex items-center gap-2">
                            💰 Komisyon Oranları
                            <span className="text-xs text-gray-500">({planName} planınıza göre)</span>
                        </h5>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-gray-800 rounded-lg border border-gray-700">
                                <p className="text-xs text-gray-400 mb-1">🟢 Gel-Al</p>
                                <p className="text-lg font-bold text-emerald-400">%{commissionRates.clickCollect}</p>
                            </div>
                            <div className="text-center p-3 bg-gray-800 rounded-lg border border-gray-700">
                                <p className="text-xs text-gray-400 mb-1">🟠 Kendi Kurye</p>
                                <p className="text-lg font-bold text-orange-400">%{commissionRates.ownCourier}</p>
                            </div>
                            <div className="text-center p-3 bg-gray-800 rounded-lg border border-gray-700">
                                <p className="text-xs text-gray-400 mb-1">🔵 LOKMA Kurye</p>
                                <p className="text-lg font-bold text-blue-400">%{commissionRates.lokmaCourier}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Komisyon oranları planınıza göre belirlenir. Değişiklik için yöneticinize başvurun.
                        </p>
                    </div>

                    {/* Smart Info Banner */}
                    {!formData.hasOwnCourier && !formData.lokmaDriverEnabled && (
                        <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/50">
                            <p className="text-red-300 text-sm flex items-center gap-2">
                                ⚠️ Dikkat: Ne kendi kurye ne de LOKMA kurye desteği aktif değil.
                            </p>
                            <p className="text-red-400/70 text-xs mt-1">
                                Teslimat siparişleri atanamayacaktır. En az birini aktifleştirin.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
