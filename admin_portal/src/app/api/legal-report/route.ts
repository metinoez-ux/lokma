// API Route for sending legal report email notifications via Resend
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend, DEFAULT_SENDER } from '@/lib/resend-email';

const ADMIN_EMAIL = 'metin.oez@gmail.com';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            reportId,
            businessName,
            productName,
            topic,
            reason,
            description,
            reporterName,
            reporterEmail,
            category,
        } = body;

        if (!reportId || !businessName || !topic || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const topicLabels: Record<string, string> = {
            food_safety: 'Lebensmittelsicherheit',
            description: 'Irreführende Beschreibung',
            images: 'Bilder',
            allergens: 'Allergene',
            forbidden: 'Verbotene Inhaltsstoffe',
            other: 'Sonstiges',
        };

        const topicLabel = topicLabels[topic] || topic;
        const dateStr = new Date().toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: #C62828; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">🚩</div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Neue Meldung — Rechtliche Bedenken</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Marketplace</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <h2 style="color: #fb335b; margin: 0 0 20px 0; font-size: 20px;">Meldung #${reportId.slice(0, 8).toUpperCase()}</h2>
                    
                    <!-- Report Details -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; border-left: 4px solid #fb335b;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Geschäft:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">${businessName}</td>
                            </tr>
                            ${productName ? `<tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Produkt:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${productName}</td>
                            </tr>` : ''}
                            ${category ? `<tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Kategorie:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${category}</td>
                            </tr>` : ''}
                            <tr style="border-top: 1px solid #444;">
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Thema:</td>
                                <td style="padding: 10px 0; color: #fb335b; font-weight: bold; text-align: right;">${topicLabel}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Grund:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${reason}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Datum:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${dateStr}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Description -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; margin-top: 15px;">
                        <p style="margin: 0 0 8px 0; color: #888; font-size: 12px;">BESCHREIBUNG</p>
                        <p style="margin: 0; color: white; line-height: 1.6;">${description || 'Keine Beschreibung angegeben.'}</p>
                    </div>
                    
                    <!-- Reporter Info -->
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; margin-top: 15px;">
                        <p style="margin: 0 0 8px 0; color: #888; font-size: 12px;">MELDER</p>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 5px 0; color: #888; font-size: 14px;">Name:</td>
                                <td style="padding: 5px 0; color: white; text-align: right;">${reporterName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #888; font-size: 14px;">E-Mail:</td>
                                <td style="padding: 5px 0; color: #fb335b; text-align: right;">${reporterEmail}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- CTA -->
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="https://lokma.web.app/admin/reports" style="display: inline-block; padding: 12px 30px; background: #C62828; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                            Im Admin Portal ansehen →
                        </a>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">Diese E-Mail wurde automatisch generiert.</p>
                    <p style="margin: 10px 0 0 0;">© LOKMA Marketplace</p>
                </div>
            </div>
        `;

        const result = await sendEmailWithResend({
            to: ADMIN_EMAIL,
            subject: `🚩 Neue Meldung: ${topicLabel} — ${businessName}`,
            html: emailHtml,
            replyTo: reporterEmail,
        });

        if (!result.success) {
            console.error('Resend email error:', result.error);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, emailId: result.id });
    } catch (error) {
        console.error('Error sending legal report email:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
