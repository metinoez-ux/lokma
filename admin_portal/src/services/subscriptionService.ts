import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ButcherSubscriptionPlan } from '@/types';

const COLLECTION_NAME = 'subscription_plans';

export const subscriptionService = {
    // Get all plans (for admin list)
    getAllPlans: async (businessType?: string): Promise<ButcherSubscriptionPlan[]> => {
        try {
            let q;
            if (businessType) {
                q = query(
                    collection(db, COLLECTION_NAME),
                    where('businessType', '==', businessType)
                );
            } else {
                q = query(collection(db, COLLECTION_NAME));
            }

            const snapshot = await getDocs(q);
            const plans = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
                } as ButcherSubscriptionPlan;
            });

            // Client-side sort to avoid composite index requirement
            return plans.sort((a, b) => (a.order || 0) - (b.order || 0));
        } catch (error) {
            console.error('Error fetching plans:', error);
            return [];
        }
    },

    // Get only active plans (for butcher selection)
    getActivePlans: async (businessType?: string): Promise<ButcherSubscriptionPlan[]> => {
        try {
            let constraints: any[] = [where('isActive', '==', true)];

            if (businessType && businessType !== 'all') {
                constraints.unshift(where('businessType', '==', businessType));
            }

            const q = query(collection(db, COLLECTION_NAME), ...constraints);
            const snapshot = await getDocs(q);
            const plans = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
                } as ButcherSubscriptionPlan;
            });

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

    // Seed default plans if collection is empty
    seedDefaults: async (): Promise<void> => {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        if (!snapshot.empty) return; // Already seeded

        const defaults: ButcherSubscriptionPlan[] = [
            // 1. FREE (Deneme / Küçük Esnaf)
            {
                id: 'free',
                businessType: 'butcher',
                code: 'free',
                name: 'Free',
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
                    aiSupplierOrdering: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            // 2. BASIC (Esnaf)
            {
                id: 'basic',
                businessType: 'butcher',
                code: 'basic',
                name: 'Basic',
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
                    aiSupplierOrdering: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            // 3. PRO (Aktif Kasap)
            {
                id: 'pro',
                businessType: 'butcher',
                code: 'pro',
                name: 'Pro',
                description: 'Günlük sipariş alan aktif kasaplar için.',
                monthlyFee: 59.99,
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
                    delivery: true, // Kurye entegrasyonu
                    onlinePayment: true, // Kart/Apple Pay
                    campaigns: true,
                    basicStatsOnly: false, // Detaylı rapor
                    marketing: false,
                    prioritySupport: true,
                    liveCourierTracking: true,
                    eslIntegration: false,
                    posIntegration: true, // Planned
                    scaleIntegration: true, // Planned
                    accountingIntegration: true, // Planned
                    aiSupplierOrdering: true // B2B Sipariş
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            // 4. ULTRA (Zincir / Lider)
            {
                id: 'ultra',
                businessType: 'butcher',
                code: 'ultra',
                name: 'Ultra',
                description: 'En kapsamlı özellik paketi.',
                monthlyFee: 99.99,
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
                    onlinePayment: true,
                    campaigns: true,
                    basicStatsOnly: false,
                    marketing: true,
                    prioritySupport: true,
                    liveCourierTracking: true,
                    eslIntegration: true, // ESL Etiketleri Dahil
                    posIntegration: true,
                    scaleIntegration: true,
                    accountingIntegration: true,
                    aiSupplierOrdering: true
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
