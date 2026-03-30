// WhatsApp messaging library
// Currently disabled - Twilio has been removed in favor of seven.io SMS.
// This module exports stub functions to prevent build errors.

export type WhatsAppMessageType =
    | 'order_confirmed'
    | 'order_preparing'
    | 'order_ready'
    | 'order_out_for_delivery'
    | 'order_delivered'
    | 'order_cancelled'
    | 'campaign'
    | 'staff_invitation';

export async function sendWhatsAppMessage(params: {
    to: string;
    type: WhatsAppMessageType;
    data: Record<string, string>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('WhatsApp disabled. Message not sent to:', params.to);
    return {
        success: false,
        error: 'WhatsApp provider not configured. Use SMS instead.',
    };
}

export async function sendWhatsAppCampaign(params: {
    recipients: string[];
    title: string;
    message: string;
    businessName: string;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
    console.log('WhatsApp campaign disabled. Recipients:', params.recipients.length);
    return {
        sent: 0,
        failed: params.recipients.length,
        errors: ['WhatsApp provider not configured'],
    };
}

export async function notifyOrderConfirmed(params: {
    customerPhone: string;
    orderId: string;
    businessName: string;
    total: string;
}) {
    return sendWhatsAppMessage({
        to: params.customerPhone,
        type: 'order_confirmed',
        data: params,
    });
}

export async function notifyOrderOutForDelivery(params: {
    customerPhone: string;
    orderId: string;
    courierName?: string;
    eta?: string;
    trackingUrl?: string;
}) {
    return sendWhatsAppMessage({
        to: params.customerPhone,
        type: 'order_out_for_delivery',
        data: {
            ...params,
            courierName: params.courierName || '',
            eta: params.eta || '',
            trackingUrl: params.trackingUrl || '',
        },
    });
}

export async function sendStaffInvitationSMS(params: {
    staffPhone: string;
    staffName: string;
    inviterName: string;
    businessName: string;
    role: string;
    tempPassword: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('Staff invitation via WhatsApp disabled. Use SMS route instead.');
    return {
        success: false,
        error: 'WhatsApp disabled. SMS is the active channel.',
    };
}

export function generateTempPassword(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
