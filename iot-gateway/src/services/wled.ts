import fetch from 'node-fetch';
import { config, COLOR_PROFILES, NotifyEvent } from '../config';

/**
 * WLED HTTP JSON API Service
 * 
 * WLED firmware runs on ESP32/ESP8266 and exposes a simple HTTP API.
 * Docs: https://kno.wled.ge/interfaces/json-api/
 */

interface WLEDState {
    on: boolean;
    bri: number;  // brightness 0-255
    seg: {
        col: number[][];  // [[R,G,B], [secondary], [tertiary]]
        fx: number;       // effect ID (0=solid, 1=blink, 2=breathe, etc.)
        sx: number;       // effect speed (0-255)
        ix: number;       // effect intensity (0-255)
    }[];
}

/**
 * Send a color flash effect to all configured WLED devices.
 * After `durationMs`, returns the LED to idle (warm orange).
 */
export async function flashWLED(
    event: NotifyEvent,
    durationMs: number = 5000
): Promise<boolean[]> {
    if (config.wled.devices.length === 0) {
        console.warn('⚠️  No WLED devices configured — skipping LED flash');
        return [];
    }

    const color = COLOR_PROFILES[event] || COLOR_PROFILES.new_order;
    const idleColor = COLOR_PROFILES.idle;

    // Flash state: blink effect at high speed
    const flashState: WLEDState = {
        on: true,
        bri: 255,
        seg: [{
            col: [[color.r, color.g, color.b]],
            fx: 1,    // 1 = Blink effect
            sx: 180,  // Speed
            ix: 255,  // Intensity
        }],
    };

    // Idle state: solid warm orange at low brightness  
    const idleState: WLEDState = {
        on: true,
        bri: 80,
        seg: [{
            col: [[idleColor.r, idleColor.g, idleColor.b]],
            fx: 0,    // 0 = Solid
            sx: 0,
            ix: 0,
        }],
    };

    const results = await Promise.all(
        config.wled.devices.map(async (ip) => {
            try {
                // Start flash
                const res = await fetch(`http://${ip}/json/state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(flashState),
                });

                if (!res.ok) {
                    console.error(`❌ WLED ${ip} flash failed: ${res.status}`);
                    return false;
                }

                console.log(`💡 WLED ${ip} → ${color.name} flash`);

                // Schedule return to idle
                setTimeout(async () => {
                    try {
                        await fetch(`http://${ip}/json/state`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(idleState),
                        });
                        console.log(`💡 WLED ${ip} → idle`);
                    } catch (e) {
                        console.warn(`⚠️  WLED ${ip} idle restore failed`);
                    }
                }, durationMs);

                return true;
            } catch (err: any) {
                console.error(`❌ WLED ${ip} error: ${err.message}`);
                return false;
            }
        })
    );

    return results;
}

/**
 * Turn all WLED devices off.
 */
export async function turnOffWLED(): Promise<void> {
    for (const ip of config.wled.devices) {
        try {
            await fetch(`http://${ip}/json/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ on: false }),
            });
        } catch {
            // ignore
        }
    }
}

/**
 * Set WLED to a solid color (for status display).
 */
export async function setWLEDColor(
    r: number, g: number, b: number, brightness: number = 128
): Promise<void> {
    for (const ip of config.wled.devices) {
        try {
            await fetch(`http://${ip}/json/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    on: true,
                    bri: brightness,
                    seg: [{ col: [[r, g, b]], fx: 0 }],
                }),
            });
        } catch {
            // ignore
        }
    }
}

/**
 * Check if WLED devices are reachable.
 */
export async function checkWLEDHealth(): Promise<{ ip: string; ok: boolean }[]> {
    return Promise.all(
        config.wled.devices.map(async (ip) => {
            try {
                const res = await fetch(`http://${ip}/json/info`, {
                    signal: AbortSignal.timeout(2000)
                });
                return { ip, ok: res.ok };
            } catch {
                return { ip, ok: false };
            }
        })
    );
}
