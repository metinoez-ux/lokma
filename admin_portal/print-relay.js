#!/usr/bin/env node
/**
 * LOKMA Print Relay Server
 * 
 * Standalone server that runs on the local network (e.g., MacBook)
 * and relays print requests from the LOKMA Admin Portal (lokma.web.app)
 * to a thermal receipt printer on the same network.
 * 
 * Usage:
 *   node print-relay.js
 * 
 * The admin portal's printerService uses the `printServerUrl` setting
 * to route print requests through this relay.
 * 
 * Environment Variables:
 *   PORT        - HTTP port (default: 3001)
 *   HTTPS_PORT  - HTTPS port (default: 3002)
 */

const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3001');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3002');

// ─── CORS ────────────────────────────────────────────────────────
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

// ─── ESC/POS Commands ────────────────────────────────────────────
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;
const DLE = 0x10;
const EOT = 0x04;

const CMD = {
    INIT: Buffer.from([ESC, 0x40]),
    BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
    BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
    ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
    ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
    ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
    FONT_NORMAL: Buffer.from([ESC, 0x21, 0x00]),
    FONT_DOUBLE_H: Buffer.from([ESC, 0x21, 0x10]),
    FONT_DOUBLE_W: Buffer.from([ESC, 0x21, 0x20]),
    FONT_DOUBLE: Buffer.from([ESC, 0x21, 0x30]),
    FONT_LARGE: Buffer.from([GS, 0x21, 0x11]),
    LINE: Buffer.from([LF]),
    CUT: Buffer.from([GS, 0x56, 0x00]),
    PARTIAL_CUT: Buffer.from([GS, 0x56, 0x01]),
    FEED_3: Buffer.from([ESC, 0x64, 0x03]),
    FEED_5: Buffer.from([ESC, 0x64, 0x05]),
};

const STATUS_CMDS = {
    PRINTER: Buffer.from([DLE, EOT, 0x01]),
};

// ─── Character Transliteration ───────────────────────────────────
const CHAR_REPLACE = {
    'ae': 'ae', 'Ae': 'Ae', 'oe': 'oe', 'Oe': 'Oe',
    'ue': 'ue', 'Ue': 'Ue', 'ss': 'ss',
    'c': 'c', 'C': 'C', 's': 's', 'S': 'S',
    'g': 'g', 'G': 'G', 'i': 'i', 'I': 'I',
};

function encodeText(text) {
    const map = {
        '\u00e4': 'ae', '\u00c4': 'Ae', '\u00f6': 'oe', '\u00d6': 'Oe',
        '\u00fc': 'ue', '\u00dc': 'Ue', '\u00df': 'ss',
        '\u00e7': 'c', '\u00c7': 'C', '\u015f': 's', '\u015e': 'S',
        '\u011f': 'g', '\u011e': 'G', '\u0131': 'i', '\u0130': 'I',
        '\u00e9': 'e', '\u00e8': 'e', '\u00ea': 'e', '\u00eb': 'e',
        '\u00e1': 'a', '\u00e0': 'a', '\u00e2': 'a',
        '\u00f3': 'o', '\u00f2': 'o', '\u00f4': 'o',
        '\u00fa': 'u', '\u00f9': 'u', '\u00fb': 'u',
        '\u00f1': 'n', '\u00d1': 'N', '\u20ac': 'EUR',
    };
    let ascii = '';
    for (const ch of text) {
        ascii += map[ch] || ch;
    }
    return Buffer.from(ascii, 'ascii');
}

function textLine(text) {
    return Buffer.concat([encodeText(text), CMD.LINE]);
}

function separator(char = '-', width = 48) {
    return textLine(char.repeat(width));
}

// ─── TCP Functions ───────────────────────────────────────────────

async function checkPrinterTCP(ip, port, timeoutMs = 3000) {
    const start = Date.now();
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            socket.destroy();
            resolve(result);
        };

        const timer = setTimeout(() => {
            finish({ online: false, responseTimeMs: Date.now() - start, error: `Timeout after ${timeoutMs}ms` });
        }, timeoutMs);

        socket.connect(port, ip, () => {
            clearTimeout(timer);
            finish({ online: true, responseTimeMs: Date.now() - start, paperOk: true, coverClosed: true });
        });

        socket.on('error', (err) => {
            clearTimeout(timer);
            finish({ online: false, responseTimeMs: Date.now() - start, error: err.message });
        });
    });
}

async function sendToPrinter(ip, port, data, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let resolved = false;

        const timer = setTimeout(() => {
            if (!resolved) { resolved = true; socket.destroy(); reject(new Error(`Timeout after ${timeoutMs}ms`)); }
        }, timeoutMs);

        socket.connect(port, ip, () => {
            socket.write(data, () => {
                clearTimeout(timer);
                resolved = true;
                socket.end();
                resolve();
            });
        });

        socket.on('error', (err) => {
            clearTimeout(timer);
            if (!resolved) { resolved = true; reject(err); }
        });

        socket.on('close', () => {
            clearTimeout(timer);
            if (!resolved) { resolved = true; resolve(); }
        });
    });
}

// ─── Receipt Builder ─────────────────────────────────────────────

function buildReceipt(order, businessName) {
    const parts = [];
    parts.push(CMD.INIT);

    // Header
    parts.push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.FONT_DOUBLE_H);
    parts.push(textLine(businessName || 'LOKMA'));
    parts.push(CMD.FONT_NORMAL, CMD.BOLD_OFF);

    const typeLabels = { delivery: 'KURYE / LIEFERUNG', pickup: 'GEL-AL / ABHOLUNG', dine_in: 'YERINDE / VOR ORT' };
    const orderType = order.orderType || order.type || 'delivery';
    parts.push(CMD.BOLD_ON);
    parts.push(textLine(typeLabels[orderType] || orderType.toUpperCase()));
    parts.push(CMD.BOLD_OFF, CMD.ALIGN_LEFT);
    parts.push(separator('='));

    // Order number
    parts.push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.FONT_LARGE);
    const orderNum = order.orderNumber || order.id?.substring(0, 6) || '---';
    parts.push(textLine(`#${orderNum}`));
    parts.push(CMD.FONT_NORMAL, CMD.BOLD_OFF, CMD.ALIGN_LEFT);

    // Scheduled time
    if (order.scheduledAt) {
        parts.push(separator('*'));
        parts.push(CMD.ALIGN_CENTER, CMD.BOLD_ON);
        parts.push(textLine('ISTENEN SAAT / BESTELLUNG FUER'));
        parts.push(CMD.FONT_LARGE);
        const d = new Date(order.scheduledAt);
        parts.push(textLine(d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })));
        parts.push(textLine(`${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`));
        parts.push(CMD.FONT_NORMAL, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
    }

    parts.push(separator());

    // Items
    parts.push(CMD.BOLD_ON);
    parts.push(textLine('URUNLER / ARTIKEL'));
    parts.push(CMD.BOLD_OFF);
    parts.push(separator('-'));

    if (order.items && Array.isArray(order.items)) {
        let pos = 0;
        for (const item of order.items) {
            pos++;
            const qty = item.quantity || 1;
            const name = item.name || item.productName || 'Unbekannt';
            const price = item.price ? `${(item.price * qty).toFixed(2)} EUR` : '';
            const rawUnit = item.unit || '';
            const unit = (rawUnit.toLowerCase() === 'adet' || rawUnit.toLowerCase() === 'stueck') ? '' : rawUnit;
            const unitStr = unit ? ` ${unit}` : '';

            parts.push(CMD.FONT_DOUBLE_H, CMD.BOLD_ON);
            parts.push(textLine(`(#${pos}) - ${qty}x${unitStr} ${name}`));
            parts.push(CMD.FONT_NORMAL, CMD.BOLD_OFF);

            if (price) {
                parts.push(CMD.ALIGN_RIGHT);
                parts.push(textLine(price));
                parts.push(CMD.ALIGN_LEFT);
            }

            const opts = item.selectedOptions || item.options;
            if (opts && Array.isArray(opts) && opts.length > 0) {
                for (const opt of opts) {
                    const optName = opt.optionName || opt.name || opt;
                    const groupName = opt.groupName || '';
                    const priceMod = opt.priceModifier ? ` +${Number(opt.priceModifier).toFixed(2)}` : '';
                    const label = groupName ? `${groupName}: ${optName}` : optName;
                    parts.push(textLine(`    > ${label}${priceMod}`));
                }
            }
            if (item.note) parts.push(textLine(`  * ${item.note}`));
            parts.push(Buffer.from([ESC, 0x4A, 20]));
        }
    }

    parts.push(separator());

    // Total
    if (order.total || order.grandTotal) {
        parts.push(CMD.ALIGN_RIGHT, CMD.BOLD_ON, CMD.FONT_DOUBLE_H);
        parts.push(textLine(`TOPLAM: ${(order.grandTotal || order.total || 0).toFixed(2)} EUR`));
        parts.push(CMD.FONT_NORMAL, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
        parts.push(separator());
    }

    // Customer
    if (order.customerName || order.customerPhone) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('MUSTERI / KUNDE'));
        parts.push(CMD.BOLD_OFF);
        if (order.customerName) parts.push(textLine(`Ad: ${order.customerName}`));
        if (order.customerPhone) parts.push(textLine(`Tel: ${order.customerPhone}`));
        parts.push(separator());
    }

    // Address
    if (orderType === 'delivery' && order.deliveryAddress) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('ADRES / ADRESSE'));
        parts.push(CMD.BOLD_OFF);
        const addr = order.deliveryAddress;
        if (typeof addr === 'string') { parts.push(textLine(addr)); }
        else {
            if (addr.street) parts.push(textLine(addr.street));
            if (addr.city || addr.zipCode) parts.push(textLine(`${addr.zipCode || ''} ${addr.city || ''}`));
            if (addr.floor) parts.push(textLine(`Kat/Etage: ${addr.floor}`));
            if (addr.note) parts.push(textLine(`Not: ${addr.note}`));
        }
        parts.push(separator());
    }

    // Table
    if (orderType === 'dine_in' && (order.tableNumber || order.tableName)) {
        parts.push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.FONT_DOUBLE);
        parts.push(textLine(`MASA / TISCH: ${order.tableName || order.tableNumber}`));
        parts.push(CMD.FONT_NORMAL, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
        parts.push(separator());
    }

    // Note
    if (order.note || order.orderNote) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('NOT / HINWEIS'));
        parts.push(CMD.BOLD_OFF);
        parts.push(textLine(order.note || order.orderNote));
        parts.push(separator());
    }

    // Payment
    if (order.paymentMethod) {
        const payLabels = { cash: 'Nakit / Bar', cashOnDelivery: 'Nakit / Barzahlung', card: 'Kart / Karte', cardOnDelivery: 'Kart / Kartenzahlung', online: 'Online', stripe: 'Online / Stripe' };
        parts.push(textLine(`Odeme: ${payLabels[order.paymentMethod] || order.paymentMethod}`));
    }

    // Footer
    parts.push(CMD.ALIGN_CENTER);
    const now = new Date();
    parts.push(textLine(`${now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}  ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`));
    parts.push(textLine('--- LOKMA ---'));
    parts.push(CMD.ALIGN_LEFT, CMD.FEED_5, CMD.PARTIAL_CUT);

    return Buffer.concat(parts);
}

// ─── Self-Signed Certificate ─────────────────────────────────────

function getOrCreateCert() {
    const certDir = path.join(__dirname, '.certs');
    const certPath = path.join(certDir, 'cert.pem');
    const keyPath = path.join(certDir, 'key.pem');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    }

    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

    console.log('Generating self-signed certificate...');
    try {
        execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=lokma-print-relay"`, { stdio: 'pipe' });
        return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    } catch (err) {
        console.warn('Could not generate HTTPS cert, running HTTP only:', err.message);
        return null;
    }
}

// ─── Request Handler ─────────────────────────────────────────────

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

async function handleRequest(req, res) {
    // Set CORS headers on every response
    for (const [key, val] of Object.entries(CORS_HEADERS)) {
        res.setHeader(key, val);
    }

    // OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url;

    // GET / — status page
    if (url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'LOKMA Print Relay', status: 'running', uptime: process.uptime() }));
        return;
    }

    // POST /api/print/health
    if (url === '/api/print/health' && req.method === 'POST') {
        const body = await parseBody(req);
        const { printerIp, printerPort = 9100 } = body;

        if (!printerIp) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'printerIp is required' }));
            return;
        }

        const result = await checkPrinterTCP(printerIp, printerPort);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...result, timestamp: new Date().toISOString(), printerIp, printerPort }));
        return;
    }

    // POST /api/print
    if (url === '/api/print' && req.method === 'POST') {
        const body = await parseBody(req);
        const { printerIp, printerPort = 9100, order, businessName, testPrint, copies = 1 } = body;

        if (!printerIp) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'printerIp is required' }));
            return;
        }

        let receiptData;
        if (testPrint) {
            receiptData = buildReceipt({
                orderNumber: 'TEST',
                orderType: 'delivery',
                items: [
                    { name: 'Test Urun 1', quantity: 2, price: 5.50 },
                    { name: 'Test Urun 2', quantity: 1, price: 3.00, note: 'Ohne Zwiebeln' },
                ],
                total: 14.00,
                customerName: 'Test Musteri',
                customerPhone: '0176 12345678',
                deliveryAddress: { street: 'Teststr. 42', zipCode: '41836', city: 'Hueckelhoven' },
            }, businessName || 'LOKMA Test');
        } else if (!order) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'order data is required' }));
            return;
        } else {
            receiptData = buildReceipt(order, businessName);
        }

        try {
            for (let i = 0; i < copies; i++) {
                await sendToPrinter(printerIp, printerPort, receiptData);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Printed (${copies} copies)`, bytesWritten: receiptData.length }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Print failed', details: err.message }));
        }
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

// ─── Start Servers ───────────────────────────────────────────────

// HTTP server
const httpServer = http.createServer(handleRequest);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  LOKMA Print Relay`);
    console.log(`  HTTP:  http://0.0.0.0:${PORT}`);
});

// HTTPS server (for mixed content bypass)
const certs = getOrCreateCert();
if (certs) {
    const httpsServer = https.createServer(certs, handleRequest);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`  HTTPS: https://0.0.0.0:${HTTPS_PORT}`);
        console.log(`\n  Tablet icin printServerUrl ayarla:`);
        console.log(`    https://192.168.188.26:${HTTPS_PORT}`);
        console.log(`\n  Once tablette su adresi ziyaret edip sertifikayi kabul et:`);
        console.log(`    https://192.168.188.26:${HTTPS_PORT}/`);
        console.log('');
    });
}
