/**
 * Billing Data Collector Service
 * 
 * Aggregates monthly billing data for each business:
 * - Subscription plan fee
 * - Commission from orders
 * - Active module fees
 * - Sponsored product conversion fees
 * 
 * Used by the monthly invoicing cron to build Lexware invoices.
 */

import * as admin from "firebase-admin";

// Lazy-init to avoid calling admin.firestore() before initializeApp()
let _db: admin.firestore.Firestore | null = null;
function getDb(): admin.firestore.Firestore {
    if (!_db) _db = admin.firestore();
    return _db;
}

// =============================================================================
// TYPES
// =============================================================================

export interface MonthlyBillingData {
    businessId: string;
    businessName: string;
    businessAddress: {
        street: string;
        zip: string;
        city: string;
        countryCode: string;
    };
    businessEmail: string;
    vatId: string; // USt-IdNr. — required for EU reverse-charge (§13b UStG)

    // Subscription
    subscriptionPlanId: string;
    subscriptionPlanName: string;
    subscriptionFee: number; // Gross amount

    // Commission
    commissionAmount: number; // Gross total commission
    commissionDetails: {
        totalSales: number;
        orderCount: number;
        ratePercent: number;
        cardCommission: number;
        cashCommission: number;
    };
    commissionRecordIds: string[];

    // Modules
    activeModules: { name: string; fee: number }[];

    // Sponsored
    sponsoredFee: number;
    sponsoredConversions: number;
    sponsoredRecordIds: string[];

    // Totals
    totalGrossAmount: number;
    hasChargeableItems: boolean;
}

// =============================================================================
// DATA COLLECTION
// =============================================================================

/**
 * Collects all billing data for a single business for the given period.
 */
export async function collectMonthlyBillingData(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
): Promise<MonthlyBillingData> {
    // 1. Get business info
    const businessDoc = await getDb().collection("butcher_partners").doc(businessId).get();
    const business = businessDoc.data() || {};

    const businessName = business.companyName || business.brand || "Unbekannt";
    const address = business.address || {};
    const businessAddress = {
        street: address.street || "",
        zip: address.postalCode || address.zip || "",
        city: address.city || "",
        countryCode: address.countryCode || business.countryCode || "DE",
    };
    const businessEmail = business.email || business.contactEmail || business.adminEmail || "";
    const vatId = business.vatId || business.ustIdNr || business.taxId || "";

    // 2. Get subscription plan
    const planId = business.subscriptionPlan || "basic";
    const planDoc = await getDb().collection("subscription_plans").doc(planId).get();
    const plan = planDoc.exists ? planDoc.data() : null;
    const subscriptionFee = plan?.monthlyFee || business.monthlyFee || 0;
    const subscriptionPlanName = plan?.name || planId;
    const commissionRate = plan?.commissionRate || business.commissionRate || 0;

    // 3. Aggregate commission records for this period
    const periodString = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;

    const commRecordsSnapshot = await getDb().collection("commission_records")
        .where("businessId", "==", businessId)
        .where("period", "==", periodString)
        .get();

    let totalCommission = 0;
    let cardCommission = 0;
    let cashCommission = 0;
    let totalSales = 0;
    let orderCount = 0;
    const commissionRecordIds: string[] = [];

    for (const recDoc of commRecordsSnapshot.docs) {
        const rec = recDoc.data();
        totalCommission += rec.totalCommission || 0;
        totalSales += rec.orderTotal || rec.totalAmount || 0;
        orderCount++;
        commissionRecordIds.push(recDoc.id);

        const isCard = rec.paymentMethod === "card" || rec.paymentMethod === "stripe";
        if (isCard) {
            cardCommission += rec.totalCommission || 0;
        } else {
            cashCommission += rec.totalCommission || 0;
        }
    }

    // Round to 2 decimals
    totalCommission = Math.round(totalCommission * 100) / 100;
    cardCommission = Math.round(cardCommission * 100) / 100;
    cashCommission = Math.round(cashCommission * 100) / 100;

    // 4. Active module fees
    const activeModules: { name: string; fee: number }[] = [];
    const modules = business.activeModules || plan?.includedModules || {};

    // Module definitions with prices (could be from Firestore config)
    const moduleConfig: Record<string, { name: string; fee: number }> = {
        courier: { name: "Kurierservice", fee: 15 },
        tableOrdering: { name: "Tischbestellung", fee: 10 },
        loyalty: { name: "Treueprogramm", fee: 10 },
        smartNotifications: { name: "Smart Benachrichtigungen", fee: 5 },
        analytics: { name: "Erweiterte Analysen", fee: 10 },
    };

    if (typeof modules === "object") {
        for (const [key, value] of Object.entries(modules)) {
            if (value === true && moduleConfig[key]) {
                // Check if module fee is included in plan or extra
                const includedInPlan = plan?.includedModules?.[key] === true;
                if (!includedInPlan && moduleConfig[key].fee > 0) {
                    activeModules.push(moduleConfig[key]);
                }
            }
        }
    }

    // 5. Sponsored conversion fees
    let sponsoredFee = 0;
    let sponsoredConversions = 0;
    const sponsoredRecordIds: string[] = [];

    try {
        const sponsoredSnapshot = await getDb().collection("sponsored_conversions")
            .where("businessId", "==", businessId)
            .where("period", "==", periodString)
            .get();

        for (const sDoc of sponsoredSnapshot.docs) {
            const sData = sDoc.data();
            sponsoredFee += sData.totalFee || 0;
            sponsoredConversions += sData.sponsoredItemCount || 0;
            sponsoredRecordIds.push(sDoc.id);
        }
        sponsoredFee = Math.round(sponsoredFee * 100) / 100;
    } catch (err) {
        console.error(`[BillingCollector] Error aggregating sponsored fees for ${businessId}:`, err);
    }

    // 6. Calculate totals
    const moduleFeeTotal = activeModules.reduce((sum, m) => sum + m.fee, 0);
    const totalGrossAmount = Math.round(
        (subscriptionFee + totalCommission + moduleFeeTotal + sponsoredFee) * 100
    ) / 100;

    return {
        businessId,
        businessName,
        businessAddress,
        businessEmail,
        vatId,
        subscriptionPlanId: planId,
        subscriptionPlanName,
        subscriptionFee,
        commissionAmount: totalCommission,
        commissionDetails: {
            totalSales: Math.round(totalSales * 100) / 100,
            orderCount,
            ratePercent: commissionRate * 100,
            cardCommission,
            cashCommission,
        },
        commissionRecordIds,
        activeModules,
        sponsoredFee,
        sponsoredConversions,
        sponsoredRecordIds,
        totalGrossAmount,
        hasChargeableItems: totalGrossAmount > 0,
    };
}

/**
 * Collects billing data for ALL active businesses.
 */
export async function collectAllBusinessBillingData(
    periodStart: Date,
    periodEnd: Date
): Promise<MonthlyBillingData[]> {
    const businessesSnapshot = await getDb().collection("butcher_partners")
        .where("subscriptionStatus", "==", "active")
        .get();

    console.log(`[BillingCollector] Found ${businessesSnapshot.size} active businesses`);

    const results: MonthlyBillingData[] = [];

    for (const doc of businessesSnapshot.docs) {
        try {
            const data = await collectMonthlyBillingData(doc.id, periodStart, periodEnd);
            results.push(data);
        } catch (error) {
            console.error(`[BillingCollector] Error collecting data for ${doc.id}:`, error);
        }
    }

    return results;
}
