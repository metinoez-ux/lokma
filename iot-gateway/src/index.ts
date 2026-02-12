import express from 'express';
import cors from 'cors';
import { config } from './config';
import notifyRouter from './routes/notify';
import alexaSetupRouter from './routes/alexa-setup';
import { initAlexa } from './services/alexa';
import { loadAllBusinessConnections } from './services/alexa-multi';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Simple API key auth middleware
app.use((req, res, next) => {
    // Allow health check without auth
    if (req.path === '/health') return next();

    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (apiKey !== config.apiKey) {
        res.status(401).json({ error: 'Unauthorized — invalid API key' });
        return;
    }
    next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/', notifyRouter);
app.use('/alexa', alexaSetupRouter);

// Root info
app.get('/', (_req, res) => {
    res.json({
        name: 'LOKMA IoT Notification Gateway',
        version: '1.0.0',
        endpoints: {
            'POST /notify': 'Send notification to Alexa + LED',
            'POST /test': 'Test notification',
            'GET /health': 'Service health check',
            'POST /alexa/setup': 'Connect a business Alexa account',
            'GET /alexa/status/:businessId': 'Check Alexa connection status',
            'DELETE /alexa/disconnect/:businessId': 'Remove Alexa connection',
            'GET /devices/:businessId': 'List Alexa devices for business',
        },
    });
});

// ─── Startup ────────────────────────────────────────────────────────────────
async function start() {
    console.log(`
╔══════════════════════════════════════════════════╗
║     🔔  LOKMA IoT Notification Gateway  🔔      ║
║     ─────────────────────────────────────        ║
║     Alexa • WLED • Philips Hue                   ║
╚══════════════════════════════════════════════════╝
    `);

    // Initialize global Alexa (optional — for Metin's HA setup)
    if (config.alexa.cookie) {
        console.log('🔄 Initializing global Alexa connection...');
        await initAlexa();
    }

    // Load all per-business Alexa connections
    console.log('🔄 Loading per-business Alexa connections...');
    await loadAllBusinessConnections();

    // WLED status
    if (config.wled.devices.length > 0) {
        console.log(`💡 WLED devices configured: ${config.wled.devices.join(', ')}`);
    } else {
        console.log('⚠️  No WLED devices configured');
    }

    // Hue status
    if (config.hue.bridgeIp) {
        console.log(`💡 Philips Hue bridge: ${config.hue.bridgeIp}`);
    }

    // Start HTTP server
    app.listen(config.port, () => {
        console.log(`\n🚀 Gateway running on http://0.0.0.0:${config.port}`);
        console.log(`   API Key: ${config.apiKey.substring(0, 4)}****\n`);
    });
}

start().catch(console.error);
