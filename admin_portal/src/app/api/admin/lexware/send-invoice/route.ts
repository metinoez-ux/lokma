export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

/**
 * POST /api/admin/lexware/send-invoice
 * 
 * Manually sends an existing Firestore invoice to Lexware Office API.
 * Use cases:
 * - Mid-month business account closure
 * - Customer exit from platform
 * - Testing invoice creation in Lexware
 * 
 * Body: { invoiceId: string }
 * 
 * Returns the Lexware invoice ID and voucher number on success.
 */

const LEXWARE_BASE_URL = 'https://api.lexware.io';
const LEXWARE_API_KEY = process.env.LEXWARE_API_KEY || '';

// Lexware API helper
async function lexwareRequest(method: string, path: string, body?: any) {
 const url = `${LEXWARE_BASE_URL}${path}`;
 const headers: Record<string, string> = {
 'Authorization': `Bearer ${LEXWARE_API_KEY}`,
 'Accept': 'application/json',
 };
 const options: RequestInit = { method, headers };
 if (body) {
 headers['Content-Type'] = 'application/json';
 options.body = JSON.stringify(body);
 }
 const response = await fetch(url, options);
 const contentType = response.headers.get('content-type') || '';
 let data: any;
 if (contentType.includes('application/json')) {
 data = await response.json();
 } else {
 data = await response.text();
 }
 return { status: response.status, data };
}

// Determine Lexware tax type from invoice data
function determineTaxType(invoice: any): string {
 const country = (invoice.countryCode || 'DE').toUpperCase();
 if (country === 'DE') return 'gross';

 const EU_STATES = new Set([
 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
 ]);

 if (EU_STATES.has(country) && invoice.vatId) return 'intraCommunitySupply';
 if (!EU_STATES.has(country) && country !== 'DE') return 'thirdPartyCountryService';
 return 'gross';
}

export async function POST(request: Request) {
 try {
 if (!LEXWARE_API_KEY) {
 return NextResponse.json(
 { error: 'LEXWARE_API_KEY ist nicht konfiguriert' },
 { status: 500 }
 );
 }

 const { db } = getFirebaseAdmin();
 const body = await request.json();
 const { invoiceId } = body;

 if (!invoiceId) {
 return NextResponse.json({ error: 'invoiceId ist erforderlich' }, { status: 400 });
 }

 // 1. Load invoice from Firestore
 const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
 if (!invoiceDoc.exists) {
 return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
 }

 const invoice = invoiceDoc.data()!;

 // 2. Check if already sent to Lexware
 if (invoice.lexwareInvoiceId) {
 return NextResponse.json({
 error: 'Bereits an Lexware gesendet',
 lexwareId: invoice.lexwareInvoiceId,
 voucherNumber: invoice.lexwareVoucherNumber || invoice.invoiceNumber,
 }, { status: 409 });
 }

 // 3. Build Lexware payload from invoice data
 const taxType = determineTaxType(invoice);
 const taxRate = taxType === 'gross' ? 19 : 0;
 const isVatFree = taxRate === 0;

 const makeUnitPrice = (amount: number) => {
 const base: any = { currency: 'EUR', taxRatePercentage: taxRate };
 // Always use netAmount — our invoice stores net values (subtotal)
 // Lexware will calculate gross = net + tax automatically
 base.netAmount = amount;
 return base;
 };

 // Build line items - support both 'lineItems' (new) and 'items' (legacy) field names
 const lexwareLineItems: any[] = [];
 const invoiceItems = invoice.lineItems || invoice.items;

 if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
 for (const item of invoiceItems) {
 const itemTaxRate = item.taxRate ?? taxRate;
 lexwareLineItems.push({
 type: 'custom',
 name: item.description || item.name || 'Leistung',
 description: item.details || '',
 quantity: item.quantity || 1,
 unitName: item.unit || item.unitName || 'Stuck',
 unitPrice: {
 currency: 'EUR',
 netAmount: item.unitPrice || item.netAmount || 0,
 taxRatePercentage: itemTaxRate,
 },
 });
 }
 } else {
 // Fallback: Single line item from invoice totals
 lexwareLineItems.push({
 type: 'custom',
 name: invoice.description || `LOKMA Plattform-Rechnung ${invoice.period || ''}`,
 description: invoice.period
 ? `Abrechnungszeitraum: ${invoice.period}`
 : `Rechnungsnr. ${invoice.invoiceNumber}`,
 quantity: 1,
 unitName: 'Pauschale',
 unitPrice: {
 currency: 'EUR',
 netAmount: invoice.subtotal || invoice.grandTotal || 0,
 taxRatePercentage: taxRate,
 },
 });
 }

 // Period formatting
 const periodLabel = invoice.period || 'Einmalig';
 const voucherDate = invoice.issueDate
 ? (typeof invoice.issueDate.toDate === 'function'
 ? invoice.issueDate.toDate().toISOString()
 : new Date(invoice.issueDate).toISOString())
 : new Date().toISOString();

 // Parse buyer address
 const addressParts = (invoice.butcherAddress || '').split(',').map((s: string) => s.trim());
 const street = addressParts[0] || '';
 const cityParts = (addressParts[1] || '').split(' ');
 const zip = cityParts[0] || '';
 const city = cityParts.slice(1).join(' ') || '';

 // Build remark
 let remark = 'Die Zahlung erfolgt per SEPA-Lastschrift. Vielen Dank für Ihre Partnerschaft mit LOKMA!';
 if (taxType === 'intraCommunitySupply') {
 remark = `Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge) gem. §13b UStG.\n\n${remark}`;
 }
 if (invoice.vatId) {
 remark = `USt-IdNr. Kunde: ${invoice.vatId}\n${remark}`;
 }

 const lexwarePayload = {
 archived: false,
 voucherDate,
 address: {
 name: invoice.butcherName || 'Unbekannt',
 street,
 zip,
 city,
 countryCode: invoice.countryCode || 'DE',
 },
 lineItems: lexwareLineItems,
 totalPrice: { currency: 'EUR' },
 taxConditions: { taxType },
 paymentConditions: {
 paymentTermLabel: 'Zahlung per SEPA-Lastschrift innerhalb von 14 Tagen',
 paymentTermDuration: 14,
 },
 title: 'Rechnung',
 introduction: `Unsere Rechnungsnr.: ${invoice.invoiceNumber || ''}\nLOKMA Plattform-Abrechnung – ${periodLabel}.`,
 remark,
 shippingConditions: {
 shippingType: 'service',
 shippingDate: voucherDate,
 },
 };

 // 4. Send to Lexware API
 console.log(`[Lexware Manual] Sending invoice ${invoiceId} to Lexware...`);
 const { status, data } = await lexwareRequest('POST', '/v1/invoices?finalize=true', lexwarePayload);

 if (status !== 200 && status !== 201) {
 console.error(`[Lexware Manual] Failed: HTTP ${status}`, data);
 return NextResponse.json({
 error: `Lexware API Fehler: HTTP ${status}`,
 details: typeof data === 'string' ? data : JSON.stringify(data),
 }, { status: 502 });
 }

 const lexwareId = data.id;
 console.log(`[Lexware Manual] Invoice created: ${lexwareId}`);

 // 5. Fetch invoice details from Lexware to get voucherNumber
 let voucherNumber = '';
 let pdfFileId = '';
 try {
 const detailRes = await lexwareRequest('GET', `/v1/invoices/${lexwareId}`);
 if (detailRes.status === 200) {
 voucherNumber = detailRes.data.voucherNumber || '';
 pdfFileId = detailRes.data.files?.documentFileId || '';
 }
 } catch (e) {
 console.warn('[Lexware Manual] Could not fetch invoice detail:', e);
 }

 // 6. Update Firestore with Lexware reference
 const now = new Date();
 await db.collection('invoices').doc(invoiceId).update({
 lexwareInvoiceId: lexwareId,
 lexwareVoucherNumber: voucherNumber || null,
 lexwarePdfFileId: pdfFileId || null,
 lexwareSentAt: now,
 lexwareSentBy: body.sentBy || 'admin',
 source: invoice.source === 'fallback_no_lexware' ? 'manual_lexware' : (invoice.source || 'manual_lexware'),
 updatedAt: now,
 });

 // 7. Add audit log
 await db.collection('erp_audit_log').add({
 entityType: 'invoice',
 entityId: invoiceId,
 action: 'lexware_manual_send',
 details: {
 lexwareId,
 voucherNumber,
 sentBy: body.sentBy || 'admin',
 },
 timestamp: now,
 createdAt: now,
 });

 console.log(`[Lexware Manual] Invoice ${invoiceId} → Lexware ${lexwareId} (${voucherNumber})`);

 return NextResponse.json({
 success: true,
 lexwareId,
 voucherNumber,
 pdfFileId,
 message: `Rechnung erfolgreich an Lexware gesendet. Lexware-Nr.: ${voucherNumber || lexwareId}`,
 });

 } catch (error: any) {
 console.error('[Lexware Manual] Error:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
