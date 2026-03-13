import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { nt, resolveLocale } from '@/lib/notification-i18n';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;

const client = twilio(accountSid, authToken);

interface WhatsAppRequest {
    to: string;
    message: string;
    locale?: string;
    templateType?: 'order_confirmation' | 'order_ready' | 'order_rejected' | 'custom';
    templateData?: Record<string, string>;
}

// Locale-aware message templates
function getTemplateMessage(locale: string, templateType: string, data: Record<string, string>): string {
    const loc = resolveLocale(locale);
    switch (templateType) {
        case 'order_confirmation':
            return nt(loc, 'whatsapp.order.confirmation', {
                customer: data.customerName || nt(loc, 'common.defaultCustomer'),
                orderId: data.orderId || '',
                business: data.butcherName || nt(loc, 'common.defaultBusiness'),
                total: data.total || '0',
            });
        case 'order_ready':
            return nt(loc, 'whatsapp.order.ready', {
                customer: data.customerName || nt(loc, 'common.defaultCustomer'),
                orderId: data.orderId || '',
                business: data.butcherName || nt(loc, 'common.defaultBusiness'),
                address: data.address || '',
            });
        case 'order_rejected':
            return nt(loc, 'whatsapp.order.rejected', {
                customer: data.customerName || nt(loc, 'common.defaultCustomer'),
                orderId: data.orderId || '',
                reason: data.reason || '',
                phone: data.butcherPhone || '',
            });
        default:
            return nt(loc, 'whatsapp.fallback');
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: WhatsAppRequest = await request.json();
        const { to, message, locale: rawLocale, templateType, templateData } = body;
        const locale = resolveLocale(rawLocale);

        if (!to) {
            return NextResponse.json(
                { success: false, error: nt(locale, 'whatsapp.phoneRequired') },
                { status: 400 }
            );
        }

        // Format phone number for WhatsApp
        let formattedPhone = to.replace(/\s+/g, '').replace(/^0/, '');
        if (!formattedPhone.startsWith('+')) {
            // Assume German number if no country code
            formattedPhone = '+49' + formattedPhone;
        }
        const whatsappTo = `whatsapp:${formattedPhone}`;

        // Determine message content
        let messageBody: string;
        if (templateType && templateType !== 'custom' && templateData) {
            messageBody = getTemplateMessage(locale, templateType, templateData);
        } else {
            messageBody = message || nt(locale, 'whatsapp.fallback');
        }

        // Send WhatsApp message via Twilio
        const twilioMessage = await client.messages.create({
            body: messageBody,
            from: twilioWhatsAppFrom,
            to: whatsappTo,
        });

        console.log('WhatsApp sent successfully:', twilioMessage.sid);

        return NextResponse.json({
            success: true,
            messageId: twilioMessage.sid,
            status: twilioMessage.status,
            to: whatsappTo,
        });

    } catch (error) {
        console.error('Twilio WhatsApp error:', error);

        const errorMessage = error instanceof Error ? error.message : 'WhatsApp send failed';

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
