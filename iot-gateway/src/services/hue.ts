import fetch from 'node-fetch';
import { config, COLOR_PROFILES, NotifyEvent } from '../config';

/**
 * Philips Hue Local Bridge API Service
 * 
 * Uses the local REST API (no cloud needed).
 * Requires a one-time bridge pairing to get a username.
 * 
 * Setup: Press the bridge button, then:
 * curl -X POST http://<bridge-ip>/api -d '{"devicetype":"lokma-iot-gateway"}'
 */

interface HueLightState {
    on: boolean;
    bri?: number;   // 1-254
    hue?: number;   // 0-65535
    sat?: number;   // 0-254
    xy?: [number, number]; // CIE color space
    alert?: 'none' | 'select' | 'lselect'; // lselect = 15 flash cycles
}

/**
 * Convert RGB to CIE xy color space for Hue.
 */
function rgbToXY(r: number, g: number, b: number): [number, number] {
    let red = r / 255;
    let green = g / 255;
    let blue = b / 255;

    // Gamma correction
    red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
    green = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
    blue = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

    const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
    const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
    const Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;

    const sum = X + Y + Z;
    if (sum === 0) return [0.3128, 0.3290]; // D65 white point

    return [X / sum, Y / sum];
}

/**
 * Flash Hue lights with a color for a given event.
 */
export async function flashHue(
    event: NotifyEvent,
    durationMs: number = 5000
): Promise<boolean> {
    if (!config.hue.bridgeIp || !config.hue.username) {
        console.warn('⚠️  Philips Hue not configured — skipping');
        return false;
    }

    if (config.hue.lightIds.length === 0) {
        console.warn('⚠️  No Hue light IDs configured — skipping');
        return false;
    }

    const color = COLOR_PROFILES[event] || COLOR_PROFILES.new_order;
    const xy = rgbToXY(color.r, color.g, color.b);

    const baseUrl = `http://${config.hue.bridgeIp}/api/${config.hue.username}`;

    // Save current states
    const savedStates: Record<string, any> = {};

    try {
        for (const lightId of config.hue.lightIds) {
            // Save current state
            try {
                const res = await fetch(`${baseUrl}/lights/${lightId}`);
                const data = await res.json() as any;
                savedStates[lightId] = data?.state;
            } catch {
                // Continue even if we can't save state
            }

            // Set flash color with "lselect" (15 rapid flash cycles, ~15 sec)
            const flashState: HueLightState = {
                on: true,
                bri: 254,
                xy,
                alert: 'lselect',
            };

            await fetch(`${baseUrl}/lights/${lightId}/state`, {
                method: 'PUT',
                body: JSON.stringify(flashState),
            });
        }

        console.log(`💡 Hue lights → ${color.name} flash`);

        // Restore after duration
        setTimeout(async () => {
            for (const lightId of config.hue.lightIds) {
                try {
                    const saved = savedStates[lightId];
                    if (saved) {
                        await fetch(`${baseUrl}/lights/${lightId}/state`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                on: saved.on ?? true,
                                bri: saved.bri ?? 128,
                                xy: saved.xy,
                                alert: 'none',
                            }),
                        });
                    } else {
                        // Default restore: stop alert
                        await fetch(`${baseUrl}/lights/${lightId}/state`, {
                            method: 'PUT',
                            body: JSON.stringify({ alert: 'none' }),
                        });
                    }
                } catch {
                    // ignore
                }
            }
            console.log('💡 Hue lights → restored');
        }, durationMs);

        return true;
    } catch (err: any) {
        console.error(`❌ Hue flash error: ${err.message}`);
        return false;
    }
}

/**
 * Check if the Hue bridge is reachable.
 */
export async function checkHueHealth(): Promise<boolean> {
    if (!config.hue.bridgeIp || !config.hue.username) return false;

    try {
        const res = await fetch(
            `http://${config.hue.bridgeIp}/api/${config.hue.username}/lights`,
            { signal: AbortSignal.timeout(2000) }
        );
        return res.ok;
    } catch {
        return false;
    }
}
