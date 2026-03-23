'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { subscriptionService } from '@/services/subscriptionService';
import { useTranslations } from 'next-intl';

import { normalizeTimeString } from '@/utils/timeUtils';

// formatTo24h: paylasimli utility uzerinden -- tum zaman formati varyasyonlarini handle eder
function formatTo24h(timeStr: string): string {
    return normalizeTimeString(timeStr) || timeStr;
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
    
  const t = useTranslations('AdminDeliverysettings');
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

    // Resolve business ID via shared hook
    const businessId = useAdminBusinessId();

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

                    // Opening hours: normalize on read
                    let openingHoursStr = '';
                    if (Array.isArray(d.openingHours)) {
                        openingHoursStr = d.openingHours.join('\n');
                    } else if (typeof d.openingHours === 'string') {
                        openingHoursStr = d.openingHours;
                    }
                    // Okunan satirlari 24h formatina normalize et
                    openingHoursStr = openingHoursStr.split('\n').map((line: string) => {
                        const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
                        if (!match) return line.trim();
                        const dayName = match[1].trim();
                        const timePart = match[2].trim();
                        const lower = timePart.toLowerCase();
                        if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
                            return `${dayName}: Closed`;
                        }
                        const sep = timePart.includes('\u2013') ? '\u2013' : '-';
                        const parts = timePart.split(sep).map((p: string) => p.trim());
                        if (parts.length >= 2) {
                            return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
                        }
                        return line.trim();
                    }).filter(Boolean).join('\n');

                    setFormData({
                        openingHours: openingHoursStr,
                        supportsDelivery: d.supportsDelivery || d.hasDelivery || false,
                        minDeliveryOrder: d.minDeliveryOrder || d.minOrder || 0,
                        deliveryFee: d.deliveryFee || 0,
                        deliveryStartTime: normalizeTimeString(d.deliveryStartTime || ''),
                        deliveryEndTime: normalizeTimeString(d.deliveryEndTime || ''),
                        pickupStartTime: normalizeTimeString(d.pickupStartTime || ''),
                        pickupEndTime: normalizeTimeString(d.pickupEndTime || ''),
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
                // Opening hours -- normalize before save
                openingHours: formData.openingHours
                    ? formData.openingHours.split('\n').map((line: string) => {
                        const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
                        if (!match) return line.trim();
                        const dayName = match[1].trim();
                        const timePart = match[2].trim();
                        const lower = timePart.toLowerCase();
                        if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
                            return `${dayName}: Closed`;
                        }
                        const sep = timePart.includes('\u2013') ? '\u2013' : '-';
                        const parts = timePart.split(sep).map((p: string) => p.trim());
                        if (parts.length >= 2) {
                            return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
                        }
                        return line.trim();
                    }).filter(Boolean)
                    : [],
                // Delivery settings
                supportsDelivery: formData.supportsDelivery,
                minDeliveryOrder: formData.minDeliveryOrder,
                deliveryFee: formData.deliveryFee,
                deliveryStartTime: normalizeTimeString(formData.deliveryStartTime || '') || null,
                deliveryEndTime: normalizeTimeString(formData.deliveryEndTime || '') || null,
                pickupStartTime: normalizeTimeString(formData.pickupStartTime || '') || null,
                pickupEndTime: normalizeTimeString(formData.pickupEndTime || '') || null,
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
            alert(t('kayit_sirasinda_hata_olustu'));
        }
        setSaving(false);
    };

    if (adminLoading || loadingData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin text-4xl">⏳</div>
            </div>
        );
    }

    if (!admin || !businessId) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground">{t('bu_sayfaya_erisim_yetkiniz_yok')}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-6">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <a href="/admin/settings" className="text-muted-foreground hover:text-foreground text-sm transition">← Ayarlar</a>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                            {t('teslimat_saat_ayarlari')}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Kurye Status Badge */}
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${formData.supportsDelivery
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                            {formData.supportsDelivery ? t('kurye_aktif') : t('kurye_kapali')}
                        </span>

                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-foreground font-medium rounded-lg transition flex items-center gap-2"
                            >
                                {t('duzenle')}
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 rounded-lg transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-foreground font-medium rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? '⏳ Kaydediliyor...' : t('kaydet')}
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
                <div className="bg-card rounded-xl border border-border p-6 mb-6">
                    <h4 className="text-foreground font-medium mb-4 flex items-center gap-2">
                        {t('calisma_saatleri')}
                    </h4>
                    {isEditing ? (
                        <div className="space-y-2">
                            {DAYS.map((dayObj) => {
                                const currentLine = getDayLine(dayObj);
                                const { isClosed, startTime, endTime } = parseDayTime(currentLine);
                                return (
                                    <div key={dayObj.tr} className="flex items-center gap-3">
                                        <span className="w-24 text-sm text-muted-foreground font-medium">{dayObj.tr}</span>
                                        <input
                                            type="time"
                                            value={formatTo24h(startTime)}
                                            disabled={isClosed}
                                            onChange={(e) => updateDayHours(dayObj, e.target.value, endTime, false)}
                                            className={`w-28 bg-background border border-gray-600 rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                                        />
                                        <span className="text-gray-500 font-bold">–</span>
                                        <input
                                            type="time"
                                            value={formatTo24h(endTime)}
                                            disabled={isClosed}
                                            onChange={(e) => updateDayHours(dayObj, startTime, e.target.value, false)}
                                            className={`w-28 bg-background border border-gray-600 rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                                        />
                                        <label className="flex items-center cursor-pointer ml-auto relative">
                                            <input
                                                type="checkbox"
                                                checked={isClosed}
                                                onChange={(e) => updateDayHours(dayObj, startTime || '09:00', endTime || '22:00', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                                            <span className="ml-2 text-xs text-muted-foreground font-medium w-10">{isClosed ? t('kapali') : t('acik')}</span>
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
                                    <li key={i} className="flex justify-between items-center border-b border-border/50 pb-1.5 last:border-0">
                                        <span className="font-medium text-muted-foreground text-sm w-24">{dayName}</span>
                                        <span className={`font-mono text-sm ${isClosed ? 'text-red-800 dark:text-red-400' : 'text-foreground'}`}>
                                            {isClosed ? t('kapali') : content || '-'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="text-center py-4">
                            <span className="text-gray-500 italic text-sm">{t('calisma_saatleri_henuz_belirlenmemis')}</span>
                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="block mx-auto mt-2 text-blue-800 dark:text-blue-400 hover:text-blue-300 text-sm"
                                >
                                    {t('saat_ekle')}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══════ Section 2: Teslimat Ayarları ═══════ */}
                <div className="bg-card rounded-xl border border-border p-6 space-y-6">

                    {/* Kurye Desteği */}
                    <div className="space-y-4">
                        <h4 className="text-foreground font-medium border-b border-border pb-2">
                            {t('teslimat_ayarlari')}
                        </h4>

                        {/* Plan gating warning */}
                        {!planHasDelivery && (
                            <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700/50">
                                <p className="text-amber-300 text-sm flex items-center gap-2">
                                    {t('mevcut_planiniz')}<strong>{planName}</strong>{t('kurye_modulunu_icermiyor')}
                                </p>
                                <p className="text-amber-800 dark:text-amber-400/70 text-xs mt-1">
                                    {t('kurye_destegini_aktiflestirmek_icin_plan')}
                                    <a href="/account" className="underline ml-1 hover:text-amber-300">{t('plan_degistir')}</a>
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
                                title={!planHasDelivery ? t('planiniz_kurye_modulu_icermiyor') : ''}
                            />
                            <span className={`text-white ${!planHasDelivery ? 'opacity-50' : ''}`}>{t('kurye_destegi_var')}</span>
                            {!planHasDelivery && (
                                <span className="px-2 py-0.5 bg-gray-700 text-muted-foreground text-xs rounded-full">🔒 Plan Gerekli</span>
                            )}
                        </div>

                        {formData.supportsDelivery && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-muted-foreground text-sm">{t('min_siparis')}</label>
                                    <input
                                        type="number"
                                        value={formData.minDeliveryOrder}
                                        onChange={(e) => setFormData({ ...formData, minDeliveryOrder: parseFloat(e.target.value) || 0 })}
                                        disabled={!isEditing}
                                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-muted-foreground text-sm">{t('teslimat_ucreti')}</label>
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
                    <div className="p-4 bg-background/50 rounded-lg border border-border">
                        <h5 className="text-foreground font-medium mb-3 flex items-center gap-2">
                            {t('gelismis_siparis_saatleri')}
                            <span className="text-xs text-gray-500">(Opsiyonel)</span>
                        </h5>
                        <p className="text-xs text-muted-foreground mb-4">
                            {t('i_sletme_acik_olsa_bile_kurye_gel_al_hiz')}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Kurye Başlangıç */}
                            <div>
                                <label className="text-muted-foreground text-sm flex items-center gap-1">{t('kurye_baslangic')}</label>
                                <input
                                    type="time"
                                    value={formData.deliveryStartTime || ''}
                                    onChange={(e) => setFormData({ ...formData, deliveryStartTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('bos_acilis_saati')}</p>
                            </div>

                            {/* Kurye Bitiş */}
                            <div>
                                <label className="text-muted-foreground text-sm flex items-center gap-1">{t('kurye_bitis')}</label>
                                <input
                                    type="time"
                                    value={formData.deliveryEndTime || ''}
                                    onChange={(e) => setFormData({ ...formData, deliveryEndTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('bos_kapanis_saati')}</p>
                            </div>

                            {/* Gel Al Başlangıç */}
                            <div>
                                <label className="text-muted-foreground text-sm flex items-center gap-1">{t('gel_al_baslangic')}</label>
                                <input
                                    type="time"
                                    value={formData.pickupStartTime || ''}
                                    onChange={(e) => setFormData({ ...formData, pickupStartTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('bos_acilis_saati')}</p>
                            </div>

                            {/* Gel Al Bitiş */}
                            <div>
                                <label className="text-muted-foreground text-sm flex items-center gap-1">{t('gel_al_bitis')}</label>
                                <input
                                    type="time"
                                    value={formData.pickupEndTime || ''}
                                    onChange={(e) => setFormData({ ...formData, pickupEndTime: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('bos_kapanis_saati')}</p>
                            </div>
                        </div>

                        {/* Ücretsiz Teslimat Eşiği */}
                        <div className="mt-4">
                            <label className="text-muted-foreground text-sm flex items-center gap-1">
                                {t('ucretsiz_teslimat_esigi')}
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
                                <span className="text-muted-foreground text-sm">{t('uzeri_siparislerde_teslimat_ucretsiz')}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{t('0_her_zaman_teslimat_ucreti_uygulanir')}</p>
                        </div>

                        {/* Ön Sipariş */}
                        <div className="mt-4 flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.preOrderEnabled}
                                onChange={(e) => setFormData({ ...formData, preOrderEnabled: e.target.checked })}
                                disabled={!isEditing}
                                className="w-5 h-5 accent-amber-500"
                            />
                            <div>
                                <span className="text-foreground">{t('on_siparis_kabul_et')}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t('i_sletme_kapaliyken_de_ertesi_gun_icin_s')}
                                </p>
                            </div>
                        </div>

                        {/* Info Banner */}
                        {(formData.deliveryStartTime || formData.pickupStartTime) && (
                            <div className="mt-3 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                                <p className="text-xs text-blue-300">
                                    {t('mobil_uygulamada_isletme_kartinda_teslim')} {formData.deliveryStartTime || '...'}&apos;ten sonra&quot; /
                                    &quot;Gel Al {formData.pickupStartTime || '...'}{t('dan_itibaren_seklinde_badge_gosterilecek')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════ Section 3: Kurye Yapılandırması ═══════ */}
                <div className="bg-card rounded-xl border border-border p-6 mt-6 space-y-6">
                    <h4 className="text-foreground font-medium border-b border-border pb-2 flex items-center gap-2">
                        {t('kurye_yapilandirmasi')}
                    </h4>

                    {/* Kendi Kuryem Var */}
                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                        <div>
                            <p className="text-foreground font-medium flex items-center gap-2">{t('kendi_kuryem_var')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('i_sletmenizin_kendi_teslimat_personeli_v')}</p>
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
                            <span className={`ml-2 text-sm font-medium ${formData.hasOwnCourier ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                                {formData.hasOwnCourier ? t('evet') : t('hayir')}
                            </span>
                        </label>
                    </div>

                    {/* LOKMA Sürücü Desteği */}
                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-blue-200 dark:border-blue-700/30">
                        <div>
                            <p className="text-foreground font-medium flex items-center gap-2">{t('lokma_surucu_destegi')}</p>
                            <p className="text-xs text-muted-foreground mt-1">LOKMA platform kuryelerinden destek almak ister misiniz?</p>
                            <p className="text-xs text-blue-800 dark:text-blue-400/70 mt-0.5">{t('aktiflestiginde_lokma_kuryelerine_sipari')}</p>
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
                            <span className={`ml-2 text-sm font-medium ${formData.lokmaDriverEnabled ? 'text-blue-300' : 'text-muted-foreground'}`}>
                                {formData.lokmaDriverEnabled ? t('aktif') : t('kapali')}
                            </span>
                        </label>
                    </div>

                    {/* Teslimat Tercihi */}
                    {(formData.hasOwnCourier && formData.lokmaDriverEnabled) && (
                        <div className="p-4 bg-background/50 rounded-lg border border-border">
                            <label className="text-foreground font-medium flex items-center gap-2 mb-2">
                                ⚡ Bildirim Tercihi
                            </label>
                            <p className="text-xs text-muted-foreground mb-3">{t('yeni_teslimat_siparislerinde_kimlere_bil')}</p>
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
                    <div className="p-4 bg-background/30 rounded-lg border border-border/50">
                        <h5 className="text-foreground font-medium mb-3 flex items-center gap-2">
                            {t('komisyon_oranlari')}
                            <span className="text-xs text-gray-500">({planName} {t('planiniza_gore')}</span>
                        </h5>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-card rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">🟢 Gel-Al</p>
                                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-400">%{commissionRates.clickCollect}</p>
                            </div>
                            <div className="text-center p-3 bg-card rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">{t('kendi_kurye')}</p>
                                <p className="text-lg font-bold text-amber-800 dark:text-amber-400">%{commissionRates.ownCourier}</p>
                            </div>
                            <div className="text-center p-3 bg-card rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">{t('lokma_kurye')}</p>
                                <p className="text-lg font-bold text-blue-800 dark:text-blue-400">%{commissionRates.lokmaCourier}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            {t('komisyon_oranlari_planiniza_gore_belirle')}
                        </p>
                    </div>

                    {/* Smart Info Banner */}
                    {!formData.hasOwnCourier && !formData.lokmaDriverEnabled && (
                        <div className="p-3 bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/50">
                            <p className="text-red-300 text-sm flex items-center gap-2">
                                {t('dikkat_ne_kendi_kurye_ne_de_lokma_kurye_')}
                            </p>
                            <p className="text-red-800 dark:text-red-400/70 text-xs mt-1">
                                {t('teslimat_siparisleri_atanamayacaktir_en_')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
