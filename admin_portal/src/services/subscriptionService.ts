import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ButcherSubscriptionPlan } from '@/types';

const COLLECTION_NAME = 'subscription_plans';

export const subscriptionService = {
 getAllPlans: async (businessType?: string): Promise<ButcherSubscriptionPlan[]> => {
 try {
 let q;
 if (businessType && businessType !== 'all') {
 q = query(
 collection(db, COLLECTION_NAME),
 where('businessType', '==', businessType)
 );
 } else {
 q = query(collection(db, COLLECTION_NAME));
 }

 const snapshot = await getDocs(q);
 let plans = snapshot.docs.map(doc => {
 const data = doc.data();
 return {
 ...data,
 createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
 updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
 } as ButcherSubscriptionPlan;
 });

      // Auto-seed if there are no ACTIVE plans for this specific sector
      if (plans.filter(p => p.isActive).length === 0) {
        const sector = (businessType && businessType !== 'all') ? businessType : 'butcher';
        await subscriptionService.seedDefaults(sector);
        
        // Re-fetch after seeding
        const refetchSnap = await getDocs(q);
        plans = refetchSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          } as ButcherSubscriptionPlan;
        });
      }

 // Client-side sort to avoid composite index requirement
 return plans.sort((a, b) => (a.order || 0) - (b.order || 0));
 } catch (error) {
 console.error('Error fetching plans:', error);
 return [];
 }
 },

 getActivePlans: async (businessType?: string): Promise<ButcherSubscriptionPlan[]> => {
 try {
 let constraints: any[] = [where('isActive', '==', true)];

 if (businessType && businessType !== 'all') {
 constraints.unshift(where('businessType', '==', businessType));
 }

 const q = query(collection(db, COLLECTION_NAME), ...constraints);
 const snapshot = await getDocs(q);
 let plans = snapshot.docs.map(doc => {
 const data = doc.data();
 return {
 ...data,
 createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
 updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
 } as ButcherSubscriptionPlan;
 });

      if (plans.length === 0) {
        // Auto-seed for this sector
        const sector = (businessType && businessType !== 'all') ? businessType : 'butcher';
        await subscriptionService.seedDefaults(sector);

        // Re-fetch after seeding
        const refetchSnap = await getDocs(q);
        plans = refetchSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          } as ButcherSubscriptionPlan;
        });
      }

 return plans.sort((a, b) => (a.order || 0) - (b.order || 0));
 } catch (error) {
 console.error('Error fetching active plans:', error);
 return [];
 }
 },

 // Create a new plan
 createPlan: async (plan: ButcherSubscriptionPlan): Promise<void> => {
 await setDoc(doc(db, COLLECTION_NAME, plan.id), plan);
 },

 // Update an existing plan
 updatePlan: async (id: string, updates: Partial<ButcherSubscriptionPlan>): Promise<void> => {
 await updateDoc(doc(db, COLLECTION_NAME, id), {
 ...updates,
 updatedAt: new Date()
 });
 },

 // Delete (or deactivate) a plan
 deletePlan: async (id: string): Promise<void> => {
 await deleteDoc(doc(db, COLLECTION_NAME, id));
 },

 // Seed default plans if collection is empty for a specific business type
 seedDefaults: async (businessType: string = 'butcher'): Promise<void> => {
 // Check if plans for THIS businessType already exist
 const q = query(collection(db, COLLECTION_NAME), where('businessType', '==', businessType));
 const snapshot = await getDocs(q);
 if (!snapshot.empty) return; // Already seeded for this type

 // Use prefixes to distinguish plans by sector
 const pfx = businessType === 'restoran' ? 'Dine' : businessType === 'market' ? 'Shop' : 'Eat';
 const idSuffix = businessType === 'butcher' ? '' : `_${businessType}`;

 const defaults: ButcherSubscriptionPlan[] = [
 // 1. FREE
 {
 id: `free${idSuffix}`,
 businessType: businessType,
 code: `free${idSuffix}`,
 name: `${pfx} Free`,
 description: 'Ücretsiz başlangıç paketi.',
 monthlyFee: 0,
 yearlyFee: 0,
 currency: 'EUR',
 billingCycle: 'monthly',
 setupFee: 0,
 minContractMonths: 0,
 commissionClickCollect: 8,
 commissionOwnCourier: 0,
 commissionLokmaCourier: 0,

 orderLimit: 50,
 orderOverageAction: 'block', // Limit aşımında durdur
 orderOverageFee: 0,

 productLimit: 10,
 campaignLimit: 0,
 freeOrderCount: 5,
 perOrderFeeType: 'none',
 perOrderFeeAmount: 0,
 tableReservationLimit: null,
 tableReservationOverageFee: 0,
 sponsoredFeePerConversion: 0.50,
 sponsoredMaxProducts: 3,
 trialDays: 0,

 color: 'bg-gray-600',
 highlighted: false,
 order: 1,
 isActive: true,
 features: {
 clickAndCollect: true,
 delivery: false,
 pickup: true,
 onlinePayment: false,
 campaigns: false,
 basicStatsOnly: true,
 marketing: false,
 prioritySupport: false,
 liveCourierTracking: false,
 eslIntegration: false,
 posIntegration: false,
 scaleIntegration: false,
 accountingIntegration: false,
 aiSupplierOrdering: false,
 reservations: true,
 dineInQR: true,
 waiterOrder: false,
 sponsoredProducts: false,
 couponSystem: false,
 referralSystem: false,
 firstOrderDiscount: false,
 freeDrink: false,
 donationRoundUp: false,
 },
 createdAt: new Date(),
 updatedAt: new Date()
 },
 // 2. BASIC (Esnaf)
 {
    id: `basic${idSuffix}`,
    businessType: businessType,
    code: `basic${idSuffix}`,
    name: `${pfx} Basic`,
    description: 'Mahalle kasabı ve küçük işletmeler için.',
    monthlyFee: 29.99,
 yearlyFee: 299.90, // ~10 ay
 currency: 'EUR',
 billingCycle: 'monthly',
 setupFee: 0,
 minContractMonths: 0,
 commissionClickCollect: 6,
 commissionOwnCourier: 5,
 commissionLokmaCourier: 8,

 orderLimit: 200,
 orderOverageAction: 'overage_fee',
 orderOverageFee: 0.50,

 productLimit: 30,
 campaignLimit: 1,
 freeOrderCount: 10,
 perOrderFeeType: 'none',
 perOrderFeeAmount: 0,
 tableReservationLimit: null,
 tableReservationOverageFee: 0,
 sponsoredFeePerConversion: 0.40,
 sponsoredMaxProducts: 5,
 trialDays: 30,

 color: 'bg-green-600',
 highlighted: false,
 order: 2,
 isActive: true,
 features: {
 clickAndCollect: true,
 delivery: false,
 pickup: true,
 onlinePayment: false,
 campaigns: true,
 basicStatsOnly: true,
 marketing: false,
 prioritySupport: false,
 liveCourierTracking: false,
 eslIntegration: false,
 posIntegration: false,
 scaleIntegration: false,
 accountingIntegration: false,
 aiSupplierOrdering: false,
 reservations: true,
 dineInQR: true,
 waiterOrder: true,
 sponsoredProducts: false,
 couponSystem: false,
 referralSystem: false,
 firstOrderDiscount: false,
 freeDrink: true,
 donationRoundUp: true,
 },
 createdAt: new Date(),
 updatedAt: new Date()
 },
 // 3. PRO (Orta Ölçekli)
 {
    id: `pro${idSuffix}`,
    businessType: businessType,
    code: `pro${idSuffix}`,
    name: `${pfx} Pro`,
    description: 'Büyüyen işletmeler ve çoklu şubeler için.',
    monthlyFee: 69.99,
 yearlyFee: 599.90, // ~10 ay
 currency: 'EUR',
 billingCycle: 'monthly',
 setupFee: 49.90, // Kurulum ücreti
 minContractMonths: 12,
 commissionClickCollect: 4,
 commissionOwnCourier: 3,
 commissionLokmaCourier: 6,

 orderLimit: null, // Sınırsız
 orderOverageAction: 'none',
 orderOverageFee: 0,

 productLimit: null,
 campaignLimit: 5,
 freeOrderCount: 0,
 perOrderFeeType: 'fixed',
 perOrderFeeAmount: 0.50,
 tableReservationLimit: 100,
 tableReservationOverageFee: 1.00,
 sponsoredFeePerConversion: 0.20,
 sponsoredMaxProducts: 10,
 trialDays: 30,

 color: 'bg-blue-600',
 highlighted: true,
 order: 3,
 isActive: true,
 features: {
 clickAndCollect: true,
 delivery: true,
 pickup: true,
 onlinePayment: true,
 campaigns: true,
 basicStatsOnly: false,
 marketing: false,
 prioritySupport: true,
 liveCourierTracking: true,
 eslIntegration: false,
 posIntegration: true,
 scaleIntegration: true,
 accountingIntegration: true,
 aiSupplierOrdering: true,
 reservations: true,
 dineInQR: true,
 waiterOrder: true,
 sponsoredProducts: true,
 couponSystem: true,
 referralSystem: true,
 firstOrderDiscount: true,
 freeDrink: true,
 donationRoundUp: true,
 },
 createdAt: new Date(),
 updatedAt: new Date()
 },
 // 4. ULTRA (Kurumsal)
 {
    id: `ultra${idSuffix}`,
    businessType: businessType,
    code: `ultra${idSuffix}`,
    name: `${pfx} Ultra`,
    description: 'Gelişmiş analitik ve donanım entegrasyonu.',
    monthlyFee: 129.99,
 yearlyFee: 999.90, // ~10 ay
 currency: 'EUR',
 billingCycle: 'monthly',
 setupFee: 499.00, // ESL Kurulum Ücreti
 minContractMonths: 24, // 2 Yıllık Taahhüt (Donanım maliyeti için)
 commissionClickCollect: 3,
 commissionOwnCourier: 2,
 commissionLokmaCourier: 5,

 orderLimit: null,
 orderOverageAction: 'none',
 orderOverageFee: 0,

 productLimit: null,
 campaignLimit: null,
 freeOrderCount: 0,
 perOrderFeeType: 'none',
 perOrderFeeAmount: 0,
 tableReservationLimit: null,
 tableReservationOverageFee: 0,
 sponsoredFeePerConversion: 0,
 sponsoredMaxProducts: 20,
 trialDays: 60,

 color: 'bg-yellow-600',
 highlighted: false,
 order: 4,
 isActive: true,
 features: {
 clickAndCollect: true,
 delivery: true,
 pickup: true,
 onlinePayment: true,
 campaigns: true,
 basicStatsOnly: false,
 marketing: true,
 prioritySupport: true,
 liveCourierTracking: true,
 eslIntegration: true,
 posIntegration: true,
 scaleIntegration: true,
 accountingIntegration: true,
 aiSupplierOrdering: true,
 reservations: true,
 dineInQR: true,
 waiterOrder: true,
 sponsoredProducts: true,
 couponSystem: true,
 referralSystem: true,
 firstOrderDiscount: true,
 freeDrink: true,
 donationRoundUp: true,
 },
 createdAt: new Date(),
 updatedAt: new Date()
 }
 ];

 for (const plan of defaults) {
 await setDoc(doc(db, COLLECTION_NAME, plan.id), plan);
 console.log(`Seeded plan: ${plan.id}`);
 }
 }
};
