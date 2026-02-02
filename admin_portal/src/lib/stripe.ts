import Stripe from 'stripe';

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// =============================================================================
// SEPA DIRECT DEBIT FUNCTIONS
// =============================================================================

/**
 * Create a Stripe Customer for a butcher partner
 */
export async function createStripeCustomer(params: {
    email: string;
    name: string;
    butcherId: string;
    address?: {
        city: string;
        country: string;
        line1: string;
        postal_code: string;
    };
}) {
    const customer = await stripe.customers.create({
        email: params.email,
        name: params.name,
        metadata: {
            butcherId: params.butcherId,
        },
        address: params.address,
    });

    return customer;
}

/**
 * Attach Payment Method to customer and set as default
 */
export async function attachPaymentMethod(params: {
    customerId: string;
    paymentMethodId: string;
}) {
    const paymentMethod = await stripe.paymentMethods.attach(
        params.paymentMethodId,
        { customer: params.customerId }
    );

    await stripe.customers.update(params.customerId, {
        invoice_settings: {
            default_payment_method: params.paymentMethodId,
        },
    });

    return paymentMethod;
}

/**
 * Create a SEPA mandate for recurring payments
 */
export async function createSepaSetupIntent(params: {
    customerId: string;
    butcherId: string;
}) {
    const setupIntent = await stripe.setupIntents.create({
        customer: params.customerId,
        payment_method_types: ['sepa_debit'],
        metadata: {
            butcherId: params.butcherId,
        },
    });

    return setupIntent;
}

// =============================================================================
// INVOICE FUNCTIONS
// =============================================================================

/**
 * Create a Stripe Invoice
 */
export async function createStripeInvoice(params: {
    customerId: string;
    items: Array<{
        description: string;
        amount: number; // in cents
        quantity?: number;
    }>;
    dueDate: Date;
    metadata?: Record<string, string>;
}) {
    for (const item of params.items) {
        await stripe.invoiceItems.create({
            customer: params.customerId,
            description: item.description,
            amount: item.amount,
            currency: 'eur',
            quantity: item.quantity || 1,
        });
    }

    const invoice = await stripe.invoices.create({
        customer: params.customerId,
        collection_method: 'charge_automatically',
        due_date: Math.floor(params.dueDate.getTime() / 1000),
        metadata: params.metadata,
    });

    return invoice;
}

/**
 * Finalize and send an invoice
 */
export async function finalizeAndSendInvoice(invoiceId: string) {
    const invoice = await stripe.invoices.finalizeInvoice(invoiceId);
    await stripe.invoices.sendInvoice(invoiceId);
    return invoice;
}

// =============================================================================
// STRIPE CONNECT (MARKETPLACE) FUNCTIONS
// =============================================================================

/**
 * Create a Connected Account for a butcher (Stripe Connect Express)
 */
export async function createConnectedAccount(params: {
    email: string;
    butcherId: string;
    businessName: string;
    country: string;
}) {
    const account = await stripe.accounts.create({
        type: 'express',
        country: params.country,
        email: params.email,
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
            name: params.businessName,
            mcc: '5462', // Bakeries/Butchers
        },
        metadata: {
            butcherId: params.butcherId,
        },
    });

    return account;
}

/**
 * Create an Account Link for onboarding
 */
export async function createAccountLink(params: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
}) {
    const accountLink = await stripe.accountLinks.create({
        account: params.accountId,
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        type: 'account_onboarding',
    });

    return accountLink;
}

/**
 * Create a Destination Charge (Customer -> MIRA -> Butcher with commission)
 */
export async function createDestinationCharge(params: {
    amount: number; // Total in cents
    customerId: string;
    connectedAccountId: string;
    commissionRate: number; // e.g., 5 for 5%
    orderId: string;
}) {
    const commissionAmount = Math.round(params.amount * (params.commissionRate / 100));
    const transferAmount = params.amount - commissionAmount;

    const paymentIntent = await stripe.paymentIntents.create({
        amount: params.amount,
        currency: 'eur',
        customer: params.customerId,
        transfer_data: {
            destination: params.connectedAccountId,
            amount: transferAmount,
        },
        metadata: {
            orderId: params.orderId,
            commissionAmount: commissionAmount.toString(),
        },
    });

    return paymentIntent;
}

/**
 * Create a manual transfer/payout to connected account
 */
export async function createTransfer(params: {
    connectedAccountId: string;
    amount: number; // in cents
    metadata?: Record<string, string>;
}) {
    const transfer = await stripe.transfers.create({
        amount: params.amount,
        currency: 'eur',
        destination: params.connectedAccountId,
        metadata: params.metadata,
    });

    return transfer;
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT (RECURRING PAYMENTS)
// =============================================================================

/**
 * Create a new Subscription
 */
export async function createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata?: Record<string, string>;
}) {
    const subscription = await stripe.subscriptions.create({
        customer: params.customerId,
        items: [{ price: params.priceId }],
        trial_period_days: params.trialDays,
        metadata: params.metadata,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
    });

    return subscription;
}

/**
 * Schedule a Plan Change (Upgrade/Downgrade)
 * Changes will apply at the END of the current billing period.
 */
export async function scheduleSubscriptionChange(params: {
    subscriptionId: string;
    newPriceId: string;
}) {
    const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;

    // Use proration_behavior: 'none' to avoid immediate charges/credits.
    // The new price will be effective from the NEXT invoice automatically if we don't prorate.
    const updatedSubscription = await stripe.subscriptions.update(params.subscriptionId, {
        items: [{
            id: subscriptionItemId,
            price: params.newPriceId,
        }],
        proration_behavior: 'none',
    });

    return updatedSubscription;
}

/**
 * Cancel Subscription (At Period End)
 */
export async function cancelSubscription(subscriptionId: string) {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
    });
    return subscription;
}

/**
 * Reactivate Cancelled Subscription
 */
export async function reactivateSubscription(subscriptionId: string) {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
    });
    return subscription;
}
