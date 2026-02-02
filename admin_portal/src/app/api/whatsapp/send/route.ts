import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;

const client = twilio(accountSid, authToken);

interface WhatsAppRequest {
    to: string;
    message: string;
    templateType?: 'order_confirmation' | 'order_ready' | 'order_rejected' | 'custom';
    templateData?: Record<string, string>;
}

// Pre-defined Turkish message templates
const messageTemplates = {
    order_confirmation: (data: Record<string, string>) =>
        `🎉 Siparişiniz Alındı!\n\nMerhaba ${data.customerName || 'değerli müşterimiz'},\n\n` +
        `📦 Sipariş No: ${data.orderId}\n` +
        `🥩 Kasap: ${data.butcherName}\n` +
        `💰 Toplam: ${data.total}€\n\n` +
        `Siparişiniz hazırlandığında size yeniden haber vereceğiz.\n\n` +
        `MIRA - Helal Et Siparişi`,

    order_ready: (data: Record<string, string>) =>
        `✅ Siparişiniz Hazır!\n\nMerhaba ${data.customerName || 'değerli müşterimiz'},\n\n` +
        `📦 Sipariş No: ${data.orderId}\n` +
        `🥩 ${data.butcherName} adresinden siparişinizi teslim alabilirsiniz.\n\n` +
        `📍 Adres: ${data.address || 'Kasap adresine bakınız'}\n\n` +
        `İyi günler dileriz!\nMIRA`,

    order_rejected: (data: Record<string, string>) =>
        `⚠️ Sipariş Güncellemesi\n\nMerhaba ${data.customerName || 'değerli müşterimiz'},\n\n` +
        `📦 Sipariş No: ${data.orderId}\n\n` +
        `Maalesef siparişiniz şu anda onaylanamıyor:\n${data.reason || 'Stok yetersizliği'}\n\n` +
        `📞 Alternatifler için kasabımızı arayabilirsiniz: ${data.butcherPhone || ''}\n\n` +
        `MIRA`,
};

export async function POST(request: NextRequest) {
    try {
        const body: WhatsAppRequest = await request.json();
        const { to, message, templateType, templateData } = body;

        if (!to) {
            return NextResponse.json(
                { success: false, error: 'Telefon numarası gerekli' },
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
            const templateFn = messageTemplates[templateType];
            if (templateFn) {
                messageBody = templateFn(templateData);
            } else {
                messageBody = message || 'MIRA bilgilendirme mesajı';
            }
        } else {
            messageBody = message || 'MIRA bilgilendirme mesajı';
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

        const errorMessage = error instanceof Error ? error.message : 'WhatsApp gönderilemedi';

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
