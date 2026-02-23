/**
 * LOKMA IoT Notification Gateway — Firebase Cloud Function (2nd Gen)
 *
 * Deployed as an HTTPS function backed by Cloud Run.
 * Replaces the standalone iot-gateway microservice.
 *
 * Services:
 * - Alexa TTS announcements via alexa-remote2 (per-business multi-tenant)
 * - WLED LED strip flash via HTTP JSON API
 * - Philips Hue flash via local bridge API
 *
 * Cookie storage: Firestore (iot_alexa_cookies/{businessId})
 */

import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NotifyPayload {
    businessId: string;
    event: "new_order" | "order_ready" | "order_cancelled";
    orderNumber?: string;
    amount?: number;
    currency?: string;
    items?: number;
    language?: "de-DE" | "tr-TR";
    alexaEnabled?: boolean;
    ledEnabled?: boolean;
    hueEnabled?: boolean;
    wledDevices?: string[]; // override from Firestore config
    hueBridgeIp?: string;
    hueUsername?: string;
    hueLightIds?: string[];
}

// ─── Color Profiles ──────────────────────────────────────────────────────────
const COLOR_PROFILES = {
    new_order: { r: 0, g: 255, b: 0, hex: "#00FF00", name: "Yeşil (Yeni Sipariş)" },
    order_ready: { r: 0, g: 102, b: 255, hex: "#0066FF", name: "Mavi (Hazır)" },
    order_cancelled: { r: 255, g: 0, b: 0, hex: "#FF0000", name: "Kırmızı (İptal)" },
} as const;

type NotifyEvent = keyof typeof COLOR_PROFILES;

// ─── Alexa Service (Multi-Tenant, Firestore-Backed) ──────────────────────────
let AlexaRemote: any;
try {
    AlexaRemote = require("alexa-remote2");
} catch {
    console.warn("⚠️  alexa-remote2 not installed");
}

const alexaInstances = new Map<string, { instance: any; ready: boolean }>();

// Lazy Firestore access — avoids calling admin.firestore() before initializeApp()
function getDb() { return admin.firestore(); }

async function loadAlexaCookie(businessId: string): Promise<string | null> {
    try {
        const doc = await getDb().collection("iot_alexa_cookies").doc(businessId).get();
        return doc.exists ? doc.data()?.cookie || null : null;
    } catch {
        return null;
    }
}

async function saveAlexaCookie(businessId: string, cookie: string): Promise<void> {
    await getDb().collection("iot_alexa_cookies").doc(businessId).set({
        cookie,
        businessId,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function initBusinessAlexa(businessId: string, cookie?: string): Promise<boolean> {
    if (!AlexaRemote) return false;
    const savedCookie = cookie || await loadAlexaCookie(businessId);
    if (!savedCookie) return false;

    return new Promise((resolve) => {
        const instance = new AlexaRemote();
        instance.init(
            { cookie: savedCookie, bluetooth: false, macDms: { device_private_key: "", adp_token: "" } },
            async (err: any) => {
                if (err) {
                    console.error(`❌ Alexa init failed for ${businessId}:`, err.message || err);
                    resolve(false);
                    return;
                }
                alexaInstances.set(businessId, { instance, ready: true });
                if (cookie) await saveAlexaCookie(businessId, cookie);
                console.log(`✅ Alexa connected for business ${businessId}`);
                resolve(true);
            }
        );
    });
}

async function ensureAlexaReady(businessId: string): Promise<boolean> {
    if (alexaInstances.get(businessId)?.ready) return true;
    return initBusinessAlexa(businessId);
}

async function sendAlexaTTS(businessId: string, message: string): Promise<boolean> {
    const entry = alexaInstances.get(businessId);
    if (!entry?.ready) return false;
    return new Promise((resolve) => {
        entry.instance.sendSequenceCommand(null, "speak", message, (err: any) => {
            if (err) { console.error(`❌ Alexa TTS error:`, err.message); resolve(false); }
            else { console.log(`📢 [${businessId}] Alexa: "${message}"`); resolve(true); }
        });
    });
}

async function playAlexaSound(businessId: string, sound = "amzn_sfx_doorbell_chime"): Promise<boolean> {
    const entry = alexaInstances.get(businessId);
    if (!entry?.ready) return false;
    return new Promise((resolve) => {
        entry.instance.sendSequenceCommand(null, "sound", sound, (err: any) => {
            if (err) { resolve(false); } else { resolve(true); }
        });
    });
}

function getBusinessDevices(businessId: string): { name: string; serialNumber: string }[] {
    const entry = alexaInstances.get(businessId);
    if (!entry?.ready) return [];
    const devices = entry.instance.getDevices() || {};
    return Object.values(devices)
        .filter((d: any) => d.deviceFamily === "ECHO" || d.deviceFamily === "KNIGHT")
        .map((d: any) => ({ name: d.accountName, serialNumber: d.serialNumber }));
}

// ─── WLED Service ────────────────────────────────────────────────────────────
async function flashWLED(devices: string[], event: NotifyEvent): Promise<boolean[]> {
    if (devices.length === 0) return [];
    const color = COLOR_PROFILES[event] || COLOR_PROFILES.new_order;
    const flashState = { on: true, bri: 255, seg: [{ col: [[color.r, color.g, color.b]], fx: 1, sx: 180, ix: 255 }] };

    return Promise.all(devices.map(async (ip) => {
        try {
            const res = await fetch(`http://${ip}/json/state`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(flashState),
            });
            if (!res.ok) return false;
            console.log(`💡 WLED ${ip} → ${color.name} flash`);
            // Schedule idle restore after 5s
            setTimeout(async () => {
                try {
                    await fetch(`http://${ip}/json/state`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ on: true, bri: 80, seg: [{ col: [[255, 150, 50]], fx: 0 }] }),
                    });
                } catch { /* ignore */ }
            }, 5000);
            return true;
        } catch (err: any) {
            console.error(`❌ WLED ${ip}: ${err.message}`);
            return false;
        }
    }));
}

// ─── Philips Hue Service ─────────────────────────────────────────────────────
function rgbToXY(r: number, g: number, b: number): [number, number] {
    let red = r / 255, green = g / 255, blue = b / 255;
    red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
    green = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
    blue = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;
    const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
    const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
    const Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;
    const sum = X + Y + Z;
    if (sum === 0) return [0.3128, 0.3290];
    return [X / sum, Y / sum];
}

async function flashHue(bridgeIp: string, username: string, lightIds: string[], event: NotifyEvent): Promise<boolean> {
    if (!bridgeIp || !username || lightIds.length === 0) return false;
    const color = COLOR_PROFILES[event] || COLOR_PROFILES.new_order;
    const xy = rgbToXY(color.r, color.g, color.b);
    const baseUrl = `http://${bridgeIp}/api/${username}`;

    try {
        for (const lightId of lightIds) {
            await fetch(`${baseUrl}/lights/${lightId}/state`, {
                method: "PUT",
                body: JSON.stringify({ on: true, bri: 254, xy, alert: "lselect" }),
            });
        }
        console.log(`💡 Hue → ${color.name} flash`);
        return true;
    } catch (err: any) {
        console.error(`❌ Hue: ${err.message}`);
        return false;
    }
}

// ─── Order Message Builder ───────────────────────────────────────────────────
function buildOrderMessage(event: string, orderNumber?: string, amount?: number, items?: number, language = "de-DE", currency = "EUR"): string {
    let currencyName = "Euro";
    let fractionName = "Cent";
    if (currency === "TRY") {
        currencyName = "Lira"; fractionName = "Kuruş";
    } else if (currency === "USD") {
        currencyName = "Dolar"; fractionName = "Cent";
    } else if (currency === "GBP") {
        currencyName = "Pound"; fractionName = "Pence";
    } else if (currency === "CHF") {
        currencyName = "Frank"; fractionName = "Rappen";
    }

    // Format amount into integers: X Lira Y Kurus
    let amountStr = "";
    if (amount) {
        const primary = Math.floor(amount);
        const fraction = Math.round((amount - primary) * 100);
        amountStr = `${primary} ${currencyName}`;
        if (fraction > 0) {
            amountStr += ` ${fraction} ${fractionName}`;
        }
    }
    if (language === "tr-TR") {
        switch (event) {
            case "new_order": return `Yeni sipariş geldi! ${orderNumber ? "Sipariş numarası " + orderNumber + "." : ""} ${items ? items + " ürün," : ""} ${amountStr ? "toplam " + amountStr : ""}`.trim();
            case "order_ready": return `Sipariş ${orderNumber || ""} hazır!`;
            case "order_cancelled": return `Sipariş ${orderNumber || ""} iptal edildi.`;
            default: return `Sipariş güncellemesi: ${orderNumber || ""}`;
        }
    }
    switch (event) {
        case "new_order": return `Neue Bestellung eingegangen! ${orderNumber ? "Bestellnummer " + orderNumber + "." : ""} ${items ? items + " Artikel," : ""} ${amountStr ? "Gesamt " + amountStr : ""}`.trim();
        case "order_ready": return `Bestellung ${orderNumber || ""} ist fertig!`;
        case "order_cancelled": return `Bestellung ${orderNumber || ""} wurde storniert.`;
        default: return `Bestellupdate: ${orderNumber || ""}`;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Express App
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const iotApp = express();
iotApp.use(cors({ origin: true }));
iotApp.use(express.json());

// ─── Health Check ────────────────────────────────────────────────────────────
iotApp.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "LOKMA IoT Gateway (Cloud Function)",
        uptime: process.uptime(),
    });
});

// ─── POST /notify — Main notification endpoint ──────────────────────────────
iotApp.post("/notify", async (req, res) => {
    const payload: NotifyPayload = req.body;
    if (!payload.businessId) {
        res.status(400).json({ error: "businessId is required" });
        return;
    }

    const event = (payload.event in COLOR_PROFILES ? payload.event : "new_order") as NotifyEvent;
    const results: Record<string, any> = {};

    console.log(`\n🔔 IoT Notification → ${payload.businessId} | ${event} | Order: ${payload.orderNumber || "N/A"}`);

    // 1. Alexa
    if (payload.alexaEnabled !== false) {
        const ready = await ensureAlexaReady(payload.businessId);
        if (ready) {
            const message = buildOrderMessage(event, payload.orderNumber, payload.amount, payload.items, payload.language || "de-DE", payload.currency || "EUR");
            const soundOk = await playAlexaSound(payload.businessId);
            await new Promise(r => setTimeout(r, 1500));
            const ttsOk = await sendAlexaTTS(payload.businessId, message);
            results.alexa = { sound: soundOk, tts: ttsOk };
        } else {
            results.alexa = { skipped: true, reason: "no_connection" };
        }
    }

    // 2. WLED
    if (payload.ledEnabled !== false && payload.wledDevices && payload.wledDevices.length > 0) {
        const ledResults = await flashWLED(payload.wledDevices, event);
        results.wled = { devices: ledResults };
    }

    // 3. Hue
    if (payload.hueEnabled && payload.hueBridgeIp && payload.hueUsername) {
        const hueOk = await flashHue(payload.hueBridgeIp, payload.hueUsername, payload.hueLightIds || [], event);
        results.hue = { success: hueOk };
    }

    res.json({ success: true, event, businessId: payload.businessId, results, timestamp: new Date().toISOString() });
});

// ─── POST /test — Test notification from Admin Panel ─────────────────────────
iotApp.post("/test", async (req, res) => {
    const { businessId, language = "de-DE" } = req.body;
    const results: Record<string, any> = {};

    console.log(`🧪 TEST notification → ${businessId || "global"}`);

    if (businessId) {
        const ready = await ensureAlexaReady(businessId);
        if (ready) {
            const msg = buildOrderMessage("new_order", "TEST-001", 15.50, 2, language, "EUR");
            await playAlexaSound(businessId);
            await new Promise(r => setTimeout(r, 1500));
            await sendAlexaTTS(businessId, msg);
            results.alexa = "ok";
        } else {
            results.alexa = "not_connected";
        }
    }

    res.json({ success: true, test: true, results });
});

// ─── POST /alexa/setup — Connect a business's Amazon account ─────────────────
iotApp.post("/alexa/setup", async (req, res) => {
    const { businessId, cookie } = req.body;
    if (!businessId || !cookie) {
        res.status(400).json({ error: "businessId and cookie are required" });
        return;
    }

    const success = await initBusinessAlexa(businessId, cookie);
    if (success) {
        const devices = getBusinessDevices(businessId);
        res.json({ success: true, message: `Alexa bağlantısı başarılı! ${devices.length} cihaz bulundu.`, devices });
    } else {
        res.status(500).json({ success: false, message: "Alexa bağlantısı başarısız." });
    }
});

// ─── GET /alexa/status/:businessId ───────────────────────────────────────────
iotApp.get("/alexa/status/:businessId", (req, res) => {
    const bid = req.params.businessId;
    const ready = alexaInstances.get(bid)?.ready ?? false;
    const devices = ready ? getBusinessDevices(bid) : [];
    res.json({ businessId: bid, connected: ready, devices });
});

// ─── DELETE /alexa/disconnect/:businessId ────────────────────────────────────
iotApp.delete("/alexa/disconnect/:businessId", async (req, res) => {
    const bid = req.params.businessId;
    alexaInstances.delete(bid);
    await getDb().collection("iot_alexa_cookies").doc(bid).delete().catch(() => { });
    res.json({ success: true, message: `Alexa bağlantısı kaldırıldı: ${bid}` });
});

// ─── Root info ───────────────────────────────────────────────────────────────
iotApp.get("/", (_req, res) => {
    res.json({
        name: "LOKMA IoT Notification Gateway",
        version: "1.0.0",
        runtime: "Firebase Cloud Functions (2nd Gen)",
        endpoints: {
            "POST /notify": "Send notification (Alexa + LED + Hue)",
            "POST /test": "Send test notification",
            "POST /alexa/setup": "Connect business Alexa account",
            "GET /alexa/status/:businessId": "Check Alexa connection",
            "DELETE /alexa/disconnect/:businessId": "Remove Alexa connection",
            "GET /health": "Health check",
        },
    });
});
