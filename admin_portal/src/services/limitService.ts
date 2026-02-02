/**
 * Limit Enforcement Service
 * 
 * Sipariş, Push bildirim ve Masa rezervasyon limitlerini kontrol et
 */

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { ButcherSubscriptionPlan } from '@/types';
import { subscriptionService } from './subscriptionService';

export type LimitType = 'orders' | 'push' | 'table_reservation';

export interface LimitCheckResult {
    allowed: boolean;
    currentUsage: number;
    limit: number | null;        // null = sınırsız
    remaining: number | null;
    overageAction: 'block' | 'overage_fee' | 'none';
    overageFee: number;          // Limit aşım ücreti
    message?: string;
}

/**
 * İşletmenin belirli bir limit tipindeki kullanımını kontrol et
 */
export const checkLimit = async (
    businessId: string,
    limitType: LimitType
): Promise<LimitCheckResult> => {
    try {
        // İşletme ve plan bilgisini al
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (!businessDoc.exists()) {
            return {
                allowed: false,
                currentUsage: 0,
                limit: 0,
                remaining: 0,
                overageAction: 'block',
                overageFee: 0,
                message: 'İşletme bulunamadı'
            };
        }

        const businessData = businessDoc.data();
        const planId = businessData.subscriptionPlan || businessData.plan || 'free';

        // Plan bilgisini al
        const plans = await subscriptionService.getAllPlans();
        const plan = plans.find(p => p.id === planId || p.code === planId);

        if (!plan) {
            return {
                allowed: true,
                currentUsage: 0,
                limit: null,
                remaining: null,
                overageAction: 'none',
                overageFee: 0
            };
        }

        // Mevcut ayın kullanımını al
        const currentMonth = new Date().toISOString().slice(0, 7);
        const usage = businessData.usage || {};

        let currentUsage = 0;
        let limit: number | null = null;
        let overageAction: 'block' | 'overage_fee' | 'none' = 'none';
        let overageFee = 0;

        switch (limitType) {
            case 'orders':
                currentUsage = usage.orders?.[currentMonth] || 0;
                limit = plan.orderLimit;
                overageAction = plan.orderOverageAction || 'none';
                overageFee = plan.orderOverageFee || 0;
                break;

            case 'push':
                currentUsage = usage.push?.[currentMonth] || 0;
                limit = plan.campaignLimit;
                overageAction = 'block'; // Push için sadece engelleme
                overageFee = 0;
                break;

            case 'table_reservation':
                currentUsage = usage.tableReservations?.[currentMonth] || 0;
                limit = plan.tableReservationLimit;
                overageAction = limit !== null ? 'overage_fee' : 'none';
                overageFee = plan.tableReservationOverageFee || 0;
                break;
        }

        // Limit kontrolü
        const remaining = limit === null ? null : Math.max(0, limit - currentUsage);
        const isOverLimit = limit !== null && currentUsage >= limit;

        let allowed = true;
        let message: string | undefined;

        if (isOverLimit) {
            if (overageAction === 'block') {
                allowed = false;
                message = `${limitType === 'orders' ? 'Sipariş' : limitType === 'push' ? 'Push bildirim' : 'Masa rezervasyon'} limitine ulaşıldı. Planınızı yükseltin.`;
            } else if (overageAction === 'overage_fee') {
                message = `Limit aşıldı. Her işlem için ${overageFee}€ ek ücret uygulanacak.`;
            }
        }

        return {
            allowed,
            currentUsage,
            limit,
            remaining,
            overageAction,
            overageFee,
            message
        };
    } catch (error) {
        console.error('Error checking limit:', error);
        return {
            allowed: true,
            currentUsage: 0,
            limit: null,
            remaining: null,
            overageAction: 'none',
            overageFee: 0
        };
    }
};

/**
 * Kullanım sayacını artır
 */
export const incrementUsage = async (
    businessId: string,
    limitType: LimitType,
    amount: number = 1
): Promise<void> => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const fieldPath = limitType === 'table_reservation' ? 'tableReservations' : limitType;

        await updateDoc(doc(db, 'businesses', businessId), {
            [`usage.${fieldPath}.${currentMonth}`]: increment(amount)
        });
    } catch (error) {
        console.error('Error incrementing usage:', error);
    }
};

/**
 * Tüm kullanım istatistiklerini al
 */
export const getUsageStats = async (businessId: string): Promise<{
    orders: { used: number; limit: number | null; remaining: number | null };
    push: { used: number; limit: number | null; remaining: number | null };
    tableReservations: { used: number; limit: number | null; remaining: number | null };
}> => {
    const orderResult = await checkLimit(businessId, 'orders');
    const pushResult = await checkLimit(businessId, 'push');
    const tableResult = await checkLimit(businessId, 'table_reservation');

    return {
        orders: { used: orderResult.currentUsage, limit: orderResult.limit, remaining: orderResult.remaining },
        push: { used: pushResult.currentUsage, limit: pushResult.limit, remaining: pushResult.remaining },
        tableReservations: { used: tableResult.currentUsage, limit: tableResult.limit, remaining: tableResult.remaining }
    };
};

export const limitService = {
    checkLimit,
    incrementUsage,
    getUsageStats
};
