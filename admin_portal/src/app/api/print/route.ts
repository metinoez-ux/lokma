import { NextRequest, NextResponse } from 'next/server';
import net from 'net';
import { RECEIPT_LOGO_BASE64 } from './receiptLogo';

// CORS headers for local print relay (lokma.web.app → localhost:3000)
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
};

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMD = {
    INIT: Buffer.from([ESC, 0x40]),                    // Initialize printer
    BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),           // Bold on
    BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),          // Bold off
    ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),      // Center align
    ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),        // Left align
    ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),       // Right align
    FONT_NORMAL: Buffer.from([ESC, 0x21, 0x00]),       // Normal size
    FONT_DOUBLE_H: Buffer.from([ESC, 0x21, 0x10]),     // Double height
    FONT_DOUBLE_W: Buffer.from([ESC, 0x21, 0x20]),     // Double width
    FONT_DOUBLE: Buffer.from([ESC, 0x21, 0x30]),       // Double width + height
    FONT_LARGE: Buffer.from([GS, 0x21, 0x11]),         // 2x width + 2x height
    LINE: Buffer.from([LF]),                            // Line feed
    CUT: Buffer.from([GS, 0x56, 0x00]),                // Full cut
    PARTIAL_CUT: Buffer.from([GS, 0x56, 0x01]),        // Partial cut
    FEED_3: Buffer.from([ESC, 0x64, 0x03]),            // Feed 3 lines
    FEED_5: Buffer.from([ESC, 0x64, 0x05]),            // Feed 5 lines
    UNDERLINE_ON: Buffer.from([ESC, 0x2D, 0x01]),      // Underline on
    UNDERLINE_OFF: Buffer.from([ESC, 0x2D, 0x00]),     // Underline off
};

// ASCII transliteration for German/Turkish special characters
// Standard German convention: ß→ss, ü→ue, ö→oe, ä→ae
const CHAR_REPLACE: Record<string, string> = {
    'ä': 'ae', 'Ä': 'Ae', 'ö': 'oe', 'Ö': 'Oe',
    'ü': 'ue', 'Ü': 'Ue', 'ß': 'ss',
    'ç': 'c', 'Ç': 'C', 'ş': 's', 'Ş': 'S',
    'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'á': 'a', 'à': 'a', 'â': 'a',
    'ó': 'o', 'ò': 'o', 'ô': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u',
    'ñ': 'n', 'Ñ': 'N', '€': 'EUR',
};

// Helper to encode text for receipt printer (pure ASCII — works on all printers)
function encodeText(text: string): Buffer {
    let ascii = '';
    for (const ch of text) {
        ascii += CHAR_REPLACE[ch] || ch;
    }
    return Buffer.from(ascii, 'ascii');
}

function textLine(text: string): Buffer {
    return Buffer.concat([encodeText(text), CMD.LINE]);
}

function separator(char = '-', width = 48): Buffer {
    return textLine(char.repeat(width));
}

// Build receipt data from order
function buildReceipt(order: any, businessName?: string): Buffer {
    const parts: Buffer[] = [];

    // INIT
    parts.push(CMD.INIT);

    // --- LOKMA LOGO (raster image) ---
    parts.push(CMD.ALIGN_CENTER);
    try {
        const logoBuffer = Buffer.from(RECEIPT_LOGO_BASE64, 'base64');
        parts.push(logoBuffer);
    } catch {
        // Fallback to text logo if image fails
        parts.push(CMD.BOLD_ON);
        parts.push(CMD.FONT_LARGE);
        parts.push(textLine('LOKMA'));
        parts.push(CMD.FONT_NORMAL);
        parts.push(CMD.BOLD_OFF);
        parts.push(textLine('fresh. fast. local.'));
    }
    parts.push(CMD.ALIGN_LEFT);
    parts.push(separator());

    // --- HEADER ---
    parts.push(CMD.ALIGN_CENTER);
    parts.push(CMD.BOLD_ON);
    parts.push(CMD.FONT_DOUBLE_H);
    parts.push(textLine(businessName || 'LOKMA'));
    parts.push(CMD.FONT_NORMAL);
    parts.push(CMD.BOLD_OFF);

    // Order type badge
    const typeLabels: Record<string, string> = {
        delivery: 'KURYE / LIEFERUNG',
        pickup: 'GEL-AL / ABHOLUNG',
        dine_in: 'YERINDE / VOR ORT',
    };
    const orderType = order.orderType || order.type || 'delivery';
    parts.push(CMD.BOLD_ON);
    parts.push(textLine(typeLabels[orderType] || orderType.toUpperCase()));
    parts.push(CMD.BOLD_OFF);
    parts.push(CMD.ALIGN_LEFT);
    parts.push(separator('='));

    // --- ORDER NUMBER (BIG) ---
    parts.push(CMD.ALIGN_CENTER);
    parts.push(CMD.BOLD_ON);
    parts.push(CMD.FONT_LARGE);
    const orderNum = order.orderNumber || order.id?.substring(0, 6) || '---';
    parts.push(textLine(`#${orderNum}`));
    parts.push(CMD.FONT_NORMAL);
    parts.push(CMD.BOLD_OFF);
    parts.push(CMD.ALIGN_LEFT);

    // --- SCHEDULED TIME (BIG — if pre-order) ---
    if (order.scheduledAt) {
        parts.push(separator('*'));
        parts.push(CMD.ALIGN_CENTER);
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('ISTENEN SAAT / BESTELLUNG FUER'));
        parts.push(CMD.FONT_LARGE);
        const schedDate = new Date(order.scheduledAt);
        const schedDateStr = schedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const schedTimeStr = schedDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        parts.push(textLine(schedDateStr));
        parts.push(textLine(`${schedTimeStr} Uhr`));
        parts.push(CMD.FONT_NORMAL);
        parts.push(CMD.BOLD_OFF);
        parts.push(CMD.ALIGN_LEFT);
    }

    parts.push(separator());

    // --- ITEMS ---
    parts.push(CMD.BOLD_ON);
    parts.push(textLine('URUNLER / ARTIKEL'));
    parts.push(CMD.BOLD_OFF);
    parts.push(separator('-'));

    if (order.items && Array.isArray(order.items)) {
        let positionNum = 0;
        for (const item of order.items) {
            positionNum++;
            const qty = item.quantity || 1;
            const name = item.name || item.productName || 'Unbekannt';
            const price = item.price ? `${(item.price * qty).toFixed(2)} EUR` : '';
            // Skip "adet"/"stueck" unit - redundant
            const rawUnit = item.unit || '';
            const unit = (rawUnit.toLowerCase() === 'adet' || rawUnit.toLowerCase() === 'stueck') ? '' : rawUnit;
            const unitStr = unit ? ` ${unit}` : '';

            // Item line: "(#1) - 3x Tonno-Funghi" (double-height, bold for kitchen + packaging)
            const itemText = `(#${positionNum}) - ${qty}x${unitStr} ${name}`;
            parts.push(CMD.FONT_DOUBLE_H);
            parts.push(CMD.BOLD_ON);
            parts.push(textLine(itemText));
            parts.push(CMD.FONT_NORMAL);
            parts.push(CMD.BOLD_OFF);

            // Price on separate line (normal size, right-aligned)
            if (price) {
                parts.push(CMD.ALIGN_RIGHT);
                parts.push(textLine(price));
                parts.push(CMD.ALIGN_LEFT);
            }

            // Options / variants (Firestore uses 'selectedOptions')
            const opts = item.selectedOptions || item.options;
            if (opts && Array.isArray(opts) && opts.length > 0) {
                for (const opt of opts) {
                    const optName = opt.optionName || opt.name || opt;
                    const groupName = opt.groupName || '';
                    const priceMod = opt.priceModifier ? ` +${Number(opt.priceModifier).toFixed(2)}` : '';
                    const label = groupName ? `${groupName}: ${optName}` : optName;
                    // Indented, normal font (smaller than item which is double-height)
                    parts.push(textLine(`    > ${label}${priceMod}`));
                }
            }
            // Item note
            if (item.note) {
                parts.push(textLine(`  * ${item.note}`));
            }
            // Small gap between items (partial feed ~20 dots, not a full line)
            parts.push(Buffer.from([ESC, 0x4A, 20]));
        }
    }

    parts.push(separator());

    // --- TOTAL ---
    if (order.total || order.grandTotal) {
        parts.push(CMD.ALIGN_RIGHT);
        parts.push(CMD.BOLD_ON);
        parts.push(CMD.FONT_DOUBLE_H);
        const total = order.grandTotal || order.total || 0;
        parts.push(textLine(`TOPLAM: ${total.toFixed(2)} EUR`));
        parts.push(CMD.FONT_NORMAL);
        parts.push(CMD.BOLD_OFF);
        parts.push(CMD.ALIGN_LEFT);
        parts.push(separator());
    }

    // --- CUSTOMER INFO ---
    if (order.customerName || order.customerPhone) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('MUSTERI / KUNDE'));
        parts.push(CMD.BOLD_OFF);
        if (order.customerName) parts.push(textLine(`Ad: ${order.customerName}`));
        if (order.customerPhone) parts.push(textLine(`Tel: ${order.customerPhone}`));
        parts.push(separator());
    }

    // --- DELIVERY ADDRESS ---
    if (orderType === 'delivery' && order.deliveryAddress) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('ADRES / ADRESSE'));
        parts.push(CMD.BOLD_OFF);
        const addr = order.deliveryAddress;
        if (typeof addr === 'string') {
            parts.push(textLine(addr));
        } else {
            if (addr.street) parts.push(textLine(addr.street));
            if (addr.city || addr.zipCode) parts.push(textLine(`${addr.zipCode || ''} ${addr.city || ''}`));
            if (addr.floor) parts.push(textLine(`Kat/Etage: ${addr.floor}`));
            if (addr.note) parts.push(textLine(`Not: ${addr.note}`));
        }
        parts.push(separator());
    }

    // --- TABLE INFO (dine-in) ---
    if (orderType === 'dine_in' && (order.tableNumber || order.tableName)) {
        parts.push(CMD.ALIGN_CENTER);
        parts.push(CMD.BOLD_ON);
        parts.push(CMD.FONT_DOUBLE);
        parts.push(textLine(`MASA / TISCH: ${order.tableName || order.tableNumber}`));
        parts.push(CMD.FONT_NORMAL);
        parts.push(CMD.BOLD_OFF);
        parts.push(CMD.ALIGN_LEFT);
        parts.push(separator());
    }

    // --- ORDER NOTE ---
    if (order.note || order.orderNote) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('NOT / HINWEIS'));
        parts.push(CMD.BOLD_OFF);
        parts.push(textLine(order.note || order.orderNote));
        parts.push(separator());
    }

    // --- PAYMENT ---
    if (order.paymentMethod) {
        const payLabels: Record<string, string> = {
            cash: 'Nakit / Bar',
            cashOnDelivery: 'Nakit / Barzahlung',
            card: 'Kart / Karte',
            cardOnDelivery: 'Kart / Kartenzahlung',
            online: 'Online',
            stripe: 'Online / Stripe',
            paypal: 'PayPal',
        };
        parts.push(textLine(`Odeme: ${payLabels[order.paymentMethod] || order.paymentMethod}`));
    }

    // --- FOOTER ---
    parts.push(CMD.ALIGN_CENTER);
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    parts.push(textLine(`${dateStr}  ${timeStr}`));
    parts.push(textLine('--- LOKMA ---'));
    parts.push(CMD.ALIGN_LEFT);

    // Feed and cut
    parts.push(CMD.FEED_5);
    parts.push(CMD.PARTIAL_CUT);

    return Buffer.concat(parts);
}

// Build reservation receipt
function buildReservationReceipt(reservation: any, businessName?: string): Buffer {
    const parts: Buffer[] = [];

    // INIT
    parts.push(CMD.INIT);

    // --- HEADER ---
    parts.push(CMD.ALIGN_CENTER);
    parts.push(CMD.BOLD_ON);
    parts.push(CMD.FONT_DOUBLE_H);
    parts.push(textLine(businessName || 'LOKMA'));
    parts.push(CMD.FONT_NORMAL);
    parts.push(CMD.BOLD_OFF);

    // Type badge
    parts.push(CMD.BOLD_ON);
    parts.push(textLine('MASA REZERVASYONU'));
    parts.push(textLine('TISCHRESERVIERUNG'));
    parts.push(CMD.BOLD_OFF);
    parts.push(CMD.ALIGN_LEFT);
    parts.push(separator('='));

    // --- RESERVATION NUMBER (BIG) ---
    parts.push(CMD.ALIGN_CENTER);
    parts.push(CMD.BOLD_ON);
    parts.push(CMD.FONT_LARGE);
    const resId = reservation.reservationNumber || reservation.id?.substring(0, 6)?.toUpperCase() || '---';
    parts.push(textLine(`REZ #${resId}`));
    parts.push(CMD.FONT_NORMAL);
    parts.push(CMD.BOLD_OFF);
    parts.push(CMD.ALIGN_LEFT);
    parts.push(separator());

    // --- DATE & TIME (LARGE + BOLD) ---
    parts.push(CMD.ALIGN_CENTER);
    parts.push(CMD.BOLD_ON);
    parts.push(CMD.FONT_DOUBLE);
    const resDate = reservation.reservationDate
        ? new Date(reservation.reservationDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '--.--.----';
    const resTime = reservation.timeSlot
        || (reservation.reservationDate
            ? new Date(reservation.reservationDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : '--:--');
    parts.push(textLine(resDate));
    parts.push(textLine(`${resTime} Uhr`));
    parts.push(CMD.FONT_NORMAL);
    parts.push(CMD.BOLD_OFF);
    parts.push(CMD.ALIGN_LEFT);
    parts.push(separator());

    // --- PARTY SIZE ---
    parts.push(CMD.ALIGN_CENTER);
    parts.push(CMD.BOLD_ON);
    parts.push(CMD.FONT_DOUBLE);
    parts.push(textLine(`${reservation.partySize || '?'} Kisi / Personen`));
    parts.push(CMD.FONT_NORMAL);
    parts.push(CMD.BOLD_OFF);
    parts.push(CMD.ALIGN_LEFT);
    parts.push(separator());

    // --- TABLE CARD NUMBERS ---
    if (reservation.tableCardNumbers && reservation.tableCardNumbers.length > 0) {
        parts.push(CMD.ALIGN_CENTER);
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('MASA / TISCH'));
        parts.push(CMD.FONT_DOUBLE);
        parts.push(textLine(`Nr. ${reservation.tableCardNumbers.join(', ')}`));
        parts.push(CMD.FONT_NORMAL);
        parts.push(CMD.BOLD_OFF);
        parts.push(CMD.ALIGN_LEFT);
        parts.push(separator());
    }

    // --- CUSTOMER INFO ---
    parts.push(CMD.BOLD_ON);
    parts.push(textLine('MUSTERI / KUNDE'));
    parts.push(CMD.BOLD_OFF);
    parts.push(textLine(`Ad: ${reservation.customerName || 'Unbekannt'}`));
    if (reservation.customerPhone) {
        parts.push(textLine(`Tel: ${reservation.customerPhone}`));
    }
    if (reservation.customerEmail) {
        parts.push(textLine(`Email: ${reservation.customerEmail}`));
    }
    parts.push(separator());

    // --- NOTES ---
    if (reservation.notes) {
        parts.push(CMD.BOLD_ON);
        parts.push(textLine('NOT / NOTIZ'));
        parts.push(CMD.BOLD_OFF);
        parts.push(textLine(reservation.notes));
        parts.push(separator());
    }

    // --- FOOTER ---
    parts.push(CMD.ALIGN_CENTER);
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    parts.push(textLine(`Erstellt: ${dateStr} ${timeStr}`));
    parts.push(textLine('--- LOKMA ---'));
    parts.push(CMD.ALIGN_LEFT);

    // Feed and cut
    parts.push(CMD.FEED_5);
    parts.push(CMD.PARTIAL_CUT);

    return Buffer.concat(parts);
}

// Send data to printer via TCP
async function sendToPrinter(ip: string, port: number, data: Buffer, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let resolved = false;

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                reject(new Error(`Printer timeout after ${timeoutMs}ms`));
            }
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
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });

        socket.on('close', () => {
            clearTimeout(timer);
            if (!resolved) {
                resolved = true;
                resolve();
            }
        });
    });
}

// POST handler
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { printerIp, printerPort = 9100, order, reservation, businessName, testPrint } = body;

        if (!printerIp) {
            return NextResponse.json({ error: 'printerIp is required' }, { status: 400, headers: CORS_HEADERS });
        }

        let receiptData: Buffer;

        if (testPrint) {
            // Build a test receipt
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
        } else if (reservation) {
            // Build a reservation receipt
            receiptData = buildReservationReceipt(reservation, businessName);
        } else {
            if (!order) {
                return NextResponse.json({ error: 'order or reservation data is required' }, { status: 400 });
            }
            receiptData = buildReceipt(order, businessName);
        }

        // Send to printer
        const copies = body.copies || 1;
        for (let i = 0; i < copies; i++) {
            await sendToPrinter(printerIp, printerPort, receiptData);
        }

        return NextResponse.json({
            success: true,
            message: `Receipt printed successfully (${copies} copy/copies)`,
            bytesWritten: receiptData.length
        }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error('Print error:', error);
        return NextResponse.json({
            error: 'Print failed',
            details: error.message
        }, { status: 500, headers: CORS_HEADERS });
    }
}
