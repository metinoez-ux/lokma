import { config } from '../config';

// ─── alexa-remote2 Types (minimal) ──────────────────────────────────────────
let Alexa: any;
let alexaInstance: any = null;
let alexaReady = false;

/**
 * Initialize the Alexa Remote2 connection.
 * Must be called once on server start.
 */
export async function initAlexa(): Promise<void> {
    if (!config.alexa.cookie) {
        console.warn('⚠️  ALEXA_COOKIE not set — Alexa notifications disabled.');
        return;
    }

    try {
        Alexa = require('alexa-remote2');
    } catch {
        console.warn('⚠️  alexa-remote2 not installed — run: npm install alexa-remote2');
        return;
    }

    return new Promise((resolve) => {
        alexaInstance = new Alexa();
        alexaInstance.init(
            {
                cookie: config.alexa.cookie,
                proxyOwnIp: config.alexa.proxyOwnIp || undefined,
                proxyPort: 3001,
                bluetooth: false,
                macDms: {
                    device_private_key: '',
                    adp_token: '',
                },
            },
            (err: any) => {
                if (err) {
                    console.error('❌ Alexa init failed:', err.message || err);
                    resolve();
                    return;
                }
                alexaReady = true;
                console.log('✅ Alexa Remote connected successfully');

                // List available devices for debugging
                const devices = alexaInstance.getDevices();
                if (devices) {
                    const echoDevices = Object.values(devices).filter(
                        (d: any) => d.deviceFamily === 'ECHO' || d.deviceFamily === 'KNIGHT'
                    );
                    console.log(`   📢 Found ${echoDevices.length} Echo devices`);
                    echoDevices.forEach((d: any) => {
                        console.log(`      - ${d.accountName} (${d.serialNumber})`);
                    });
                }
                resolve();
            }
        );
    });
}

/**
 * Get all available Echo device serial numbers.
 */
export function getEchoDevices(): { name: string; serialNumber: string }[] {
    if (!alexaReady || !alexaInstance) return [];
    const devices = alexaInstance.getDevices();
    if (!devices) return [];

    return Object.values(devices)
        .filter((d: any) => d.deviceFamily === 'ECHO' || d.deviceFamily === 'KNIGHT')
        .map((d: any) => ({
            name: d.accountName,
            serialNumber: d.serialNumber,
        }));
}

/**
 * Send a TTS announcement to all Echo devices.
 */
export async function sendAlexaAnnouncement(message: string): Promise<boolean> {
    if (!alexaReady || !alexaInstance) {
        console.warn('⚠️  Alexa not ready — skipping announcement');
        return false;
    }

    return new Promise((resolve) => {
        // Use "announce" to broadcast to all devices
        alexaInstance.sendSequenceCommand(
            null, // null = all devices
            'speak',
            message,
            (err: any) => {
                if (err) {
                    console.error('❌ Alexa speak failed:', err.message || err);
                    resolve(false);
                } else {
                    console.log(`📢 Alexa announced: "${message}"`);
                    resolve(true);
                }
            }
        );
    });
}

/**
 * Play a notification sound on all Echo devices.
 */
export async function playAlexaSound(soundName?: string): Promise<boolean> {
    if (!alexaReady || !alexaInstance) {
        console.warn('⚠️  Alexa not ready — skipping sound');
        return false;
    }

    // Default notification sound
    const sound = soundName || 'amzn_sfx_doorbell_chime';

    return new Promise((resolve) => {
        alexaInstance.sendSequenceCommand(
            null,
            'sound',
            sound,
            (err: any) => {
                if (err) {
                    console.error('❌ Alexa sound failed:', err.message || err);
                    resolve(false);
                } else {
                    console.log(`🔔 Alexa played sound: ${sound}`);
                    resolve(true);
                }
            }
        );
    });
}

/**
 * Build a human-readable order announcement message.
 */
export function buildOrderMessage(
    event: string,
    orderNumber?: string,
    amount?: number,
    items?: number,
    language: 'de-DE' | 'tr-TR' = 'de-DE'
): string {
    const amountStr = amount ? amount.toFixed(2).replace('.', ' Euro ') + ' Cent' : '';

    if (language === 'tr-TR') {
        switch (event) {
            case 'new_order':
                return `Yeni sipariş geldi! ${orderNumber ? 'Sipariş numarası ' + orderNumber + '.' : ''} ${items ? items + ' ürün,' : ''} ${amountStr ? 'toplam ' + amountStr : ''}`.trim();
            case 'order_ready':
                return `Sipariş ${orderNumber || ''} hazır!`;
            case 'order_cancelled':
                return `Sipariş ${orderNumber || ''} iptal edildi.`;
            default:
                return `Sipariş güncellemesi: ${orderNumber || ''}`;
        }
    }

    // German (default)
    switch (event) {
        case 'new_order':
            return `Neue Bestellung eingegangen! ${orderNumber ? 'Bestellnummer ' + orderNumber + '.' : ''} ${items ? items + ' Artikel,' : ''} ${amountStr ? 'Gesamt ' + amountStr : ''}`.trim();
        case 'order_ready':
            return `Bestellung ${orderNumber || ''} ist fertig!`;
        case 'order_cancelled':
            return `Bestellung ${orderNumber || ''} wurde storniert.`;
        default:
            return `Bestellupdate: ${orderNumber || ''}`;
    }
}

export function isAlexaReady(): boolean {
    return alexaReady;
}
