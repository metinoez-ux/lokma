import { Router, Request, Response } from 'express';
import { NotifyEvent, COLOR_PROFILES, config } from '../config';
import {
    sendAlexaAnnouncement,
    playAlexaSound,
    buildOrderMessage,
    isAlexaReady,
    getEchoDevices,
} from '../services/alexa';
import { flashWLED, checkWLEDHealth } from '../services/wled';
import { flashHue, checkHueHealth } from '../services/hue';
import {
    sendAnnouncementForBusiness,
    playSoundForBusiness,
    isBusinessAlexaReady,
    getBusinessDevices,
} from '../services/alexa-multi';

const router = Router();

// ─── POST /notify ────────────────────────────────────────────────────────────
// Main endpoint called by Cloud Functions when a new order arrives.
router.post('/notify', async (req: Request, res: Response) => {
    const {
        businessId,
        event = 'new_order',
        orderNumber,
        amount,
        items,
        language = 'de-DE',
        // Per-business device config (optional, from Firestore)
        alexaEnabled = true,
        ledEnabled = true,
        hueEnabled = false,
    } = req.body;

    if (!businessId) {
        res.status(400).json({ error: 'businessId is required' });
        return;
    }

    console.log(`\n🔔 ━━━ NOTIFICATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Business: ${businessId}`);
    console.log(`   Event:    ${event}`);
    console.log(`   Order:    ${orderNumber || 'N/A'}`);
    console.log(`   Amount:   ${amount || 'N/A'}€`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const results: Record<string, any> = {};
    const validEvent = (event in COLOR_PROFILES ? event : 'new_order') as NotifyEvent;

    // ── 1. Alexa (per-business multi-tenant) ─────────────────────────────────
    if (alexaEnabled) {
        const message = buildOrderMessage(validEvent, orderNumber, amount, items, language);

        // Try per-business Alexa first (each business has own Amazon account)
        if (isBusinessAlexaReady(businessId)) {
            const soundOk = await playSoundForBusiness(businessId, 'amzn_sfx_doorbell_chime');
            // Small delay so the ding plays before the TTS
            await new Promise(r => setTimeout(r, 1500));
            const ttsOk = await sendAnnouncementForBusiness(businessId, message);
            results.alexa = { sound: soundOk, tts: ttsOk, mode: 'per-business' };
        }
        // Fallback: global Alexa (Metin's HA setup / shared gateway)
        else if (isAlexaReady()) {
            const soundOk = await playAlexaSound('amzn_sfx_doorbell_chime');
            await new Promise(r => setTimeout(r, 1500));
            const ttsOk = await sendAlexaAnnouncement(message);
            results.alexa = { sound: soundOk, tts: ttsOk, mode: 'global' };
        } else {
            results.alexa = { skipped: true, reason: 'no_connection' };
        }
    }

    // ── 2. WLED LED Strip ────────────────────────────────────────────────────
    if (ledEnabled) {
        const ledResults = await flashWLED(validEvent, 5000);
        results.wled = { devices: ledResults };
    }

    // ── 3. Philips Hue ───────────────────────────────────────────────────────
    if (hueEnabled) {
        const hueOk = await flashHue(validEvent, 5000);
        results.hue = { success: hueOk };
    }

    res.json({
        success: true,
        event: validEvent,
        businessId,
        results,
        timestamp: new Date().toISOString(),
    });
});

// ─── GET /health ─────────────────────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
    const wledHealth = await checkWLEDHealth();
    const hueHealth = await checkHueHealth();

    res.json({
        status: 'ok',
        uptime: process.uptime(),
        services: {
            alexa: {
                global: isAlexaReady(),
                devices: getEchoDevices(),
            },
            wled: wledHealth,
            hue: hueHealth,
        },
    });
});

// ─── GET /devices/:businessId ────────────────────────────────────────────────
// List Alexa devices for a specific business
router.get('/devices/:businessId', (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const ready = isBusinessAlexaReady(businessId);
    const devices = ready ? getBusinessDevices(businessId) : [];

    res.json({
        businessId,
        connected: ready,
        devices,
    });
});

// ─── POST /test ──────────────────────────────────────────────────────────────
// Test endpoint for the admin panel "Test Bildirimi Gönder" button
router.post('/test', async (req: Request, res: Response) => {
    const { businessId, language = 'de-DE' } = req.body;

    console.log(`\n🧪 TEST notification for business: ${businessId || 'global'}\n`);

    // Send a test notification
    const testPayload = {
        businessId: businessId || 'test',
        event: 'new_order',
        orderNumber: 'TEST-001',
        amount: 15.50,
        items: 2,
        language,
        alexaEnabled: true,
        ledEnabled: true,
        hueEnabled: false,
    };

    // Reuse the notify logic by calling our own handler
    req.body = testPayload;

    // Inline test
    const message = buildOrderMessage('new_order', 'TEST-001', 15.50, 2, language);
    const results: Record<string, any> = {};

    if (businessId && isBusinessAlexaReady(businessId)) {
        await playSoundForBusiness(businessId, 'amzn_sfx_doorbell_chime');
        await new Promise(r => setTimeout(r, 1500));
        await sendAnnouncementForBusiness(businessId, message);
        results.alexa = 'per-business';
    } else if (isAlexaReady()) {
        await playAlexaSound('amzn_sfx_doorbell_chime');
        await new Promise(r => setTimeout(r, 1500));
        await sendAlexaAnnouncement(message);
        results.alexa = 'global';
    }

    await flashWLED('new_order', 5000);
    results.wled = true;

    res.json({ success: true, test: true, results });
});

export default router;
