'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { subscriptionService } from '@/services/subscriptionService';

// ─────────────────────────────────────────────────────────────────────────────
// Plan Tier Hierarchy — maps template minPlanTier to actual plan codes
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_TIER_LEVEL: Record<string, number> = {
    'free': 0,
    'basic': 1,
    'pro': 2,       // "standard" in template = "pro" in plans
    'standard': 2,  // alias
    'ultra': 3,     // "premium" in template = "ultra" in plans
    'premium': 3,   // alias
};

function meetsMinTier(businessPlanCode: string, requiredTier: string): boolean {
    return (PLAN_TIER_LEVEL[businessPlanCode] ?? 0) >= (PLAN_TIER_LEVEL[requiredTier] ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PromotionTemplate {
    id: string;
    name: string;
    nameTranslations: Record<string, string>;
    description: string;
    type: string;
    icon: string;
    defaultValue: number;
    defaultDurationDays: number;
    minPlanTier: string;
    allowedPopupFormats: string[];
    isActive: boolean;
    sortOrder: number;
}

interface BusinessPromotion {
    id: string;
    templateId?: string;
    type: string;
    title: string;
    description: string;
    value: number;
    valueType: string;
    // Conditions
    minOrderAmount?: number;
    maxRedemptions?: number;
    perUserLimit?: number;
    newCustomersOnly: boolean;
    validDeliveryMethods: string[];
    validDays: string[];
    buyX?: number;
    getY?: number;
    // Schedule
    validFrom?: string;
    validUntil?: string;
    happyHourStart?: string;
    happyHourEnd?: string;
    // Display
    showInDiscovery: boolean;
    showAsPopup: boolean;
    showInStore: boolean;
    badgeText: string;
    badgeColor: string;
    popupFormat: string;
    // Stats
    impressions: number;
    clicks: number;
    redemptions: number;
    totalDiscountGiven: number;
    // Meta
    isActive: boolean;
    createdAt?: any;
}

const PROMOTION_TYPES = [
    { value: 'percentOff', label: 'Yüzde İndirim (%)', icon: '🔥' },
    { value: 'fixedOff', label: 'Sabit İndirim (€)', icon: '🎉' },
    { value: 'freeDelivery', label: 'Ücretsiz Teslimat', icon: '🚚' },
    { value: 'buyXGetY', label: '1 Al 1 Bedava (BOGO)', icon: '🎁' },
    { value: 'minOrderDiscount', label: 'Min. Siparişe İndirim', icon: '💰' },
    { value: 'happyHour', label: 'Happy Hour', icon: '⏰' },
    { value: 'loyaltyCard', label: 'Puan Kartı', icon: '🎖️' },
];

const POPUP_FORMATS = [
    { value: 'bottomSheet', label: 'Alt Sayfa (Bottom Sheet)', desc: 'Ekranın altından yukarı kayar' },
    { value: 'centerModal', label: 'Ortada Popup (Modal)', desc: 'Ekranın ortasında görünür' },
    { value: 'topBanner', label: 'Üst Banner', desc: 'Üstten aşağı kayar, otomatik kapanır' },
    { value: 'snackbar', label: 'Bildirim Çubuğu', desc: 'Küçük bildirim stili, altta görünür' },
];

const DAY_OPTIONS = [
    { value: 'mon', label: 'Pzt' },
    { value: 'tue', label: 'Sal' },
    { value: 'wed', label: 'Çar' },
    { value: 'thu', label: 'Per' },
    { value: 'fri', label: 'Cum' },
    { value: 'sat', label: 'Cmt' },
    { value: 'sun', label: 'Paz' },
];

const ALL_DAYS = DAY_OPTIONS.map(d => d.value);

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

function PromotionsPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const params = useParams();
    const locale = (params?.locale as string) || 'tr';
    const businessId = admin?.businessId;

    const [promotions, setPromotions] = useState<BusinessPromotion[]>([]);
    const [templates, setTemplates] = useState<PromotionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [editingPromo, setEditingPromo] = useState<BusinessPromotion | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<BusinessPromotion | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'expired' | 'all'>('active');

    // ─── Plan Gating State ───────────────────────────────────────────────────
    const [businessPlanCode, setBusinessPlanCode] = useState('free');
    const [businessPlanName, setBusinessPlanName] = useState('Free');
    const [campaignLimit, setCampaignLimit] = useState<number | null>(0);
    const [hasCampaignFeature, setHasCampaignFeature] = useState(false);

    const defaultForm = {
        templateId: '' as string,
        type: 'percentOff',
        title: '',
        description: '',
        value: 10,
        valueType: 'percent',
        minOrderAmount: undefined as number | undefined,
        maxRedemptions: undefined as number | undefined,
        perUserLimit: undefined as number | undefined,
        newCustomersOnly: false,
        validDeliveryMethods: ['delivery', 'pickup'],
        validDays: ALL_DAYS,
        buyX: 2,
        getY: 1,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        happyHourStart: '14:00',
        happyHourEnd: '16:00',
        showInDiscovery: true,
        showAsPopup: false,
        showInStore: true,
        badgeText: '',
        badgeColor: '#FF6B35',
        popupFormat: 'bottomSheet',
        isActive: true,
    };

    const [formData, setFormData] = useState(defaultForm);

    // ─── Load ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (adminLoading || !businessId) return;

        const load = async () => {
            try {
                // Load business promotions
                const promoQuery = query(
                    collection(db, 'businesses', businessId, 'promotions'),
                    orderBy('createdAt', 'desc')
                );
                const promoSnap = await getDocs(promoQuery);
                setPromotions(promoSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                    validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                })) as BusinessPromotion[]);

                // Load promotion templates
                const tplQuery = query(
                    collection(db, 'promotionTemplates'),
                    where('isActive', '==', true),
                    orderBy('sortOrder')
                );
                const tplSnap = await getDocs(tplQuery);
                setTemplates(tplSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PromotionTemplate[]);

                // ─── Load Business Plan for Gating ──────────────────────────
                const bizDoc = await getDoc(doc(db, 'businesses', businessId));
                if (bizDoc.exists()) {
                    const bizData = bizDoc.data();
                    const planCode = bizData.subscriptionPlan || bizData.plan || 'free';
                    setBusinessPlanCode(planCode);

                    try {
                        const plans = await subscriptionService.getAllPlans();
                        const activePlan = plans.find((p: any) => p.id === planCode || p.code === planCode);
                        if (activePlan) {
                            setBusinessPlanName(activePlan.name || planCode);
                            setCampaignLimit(activePlan.campaignLimit ?? 0);
                            setHasCampaignFeature(!!activePlan.features?.campaigns);
                        } else {
                            setBusinessPlanName(planCode);
                        }
                    } catch {
                        // Plan service fail — allow by default
                        setHasCampaignFeature(true);
                        setCampaignLimit(null);
                        setBusinessPlanName(planCode);
                    }
                }
            } catch (error) {
                console.error('Error loading promotions:', error);
            }
            setLoading(false);
        };

        load();
    }, [adminLoading, businessId]);

    // ─── Plan Gating Helpers ─────────────────────────────────────────────────

    const activePromoCount = promotions.filter(p => p.isActive).length;
    const isAtCampaignLimit = campaignLimit !== null && activePromoCount >= campaignLimit;
    const canCreateCampaign = hasCampaignFeature && !isAtCampaignLimit;

    // ─── Template Activation ─────────────────────────────────────────────────

    const activateTemplate = (template: PromotionTemplate) => {
        const now = new Date();
        const endDate = new Date(now.getTime() + template.defaultDurationDays * 86400000);

        setFormData({
            ...defaultForm,
            templateId: template.id,
            type: template.type,
            title: template.nameTranslations?.tr || template.name,
            description: template.description,
            value: template.defaultValue,
            valueType: template.type === 'percentOff' || template.type === 'happyHour' ? 'percent' : 'fixed',
            validFrom: now.toISOString().split('T')[0],
            validUntil: endDate.toISOString().split('T')[0],
            showAsPopup: true,
            popupFormat: template.allowedPopupFormats?.[0] || 'bottomSheet',
        });

        setShowTemplateSelector(false);
        setEditingPromo(null);
        setShowModal(true);
    };

    // ─── Save ────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!formData.title.trim() || !businessId) return;

        setSaving(true);
        try {
            const typeInfo = PROMOTION_TYPES.find(t => t.value === formData.type);
            const autoBadge = formData.type === 'percentOff' ? `%${formData.value} İndirim` :
                formData.type === 'fixedOff' ? `${formData.value}€ İndirim` :
                    formData.type === 'freeDelivery' ? 'Ücretsiz Teslimat' :
                        formData.type === 'buyXGetY' ? `${formData.buyX} Al ${formData.getY} Öde` :
                            `${typeInfo?.icon || ''} ${formData.title}`;

            const saveData: Record<string, any> = {
                templateId: formData.templateId || null,
                type: formData.type,
                title: formData.title.trim(),
                description: formData.description.trim(),
                value: Number(formData.value),
                valueType: formData.valueType,
                minOrderAmount: formData.minOrderAmount ? Number(formData.minOrderAmount) : null,
                maxRedemptions: formData.maxRedemptions ? Number(formData.maxRedemptions) : null,
                perUserLimit: formData.perUserLimit ? Number(formData.perUserLimit) : null,
                newCustomersOnly: formData.newCustomersOnly,
                validDeliveryMethods: formData.validDeliveryMethods,
                validDays: formData.validDays,
                buyX: formData.type === 'buyXGetY' ? Number(formData.buyX) : null,
                getY: formData.type === 'buyXGetY' ? Number(formData.getY) : null,
                happyHourStart: formData.type === 'happyHour' ? formData.happyHourStart : null,
                happyHourEnd: formData.type === 'happyHour' ? formData.happyHourEnd : null,
                showInDiscovery: formData.showInDiscovery,
                showAsPopup: formData.showAsPopup,
                showInStore: formData.showInStore,
                badgeText: formData.badgeText || autoBadge,
                badgeColor: formData.badgeColor,
                popupFormat: formData.popupFormat,
                isActive: formData.isActive,
                updatedAt: new Date(),
            };

            if (formData.validFrom) {
                saveData.validFrom = Timestamp.fromDate(new Date(formData.validFrom));
            }
            if (formData.validUntil) {
                saveData.validUntil = Timestamp.fromDate(new Date(formData.validUntil));
            }

            const promoCol = collection(db, 'businesses', businessId, 'promotions');

            if (editingPromo) {
                await updateDoc(doc(db, 'businesses', businessId, 'promotions', editingPromo.id), saveData);
            } else {
                saveData.createdAt = new Date();
                saveData.impressions = 0;
                saveData.clicks = 0;
                saveData.redemptions = 0;
                saveData.totalDiscountGiven = 0;
                saveData.createdBy = admin?.id || '';
                await addDoc(promoCol, saveData);
            }

            // Reload
            const snapshot = await getDocs(query(promoCol, orderBy('createdAt', 'desc')));
            setPromotions(snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
            })) as BusinessPromotion[]);

            setShowModal(false);
            setEditingPromo(null);
            setFormData(defaultForm);
        } catch (error) {
            console.error('Error saving promotion:', error);
        }
        setSaving(false);
    };

    // ─── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!confirmDelete || !businessId) return;
        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'promotions', confirmDelete.id));
            setPromotions(promotions.filter(p => p.id !== confirmDelete.id));
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting promotion:', error);
        }
    };

    // ─── Toggle Active ──────────────────────────────────────────────────────

    const toggleActive = async (promo: BusinessPromotion) => {
        if (!businessId) return;

        // BUG FIX: Prevent reactivation if campaign limit is reached
        if (!promo.isActive && campaignLimit !== null && activePromoCount >= campaignLimit) {
            alert(`Kampanya limitine ulaştınız (${activePromoCount}/${campaignLimit}). Yeni kampanya aktif edemezsiniz.`);
            return;
        }

        try {
            await updateDoc(doc(db, 'businesses', businessId, 'promotions', promo.id), {
                isActive: !promo.isActive,
            });
            setPromotions(promotions.map(p => p.id === promo.id ? { ...p, isActive: !p.isActive } : p));
        } catch (error) {
            console.error('Error toggling promotion:', error);
        }
    };

    // ─── Edit ────────────────────────────────────────────────────────────────

    const openEdit = (promo: BusinessPromotion) => {
        setEditingPromo(promo);
        setFormData({
            templateId: promo.templateId || '',
            type: promo.type,
            title: promo.title,
            description: promo.description || '',
            value: promo.value,
            valueType: promo.valueType || 'fixed',
            minOrderAmount: promo.minOrderAmount,
            maxRedemptions: promo.maxRedemptions,
            perUserLimit: promo.perUserLimit,
            newCustomersOnly: promo.newCustomersOnly || false,
            validDeliveryMethods: promo.validDeliveryMethods || ['delivery', 'pickup'],
            validDays: promo.validDays || ALL_DAYS,
            buyX: promo.buyX || 2,
            getY: promo.getY || 1,
            validFrom: promo.validFrom || '',
            validUntil: promo.validUntil || '',
            happyHourStart: promo.happyHourStart || '14:00',
            happyHourEnd: promo.happyHourEnd || '16:00',
            showInDiscovery: promo.showInDiscovery ?? true,
            showAsPopup: promo.showAsPopup ?? false,
            showInStore: promo.showInStore ?? true,
            badgeText: promo.badgeText || '',
            badgeColor: promo.badgeColor || '#FF6B35',
            popupFormat: promo.popupFormat || 'bottomSheet',
            isActive: promo.isActive,
        });
        setShowModal(true);
    };

    // ─── Filter ──────────────────────────────────────────────────────────────

    // Use useMemo to avoid creating a new Date on every render but still update when promotions change
    const now = useMemo(() => new Date(), [promotions]);
    const filteredPromos = promotions.filter(p => {
        if (activeTab === 'active') return p.isActive && (!p.validUntil || new Date(p.validUntil) >= now);
        if (activeTab === 'expired') return p.validUntil && new Date(p.validUntil) < now;
        return true;
    });

    // ─── Access check ────────────────────────────────────────────────────────

    if (!adminLoading && !businessId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Erişim Yok</h2>
                    <p className="text-gray-400 mt-2">Promosyon yönetimi için bir işletmeye bağlı olmanız gerekir.</p>
                </div>
            </div>
        );
    }

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-orange-700 to-orange-600 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🎯</span>
                            <div>
                                <h1 className="text-xl font-bold">Kampanya & Promosyon</h1>
                                <p className="text-orange-200 text-sm">
                                    {activePromoCount} aktif kampanya
                                    {campaignLimit !== null && (
                                        <span className="ml-1 opacity-80">/ {campaignLimit} hak ({businessPlanName})</span>
                                    )}
                                    {campaignLimit === null && (
                                        <span className="ml-1 opacity-80">· Sınırsız ({businessPlanName})</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowTemplateSelector(true)}
                                disabled={!canCreateCampaign}
                                className={`px-4 py-2 rounded-lg font-medium transition ${canCreateCampaign ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 opacity-50 cursor-not-allowed'}`}
                                title={!hasCampaignFeature ? 'Planınız kampanya özelliğini içermiyor' : isAtCampaignLimit ? `Kampanya limitine ulaştınız (${campaignLimit})` : ''}
                            >
                                📋 Şablondan Oluştur
                            </button>
                            <button
                                onClick={() => { setEditingPromo(null); setFormData(defaultForm); setShowModal(true); }}
                                disabled={!canCreateCampaign}
                                className={`px-4 py-2 rounded-lg font-medium transition ${canCreateCampaign ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 opacity-50 cursor-not-allowed'}`}
                                title={!hasCampaignFeature ? 'Planınız kampanya özelliğini içermiyor' : isAtCampaignLimit ? `Kampanya limitine ulaştınız (${campaignLimit})` : ''}
                            >
                                + Özel Kampanya
                            </button>
                        </div>
                    </div>

                    {/* Plan Gating Warning */}
                    {!hasCampaignFeature && (
                        <div className="mt-3 p-3 bg-amber-900/40 rounded-lg border border-amber-600/50">
                            <p className="text-amber-200 text-sm flex items-center gap-2">
                                🔒 Mevcut planınız (<strong>{businessPlanName}</strong>) kampanya özelliğini içermiyor.
                            </p>
                            <p className="text-amber-300/70 text-xs mt-1">
                                Kampanya oluşturmak için planınızı yükseltin →
                                <a href={`/${locale}/admin/account`} className="underline ml-1 hover:text-amber-200">Plan Değiştir</a>
                            </p>
                        </div>
                    )}
                    {hasCampaignFeature && isAtCampaignLimit && (
                        <div className="mt-3 p-3 bg-amber-900/40 rounded-lg border border-amber-600/50">
                            <p className="text-amber-200 text-sm flex items-center gap-2">
                                ⚠️ Kampanya limitine ulaştınız ({activePromoCount}/{campaignLimit}).
                                Yeni kampanya oluşturmak için mevcut birini deaktif edin veya planınızı yükseltin.
                            </p>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    {[
                        { key: 'active' as const, label: '🟢 Aktif', count: promotions.filter(p => p.isActive && (!p.validUntil || new Date(p.validUntil) >= now)).length },
                        { key: 'expired' as const, label: '⏰ Süresi Dolmuş', count: promotions.filter(p => p.validUntil && new Date(p.validUntil) < now).length },
                        { key: 'all' as const, label: '📋 Tümü', count: promotions.length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.key
                                ? 'bg-orange-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Promotion Cards */}
                {filteredPromos.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <span className="text-5xl">🎯</span>
                        <h3 className="text-lg font-medium text-white mt-4">Henüz kampanya yok</h3>
                        <p className="text-gray-400 mt-2">Müşterilerinize özel kampanyalar oluşturun!</p>
                        <button
                            onClick={() => canCreateCampaign ? setShowTemplateSelector(true) : undefined}
                            disabled={!canCreateCampaign}
                            className={`mt-4 px-6 py-3 rounded-lg transition ${canCreateCampaign ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                        >
                            📋 Şablondan Hızlı Oluştur
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {filteredPromos.map(promo => {
                            const typeInfo = PROMOTION_TYPES.find(t => t.value === promo.type);
                            const isExpired = promo.validUntil && new Date(promo.validUntil) < now;
                            const formatInfo = POPUP_FORMATS.find(f => f.value === promo.popupFormat);

                            return (
                                <div key={promo.id} className={`bg-gray-800 rounded-xl overflow-hidden border transition ${!promo.isActive ? 'border-red-900/50 opacity-60' :
                                    isExpired ? 'border-yellow-900/50 opacity-70' :
                                        'border-gray-700'
                                    }`}>
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{typeInfo?.icon || '🎯'}</span>
                                                    <h3 className="text-white font-bold text-lg truncate">{promo.title}</h3>
                                                    {isExpired && <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded shrink-0">Süresi Dolmuş</span>}
                                                </div>
                                                {promo.description && (
                                                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{promo.description}</p>
                                                )}

                                                {/* Badges */}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                                                    <span className="bg-orange-900/50 text-orange-300 px-2 py-1 rounded">
                                                        {typeInfo?.label}
                                                    </span>
                                                    {promo.showAsPopup && (
                                                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                                                            📱 {formatInfo?.label || 'Popup'}
                                                        </span>
                                                    )}
                                                    {promo.showInDiscovery && (
                                                        <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded">
                                                            🔍 Discovery
                                                        </span>
                                                    )}
                                                    {promo.newCustomersOnly && (
                                                        <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">
                                                            🆕 Yeni Müşteri
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Stats */}
                                                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                                                    <span>👁 {promo.impressions || 0} gösterim</span>
                                                    <span>👆 {promo.clicks || 0} tıklama</span>
                                                    <span>✅ {promo.redemptions || 0} kullanım</span>
                                                    {promo.totalDiscountGiven > 0 && (
                                                        <span>💸 {promo.totalDiscountGiven.toFixed(2)}€</span>
                                                    )}
                                                </div>

                                                {/* Date */}
                                                {promo.validFrom && (
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        📅 {promo.validFrom}{promo.validUntil ? ` → ${promo.validUntil}` : ''}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => toggleActive(promo)}
                                                    className={`p-1.5 rounded-lg transition text-sm ${promo.isActive ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}
                                                >
                                                    {promo.isActive ? '✅' : '⏸️'}
                                                </button>
                                                <button
                                                    onClick={() => openEdit(promo)}
                                                    className="p-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition text-white text-sm"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(promo)}
                                                    className="p-1.5 bg-red-600 hover:bg-red-500 rounded-lg transition text-white text-sm"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Template Selector Modal */}
            {showTemplateSelector && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">📋 Kampanya Şablonları</h2>
                            <button onClick={() => setShowTemplateSelector(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                            Hazır şablonlardan seçin, tek tıkla kampanya oluşturun.
                            <span className="text-gray-500 block mt-1">Planınız: <strong className="text-gray-300">{businessPlanName}</strong></span>
                        </p>

                        {templates.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">Henüz şablon oluşturulmamış</p>
                        ) : (
                            <div className="space-y-3">
                                {templates.map(tpl => {
                                    const tierAllowed = meetsMinTier(businessPlanCode, tpl.minPlanTier);
                                    const tierLabel = tpl.minPlanTier === 'premium' || tpl.minPlanTier === 'ultra' ? '👑 Ultra' :
                                        tpl.minPlanTier === 'standard' || tpl.minPlanTier === 'pro' ? '⭐ Pro' : null;

                                    return (
                                        <button
                                            key={tpl.id}
                                            onClick={() => tierAllowed ? activateTemplate(tpl) : undefined}
                                            disabled={!tierAllowed}
                                            className={`w-full text-left rounded-lg p-4 transition border ${tierAllowed
                                                ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-orange-500 cursor-pointer'
                                                : 'bg-gray-800/50 border-gray-700/50 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{tpl.icon}</span>
                                                <div className="flex-1">
                                                    <h3 className={`font-semibold ${tierAllowed ? 'text-white' : 'text-gray-500'}`}>
                                                        {tpl.nameTranslations?.tr || tpl.name}
                                                    </h3>
                                                    <p className="text-gray-400 text-sm">{tpl.description}</p>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                                                            {PROMOTION_TYPES.find(t => t.value === tpl.type)?.label}
                                                        </span>
                                                        <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                                                            {tpl.defaultDurationDays} gün
                                                        </span>
                                                        {tierLabel && (
                                                            <span className={`text-xs px-2 py-0.5 rounded ${tierAllowed
                                                                ? 'bg-amber-900/50 text-amber-300'
                                                                : 'bg-red-900/50 text-red-400'
                                                                }`}>
                                                                {tierAllowed ? tierLabel : `🔒 ${tierLabel} Gerekli`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {tierAllowed ? (
                                                    <span className="text-orange-400 text-lg">→</span>
                                                ) : (
                                                    <span className="text-gray-600 text-lg">🔒</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg my-8">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingPromo ? 'Kampanya Düzenle' : 'Yeni Kampanya'}
                        </h2>

                        {/* Title */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Kampanya Başlığı</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Örn: İlk Siparişine 5€ İndirim!"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Açıklama</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Kampanya detayları..."
                                rows={2}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 resize-none"
                            />
                        </div>

                        {/* Type */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Kampanya Türü</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                            >
                                {PROMOTION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Value (conditonal) */}
                        {formData.type !== 'freeDelivery' && formData.type !== 'buyXGetY' && formData.type !== 'loyaltyCard' && (
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-1 block">
                                    İndirim Değeri {formData.type === 'percentOff' || formData.type === 'happyHour' ? '(%)' : '(€)'}
                                </label>
                                <input
                                    type="number"
                                    value={formData.value}
                                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        )}

                        {/* BOGO fields */}
                        {formData.type === 'buyXGetY' && (
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Al (X)</label>
                                    <input
                                        type="number"
                                        value={formData.buyX}
                                        onChange={(e) => setFormData({ ...formData, buyX: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Öde (Y)</label>
                                    <input
                                        type="number"
                                        value={formData.getY}
                                        onChange={(e) => setFormData({ ...formData, getY: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Happy Hour fields */}
                        {formData.type === 'happyHour' && (
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">⏰ Başlangıç</label>
                                    <input
                                        type="time"
                                        value={formData.happyHourStart}
                                        onChange={(e) => setFormData({ ...formData, happyHourStart: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">⏰ Bitiş</label>
                                    <input
                                        type="time"
                                        value={formData.happyHourEnd}
                                        onChange={(e) => setFormData({ ...formData, happyHourEnd: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Min Order */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Min. Sipariş Tutarı (€) — Opsiyonel</label>
                            <input
                                type="number"
                                value={formData.minOrderAmount || ''}
                                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value ? Number(e.target.value) : undefined })}
                                placeholder="Boş = sınırsız"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Başlangıç</label>
                                <input
                                    type="date"
                                    value={formData.validFrom}
                                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Bitiş</label>
                                <input
                                    type="date"
                                    value={formData.validUntil}
                                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                />
                            </div>
                        </div>

                        {/* Valid Days */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Geçerli Günler</label>
                            <div className="flex flex-wrap gap-1.5">
                                {DAY_OPTIONS.map(d => (
                                    <button
                                        key={d.value}
                                        onClick={() => {
                                            const days = formData.validDays.includes(d.value)
                                                ? formData.validDays.filter(v => v !== d.value)
                                                : [...formData.validDays, d.value];
                                            setFormData({ ...formData, validDays: days });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition ${formData.validDays.includes(d.value)
                                            ? 'bg-orange-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Display Options */}
                        <div className="mb-4 bg-gray-700/50 rounded-lg p-4">
                            <label className="text-gray-300 text-sm font-semibold mb-3 block">📱 Gösterim Ayarları</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.showAsPopup}
                                        onChange={(e) => setFormData({ ...formData, showAsPopup: e.target.checked })}
                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                    />
                                    <span className="text-gray-300 text-sm">Uygulama açılışında popup göster</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.showInDiscovery}
                                        onChange={(e) => setFormData({ ...formData, showInDiscovery: e.target.checked })}
                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                    />
                                    <span className="text-gray-300 text-sm">Ana sayfa kartında badge göster</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.showInStore}
                                        onChange={(e) => setFormData({ ...formData, showInStore: e.target.checked })}
                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                    />
                                    <span className="text-gray-300 text-sm">Mağaza sayfasında banner göster</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.newCustomersOnly}
                                        onChange={(e) => setFormData({ ...formData, newCustomersOnly: e.target.checked })}
                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                    />
                                    <span className="text-gray-300 text-sm">Sadece yeni müşterilere göster</span>
                                </label>
                            </div>
                        </div>

                        {/* Popup Format Selector */}
                        {formData.showAsPopup && (
                            <div className="mb-4 bg-blue-900/20 rounded-lg p-4 border border-blue-800/30">
                                <label className="text-blue-300 text-sm font-semibold mb-3 block">📱 Popup Formatı</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {POPUP_FORMATS.map(f => (
                                        <button
                                            key={f.value}
                                            onClick={() => setFormData({ ...formData, popupFormat: f.value })}
                                            className={`text-left p-3 rounded-lg text-sm transition border ${formData.popupFormat === f.value
                                                ? 'bg-blue-700/40 border-blue-500 text-white'
                                                : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50'}`}
                                        >
                                            <span className="font-medium block">{f.label}</span>
                                            <span className="text-xs text-gray-400">{f.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active toggle */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                />
                                <span className="text-gray-300">Aktif (hemen yayınla)</span>
                            </label>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.title.trim()}
                                className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Kampanyayı Sil"
                message="Bu kampanyayı kalıcı olarak silmek istediğinizden emin misiniz?"
                itemName={confirmDelete?.title}
                variant="danger"
                confirmText="Evet, Sil"
                loadingText="Siliniyor..."
            />
        </div>
    );
}

export default function PromotionsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        }>
            <PromotionsPageContent />
        </Suspense>
    );
}
