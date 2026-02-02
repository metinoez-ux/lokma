import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin'; // Admin SDK for secure updates

import { stripe, createStripeCustomer, createSubscription, scheduleSubscriptionChange, cancelSubscription } from '@/lib/stripe';
import { ButcherPartner, ButcherSubscriptionPlan } from '@/types';

// Helper to get Plan Price ID based on cycle
const getStripePriceId = (plan: ButcherSubscriptionPlan, cycle: 'monthly' | 'yearly') => {
    if (!plan.stripePriceId) return null;
    return cycle === 'yearly' ? plan.stripePriceId.yearly : plan.stripePriceId.monthly;
};

export async function POST(request: Request) {
    try {
        const { db } = getFirebaseAdmin();

        // 1. Verify Authentication (Super Admin only typically)
        // In a real app, middleware handles auth, but we can double check logic here if needed.
        // For now, assuming protected route.

        const body = await request.json();
        const { butcherId, planCode, billingCycle } = body; // planCode: 'pro', 'basic' etc.

        if (!butcherId || !planCode) {
            return NextResponse.json({ error: 'Missing defined parameters' }, { status: 400 });
        }

        // 2. Fetch Butcher & Target Plan
        const butcherDoc = await db.collection('businesses').doc(butcherId).get();
        if (!butcherDoc.exists) {
            return NextResponse.json({ error: 'Butcher not found' }, { status: 404 });
        }
        const butcher = butcherDoc.data() as ButcherPartner;

        // If plan is 'none', cancel subscription
        if (planCode === 'none') {
            if (butcher.subscriptionId && butcher.subscriptionStatus === 'active') {
                await cancelSubscription(butcher.subscriptionId);
                await db.collection('businesses').doc(butcherId).update({
                    subscriptionStatus: 'cancelled',
                    nextSubscriptionPlan: null,
                    updatedAt: new Date()
                });
                return NextResponse.json({ success: true, message: 'Subscription cancelled at period end.' });
            }
            return NextResponse.json({ success: true, message: 'No active subscription to cancel.' });
        }

        // Fetch Plan Details
        const plansSnapshot = await db.collection('subscription_plans').where('code', '==', planCode).limit(1).get();
        if (plansSnapshot.empty) {
            return NextResponse.json({ error: 'Plan code invalid' }, { status: 400 });
        }
        const targetPlan = plansSnapshot.docs[0].data() as ButcherSubscriptionPlan;

        // 3. Resolve Stripe Price ID
        const priceId = getStripePriceId(targetPlan, billingCycle || 'monthly');

        // Check if we have a real Stripe Price ID (User needs to put this in DB)
        if (!priceId) {
            // Fallback: If no Stripe ID configured yet, just update Firestore (Manual Mode)
            console.warn(`No Stripe Price ID found for plan ${planCode} (${billingCycle}). Updating DB only.`);
            await db.collection('businesses').doc(butcherId).update({
                subscriptionPlan: planCode,
                billingCycle: billingCycle || 'monthly',
                monthlyFee: billingCycle === 'yearly' ? targetPlan.yearlyFee : targetPlan.monthlyFee,
                subscriptionStatus: 'active',
                updatedAt: new Date()
            });
            return NextResponse.json({ success: true, message: 'Plan updated locally (No Stripe Price ID configured).' });
        }

        // 4. Ensure Stripe Customer Exists
        let stripeCustomerId = butcher.stripeCustomerId; // You need to add this field to type if missing
        if (!stripeCustomerId) {
            const customer = await createStripeCustomer({
                email: butcher.contactPerson.email || `butcher_${butcher.customerId}@mira.com`, // Fallback email
                name: butcher.companyName,
                butcherId: butcher.id,
                address: {
                    line1: butcher.address.street,
                    city: butcher.address.city,
                    postal_code: butcher.address.postalCode,
                    country: butcher.address.country,
                }
            });
            stripeCustomerId = customer.id;
            await db.collection('businesses').doc(butcherId).update({ stripeCustomerId });
        }

        // 5. Handle Subscription
        let updatedSubscription;

        // CASE A: Create New Subscription (No active sub)
        if (!butcher.subscriptionId || butcher.subscriptionStatus !== 'active') {
            const sub = await createSubscription({
                customerId: stripeCustomerId,
                priceId: priceId,
                trialDays: targetPlan.trialDays, // Use trial days from plan
                metadata: {
                    butcherId: butcher.id,
                    planCode: planCode
                }
            });

            // Save to Firestore
            await db.collection('businesses').doc(butcherId).update({
                subscriptionPlan: planCode,
                billingCycle: billingCycle || 'monthly',
                monthlyFee: billingCycle === 'yearly' ? targetPlan.yearlyFee : targetPlan.monthlyFee,
                subscriptionId: sub.id,
                subscriptionStatus: 'active', // Or 'trialing' check sub.status
                updatedAt: new Date()
            });

            updatedSubscription = sub;
        }
        // CASE B: Update Existing Subscription
        else {
            // Schedule change for end of period
            const sub = await scheduleSubscriptionChange({
                subscriptionId: butcher.subscriptionId,
                newPriceId: priceId
            });

            // Update Firestore to reflect "Pending Change"
            await db.collection('businesses').doc(butcherId).update({
                nextSubscriptionPlan: planCode,
                nextSubscriptionDate: new Date((sub as any).current_period_end * 1000), // Approximate
                updatedAt: new Date()
            });

            updatedSubscription = sub;
        }

        return NextResponse.json({ success: true, subscription: updatedSubscription });

    } catch (error: any) {
        console.error('Subscription Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
