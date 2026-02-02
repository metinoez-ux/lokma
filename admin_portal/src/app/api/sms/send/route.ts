import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioSmsFrom = process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

interface SmsRequest {
    to: string;
    message: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: SmsRequest = await request.json();
        const { to, message } = body;

        if (!to) {
            return NextResponse.json(
                { success: false, error: 'Telefon numarası gerekli' },
                { status: 400 }
            );
        }

        if (!message) {
            return NextResponse.json(
                { success: false, error: 'Mesaj gerekli' },
                { status: 400 }
            );
        }

        // Check if Twilio is configured
        if (!accountSid || !authToken || !twilioSmsFrom) {
            console.error('Twilio SMS not configured. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM');
            return NextResponse.json(
                { success: false, error: 'SMS servisi yapılandırılmamış' },
                { status: 500 }
            );
        }

        // Format phone number for SMS
        let formattedPhone = to.replace(/\s+/g, '').replace(/[()-]/g, '');
        if (!formattedPhone.startsWith('+')) {
            // Assume German number if no country code
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '+49' + formattedPhone.slice(1);
            } else {
                formattedPhone = '+49' + formattedPhone;
            }
        }

        console.log('📱 Sending SMS to:', formattedPhone);

        // Send SMS via Twilio
        const twilioMessage = await client.messages.create({
            body: message,
            from: twilioSmsFrom,
            to: formattedPhone,
        });

        console.log('✅ SMS sent successfully:', twilioMessage.sid);

        return NextResponse.json({
            success: true,
            messageId: twilioMessage.sid,
            status: twilioMessage.status,
            to: formattedPhone,
        });

    } catch (error) {
        console.error('❌ Twilio SMS error:', error);

        const errorMessage = error instanceof Error ? error.message : 'SMS gönderilemedi';

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
