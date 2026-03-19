'use client';

import { useState, useEffect, Suspense, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';
import { subscriptionService } from '@/services/subscriptionService';
import DealsTab from '@/components/promotions/DealsTab';
import CouponsTab from '@/components/promotions/CouponsTab';
import TemplatesTab from '@/components/promotions/TemplatesTab';

// Yemek/restoran segmenti kontrolü
const isRestaurantSegment = (type: string | undefined): boolean => {
    if (!type) return false;
    const t = type.toLowerCase();
    return t.includes('restaurant') || t.includes('restoran') || t.includes('yemek') || t === 'food';
};

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
    availablePlans: string[];
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
    dailyLimit?: number;
    weeklyLimit?: number;
    perUserDailyLimit?: number;
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
    // — Klasik İndirim Modelleri — (Free+)
    { value: 'percentOff', labelKey: 'percentOff', icon: '🔥', minPlanTier: 'free' },
    { value: 'fixedOff', labelKey: 'fixedOff', icon: '🎉', minPlanTier: 'free' },
    { value: 'freeDelivery', labelKey: 'freeDelivery', icon: '🚚', minPlanTier: 'basic' },
    { value: 'buyXGetY', labelKey: 'buyXGetY', icon: '🎁', minPlanTier: 'standard' },
    { value: 'minOrderDiscount', labelKey: 'minOrderDiscount', icon: '💰', minPlanTier: 'basic' },
    // — Zamanlı & Etkinlik — (Standard+)
    { value: 'happyHour', labelKey: 'happyHour', icon: '⏰', minPlanTier: 'standard' },
    { value: 'flashSale', labelKey: 'flashSale', icon: '⚡', minPlanTier: 'standard' },
    // — Sadakat & Ödül — (Standard+)
    { value: 'loyaltyCard', labelKey: 'loyaltyCard', icon: '🎖️', minPlanTier: 'standard' },
    { value: 'cashback', labelKey: 'cashback', icon: '💸', minPlanTier: 'ultra' },
    { value: 'spinWheel', labelKey: 'spinWheel', icon: '🎰', minPlanTier: 'ultra' },
    // — Ürün & Sepet Bazlı — (Standard+)
    { value: 'bundleDeal', labelKey: 'bundleDeal', icon: '📦', minPlanTier: 'standard' },
    { value: 'productDiscount', labelKey: 'productDiscount', icon: '🏷️', minPlanTier: 'basic' },
    { value: 'cartBooster', labelKey: 'cartBooster', icon: '🛒', minPlanTier: 'standard' },
    // — Hedefli & Otomatik — (Premium)
    { value: 'segmentCampaign', labelKey: 'segmentCampaign', icon: '🎯', minPlanTier: 'ultra' },
    { value: 'firstOrderSurprise', labelKey: 'firstOrderSurprise', icon: '💳', minPlanTier: 'standard' },
    { value: 'pushPromo', labelKey: 'pushPromo', icon: '📲', minPlanTier: 'ultra' },
];

// Default safety limits per plan tier (max total redemptions if user sets none)
const PLAN_DEFAULT_SAFETY_LIMITS: Record<string, { maxRedemptions: number | null; dailyLimit: number | null }> = {
    free: { maxRedemptions: 50, dailyLimit: 10 },
    basic: { maxRedemptions: 200, dailyLimit: 30 },
    pro: { maxRedemptions: 1000, dailyLimit: 100 },
    standard: { maxRedemptions: 1000, dailyLimit: 100 },
    ultra: { maxRedemptions: null, dailyLimit: null },
};

const canUseTier = (planCode: string, requiredTier: string): boolean => {
    return (PLAN_TIER_LEVEL[planCode.toLowerCase()] ?? 0) >= (PLAN_TIER_LEVEL[requiredTier] ?? 0);
};

// ─── Promosyon Çakışma Grupları ──────────────────────────────────────────────
// Grup A: Genel sepet indirimleri — mutual exclusive (max 1 aktif)
// Grup B: Ürün/sepet bazlı — aynı hedefte çakışabilir
// Grup C: Bağımsız — çakışmaz (free-pass)
const CONFLICT_GROUPS: Record<string, string[]> = {
    A: ['percentOff', 'fixedOff', 'happyHour', 'flashSale', 'segmentCampaign', 'firstOrderSurprise', 'pushPromo'],
    B: ['productDiscount', 'bundleDeal', 'cartBooster'],
    C: ['freeDelivery', 'cashback', 'loyaltyCard', 'spinWheel', 'buyXGetY', 'minOrderDiscount'],
};

interface ConflictWarning {
    conflictingPromos: { id: string; title: string; type: string }[];
    group: string;
    message: string;
}

/** Check if a new promotion type conflicts with existing active promotions */
function checkConflicts(
    newType: string,
    existingPromos: BusinessPromotion[],
    editingId?: string
): ConflictWarning | null {
    // Only Grup A is mutual exclusive
    if (!CONFLICT_GROUPS.A.includes(newType)) return null;

    const conflicting = existingPromos.filter(p =>
        p.isActive &&
        p.id !== editingId &&
        CONFLICT_GROUPS.A.includes(p.type) &&
        (!p.validUntil || new Date(p.validUntil) >= new Date())
    );

    if (conflicting.length === 0) return null;

    const typeLabels = conflicting.map(p => {
        const info = PROMOTION_TYPES.find(pt => pt.value === p.type);
        return `${info?.icon || '🎯'} ${p.title}`;
    });

    return {
        conflictingPromos: conflicting.map(p => ({ id: p.id, title: p.title, type: p.type })),
        group: 'A',
        message: `⚠️ ${typeLabels.join(', ')}`,
    };
}

const POPUP_FORMATS = [
    { value: 'bottomSheet', labelKey: 'bottomSheet', descKey: 'bottomSheetDesc' },
    { value: 'centerModal', labelKey: 'centerModal', descKey: 'centerModalDesc' },
    { value: 'topBanner', labelKey: 'topBanner', descKey: 'topBannerDesc' },
    { value: 'snackbar', labelKey: 'snackbar', descKey: 'snackbarDesc' },
];

const DAY_OPTIONS = [
    { value: 'mon', labelKey: 'mon' },
    { value: 'tue', labelKey: 'tue' },
    { value: 'wed', labelKey: 'wed' },
    { value: 'thu', labelKey: 'thu' },
    { value: 'fri', labelKey: 'fri' },
    { value: 'sat', labelKey: 'sat' },
    { value: 'sun', labelKey: 'sun' },
];

const ALL_DAYS = DAY_OPTIONS.map(d => d.value);

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

function PromotionsPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const t = useTranslations('AdminPromotions');
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params?.locale as string) || 'tr';
    const isSuperAdmin = admin?.role === 'super_admin';
    // Super admin → URL'den ?businessId=xxx, normal admin → kendi businessId'si
    const businessId = isSuperAdmin
        ? (searchParams?.get('businessId') || admin?.businessId || null)
        : (admin?.businessId || null);

    const router = useRouter();

    // ─── Ana Sekme (URL ?tab parametresi ile senkron) ───────────────────────
    const urlTab = searchParams?.get('tab') || 'kampanya';
    type MainTab = 'kampanya' | 'firsatlar' | 'kuponlar' | 'sablonlar' | 'bedava_icecek';
    const [mainTab, setMainTabState] = useState<MainTab>(urlTab as MainTab);
    const setMainTab = (tab: MainTab) => {
        setMainTabState(tab);
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('tab', tab);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    const [promotions, setPromotions] = useState<BusinessPromotion[]>([]);
    const [templates, setTemplates] = useState<PromotionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [editingPromo, setEditingPromo] = useState<BusinessPromotion | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<BusinessPromotion | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'expired' | 'all'>('active');

    // Deals (Fırsatlar) state
    interface Deal { id: string; title: string; description: string; discountType: 'percent' | 'fixed'; discountValue: number; businessIds: string[]; targetAudience: string; validFrom: string; validUntil: string; isActive: boolean; createdAt?: any; imageUrl?: string; }
    const [deals, setDeals] = useState<Deal[]>([]);
    const [dealsLoaded, setDealsLoaded] = useState(false);

    // Kuponlar state
    interface Coupon { id: string; code: string; discountType: 'percent' | 'fixed' | 'freeDelivery'; discountValue: number; minOrderAmount: number; maxDiscount: number; usageLimit: number; usageCount: number; perUserLimit: number; couponType: string; validFrom: string; validUntil: string; businessId?: string; isActive: boolean; newCustomersOnly?: boolean; createdAt?: any; }
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [couponsLoaded, setCouponsLoaded] = useState(false);

    // All businesses for deals/coupons
    const [allBusinesses, setAllBusinesses] = useState<{ id: string; name: string }[]>([]);

    // Şablon yönetimi (super admin only)
    interface FullTemplate { id: string; name: string; nameTranslations: Record<string, string>; description: string; type: string; icon: string; defaultValue: number; defaultDurationDays: number; minPlanTier: string; availablePlans: string[]; allowedPopupFormats: string[]; isActive: boolean; sortOrder: number; createdAt?: any; }
    const [allTemplates, setAllTemplates] = useState<FullTemplate[]>([]);
    const [templatesLoaded, setTemplatesLoaded] = useState(false);

    // ─── Plan Gating State ───────────────────────────────────────────────────
    const [businessPlanCode, setBusinessPlanCode] = useState('free');
    const [businessPlanName, setBusinessPlanName] = useState('Free');
    const [campaignLimit, setCampaignLimit] = useState<number | null>(0);
    const [hasCampaignFeature, setHasCampaignFeature] = useState(true);

    // ─── 🥤 Bedava İçecek State ──────────────────────────────────────────────
    const [businessType, setBusinessType] = useState<string>('');
    const [freeDrinkEnabled, setFreeDrinkEnabled] = useState(false);
    const [freeDrinkMinimumOrder, setFreeDrinkMinimumOrder] = useState(0);
    const [freeDrinkProducts, setFreeDrinkProducts] = useState<string[]>([]);
    const [businessProducts, setBusinessProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [savingFreeDrink, setSavingFreeDrink] = useState(false);
    const [freeDrinkToast, setFreeDrinkToast] = useState<string>('');

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
        dailyLimit: undefined as number | undefined,
        weeklyLimit: undefined as number | undefined,
        perUserDailyLimit: undefined as number | undefined,
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
        // ─── Tip-bazlı alanlar (C-1..C-5, M-1) ──────────────────────
        cashbackPercent: 5 as number,                         // C-1: cashback tipi
        targetSegment: '' as string,                          // C-2: segmentCampaign tipi
        bundlePrice: undefined as number | undefined,         // C-3: bundleDeal tipi
        bundleProductIds: [] as string[],                     // C-3: bundleDeal tipi
        boosterThreshold: undefined as number | undefined,    // C-4: cartBooster tipi
        boosterReward: undefined as number | undefined,       // C-4: cartBooster tipi
        targetProductId: '' as string,                        // C-5: productDiscount tipi
        validCategories: [] as string[],                      // M-1: kategori filtresi
        validProducts: [] as string[],                        // M-1: ürün filtresi
    };

    const [formData, setFormData] = useState(defaultForm);
    const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null);
    const [forceOverrideConflict, setForceOverrideConflict] = useState(false);

    // ─── Load ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (adminLoading) return;
        // Super admin: businessId olmadan da template'leri yükle
        if (!isSuperAdmin && !businessId) return;

        const load = async () => {
            try {
                const queryList: Promise<any>[] = [
                    getDocs(collection(db, 'promotionTemplates')),
                ];

                // businessId varsa o işletmenin verilerini de yükle
                if (businessId) {
                    queryList.push(
                        getDocs(query(
                            collection(db, 'businesses', businessId, 'promotions'),
                            orderBy('createdAt', 'desc')
                        )),
                        getDoc(doc(db, 'businesses', businessId)),
                    );
                }

                const [tplSnap, promoSnap, bizDoc] = await Promise.all(queryList);

                const allTemplates = tplSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as PromotionTemplate[];
                // Client-side filter (active only for business admins) and sort
                const filteredTemplates = isSuperAdmin
                    ? allTemplates.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    : allTemplates.filter(t => t.isActive !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                setTemplates(filteredTemplates);

                if (promoSnap) {
                    setPromotions(promoSnap.docs.map((d: any) => ({
                        id: d.id,
                        ...d.data(),
                        validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                        validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                    })) as BusinessPromotion[]);
                }

                // ─── Business plan + type + free drink ──────────────────────
                if (bizDoc?.exists()) {
                    const bizData = bizDoc.data();
                    const planCode = bizData.subscriptionPlan || bizData.plan || 'free';
                    setBusinessPlanCode(planCode);

                    const bType = (bizData.types?.[0] || bizData.type || bizData.businessType || '').toLowerCase();
                    setBusinessType(bType);

                    setFreeDrinkEnabled(bizData.freeDrinkEnabled !== false);
                    setFreeDrinkMinimumOrder(bizData.freeDrinkMinimumOrder ?? 0);
                    setFreeDrinkProducts(bizData.freeDrinkProducts ?? []);

                    if (isRestaurantSegment(bType)) {
                        setLoadingProducts(true);
                        try {
                            const prodSnap = await getDocs(collection(db, 'businesses', businessId!, 'products'));
                            setBusinessProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                        } catch (e) {
                            console.error('Products load error:', e);
                        }
                        setLoadingProducts(false);
                    }

                    try {
                        const plans = await subscriptionService.getAllPlans();
                        const activePlan = plans.find((p: any) => p.id === planCode || p.code === planCode);
                        if (activePlan) {
                            setBusinessPlanName(activePlan.name || planCode);
                            setCampaignLimit(activePlan.campaignLimit ?? null);
                            // Kampanya özelliği: plan features'da açıkça false değilse aktif
                            setHasCampaignFeature(activePlan.features?.campaigns !== false);
                        } else {
                            setBusinessPlanName(planCode);
                            setHasCampaignFeature(true);
                        }
                    } catch {
                        setHasCampaignFeature(true);
                        setCampaignLimit(null);
                        setBusinessPlanName(planCode);
                    }
                }

                // Super admin: plan gating bypass
                if (isSuperAdmin) {
                    setHasCampaignFeature(true);
                    setCampaignLimit(null);
                    setBusinessPlanName('Super Admin');
                }
            } catch (error) {
                console.error('Error loading promotions:', error);
            }
            setLoading(false);
        };

        load();
    }, [adminLoading, businessId, isSuperAdmin]);

    // ─── 🥤 FreeDrink Save ───────────────────────────────────────────────────

    const saveFreeDrinkField = useCallback(async (fields: Record<string, any>) => {
        if (!businessId) return;
        setSavingFreeDrink(true);
        try {
            await updateDoc(doc(db, 'businesses', businessId), fields);
            setFreeDrinkToast(`✅ ${t('saved')}`);
        } catch (e) {
            console.error('freeDrink save err:', e);
            setFreeDrinkToast(`❌ ${t('saveFailed')}`);
        }
        setSavingFreeDrink(false);
        setTimeout(() => setFreeDrinkToast(''), 2000);
    }, [businessId]);

    const toggleFreeDrinkProduct = useCallback(async (productId: string) => {
        const next = freeDrinkProducts.includes(productId)
            ? freeDrinkProducts.filter(id => id !== productId)
            : freeDrinkProducts.length >= 5 ? freeDrinkProducts : [...freeDrinkProducts, productId];
        setFreeDrinkProducts(next);
        await saveFreeDrinkField({ freeDrinkProducts: next });
    }, [freeDrinkProducts, saveFreeDrinkField]);

    // ─── Plan Gating Helpers ─────────────────────────────────────────────────

    const activePromoCount = promotions.filter(p => p.isActive).length;
    const isAtCampaignLimit = !isSuperAdmin && campaignLimit !== null && campaignLimit > 0 && activePromoCount >= campaignLimit;
    const canCreateCampaign = isSuperAdmin || (hasCampaignFeature && !isAtCampaignLimit);

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
        if (!formData.title.trim()) {
            alert(t('titleRequired'));
            return;
        }

        // Resolve the target businessId — for Super Admin, allow using admin.managedBusinessId or first available
        const targetBusinessId = businessId || (isSuperAdmin ? admin?.businessId : null);
        if (!targetBusinessId) {
            alert(t('businessNotFound'));
            console.error('handleSave: No businessId available.', { businessId, adminBusinessId: admin?.businessId, isSuperAdmin });
            return;
        }

        // ─── Çakışma kontrolü ─────────────────────────────────────────
        const conflict = checkConflicts(formData.type, promotions, editingPromo?.id);
        if (conflict && !forceOverrideConflict) {
            setConflictWarning(conflict);
            return; // Kullanıcı onay vermeden kaydetme
        }

        setSaving(true);

        // Eğer çakışma override edildi ise, eski çakışan promoları pasife al
        if (conflict && forceOverrideConflict) {
            try {
                for (const cp of conflict.conflictingPromos) {
                    await updateDoc(doc(db, 'businesses', targetBusinessId, 'promotions', cp.id), { isActive: false });
                }
                // Lokal state'i de güncelle
                setPromotions(prev => prev.map(p =>
                    conflict.conflictingPromos.some(cp => cp.id === p.id)
                        ? { ...p, isActive: false }
                        : p
                ));
            } catch (e) {
                console.error('Error deactivating conflicting promos:', e);
            }
        }
        setConflictWarning(null);
        setForceOverrideConflict(false);
        try {
            const typeInfo = PROMOTION_TYPES.find(pt => pt.value === formData.type);
            const autoBadge = formData.type === 'percentOff' ? t('percentDiscount', { value: formData.value }) :
                formData.type === 'fixedOff' ? t('fixedDiscount', { value: formData.value }) :
                    formData.type === 'freeDelivery' ? t('freeDeliveryBadge') :
                        formData.type === 'buyXGetY' ? t('bogoLabel', { x: formData.buyX, y: formData.getY }) :
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
                dailyLimit: formData.dailyLimit ? Number(formData.dailyLimit) : null,
                weeklyLimit: formData.weeklyLimit ? Number(formData.weeklyLimit) : null,
                perUserDailyLimit: formData.perUserDailyLimit ? Number(formData.perUserDailyLimit) : null,
                // Apply default safety limits if no limits set (plan-based protection)
                ...((!formData.maxRedemptions && !isSuperAdmin) ? {
                    _safetyMaxRedemptions: PLAN_DEFAULT_SAFETY_LIMITS[businessPlanCode]?.maxRedemptions ?? PLAN_DEFAULT_SAFETY_LIMITS.free.maxRedemptions,
                } : {}),
                ...((!formData.dailyLimit && !isSuperAdmin) ? {
                    _safetyDailyLimit: PLAN_DEFAULT_SAFETY_LIMITS[businessPlanCode]?.dailyLimit ?? PLAN_DEFAULT_SAFETY_LIMITS.free.dailyLimit,
                } : {}),
                newCustomersOnly: formData.newCustomersOnly,
                validDeliveryMethods: formData.validDeliveryMethods,
                validDays: formData.validDays,
                buyX: formData.type === 'buyXGetY' ? Number(formData.buyX) : null,
                getY: formData.type === 'buyXGetY' ? Number(formData.getY) : null,
                happyHourStart: formData.type === 'happyHour' ? formData.happyHourStart : null,
                happyHourEnd: formData.type === 'happyHour' ? formData.happyHourEnd : null,
                // ─── Tip-bazlı alanlar (C-1..C-5, M-1) ──────────────────────
                cashbackPercent: formData.type === 'cashback' ? Number(formData.cashbackPercent) : null,
                targetSegment: formData.type === 'segmentCampaign' ? formData.targetSegment : null,
                bundlePrice: formData.type === 'bundleDeal' ? (formData.bundlePrice ? Number(formData.bundlePrice) : null) : null,
                bundleProductIds: formData.type === 'bundleDeal' ? formData.bundleProductIds : null,
                boosterThreshold: formData.type === 'cartBooster' ? (formData.boosterThreshold ? Number(formData.boosterThreshold) : null) : null,
                boosterReward: formData.type === 'cartBooster' ? (formData.boosterReward ? Number(formData.boosterReward) : null) : null,
                targetProductId: formData.type === 'productDiscount' ? formData.targetProductId : null,
                validCategories: formData.validCategories?.length ? formData.validCategories : null,
                validProducts: formData.validProducts?.length ? formData.validProducts : null,
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

            const promoCol = collection(db, 'businesses', targetBusinessId, 'promotions');

            if (editingPromo) {
                await updateDoc(doc(db, 'businesses', targetBusinessId, 'promotions', editingPromo.id), saveData);
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
            alert(t('saveError'));
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
            alert(t('limitReachedAlert'));
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
            dailyLimit: promo.dailyLimit,
            weeklyLimit: promo.weeklyLimit,
            perUserDailyLimit: promo.perUserDailyLimit,
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
            // ─── Tip-bazlı alanlar (C-1..C-5, M-1) ──────────────────────
            cashbackPercent: (promo as any).cashbackPercent || 5,
            targetSegment: (promo as any).targetSegment || '',
            bundlePrice: (promo as any).bundlePrice,
            bundleProductIds: (promo as any).bundleProductIds || [],
            boosterThreshold: (promo as any).boosterThreshold,
            boosterReward: (promo as any).boosterReward,
            targetProductId: (promo as any).targetProductId || '',
            validCategories: (promo as any).validCategories || [],
            validProducts: (promo as any).validProducts || [],
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
    // Super admin daima erişebilir; normal admin businessId gerektirir
    if (!adminLoading && !isSuperAdmin && !businessId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">{t('noAccess')}</h2>
                    <p className="text-gray-400 mt-2">{t('noAccessDesc')}</p>
                </div>
            </div>
        );
    }

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-800 to-blue-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-xl font-bold">{t('title')}</h1>
                                <p className="text-blue-200 text-sm">
                                    {activePromoCount} {t('activeCampaigns')}
                                    {campaignLimit !== null && (
                                        <span className="ml-1 opacity-80">/ {campaignLimit} {t('rights')} ({businessPlanName})</span>
                                    )}
                                    {campaignLimit === null && (
                                        <span className="ml-1 opacity-80">· {t('unlimited')} ({businessPlanName})</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {mainTab === 'kampanya' && (<>
                                <button
                                    onClick={() => setShowTemplateSelector(true)}
                                    disabled={!canCreateCampaign}
                                    className={`px-4 py-2 rounded-lg font-medium transition ${canCreateCampaign ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 opacity-50 cursor-not-allowed'}`}
                                    title={!hasCampaignFeature ? t('noCampaignFeature') : isAtCampaignLimit ? t('campaignLimitReached') : ''}
                                >
                                    📋 {t('createFromTemplate')}
                                </button>
                                <button
                                    onClick={() => { setEditingPromo(null); setFormData(defaultForm); setShowModal(true); }}
                                    disabled={!canCreateCampaign}
                                    className={`px-4 py-2 rounded-lg font-medium transition ${canCreateCampaign ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 opacity-50 cursor-not-allowed'}`}
                                    title={!hasCampaignFeature ? t('noCampaignFeature') : isAtCampaignLimit ? t('campaignLimitReached') : ''}
                                >
                                    + {t('customCampaign')}
                                </button>
                            </>)}
                        </div>
                    </div>

                    {/* Plan Gating Warning */}
                    {mainTab === 'kampanya' && !hasCampaignFeature && (
                        <div className="mt-3 flex items-center gap-2 text-amber-400 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-900/30 rounded-md border border-amber-700/40">
                                🔒 {businessPlanName}
                            </span>
                            <span className="text-amber-400/60">{t('noCampaignFeatureShort')} · <a href={`/${locale}/admin/account`} className="underline hover:text-amber-300">{t('upgradePlan')}</a></span>
                        </div>
                    )}
                    {mainTab === 'kampanya' && hasCampaignFeature && isAtCampaignLimit && (
                        <div className="mt-3 flex items-center gap-2 text-amber-400 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-900/30 rounded-md border border-amber-700/40">
                                ⚠️ Limit: {activePromoCount}/{campaignLimit}
                            </span>
                            <span className="text-amber-400/60">{t('deactivateOrUpgrade')} <a href={`/${locale}/admin/account`} className="underline hover:text-amber-300">{t('upgradeYourPlan')}</a>.</span>
                        </div>
                    )}
                </div>
            </header>

            {/* ─── Ana Sekme Navigasyonu ─── */}
            <div className="bg-gray-900 border-b border-gray-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex gap-0 overflow-x-auto">
                        {([
                            { key: 'kampanya', label: t('tabCampaign'), icon: '', desc: t('tabCampDesc') },
                            { key: 'kuponlar', label: t('tabCoupons'), icon: '', desc: t('tabCouponsDesc') },
                            ...(isSuperAdmin ? [{ key: 'sablonlar', label: t('tabTemplates'), icon: '', desc: t('tabTemplatesDesc') }] : []),
                            ...(isRestaurantSegment(businessType) ? [{ key: 'bedava_icecek', label: t('tabFreeDrink'), icon: '', desc: t('tabFreeDrinkDesc') }] : []),
                        ] as { key: string; label: string; icon: string; desc: string }[]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setMainTab(tab.key as any)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${mainTab === tab.key
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                                    }`}
                            >
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6">

                {/* ─── 🥤 Bedava İçecek Tab ─── */}
                {mainTab === 'bedava_icecek' && isRestaurantSegment(businessType) && (
                    <div className="mb-6 bg-gray-800 rounded-xl overflow-hidden border border-emerald-800/40">
                        {/* Kart başlığı */}
                        <div className="bg-emerald-900/30 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🥤</span>
                                <div>
                                    <h2 className="text-white font-bold">{t('freeDrinkTitle')}</h2>
                                    <p className="text-emerald-300/70 text-xs mt-0.5">{t('freeDrinkDesc')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {freeDrinkToast && (
                                    <span className="text-xs text-emerald-400 animate-pulse">{freeDrinkToast}</span>
                                )}
                                {/* Toggle */}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={freeDrinkEnabled}
                                        onChange={async (e) => {
                                            const val = e.target.checked;
                                            setFreeDrinkEnabled(val);
                                            await saveFreeDrinkField({ freeDrinkEnabled: val });
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Kart içeriği */}
                        <div className="p-5 space-y-5">
                            {/* Durum bilgisi */}
                            <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${freeDrinkEnabled
                                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                                : 'bg-red-950/30 border-red-800/40 text-red-300'
                                }`}>
                                <span>{freeDrinkEnabled ? '✅' : '🚫'}</span>
                                <span className="font-medium">
                                    {freeDrinkEnabled
                                        ? t('freeDrinkActive')
                                        : t('freeDrinkInactive')}
                                </span>
                            </div>

                            {/* Minimum sipariş tutarı */}
                            <div>
                                <label className="text-gray-300 text-sm font-medium block mb-2">
                                    {t('minimumOrderAmount')}
                                    <span className="ml-2 text-gray-500 font-normal text-xs">{t('everyOrderActive')}</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 font-bold">€</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.50"
                                        value={freeDrinkMinimumOrder}
                                        onChange={(e) => setFreeDrinkMinimumOrder(parseFloat(e.target.value) || 0)}
                                        onBlur={() => saveFreeDrinkField({ freeDrinkMinimumOrder })}
                                        className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        placeholder="0"
                                    />
                                    <span className="text-gray-500 text-xs">
                                        {freeDrinkMinimumOrder === 0
                                            ? t('activeEveryOrder')
                                            : t('activeAtAmount', { amount: freeDrinkMinimumOrder.toFixed(2) })}
                                    </span>
                                </div>
                            </div>

                            {/* Ürün seçimi */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <label className="text-gray-300 text-sm font-medium">
                                            {t('freeProducts')}
                                        </label>
                                        <p className="text-gray-500 text-xs mt-0.5">
                                            {t('customerSelectsOne')}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${freeDrinkProducts.length >= 5
                                        ? 'bg-emerald-900/50 text-emerald-300'
                                        : 'bg-gray-700 text-gray-400'
                                        }`}>
                                        {freeDrinkProducts.length} / 5
                                    </span>
                                </div>

                                {loadingProducts ? (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                                        <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-emerald-500 rounded-full" />
                                        {t('productsLoading')}
                                    </div>
                                ) : businessProducts.length === 0 ? (
                                    <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-700 rounded-xl">
                                        <span className="text-2xl block mb-2">🔍</span>
                                        Bu işletmenin menüsünde henüz ürün yok.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {businessProducts.map((p: any) => {
                                            const isSelected = freeDrinkProducts.includes(p.id);
                                            const atMax = freeDrinkProducts.length >= 5 && !isSelected;
                                            const productName = typeof p.name === 'object'
                                                ? (p.name?.tr ?? p.name?.de ?? p.name?.en ?? t('product'))
                                                : (p.name ?? t('product'));
                                            const productCategory = typeof p.category === 'object'
                                                ? (p.category?.tr ?? p.category?.de ?? p.category?.en ?? '')
                                                : (p.category ?? '');

                                            return (
                                                <button
                                                    key={p.id}
                                                    disabled={atMax || savingFreeDrink}
                                                    onClick={() => toggleFreeDrinkProduct(p.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${isSelected
                                                        ? 'bg-emerald-950/40 border-emerald-600 text-white'
                                                        : atMax
                                                            ? 'bg-gray-800/40 border-gray-700 text-gray-600 cursor-not-allowed'
                                                            : 'bg-gray-700/60 border-gray-600 text-gray-300 hover:border-emerald-600/50 cursor-pointer'
                                                        }`}
                                                >
                                                    {p.imageUrl ? (
                                                        <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                                    ) : (
                                                        <span className="w-10 h-10 flex items-center justify-center bg-gray-700 rounded-lg text-xl flex-shrink-0">🥤</span>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{productName}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {productCategory}{p.price != null ? ` · €${Number(p.price).toFixed(2)}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className={`text-lg flex-shrink-0 ${isSelected ? 'text-emerald-400' : 'text-gray-600'}`}>
                                                        {isSelected ? '✓' : '○'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg">
                                <p className="text-blue-300 text-xs font-bold mb-1">{`ℹ️ ${t('howItWorks')}`}</p>
                                <ul className="text-blue-200/60 text-xs space-y-1 list-disc list-inside">
                                    <li>{t('howItWorks1')}</li>
                                    <li>{t('howItWorks2')}</li>
                                    <li>{t('howItWorks3')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Kampanya Tab'ları ve Listesi ─── */}
                {mainTab === 'kampanya' && (<>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        {[
                            { key: 'active' as const, label: `🟢 ${t('active')}`, count: promotions.filter(p => p.isActive && (!p.validUntil || new Date(p.validUntil) >= now)).length },
                            { key: 'expired' as const, label: `⏰ ${t('expired')}`, count: promotions.filter(p => p.validUntil && new Date(p.validUntil) < now).length },
                            { key: 'all' as const, label: `📋 ${t('all')}`, count: promotions.length },
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
                    {
                        filteredPromos.length === 0 ? (
                            <div className="bg-gray-800 rounded-xl p-12 text-center">
                                <span className="text-5xl">🎯</span>
                                <h3 className="text-lg font-medium text-white mt-4">{t('noCampaignsYet')}</h3>
                                <p className="text-gray-400 mt-2">{t('createCampaignsForCustomers')}</p>
                                <button
                                    onClick={() => canCreateCampaign ? setShowTemplateSelector(true) : undefined}
                                    disabled={!canCreateCampaign}
                                    className={`mt-4 px-6 py-3 rounded-lg transition ${canCreateCampaign ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                >
                                    {`📋 ${t('quickCreateFromTemplate')}`}
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {filteredPromos.map(promo => {
                                    const typeInfo = PROMOTION_TYPES.find(pt => pt.value === promo.type);
                                    const isExpired = promo.validUntil && new Date(promo.validUntil) < now;
                                    const formatInfo = POPUP_FORMATS.find(f => f.value === promo.popupFormat);

                                    return (
                                        <div
                                            key={promo.id}
                                            className={`bg-gray-800 rounded-xl overflow-hidden border transition ${isExpired ? 'border-gray-700 opacity-70' : promo.isActive ? 'border-orange-800/50' : 'border-gray-700'
                                                }`}
                                        >
                                            {/* ─── Card header ─── */}
                                            <div className={`px-4 py-3 flex items-center justify-between ${isExpired ? 'bg-gray-800' : promo.isActive ? 'bg-orange-900/20' : 'bg-gray-800'
                                                }`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{typeInfo?.icon || '🎯'}</span>
                                                    <div>
                                                        <h3 className="text-white font-semibold text-sm">{promo.title}</h3>
                                                        <span className="text-xs text-gray-400">{t(typeInfo?.labelKey || 'percentOff')}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${isExpired ? 'bg-gray-700 text-gray-400' :
                                                    promo.isActive ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'
                                                    }`}>
                                                    {isExpired ? `⏰ ${t('ended')}` : promo.isActive ? `✅ ${t('activeStatus')}` : `⏸️ ${t('passive')}`}
                                                </span>
                                            </div>

                                            {/* ─── Card body ─── */}
                                            <div className="px-4 py-3">
                                                {promo.description && (
                                                    <p className="text-gray-300 text-sm mb-2">{promo.description}</p>
                                                )}

                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {/* Value */}
                                                    <span className="text-xs bg-orange-900/30 text-orange-300 px-2 py-0.5 rounded-full">
                                                        {promo.valueType === 'percent' ? `%${promo.value}` : `€${promo.value}`} {t('discount')}
                                                    </span>
                                                    {/* Methods */}
                                                    {promo.validDeliveryMethods?.map((m: string) => (
                                                        <span key={m} className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full">
                                                            {m === 'delivery' ? `🚴 ${t('courier')}` : `🏠 ${t('gelAl')}`}
                                                        </span>
                                                    ))}
                                                    {/* Min order */}
                                                    {promo.minOrderAmount && (
                                                        <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                                                            Min €{promo.minOrderAmount}
                                                        </span>
                                                    )}
                                                    {/* New customers */}
                                                    {promo.newCustomersOnly && (
                                                        <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded-full">
                                                            Yeni müşteriler
                                                        </span>
                                                    )}
                                                    {/* Popup */}
                                                    {promo.showAsPopup && (
                                                        <span className="text-xs bg-pink-900/30 text-pink-300 px-2 py-0.5 rounded-full">
                                                            {t(formatInfo?.labelKey || 'bottomSheet')}
                                                        </span>
                                                    )}
                                                    {/* Usage limits badges */}
                                                    {(promo.maxRedemptions || promo.dailyLimit || promo.weeklyLimit || promo.perUserLimit || promo.perUserDailyLimit) && (
                                                        <span className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-0.5 rounded-full" title={[
                                                            promo.maxRedemptions ? `${t('totalLabel')}: ${promo.maxRedemptions}` : '',
                                                            promo.dailyLimit ? `${t('dailyLabel')}: ${promo.dailyLimit}` : '',
                                                            promo.weeklyLimit ? `${t('weeklyLabel')}: ${promo.weeklyLimit}` : '',
                                                            promo.perUserLimit ? `${t('perUserLabel')}: ${promo.perUserLimit}` : '',
                                                            promo.perUserDailyLimit ? `${t('perUserDailyLabel')}: ${promo.perUserDailyLimit}` : '',
                                                        ].filter(Boolean).join(' · ')}>
                                                            📊 Limitli
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Stats */}
                                                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                                                    {promo.redemptions != null && (
                                                        <span>{`📊 ${promo.redemptions} ${t('usage')}`}</span>
                                                    )}
                                                    {promo.totalDiscountGiven != null && (
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
                                            <div className="flex items-center gap-1 px-4 pb-3 shrink-0">
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
                                    );
                                })}
                            </div>
                        )
                    }
                </>)}

                {/* ─── Fırsatlar Tab ─── */}
                {mainTab === 'firsatlar' && (
                    <DealsTab
                        businessId={businessId}
                        isSuperAdmin={isSuperAdmin}
                        businesses={allBusinesses}
                        deals={deals as any}
                        setDeals={setDeals as any}
                        loaded={dealsLoaded}
                        setLoaded={setDealsLoaded}
                        setAllBusinesses={setAllBusinesses}
                    />
                )}

                {/* ─── Kuponlar Tab ─── */}
                {mainTab === 'kuponlar' && (
                    <CouponsTab
                        businessId={businessId}
                        isSuperAdmin={isSuperAdmin}
                        businesses={allBusinesses}
                        coupons={coupons as any}
                        setCoupons={setCoupons as any}
                        loaded={couponsLoaded}
                        setLoaded={setCouponsLoaded}
                        setAllBusinesses={setAllBusinesses}
                    />
                )}

                {/* ─── Şablonlar Tab (Super Admin) ─── */}
                {mainTab === 'sablonlar' && isSuperAdmin && (
                    <TemplatesTab
                        templates={allTemplates}
                        setTemplates={setAllTemplates}
                        loaded={templatesLoaded}
                        setLoaded={setTemplatesLoaded}
                    />
                )}

            </main>

            {/* Template Selector Modal */}
            {
                showTemplateSelector && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">{`📋 ${t('campaignTemplates')}`}</h2>
                                <button onClick={() => setShowTemplateSelector(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                            </div>
                            <p className="text-gray-400 text-sm mb-4">
                                Hazır şablonlardan seçin, tek tıkla kampanya oluşturun.
                                <span className="text-gray-500 block mt-1">{t('yourPlan')}: <strong className="text-gray-300">{businessPlanName}</strong></span>
                            </p>

                            {templates.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">{t('noTemplatesYet')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map(tpl => {
                                        // Plan gating: check if business plan is in availablePlans,
                                        // normalize both sides to handle alias mismatches (standard/pro, premium/ultra)
                                        const normalizeCode = (c: string) => {
                                            if (c === 'standard') return 'pro';
                                            if (c === 'premium') return 'ultra';
                                            return c.toLowerCase();
                                        };
                                        const plans: string[] = (tpl as any).availablePlans;
                                        const tierAllowed = plans
                                            ? plans.map(normalizeCode).includes(normalizeCode(businessPlanCode))
                                            : meetsMinTier(businessPlanCode, tpl.minPlanTier);
                                        const tierLabel = !tierAllowed
                                            ? (plans
                                                ? `🔒 ${plans.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}`
                                                : (tpl.minPlanTier === 'premium' || tpl.minPlanTier === 'ultra' ? '👑 Ultra' :
                                                    tpl.minPlanTier === 'standard' || tpl.minPlanTier === 'pro' ? '⭐ Pro' : null))
                                            : null;

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
                                                                {PROMOTION_TYPES.find(pt => pt.value === tpl.type)?.icon}
                                                            </span>
                                                            <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                                                                {tpl.defaultDurationDays} {t('days')}
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
                )
            }

            {/* Add/Edit Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl my-8">
                            <h2 className="text-xl font-bold text-white mb-4">
                                {editingPromo ? t('editCampaign') : t('newCampaign')}
                            </h2>

                            {/* ⚠️ Çakışma Uyarı Banner'ı */}
                            {conflictWarning && (
                                <div className="mb-4 p-4 bg-red-900/30 border border-red-600/50 rounded-xl">
                                    <p className="text-red-300 text-sm font-semibold mb-2">{`⚠️ ${t('conflictDetected')}`}</p>
                                    <p className="text-red-200/80 text-xs mb-3">{conflictWarning.message}</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setForceOverrideConflict(true);
                                                setConflictWarning(null);
                                                // handleSave will be triggered by user clicking Kaydet again
                                            }}
                                            className="flex-1 px-3 py-2 bg-red-700/60 text-red-100 rounded-lg text-xs font-medium hover:bg-red-700 transition"
                                        >
                                            🔄 Eskileri pasife al ve bu yenisini aç
                                        </button>
                                        <button
                                            onClick={() => setConflictWarning(null)}
                                            className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition"
                                        >
                                            {t('cancel')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Title */}
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-1 block">{t('campaignTitle')}</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder={t('campaignTitlePlaceholder')}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-1 block">{t('description')}</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={t('descriptionPlaceholder')}
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 resize-none"
                                />
                            </div>

                            {/* Type */}
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-1 block">{t('campaignType')}</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                                >
                                    {PROMOTION_TYPES.map(pt => {
                                        const isAllowed = isSuperAdmin || canUseTier(businessPlanCode, pt.minPlanTier);
                                        return (
                                            <option key={pt.value} value={pt.value} disabled={!isAllowed}>
                                                {pt.icon} {t(pt.labelKey || 'percentOff')}
                                                {!isAllowed ? ` 🔒 (${pt.minPlanTier}+ ${t('planRequired')})` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Value (conditonal) */}
                            {formData.type !== 'freeDelivery' && formData.type !== 'buyXGetY' && formData.type !== 'loyaltyCard' && (
                                <div className="mb-4">
                                    <label className="text-gray-400 text-sm mb-1 block">
                                        {t('discountValue')} {formData.type === 'percentOff' || formData.type === 'happyHour' ? '(%)' : '(€)'}
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
                                        <label className="text-gray-400 text-sm mb-1 block">{t('buyX')}</label>
                                        <input
                                            type="number"
                                            value={formData.buyX}
                                            onChange={(e) => setFormData({ ...formData, buyX: Number(e.target.value) })}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">{t('payY')}</label>
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
                                        <label className="text-gray-400 text-sm mb-1 block">{`⏰ ${t('startTime')}`}</label>
                                        <input
                                            type="time"
                                            value={formData.happyHourStart}
                                            onChange={(e) => setFormData({ ...formData, happyHourStart: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">{`⏰ ${t('endTime')}`}</label>
                                        <input
                                            type="time"
                                            value={formData.happyHourEnd}
                                            onChange={(e) => setFormData({ ...formData, happyHourEnd: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 💸 Cashback fields (C-1) */}
                            {formData.type === 'cashback' && (
                                <div className="mb-4 bg-emerald-900/20 rounded-lg p-4 border border-emerald-800/30">
                                    <label className="text-emerald-300 text-sm font-semibold mb-2 block">{`💸 ${t('cashbackSettings')}`}</label>
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">{t('cashbackRate')}</label>
                                        <input
                                            type="number"
                                            value={formData.cashbackPercent}
                                            onChange={(e) => setFormData({ ...formData, cashbackPercent: Number(e.target.value) })}
                                            min={1} max={100}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">{t('cashbackDesc')}</p>
                                    </div>
                                </div>
                            )}

                            {/* 🎯 Segment Campaign fields (C-2) */}
                            {formData.type === 'segmentCampaign' && (
                                <div className="mb-4 bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                                    <label className="text-purple-300 text-sm font-semibold mb-2 block">{`🎯 ${t('targetSegment')}`}</label>
                                    <select
                                        value={formData.targetSegment}
                                        onChange={(e) => setFormData({ ...formData, targetSegment: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">{t('selectSegment')}</option>
                                        <option value="vip">{`👑 ${t('vipCustomers')}`}</option>
                                        <option value="new">{`🆕 ${t('newCustomersSegment')}`}</option>
                                        <option value="returning">{`🔄 ${t('returningCustomers')}`}</option>
                                        <option value="at_risk">{`⚠️ ${t('atRisk')}`}</option>
                                        <option value="inactive">{`😴 ${t('inactiveCustomers')}`}</option>
                                        <option value="high_spender">{`💎 ${t('highSpender')}`}</option>
                                        <option value="frequent_buyer">{`🛍️ ${t('frequentBuyer')}`}</option>
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">{t('segmentOnlyNote')}</p>
                                </div>
                            )}

                            {/* 📦 Bundle Deal fields (C-3) */}
                            {formData.type === 'bundleDeal' && (
                                <div className="mb-4 bg-blue-900/20 rounded-lg p-4 border border-blue-800/30">
                                    <label className="text-blue-300 text-sm font-semibold mb-2 block">{`📦 ${t('bundleSettings')}`}</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-gray-400 text-sm mb-1 block">{t('bundlePrice')}</label>
                                            <input
                                                type="number"
                                                value={formData.bundlePrice || ''}
                                                onChange={(e) => setFormData({ ...formData, bundlePrice: e.target.value ? Number(e.target.value) : undefined })}
                                                placeholder={t('packagePrice')}
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-sm mb-1 block">{t('productIds')}</label>
                                            <input
                                                type="text"
                                                value={formData.bundleProductIds.join(', ')}
                                                onChange={(e) => setFormData({ ...formData, bundleProductIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                placeholder="urun_1, urun_2, urun_3"
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            />
                                            <p className="text-gray-500 text-xs mt-1">{t('bundleProductsNote')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 🛒 Cart Booster fields (C-4) */}
                            {formData.type === 'cartBooster' && (
                                <div className="mb-4 bg-amber-900/20 rounded-lg p-4 border border-amber-800/30">
                                    <label className="text-amber-300 text-sm font-semibold mb-2 block">{`🛒 ${t('cartBoosterSettings')}`}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-gray-400 text-sm mb-1 block">{t('thresholdAmount')}</label>
                                            <input
                                                type="number"
                                                value={formData.boosterThreshold || ''}
                                                onChange={(e) => setFormData({ ...formData, boosterThreshold: e.target.value ? Number(e.target.value) : undefined })}
                                                placeholder={t('minCartAmount')}
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-sm mb-1 block">{t('reward')}</label>
                                            <input
                                                type="number"
                                                value={formData.boosterReward || ''}
                                                onChange={(e) => setFormData({ ...formData, boosterReward: e.target.value ? Number(e.target.value) : undefined })}
                                                placeholder={t('giftDiscount')}
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-xs mt-2">{t('cartBoosterExample')}</p>
                                </div>
                            )}

                            {/* 🏷️ Product Discount fields (C-5) */}
                            {formData.type === 'productDiscount' && (
                                <div className="mb-4 bg-rose-900/20 rounded-lg p-4 border border-rose-800/30">
                                    <label className="text-rose-300 text-sm font-semibold mb-2 block">{`🏷️ ${t('productBasedDiscount')}`}</label>
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">{t('targetProductId')}</label>
                                        <input
                                            type="text"
                                            value={formData.targetProductId}
                                            onChange={(e) => setFormData({ ...formData, targetProductId: e.target.value })}
                                            placeholder={t('productIdLabel')}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-rose-500"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">{t('productDiscountNote')}</p>
                                    </div>
                                </div>
                            )}

                            {/* 📂 Kategori / Ürün Filtresi (M-1) — tüm tipler için opsiyonel */}
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-2 block font-medium">{`📂 ${t('categoryProductFilter')}`}</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="text-gray-500 text-xs mb-1 block">{t('validCategories')}</label>
                                        <input
                                            type="text"
                                            value={formData.validCategories.join(', ')}
                                            onChange={(e) => setFormData({ ...formData, validCategories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                            placeholder="et, tavuk, balik"
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs mb-1 block">{t('validProductIds')}</label>
                                        <input
                                            type="text"
                                            value={formData.validProducts.join(', ')}
                                            onChange={(e) => setFormData({ ...formData, validProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                            placeholder="urun_id_1, urun_id_2"
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Min Order */}
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-1 block">{t('minOrderAmount')}</label>
                                <input
                                    type="number"
                                    value={formData.minOrderAmount || ''}
                                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value ? Number(e.target.value) : undefined })}
                                    placeholder={t('emptyUnlimited')}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            {/* Usage Limits */}
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-2 block font-medium">{`📊 ${t('usageLimits')}`}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-gray-500 text-xs mb-1 block">{t('totalMaxUsage')}</label>
                                        <input
                                            type="number"
                                            value={formData.maxRedemptions || ''}
                                            onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder="∞"
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs mb-1 block">{t('perUserTotal')}</label>
                                        <input
                                            type="number"
                                            value={formData.perUserLimit || ''}
                                            onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder="∞"
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs mb-1 block">{t('dailyLimit')}</label>
                                        <input
                                            type="number"
                                            value={formData.dailyLimit || ''}
                                            onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder="∞"
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs mb-1 block">{t('weeklyLimit')}</label>
                                        <input
                                            type="number"
                                            value={formData.weeklyLimit || ''}
                                            onChange={(e) => setFormData({ ...formData, weeklyLimit: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder="∞"
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-gray-500 text-xs mb-1 block">{t('perUserDailyLimit')}</label>
                                        <input
                                            type="number"
                                            value={formData.perUserDailyLimit || ''}
                                            onChange={(e) => setFormData({ ...formData, perUserDailyLimit: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder={`∞ — ${t('perUserDailyPlaceholder')}`}
                                            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">{t('startDate')}</label>
                                    <input
                                        type="date"
                                        value={formData.validFrom}
                                        onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">{t('endDate')}</label>
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
                                <label className="text-gray-400 text-sm mb-1 block">{t('validDays')}</label>
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
                                            {t(d.labelKey || 'mon')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Display Options */}
                            <div className="mb-4 bg-gray-700/50 rounded-lg p-4">
                                <label className="text-gray-300 text-sm font-semibold mb-3 block">{`📱 ${t('displaySettings')}`}</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.showAsPopup}
                                            onChange={(e) => setFormData({ ...formData, showAsPopup: e.target.checked })}
                                            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                        />
                                        <span className="text-gray-300 text-sm">{t('showPopupOnOpen')}</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.showInDiscovery}
                                            onChange={(e) => setFormData({ ...formData, showInDiscovery: e.target.checked })}
                                            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                        />
                                        <span className="text-gray-300 text-sm">{t('showBadgeOnCard')}</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.showInStore}
                                            onChange={(e) => setFormData({ ...formData, showInStore: e.target.checked })}
                                            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                        />
                                        <span className="text-gray-300 text-sm">{t('showBannerInStore')}</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.newCustomersOnly}
                                            onChange={(e) => setFormData({ ...formData, newCustomersOnly: e.target.checked })}
                                            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500"
                                        />
                                        <span className="text-gray-300 text-sm">{t('showOnlyNewCustomers')}</span>
                                    </label>
                                </div>
                            </div>

                            {/* Popup Format Selector */}
                            {formData.showAsPopup && (
                                <div className="mb-4 bg-blue-900/20 rounded-lg p-4 border border-blue-800/30">
                                    <label className="text-blue-300 text-sm font-semibold mb-3 block">{`📱 ${t('popupFormat')}`}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {POPUP_FORMATS.map(f => (
                                            <button
                                                key={f.value}
                                                onClick={() => setFormData({ ...formData, popupFormat: f.value })}
                                                className={`text-left p-3 rounded-lg text-sm transition border ${formData.popupFormat === f.value
                                                    ? 'bg-blue-700/40 border-blue-500 text-white'
                                                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50'}`}
                                            >
                                                <span className="font-medium block">{t(f.labelKey || 'bottomSheet')}</span>
                                                <span className="text-xs text-gray-400">{t(f.descKey || 'bottomSheetDesc')}</span>
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
                                    <span className="text-gray-300">{t('activePublishNow')}</span>
                                </label>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowModal(false); setConflictWarning(null); setForceOverrideConflict(false); }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formData.title.trim()}
                                    className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                                >
                                    {saving ? t('saving') : t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title={t('deleteCampaign')}
                message={t('deleteConfirm')}
                itemName={confirmDelete?.title}
                variant="danger"
                confirmText={t('yesDelete')}
                loadingText={t('deleting')}
            />
        </div >
    );
}

export default function PromotionsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        }>
            <PromotionsPageContent />
        </Suspense>
    );
}
