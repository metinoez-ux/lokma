/**
 * Commission Calculation Service
 * 
 * İşletme planına ve kurye tipine göre provizyon hesaplama
 */

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { ButcherSubscriptionPlan, CourierType, CustomerOrder } from '@/types';
import { subscriptionService } from './subscriptionService';

export interface CommissionResult {
    commissionRate: number;       // Uygulanan oran (%)
    commissionAmount: number;     // Hesaplanan komisyon (€)
    perOrderFee: number;          // Sipariş başı ücret (€)
    totalCommission: number;      // Toplam kesinti (€)
    isFreeOrder: boolean;         // Ücretsiz sipariş mi?
    courierType: CourierType;
}

/**
 * İşletmenin plan bilgisini al
 */
export const getBusinessPlan = async (businessId: string): Promise<ButcherSubscriptionPlan | null> => {
    try {
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) return null;

        const businessData = businessDoc.data();
        const planId = businessData.subscriptionPlan || businessData.plan || 'free';

        const plans = await subscriptionService.getAllPlans();
        return plans.find(p => p.id === planId || p.code === planId) || null;
    } catch (error) {
        console.error('Error fetching business plan:', error);
        return null;
    }
};

/**
 * İşletmenin bu ayki sipariş sayısını al
 */
export const getMonthlyOrderCount = async (businessId: string): Promise<number> => {
    try {
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) return 0;

        const data = businessDoc.data();
        const currentMonth = new Date().toISOString().slice(0, 7); // "2026-01"

        return data.usage?.orders?.[currentMonth] || 0;
    } catch (error) {
        console.error('Error fetching monthly order count:', error);
        return 0;
    }
};

/**
 * Kurye tipine göre komisyon oranını belirle
 */
export const getCommissionRate = (plan: ButcherSubscriptionPlan, courierType: CourierType): number => {
    switch (courierType) {
        case 'click_collect':
            return plan.commissionClickCollect || 5;
        case 'own_courier':
            return plan.commissionOwnCourier || 4;
        case 'lokma_courier':
            return plan.commissionLokmaCourier || 7;
        default:
            return plan.commissionClickCollect || 5;
    }
};

/**
 * Ana komisyon hesaplama fonksiyonu
 */
export const calculateCommission = async (
    businessId: string,
    orderTotal: number,
    courierType: CourierType
): Promise<CommissionResult> => {
    // Plan bilgisini al
    const plan = await getBusinessPlan(businessId);

    if (!plan) {
        // Plan bulunamazsa varsayılan değerler
        return {
            commissionRate: 5,
            commissionAmount: orderTotal * 0.05,
            perOrderFee: 0,
            totalCommission: orderTotal * 0.05,
            isFreeOrder: false,
            courierType
        };
    }

    // Bu ayki sipariş sayısını kontrol et (ücretsiz sipariş için)
    const monthlyOrderCount = await getMonthlyOrderCount(businessId);
    const freeOrderCount = plan.freeOrderCount || 0;
    const isFreeOrder = monthlyOrderCount < freeOrderCount;

    // Kurye tipine göre komisyon oranı
    const commissionRate = getCommissionRate(plan, courierType);

    // Komisyon hesapla (ücretsiz sipariş değilse)
    let commissionAmount = 0;
    if (!isFreeOrder) {
        commissionAmount = orderTotal * (commissionRate / 100);
    }

    // Sipariş başı ücret
    let perOrderFee = 0;
    if (plan.perOrderFeeType !== 'none' && !isFreeOrder) {
        if (plan.perOrderFeeType === 'percentage') {
            perOrderFee = orderTotal * (plan.perOrderFeeAmount / 100);
        } else if (plan.perOrderFeeType === 'fixed') {
            perOrderFee = plan.perOrderFeeAmount;
        }
    }

    return {
        commissionRate,
        commissionAmount: Math.round(commissionAmount * 100) / 100, // 2 decimal
        perOrderFee: Math.round(perOrderFee * 100) / 100,
        totalCommission: Math.round((commissionAmount + perOrderFee) * 100) / 100,
        isFreeOrder,
        courierType
    };
};

/**
 * Sipariş tamamlandığında kullanım sayacını güncelle
 */
export const updateUsageCounter = async (
    businessId: string,
    commission: CommissionResult
): Promise<void> => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7); // "2026-01"

        await updateDoc(doc(db, 'businesses', businessId), {
            [`usage.orders.${currentMonth}`]: increment(1),
            [`usage.totalCommission.${currentMonth}`]: increment(commission.totalCommission),
            'usage.lastOrderAt': new Date()
        });
    } catch (error) {
        console.error('Error updating usage counter:', error);
    }
};

export const commissionService = {
    getBusinessPlan,
    getMonthlyOrderCount,
    getCommissionRate,
    calculateCommission,
    updateUsageCounter
};
