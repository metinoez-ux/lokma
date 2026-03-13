// API Route for sending emails via Resend
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend, DEFAULT_SENDER } from '@/lib/resend-email';

interface SendEmailRequest {
    type?: 'general' | 'welcome' | 'reservation' | 'password_reset' | 'kandil' | 'cuma' | 'cenaze';
    to: string | string[];
    // Type-specific data
    data?: Record<string, unknown>;
    // Direct email content (alternative to type-based templates)
    subject?: string;
    html?: string;
}

// Email Templates (simplified for direct API use)
const EmailTemplates = {
    welcome: (userName: string) => ({
        subject: 'Willkommen bei LOKMA!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; border-radius: 12px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">LOKMA</h1>
                    <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Frisches Fleisch, schnelle Lieferung</p>
                </div>
                <div style="padding: 30px; background: #f9fafb; border-radius: 12px; margin-top: 20px;">
                    <h2 style="color: #1f2937; margin-top: 0;">Hallo ${userName}!</h2>
                    <p style="color: #4b5563; line-height: 1.6;">
                        Vielen Dank, dass Sie sich bei LOKMA registriert haben!
                    </p>
                </div>
                <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                    <p>© LOKMA Marketplace - lokma.shop</p>
                </div>
            </div>
        `,
    }),

    general: (title: string, message: string) => ({
        subject: `${title}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; border-radius: 12px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">${title}</h1>
                    <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">LOKMA Marketplace</p>
                </div>
                <div style="padding: 30px; background: #f9fafb; border-radius: 12px; margin-top: 20px;">
                    <p style="color: #333; line-height: 1.6; font-size: 16px;">${message}</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                    <p>© LOKMA Marketplace - lokma.shop</p>
                </div>
            </div>
        `,
    }),

    password_reset: (userName: string, resetLink: string) => ({
        subject: 'Passwort zurücksetzen',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; border-radius: 12px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Passwort zurücksetzen</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb; border-radius: 12px; margin-top: 20px;">
                    <h2 style="color: #333; margin-top: 0;">Hallo ${userName}!</h2>
                    <p style="color: #333; line-height: 1.6;">
                        Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Passwort zurücksetzen
                        </a>
                    </div>
                    <p style="color: #888; font-size: 13px;">
                        Dieser Link ist 1 Stunde gültig.
                    </p>
                </div>
            </div>
        `,
    }),
};

export async function POST(request: NextRequest) {
    try {
        const body: SendEmailRequest = await request.json();

        // OPTION 1: Direct HTML content (used by create-user welcome emails)
        if (body.to && body.subject && body.html) {
            const result = await sendEmailWithResend({
                to: body.to,
                subject: body.subject,
                html: body.html,
            });

            if (result.success) {
                return NextResponse.json({
                    success: true,
                    messageId: result.id,
                });
            } else {
                console.error('Resend email error:', result.error);
                return NextResponse.json(
                    { error: result.error || 'Failed to send email' },
                    { status: 500 }
                );
            }
        }

        // OPTION 2: Type-based templates (original behavior)
        if (!body.to || !body.type) {
            return NextResponse.json(
                { error: 'Recipient (to) and either (type) or (subject + html) are required' },
                { status: 400 }
            );
        }

        let emailContent: { subject: string; html: string };

        switch (body.type) {
            case 'welcome':
                emailContent = EmailTemplates.welcome(
                    (body.data?.userName as string) || 'Benutzer'
                );
                break;

            case 'password_reset':
                emailContent = EmailTemplates.password_reset(
                    (body.data?.userName as string) || 'Benutzer',
                    (body.data?.resetLink as string) || ''
                );
                break;

            case 'general':
            default:
                emailContent = EmailTemplates.general(
                    (body.data?.title as string) || 'Benachrichtigung',
                    (body.data?.message as string) || ''
                );
                break;
        }

        const result = await sendEmailWithResend({
            to: body.to,
            subject: emailContent.subject,
            html: emailContent.html,
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.id,
            });
        } else {
            console.error('Resend email error:', result.error);
            return NextResponse.json(
                { error: result.error || 'Failed to send email' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Email API Error:', error);
        return NextResponse.json(
            { error: 'Failed to send email', details: String(error) },
            { status: 500 }
        );
    }
}
