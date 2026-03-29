export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend, DEFAULT_SENDER } from '@/lib/resend-email';

/**
 * Printer Alert API
 * Sends email notifications when printer goes offline/online.
 * Rate-limited: won't send duplicate alerts within 5 minutes.
 */

// In-memory rate limiting (per printer IP)
const lastAlertTimes: Map<string, number> = new Map();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const SUPER_ADMIN_EMAIL = 'metin.oez@gmail.com';

function buildAlertEmail(params: {
    type: 'offline' | 'online';
    businessName: string;
    printerIp: string;
    printerPort: number;
    errorDetails?: string;
    lastSuccessfulPrint?: string;
}) {
    const isOffline = params.type === 'offline';
    const timestamp = new Date().toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const statusColor = isOffline ? '#C62828' : '#2E7D32';
    const statusIcon = isOffline ? '🔴' : '🟢';
    const statusText = isOffline ? 'OFFLINE' : 'ONLINE';
    const statusTextDE = isOffline ? 'Drucker ist offline!' : 'Drucker ist wieder online!';

    return {
        subject: `${statusIcon} Bon-Drucker ${statusText} — ${params.businessName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: white;">
                <!-- Header -->
                <div style="background: ${statusColor}; padding: 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 5px;">${isOffline ? '🖨️❌' : '🖨️✅'}</div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${statusTextDE}</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">LOKMA Druckerüberwachung</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <div style="background: #2a2a2a; border-radius: 12px; padding: 20px; border-left: 4px solid ${statusColor};">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Unternehmen:</td>
                                <td style="padding: 10px 0; color: white; font-weight: bold; text-align: right;">${params.businessName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Drucker-IP:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${params.printerIp}:${params.printerPort}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Zeitpunkt:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${timestamp}</td>
                            </tr>
                            ${params.errorDetails ? `
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Fehler:</td>
                                <td style="padding: 10px 0; color: #ff6b6b; text-align: right; font-size: 13px;">${params.errorDetails}</td>
                            </tr>
                            ` : ''}
                            ${params.lastSuccessfulPrint ? `
                            <tr>
                                <td style="padding: 10px 0; color: #888; font-size: 14px;">Letzter Druck:</td>
                                <td style="padding: 10px 0; color: white; text-align: right;">${params.lastSuccessfulPrint}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    
                    ${isOffline ? `
                    <div style="background: #3d2020; border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #C62828;">
                        <p style="margin: 0; color: #ffaaaa; font-size: 13px;">
                            <strong>⚠️ Achtung:</strong> Neue Bestellungen können nicht automatisch gedruckt werden, solange der Drucker offline ist. Bitte prüfen Sie:
                        </p>
                        <ul style="color: #ffaaaa; font-size: 13px; margin: 10px 0 0 0; padding-left: 20px;">
                            <li>Drucker eingeschaltet?</li>
                            <li>WLAN-Verbindung stabil?</li>
                            <li>Papier vorhanden?</li>
                            <li>Netzwerkkabel/ USB verbunden?</li>
                        </ul>
                    </div>
                    ` : `
                    <div style="background: #1a3a1a; border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #2E7D32;">
                        <p style="margin: 0; color: #a5d6a7; font-size: 13px;">
                            <strong>✅ Alles in Ordnung:</strong> Der Drucker ist wieder erreichbar. Automatischer Druck wird fortgesetzt.
                        </p>
                    </div>
                    `}
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #333;">
                    <p style="margin: 0;">LOKMA Druckerüberwachung • Automatische Benachrichtigung</p>
                </div>
            </div>
        `,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            type,
            businessName,
            printerIp,
            printerPort = 9100,
            errorDetails,
            lastSuccessfulPrint,
            adminEmail,
        } = body;

        if (!type || !businessName || !printerIp) {
            return NextResponse.json(
                { error: 'type, businessName, and printerIp are required' },
                { status: 400 }
            );
        }

        // Rate limiting — prevent spam
        const rateKey = `${printerIp}:${type}`;
        const lastAlert = lastAlertTimes.get(rateKey);
        const now = Date.now();

        if (lastAlert && now - lastAlert < ALERT_COOLDOWN_MS) {
            const remainingSec = Math.ceil((ALERT_COOLDOWN_MS - (now - lastAlert)) / 1000);
            return NextResponse.json({
                success: false,
                rateLimited: true,
                message: `Alert already sent. Next alert available in ${remainingSec}s.`,
            });
        }

        lastAlertTimes.set(rateKey, now);

        // Build email
        const emailContent = buildAlertEmail({
            type,
            businessName,
            printerIp,
            printerPort,
            errorDetails,
            lastSuccessfulPrint,
        });

        // Send to super admin + business admin
        const recipients: string[] = [SUPER_ADMIN_EMAIL];
        if (adminEmail && adminEmail !== SUPER_ADMIN_EMAIL) {
            recipients.push(adminEmail);
        }

        const result = await sendEmailWithResend({
            to: recipients,
            subject: emailContent.subject,
            html: emailContent.html,
            from: DEFAULT_SENDER,
        });

        if (!result.success) {
            console.error('Printer alert email failed:', result.error);
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Alert email sent to ${recipients.join(', ')}`,
            emailId: result.id,
        });
    } catch (error: any) {
        console.error('Printer alert error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
