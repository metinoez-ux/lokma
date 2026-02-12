import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3999', 10),
    apiKey: process.env.API_KEY || 'lokma-iot-default-key',

    // Alexa
    alexa: {
        cookie: process.env.ALEXA_COOKIE || '',
        proxyOwnIp: process.env.ALEXA_PROXY_OWN_IP || '',
        language: (process.env.ALEXA_LANGUAGE || 'de-DE') as 'de-DE' | 'tr-TR',
    },

    // WLED
    wled: {
        devices: (process.env.WLED_DEVICES || '')
            .split(',')
            .map(ip => ip.trim())
            .filter(Boolean),
    },

    // Philips Hue
    hue: {
        bridgeIp: process.env.HUE_BRIDGE_IP || '',
        username: process.env.HUE_USERNAME || '',
        lightIds: (process.env.HUE_LIGHT_IDS || '')
            .split(',')
            .map(id => id.trim())
            .filter(Boolean),
    },
};

// ─── Color Profiles ─────────────────────────────────────────────────────────
export const COLOR_PROFILES = {
    new_order: { r: 0, g: 255, b: 0, hex: '#00FF00', name: 'Yeşil (Yeni Sipariş)' },
    order_ready: { r: 0, g: 102, b: 255, hex: '#0066FF', name: 'Mavi (Hazır)' },
    order_cancelled: { r: 255, g: 0, b: 0, hex: '#FF0000', name: 'Kırmızı (İptal)' },
    idle: { r: 255, g: 150, b: 50, hex: '#FF9632', name: 'Turuncu (Bekleme)' },
} as const;

export type NotifyEvent = keyof typeof COLOR_PROFILES;
