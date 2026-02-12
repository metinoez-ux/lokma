import fs from 'fs';
import path from 'path';

/**
 * Multi-Tenant Alexa Service
 * 
 * Each business owner connects their own Amazon account.
 * Their cookie is stored per businessId in ./data/alexa-cookies/
 * 
 * Flow:
 * 1. Business admin enters Amazon email/password in LOKMA admin portal
 * 2. Admin portal calls POST /alexa/setup with businessId + credentials
 * 3. Gateway uses alexa-remote2 to authenticate → stores cookie
 * 4. On subsequent notifications, the stored cookie is used
 * 
 * Each business typically has ONE Echo device (e.g., in their kitchen).
 */

let Alexa: any;
try {
    Alexa = require('alexa-remote2');
} catch {
    console.warn('⚠️  alexa-remote2 not installed');
}

// Store per-business Alexa instances
const businessInstances = new Map<string, {
    instance: any;
    ready: boolean;
    devices: { name: string; serialNumber: string }[];
}>();

const COOKIE_DIR = path.join(process.cwd(), 'data', 'alexa-cookies');

// Ensure cookie directory exists
if (!fs.existsSync(COOKIE_DIR)) {
    fs.mkdirSync(COOKIE_DIR, { recursive: true });
}

/**
 * Load a saved cookie for a business.
 */
function loadCookie(businessId: string): string | null {
    const cookiePath = path.join(COOKIE_DIR, `${businessId}.json`);
    if (fs.existsSync(cookiePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
            return data.cookie;
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Save cookie for a business.
 */
function saveCookie(businessId: string, cookie: string): void {
    const cookiePath = path.join(COOKIE_DIR, `${businessId}.json`);
    fs.writeFileSync(cookiePath, JSON.stringify({
        businessId,
        cookie,
        savedAt: new Date().toISOString(),
    }));
    console.log(`💾 Saved Alexa cookie for business: ${businessId}`);
}

/**
 * Initialize Alexa connection for a specific business.
 */
export async function initBusinessAlexa(businessId: string, cookie?: string): Promise<boolean> {
    if (!Alexa) return false;

    const savedCookie = cookie || loadCookie(businessId);
    if (!savedCookie) {
        console.warn(`⚠️  No Alexa cookie for business ${businessId}`);
        return false;
    }

    return new Promise((resolve) => {
        const instance = new Alexa();

        instance.init(
            {
                cookie: savedCookie,
                bluetooth: false,
                macDms: { device_private_key: '', adp_token: '' },
            },
            (err: any) => {
                if (err) {
                    console.error(`❌ Alexa init failed for ${businessId}:`, err.message || err);
                    resolve(false);
                    return;
                }

                // Get devices
                const allDevices = instance.getDevices() || {};
                const echoDevices = Object.values(allDevices)
                    .filter((d: any) => d.deviceFamily === 'ECHO' || d.deviceFamily === 'KNIGHT')
                    .map((d: any) => ({
                        name: d.accountName,
                        serialNumber: d.serialNumber,
                    }));

                businessInstances.set(businessId, {
                    instance,
                    ready: true,
                    devices: echoDevices,
                });

                // Save cookie for future restarts
                if (cookie) {
                    saveCookie(businessId, cookie);
                }

                console.log(`✅ Alexa connected for business ${businessId} (${echoDevices.length} devices)`);
                echoDevices.forEach(d => console.log(`   📢 ${d.name}`));
                resolve(true);
            }
        );
    });
}

/**
 * Load all saved business Alexa connections on startup.
 */
export async function loadAllBusinessConnections(): Promise<void> {
    if (!fs.existsSync(COOKIE_DIR)) return;

    const files = fs.readdirSync(COOKIE_DIR).filter(f => f.endsWith('.json'));
    console.log(`📂 Loading ${files.length} saved Alexa connections...`);

    for (const file of files) {
        const businessId = file.replace('.json', '');
        await initBusinessAlexa(businessId);
    }
}

/**
 * Send TTS announcement to a specific business's Alexa.
 */
export async function sendAnnouncementForBusiness(businessId: string, message: string): Promise<boolean> {
    const entry = businessInstances.get(businessId);
    if (!entry?.ready) return false;

    return new Promise((resolve) => {
        entry.instance.sendSequenceCommand(
            null, // all devices on this account (usually just one Echo)
            'speak',
            message,
            (err: any) => {
                if (err) {
                    console.error(`❌ Alexa speak for ${businessId}:`, err.message || err);
                    resolve(false);
                } else {
                    console.log(`📢 [${businessId}] Alexa: "${message}"`);
                    resolve(true);
                }
            }
        );
    });
}

/**
 * Play a sound on a specific business's Alexa.
 */
export async function playSoundForBusiness(
    businessId: string,
    sound: string = 'amzn_sfx_doorbell_chime'
): Promise<boolean> {
    const entry = businessInstances.get(businessId);
    if (!entry?.ready) return false;

    return new Promise((resolve) => {
        entry.instance.sendSequenceCommand(
            null,
            'sound',
            sound,
            (err: any) => {
                if (err) {
                    console.error(`❌ Alexa sound for ${businessId}:`, err.message || err);
                    resolve(false);
                } else {
                    console.log(`🔔 [${businessId}] Alexa sound: ${sound}`);
                    resolve(true);
                }
            }
        );
    });
}

/**
 * Check if a business Alexa connection is ready.
 */
export function isBusinessAlexaReady(businessId: string): boolean {
    return businessInstances.get(businessId)?.ready ?? false;
}

/**
 * Get devices for a specific business.
 */
export function getBusinessDevices(businessId: string): { name: string; serialNumber: string }[] {
    return businessInstances.get(businessId)?.devices ?? [];
}

/**
 * Disconnect and remove a business Alexa.
 */
export function disconnectBusiness(businessId: string): void {
    businessInstances.delete(businessId);
    const cookiePath = path.join(COOKIE_DIR, `${businessId}.json`);
    if (fs.existsSync(cookiePath)) {
        fs.unlinkSync(cookiePath);
    }
    console.log(`🔌 Disconnected Alexa for business: ${businessId}`);
}
