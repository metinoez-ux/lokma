import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Sandbox number

const client = twilio(accountSid, authToken);

// =============================================================================
// WHATSAPP MESSAGE TYPES
// =============================================================================

export type WhatsAppMessageType =
    | 'order_confirmed'
    | 'order_preparing'
    | 'order_ready'
    | 'order_out_for_delivery'
    | 'order_delivered'
    | 'order_cancelled'
    | 'campaign'
    | 'staff_invitation';

// =============================================================================
// MESSAGE TEMPLATES (Turkish)
// =============================================================================

const MESSAGE_TEMPLATES: Record<WhatsAppMessageType, (data: Record<string, string>) => string> = {
    order_confirmed: (data) =>
        `✅ Siparişiniz Onaylandı!\n\n` +
        `Sipariş No: #${data.orderId}\n` +
        `İşletme: ${data.businessName}\n` +
        `Toplam: ${data.total} €\n\n` +
        `Siparişiniz hazırlanmaya başlandığında size haber vereceğiz.`,

    order_preparing: (data) =>
        `👨‍🍳 Siparişiniz Hazırlanıyor!\n\n` +
        `Sipariş No: #${data.orderId}\n` +
        `İşletme: ${data.businessName}\n\n` +
        `Tahmini hazırlık süresi: ${data.prepTime || '15-20'} dakika`,

    order_ready: (data) =>
        `🎉 Siparişiniz Hazır!\n\n` +
        `Sipariş No: #${data.orderId}\n` +
        `İşletme: ${data.businessName}\n\n` +
        `${data.isDelivery === 'true'
            ? 'Kurye yola çıkmak üzere.'
            : 'Gel-Al için hazır. Adres: ' + data.address}`,

    order_out_for_delivery: (data) =>
        `🚗 Siparişiniz Yolda!\n\n` +
        `Sipariş No: #${data.orderId}\n` +
        `Kurye: ${data.courierName || 'Kurye'}\n` +
        `Tahmini varış: ${data.eta || '15-25'} dakika\n\n` +
        `${data.trackingUrl ? 'Canlı takip: ' + data.trackingUrl : ''}`,

    order_delivered: (data) =>
        `✅ Siparişiniz Teslim Edildi!\n\n` +
        `Sipariş No: #${data.orderId}\n` +
        `İşletme: ${data.businessName}\n\n` +
        `Afiyet olsun! 🥩\n` +
        `Bizi değerlendirmeyi unutmayın.`,

    order_cancelled: (data) =>
        `❌ Sipariş İptal Edildi\n\n` +
        `Sipariş No: #${data.orderId}\n` +
        `Sebep: ${data.reason || 'Belirtilmedi'}\n\n` +
        `Sorularınız için: ${data.businessPhone}`,

    campaign: (data) =>
        `🎁 ${data.title}\n\n` +
        `${data.message}\n\n` +
        `${data.businessName}`,

    staff_invitation: (data) =>
        `🎉 MIRA Sistemi Davet\n\n` +
        `Merhaba ${data.staffName},\n\n` +
        `${data.inviterName} sizi ${data.businessName} işletmesinde ${data.role} olarak MIRA sistemine ekledi.\n\n` +
        `🔑 Giriş Bilgileri:\n` +
        `📱 Kullanıcı Adı: ${data.phoneNumber}\n` +
        `🔒 Geçici Şifre: ${data.tempPassword}\n\n` +
        `👉 Giriş yapmak için: ${data.loginUrl}\n\n` +
        `⚠️ İlk girişte şifrenizi değiştirmeniz gerekecektir.`,
};

// =============================================================================
// SEND WHATSAPP MESSAGE
// =============================================================================

export async function sendWhatsAppMessage(params: {
    to: string; // Phone number (e.g., +49170123456)
    type: WhatsAppMessageType;
    data: Record<string, string>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        // Format phone number for WhatsApp
        const toNumber = params.to.startsWith('whatsapp:')
            ? params.to
            : `whatsapp:${params.to}`;

        // Get message body from template
        const body = MESSAGE_TEMPLATES[params.type](params.data);

        // Send message
        const message = await client.messages.create({
            from: whatsappFrom,
            to: toNumber,
            body: body,
        });

        console.log(`WhatsApp message sent: ${message.sid}`);

        return {
            success: true,
            messageId: message.sid,
        };
    } catch (error) {
        console.error('WhatsApp message error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// =============================================================================
// BATCH SEND (for campaigns)
// =============================================================================

export async function sendWhatsAppCampaign(params: {
    recipients: string[];
    title: string;
    message: string;
    businessName: string;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const phone of params.recipients) {
        const result = await sendWhatsAppMessage({
            to: phone,
            type: 'campaign',
            data: {
                title: params.title,
                message: params.message,
                businessName: params.businessName,
            },
        });

        if (result.success) {
            results.sent++;
        } else {
            results.failed++;
            results.errors.push(`${phone}: ${result.error}`);
        }

        // Rate limiting - wait 100ms between messages
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
}

// =============================================================================
// QUICK HELPERS
// =============================================================================

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

// =============================================================================
// STAFF INVITATION SMS
// =============================================================================

export async function sendStaffInvitationSMS(params: {
    staffPhone: string;
    staffName: string;
    inviterName: string;
    businessName: string;
    role: string;
    tempPassword: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const loginUrl = 'https://miraportal.com/login';

    return sendWhatsAppMessage({
        to: params.staffPhone,
        type: 'staff_invitation',
        data: {
            staffName: params.staffName,
            inviterName: params.inviterName,
            businessName: params.businessName,
            role: params.role,
            phoneNumber: params.staffPhone,
            tempPassword: params.tempPassword,
            loginUrl: loginUrl,
        },
    });
}

// Generate 6-digit temporary password
export function generateTempPassword(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
