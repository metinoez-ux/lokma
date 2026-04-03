/**
 * Limit Enforcement Service
 * 
 * Bestellungen, Push-Benachrichtigungen und Tischreservierungslimits prüfen
 */

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { ButcherSubscriptionPlan } from '@/types';
import { subscriptionService } from './subscriptionService';

export type LimitType = 'orders' | 'push' | 'table_reservation' | 'personnel';

export interface LimitCheckResult {
 allowed: boolean;
 currentUsage: number;
 limit: number | null; // null = unlimited
 remaining: number | null;
 overageAction: 'block' | 'overage_fee' | 'none';
 overageFee: number; // Overage fee
 message?: string;
}

/**
 * Check a business's usage for a specific limit type
 */
export const checkLimit = async (
 businessId: string,
 limitType: LimitType
): Promise<LimitCheckResult> => {
 try {
 // Get business and plan info
 const businessDoc = await getDoc(doc(db, 'businesses', businessId));
 if (!businessDoc.exists()) {
 return {
 allowed: false,
 currentUsage: 0,
 limit: 0,
 remaining: 0,
 overageAction: 'block',
 overageFee: 0,
 message: 'Unternehmen nicht gefunden'
 };
 }

 const businessData = businessDoc.data();
 const planId = businessData.subscriptionPlan || businessData.plan || 'free';

 // Get plan info
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

 // Get current month's usage
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
 overageAction = 'block'; // Push: block only
 overageFee = 0;
 break;

 case 'table_reservation':
 currentUsage = usage.tableReservations?.[currentMonth] || 0;
 limit = plan.tableReservationLimit;
 overageAction = limit !== null ? 'overage_fee' : 'none';
 overageFee = plan.tableReservationOverageFee || 0;
 break;

 case 'personnel': {
 // Count active admins for this business
 const adminsRef = collection(db, 'admins');
 const q1 = query(adminsRef, where('businessId', '==', businessId), where('isActive', '!=', false));
 const q2 = query(adminsRef, where('butcherId', '==', businessId), where('isActive', '!=', false));
 const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
 const uniqueIds = new Set<string>();
 snap1.docs.forEach(d => uniqueIds.add(d.id));
 snap2.docs.forEach(d => uniqueIds.add(d.id));
 currentUsage = uniqueIds.size;
 limit = plan.personnelLimit ?? null;
 overageAction = limit !== null ? (plan.personnelOverageFee ? 'overage_fee' : 'block') : 'none';
 overageFee = plan.personnelOverageFee || 0;
 break;
 }
 }

 // Limit check
 const remaining = limit === null ? null : Math.max(0, limit - currentUsage);
 const isOverLimit = limit !== null && currentUsage >= limit;

 let allowed = true;
 let message: string | undefined;

 if (isOverLimit) {
 if (overageAction === 'block') {
 allowed = false;
 message = `${limitType === 'orders' ? 'Bestell' : limitType === 'push' ? 'Push-Benachrichtigungs' : 'Tischreservierungs'}limit erreicht. Bitte upgraden Sie Ihren Plan.`;
 } else if (overageAction === 'overage_fee') {
 message = `Limit überschritten. Für jede weitere Transaktion wird eine Gebühr von ${overageFee}€ erhoben.`;
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
 * Increment usage counter
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
 * Get all usage statistics
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
