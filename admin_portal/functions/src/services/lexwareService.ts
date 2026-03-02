/**
 * Lexware Office API Service
 * 
 * Manages invoice and credit note creation via the Lexware REST API.
 * Used for GoBD-compliant German invoicing with automatic DATEV/XRechnung support.
 * 
 * VAT Compliance:
 *  - DE domestic → 19% MwSt (taxType: "gross" or "net")
 *  - EU B2B with valid VAT ID → 0% Reverse Charge §13b UStG (taxType: "intraCommunitySupply")
 *  - Non-EU (Drittland) → 0% (taxType: "thirdPartyCountryService")
 * 
 * API Gateway: https://api.lexware.io
 * Docs: https://developers.lexware.io/docs/
 */

// =============================================================================
// EU MEMBER STATES (ISO 3166-1 alpha-2 codes, excluding DE)
// =============================================================================

const EU_MEMBER_STATES = new Set([
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL",
    "PT", "RO", "SK", "SI", "ES", "SE",
]);

// =============================================================================
// LEXWARE TAX TYPE ENUM
// =============================================================================

/**
 * Lexware taxType values per German tax law:
 * - "gross" / "net" → DE domestic with 19% MwSt
 * - "intraCommunitySupply" → EU B2B reverse charge (§13b UStG)
 * - "thirdPartyCountryService" → Services to non-EU countries
 * - "thirdPartyCountryDelivery" → Goods delivered to non-EU countries
 * - "vatfree" → Tax-exempt (e.g. Kleinunternehmer §19)
 */
export type LexwareTaxType =
    | "gross"
    | "net"
    | "intraCommunitySupply"
    | "thirdPartyCountryService"
    | "thirdPartyCountryDelivery"
    | "vatfree";

// =============================================================================
// TYPES
// =============================================================================

export interface LexwareAddress {
    contactId?: string;
    name: string;
    supplement?: string;
    street: string;
    city: string;
    zip: string;
    countryCode: string;
}

export interface LexwareLineItem {
    type: "custom" | "text";
    name: string;
    description?: string;
    quantity?: number;
    unitName?: string;
    unitPrice?: {
        currency: string;
        netAmount?: number;
        grossAmount?: number;
        taxRatePercentage: number;
    };
    discountPercentage?: number;
}

export interface LexwareInvoicePayload {
    archived?: boolean;
    voucherDate: string; // ISO 8601 with timezone
    address: LexwareAddress;
    lineItems: LexwareLineItem[];
    totalPrice: { currency: string };
    taxConditions: { taxType: LexwareTaxType };
    paymentConditions?: {
        paymentTermLabel: string;
        paymentTermDuration: number;
    };
    shippingConditions?: {
        shippingDate: string;
        shippingType: "delivery" | "service" | "deliveryperiod" | "serviceperiod" | "none";
    };
    title: string;
    introduction: string;
    remark: string;
}

export interface LexwareCreateResponse {
    id: string;
    resourceUri: string;
    createdDate: string;
    updatedDate: string;
    version: number;
}

export interface LexwareInvoice {
    id: string;
    organizationId: string;
    voucherStatus: "draft" | "open" | "paid" | "paidoff" | "voided" | "transferred";
    voucherNumber: string;
    voucherDate: string;
    dueDate?: string;
    address: LexwareAddress;
    lineItems: LexwareLineItem[];
    totalPrice: {
        currency: string;
        totalNetAmount: number;
        totalGrossAmount: number;
        totalTaxAmount: number;
    };
    files?: {
        documentFileId: string;
    };
}

export interface LexwareInvoiceResult {
    success: boolean;
    lexwareId?: string;
    voucherNumber?: string;
    totalGross?: number;
    totalNet?: number;
    totalTax?: number;
    pdfFileId?: string;
    error?: string;
}

// =============================================================================
// LEXWARE API CLIENT
// =============================================================================

const LEXWARE_BASE_URL = "https://api.lexware.io";

/**
 * Makes an authenticated request to the Lexware API
 */
async function lexwareRequest(
    apiKey: string,
    method: string,
    path: string,
    body?: any
): Promise<{ status: number; data: any }> {
    const url = `${LEXWARE_BASE_URL}${path}`;

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
    };

    const options: RequestInit = { method, headers };

    if (body) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    let data: any;
    if (contentType.includes("application/json")) {
        data = await response.json();
    } else if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
        const arrayBuffer = await response.arrayBuffer();
        data = Buffer.from(arrayBuffer);
    } else {
        data = await response.text();
    }

    return { status: response.status, data };
}

// =============================================================================
// VIES VAT NUMBER VALIDATION (EU Commission REST API)
// =============================================================================

export interface ViesValidationResult {
    valid: boolean;
    countryCode: string;
    vatNumber: string;
    requestDate?: string;
    name?: string;
    address?: string;
    error?: string;
}

/**
 * Validates an EU VAT number using the official EU VIES REST API.
 * This is required for §13b UStG reverse-charge invoicing.
 *
 * @param fullVatId - Full VAT ID including country prefix, e.g. "ATU12345678", "NL123456789B01"
 * @returns Validation result with name/address if available
 */
export async function validateVatNumber(fullVatId: string): Promise<ViesValidationResult> {
    // Extract country code (first 2 chars) and VAT number (rest)
    const sanitized = fullVatId.replace(/[\s.-]/g, "").toUpperCase();
    if (sanitized.length < 4) {
        return { valid: false, countryCode: "", vatNumber: sanitized, error: "VAT ID too short" };
    }

    const countryCode = sanitized.substring(0, 2);
    const vatNumber = sanitized.substring(2);

    try {
        const response = await fetch(
            "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ countryCode, vatNumber }),
            }
        );

        if (!response.ok) {
            console.error(`[VIES] HTTP ${response.status} for ${countryCode}${vatNumber}`);
            return {
                valid: false,
                countryCode,
                vatNumber,
                error: `VIES API returned HTTP ${response.status}`,
            };
        }

        const data = await response.json();

        console.log(`[VIES] Validation for ${countryCode}${vatNumber}: valid=${data.valid}`);

        return {
            valid: data.valid === true,
            countryCode: data.countryCode || countryCode,
            vatNumber: data.vatNumber || vatNumber,
            requestDate: data.requestDate,
            name: data.name || undefined,
            address: data.address || undefined,
        };
    } catch (error: any) {
        console.error("[VIES] Validation error:", error.message);
        return {
            valid: false,
            countryCode,
            vatNumber,
            error: `VIES API error: ${error.message}`,
        };
    }
}

// =============================================================================
// TAX CLASSIFICATION
// =============================================================================

export interface VatClassification {
    taxType: LexwareTaxType;
    taxRatePercentage: number;
    reverseCharge: boolean;
    legalNote: string;         // Pflichtangabe auf der Rechnung
    vatIdValid?: boolean;
    vatIdCheckedAt?: string;
}

/**
 * Determines the correct Lexware taxType and tax rate based on:
 *  1. Customer's country (DE / EU / Drittland)
 *  2. Customer's VAT ID validity (VIES check for EU)
 *
 * German tax law rules:
 *  - DE customer → 19% MwSt (normal domestic)
 *  - EU customer with valid VAT ID → 0% reverse charge (§13b UStG)
 *  - EU customer WITHOUT valid VAT ID → 19% MwSt (treated as B2C/domestic)
 *  - Non-EU customer → 0% (Drittland, §3a UStG)
 */
export async function classifyTaxType(params: {
    countryCode: string;
    vatId?: string;
}): Promise<VatClassification> {
    const { countryCode, vatId } = params;
    const country = (countryCode || "DE").toUpperCase();

    // Case 1: German domestic customer
    if (country === "DE") {
        return {
            taxType: "gross",
            taxRatePercentage: 19,
            reverseCharge: false,
            legalNote: "",
        };
    }

    // Case 2: EU member state
    if (EU_MEMBER_STATES.has(country)) {
        // If they have a VAT ID, validate it
        if (vatId && vatId.trim().length > 0) {
            const viesResult = await validateVatNumber(vatId);

            if (viesResult.valid) {
                // ✅ Valid EU VAT ID → Reverse charge §13b UStG
                return {
                    taxType: "intraCommunitySupply",
                    taxRatePercentage: 0,
                    reverseCharge: true,
                    legalNote: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge) gem. §13b UStG. Die Umsatzsteuer ist vom Leistungsempfänger zu entrichten.",
                    vatIdValid: true,
                    vatIdCheckedAt: new Date().toISOString(),
                };
            } else {
                // ❌ Invalid EU VAT ID → Cannot apply reverse charge, treat as B2C
                console.warn(`[VAT] Invalid VAT ID for EU customer: ${vatId} (${country}). Charging 19% MwSt.`);
                return {
                    taxType: "gross",
                    taxRatePercentage: 19,
                    reverseCharge: false,
                    legalNote: `USt-IdNr. ${vatId} konnte nicht über VIES verifiziert werden. Rechnung mit 19% MwSt.`,
                    vatIdValid: false,
                    vatIdCheckedAt: new Date().toISOString(),
                };
            }
        }

        // No VAT ID provided → charge German VAT (B2C to EU)
        return {
            taxType: "gross",
            taxRatePercentage: 19,
            reverseCharge: false,
            legalNote: "",
        };
    }

    // Case 3: Third country (non-EU)
    // LOKMA provides digital platform services → thirdPartyCountryService
    return {
        taxType: "thirdPartyCountryService",
        taxRatePercentage: 0,
        reverseCharge: false,
        legalNote: "Leistungsort gem. §3a Abs. 2 UStG – nicht steuerbar in Deutschland.",
    };
}

// =============================================================================
// INVOICE FUNCTIONS
// =============================================================================

/**
 * Tests Lexware API connection
 */
export async function testLexwareConnection(apiKey: string): Promise<{
    connected: boolean;
    organizationId?: string;
    companyName?: string;
    features?: string[];
    error?: string;
}> {
    try {
        const { status, data } = await lexwareRequest(apiKey, "GET", "/v1/profile");

        if (status === 200) {
            return {
                connected: true,
                organizationId: data.organizationId,
                companyName: data.companyName,
                features: data.businessFeatures,
            };
        }

        return { connected: false, error: `HTTP ${status}: ${JSON.stringify(data)}` };
    } catch (error: any) {
        return { connected: false, error: error.message };
    }
}

/**
 * Creates a finalized invoice in Lexware Office.
 * Lexware automatically assigns a sequential GoBD-compliant invoice number.
 */
export async function createLexwareInvoice(
    apiKey: string,
    payload: LexwareInvoicePayload,
    finalize: boolean = true
): Promise<LexwareInvoiceResult> {
    try {
        const queryParam = finalize ? "?finalize=true" : "";
        const { status, data } = await lexwareRequest(
            apiKey,
            "POST",
            `/v1/invoices${queryParam}`,
            payload
        );

        if (status === 200 || status === 201) {
            const createResponse = data as LexwareCreateResponse;
            console.log(`[Lexware] Invoice created: ${createResponse.id}`);

            // Fetch the full invoice to get the voucherNumber
            const invoiceDetail = await getLexwareInvoice(apiKey, createResponse.id);

            return {
                success: true,
                lexwareId: createResponse.id,
                voucherNumber: invoiceDetail?.voucherNumber,
                totalGross: invoiceDetail?.totalPrice?.totalGrossAmount,
                totalNet: invoiceDetail?.totalPrice?.totalNetAmount,
                totalTax: invoiceDetail?.totalPrice?.totalTaxAmount,
                pdfFileId: invoiceDetail?.files?.documentFileId,
            };
        }

        console.error(`[Lexware] Invoice creation failed: HTTP ${status}`, data);
        return { success: false, error: `HTTP ${status}: ${JSON.stringify(data)}` };
    } catch (error: any) {
        console.error("[Lexware] Invoice creation error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Creates a finalized credit note (Gutschrift) in Lexware Office.
 * Can be standalone or linked to an existing invoice.
 */
export async function createLexwareCreditNote(
    apiKey: string,
    payload: LexwareInvoicePayload,
    finalize: boolean = true
): Promise<LexwareInvoiceResult> {
    try {
        const queryParam = finalize ? "?finalize=true" : "";
        const { status, data } = await lexwareRequest(
            apiKey,
            "POST",
            `/v1/credit-notes${queryParam}`,
            payload
        );

        if (status === 200 || status === 201) {
            const createResponse = data as LexwareCreateResponse;
            console.log(`[Lexware] Credit note created: ${createResponse.id}`);

            return {
                success: true,
                lexwareId: createResponse.id,
            };
        }

        console.error(`[Lexware] Credit note creation failed: HTTP ${status}`, data);
        return { success: false, error: `HTTP ${status}: ${JSON.stringify(data)}` };
    } catch (error: any) {
        console.error("[Lexware] Credit note creation error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Retrieves full invoice details from Lexware
 */
export async function getLexwareInvoice(
    apiKey: string,
    invoiceId: string
): Promise<LexwareInvoice | null> {
    try {
        const { status, data } = await lexwareRequest(apiKey, "GET", `/v1/invoices/${invoiceId}`);

        if (status === 200) {
            return data as LexwareInvoice;
        }

        console.error(`[Lexware] Get invoice failed: HTTP ${status}`);
        return null;
    } catch (error: any) {
        console.error("[Lexware] Get invoice error:", error);
        return null;
    }
}

/**
 * Downloads the invoice PDF from Lexware
 */
export async function downloadLexwareInvoicePDF(
    apiKey: string,
    invoiceId: string
): Promise<Buffer | null> {
    try {
        // First render the document
        const renderResult = await lexwareRequest(apiKey, "GET", `/v1/invoices/${invoiceId}/document`);

        if (renderResult.status === 200 && renderResult.data?.documentFileId) {
            // Download the file
            const { status, data } = await lexwareRequest(
                apiKey,
                "GET",
                `/v1/files/${renderResult.data.documentFileId}`
            );

            if (status === 200 && Buffer.isBuffer(data)) {
                return data;
            }
        }

        console.error(`[Lexware] PDF download failed for invoice ${invoiceId}`);
        return null;
    } catch (error: any) {
        console.error("[Lexware] PDF download error:", error);
        return null;
    }
}

// =============================================================================
// INVOICE BUILDER HELPERS
// =============================================================================

/**
 * Builds a Lexware invoice payload for a LOKMA monthly business invoice.
 * Combines subscription, commission, and module charges into one invoice.
 *
 * IMPORTANT: Now accepts VatClassification to apply correct tax treatment:
 *  - DE domestic → 19% MwSt (brutto)
 *  - EU B2B reverse charge → 0% (netto, §13b UStG)
 *  - Drittland → 0% (netto, §3a UStG)
 */
export function buildMonthlyInvoicePayload(params: {
    businessName: string;
    businessAddress: {
        street: string;
        zip: string;
        city: string;
        countryCode?: string;
    };
    vatId?: string;
    periodStart: Date;
    periodEnd: Date;
    subscriptionPlanName?: string;
    subscriptionFee?: number;
    commissionAmount?: number;
    commissionDetails?: {
        orderCount: number;
        totalSales: number;
        ratePercent: number;
    };
    activeModules?: { name: string; fee: number }[];
    sponsoredFee?: number;
    sponsoredConversions?: number;
    vatClassification: VatClassification;
}): LexwareInvoicePayload {
    const {
        businessName,
        businessAddress,
        vatId,
        periodStart,
        periodEnd,
        subscriptionPlanName,
        subscriptionFee,
        commissionAmount,
        commissionDetails,
        activeModules,
        sponsoredFee,
        sponsoredConversions,
        vatClassification,
    } = params;

    // Format period for display
    const periodLabel = periodStart.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const voucherDate = new Date().toISOString();

    // Tax-aware pricing: For 0% (reverse charge / Drittland), always use netAmount
    const taxRate = vatClassification.taxRatePercentage;
    const isVatFree = taxRate === 0;

    /**
     * Helper: create a unitPrice object with correct net/gross based on tax classification
     */
    const makeUnitPrice = (amount: number) => {
        const base: { currency: string; taxRatePercentage: number; netAmount?: number; grossAmount?: number } = {
            currency: "EUR",
            taxRatePercentage: taxRate,
        };
        if (isVatFree) {
            base.netAmount = amount;
        } else {
            base.grossAmount = amount;
        }
        return base;
    };

    const lineItems: LexwareLineItem[] = [];

    // 1. Subscription fee
    if (subscriptionFee && subscriptionFee > 0) {
        lineItems.push({
            type: "custom",
            name: `LOKMA Plattform-Abonnement – ${subscriptionPlanName || "Standard"}`,
            description: `Monatliche Nutzungsgebühr für ${periodLabel}`,
            quantity: 1,
            unitName: "Monat",
            unitPrice: makeUnitPrice(subscriptionFee),
        });
    }

    // 2. Commission
    if (commissionAmount && commissionAmount > 0 && commissionDetails) {
        lineItems.push({
            type: "custom",
            name: `LOKMA Provision – ${commissionDetails.orderCount} Bestellungen`,
            description: `Gesamtumsatz: €${commissionDetails.totalSales.toFixed(2)} × ${commissionDetails.ratePercent}% Provision (${periodLabel})`,
            quantity: 1,
            unitName: "Pauschale",
            unitPrice: makeUnitPrice(commissionAmount),
        });
    }

    // 3. Active modules
    if (activeModules && activeModules.length > 0) {
        for (const mod of activeModules) {
            if (mod.fee > 0) {
                lineItems.push({
                    type: "custom",
                    name: `Modul: ${mod.name}`,
                    description: `Aktiviert für ${periodLabel}`,
                    quantity: 1,
                    unitName: "Monat",
                    unitPrice: makeUnitPrice(mod.fee),
                });
            }
        }
    }

    // 4. Sponsored product fees
    if (sponsoredFee && sponsoredFee > 0) {
        lineItems.push({
            type: "custom",
            name: `Öne Çıkan Ürünler – ${sponsoredConversions || 0} Konversionen`,
            description: `Werbegebühren für gesponserte Produktplatzierung (${periodLabel})`,
            quantity: 1,
            unitName: "Pauschale",
            unitPrice: makeUnitPrice(sponsoredFee),
        });
    }

    // Build the remark — include legal notice for reverse charge / Drittland
    let remark = "Die Zahlung erfolgt per SEPA-Lastschrift. Vielen Dank für Ihre Partnerschaft mit LOKMA!";
    if (vatClassification.legalNote) {
        remark = `${vatClassification.legalNote}\n\n${remark}`;
    }
    if (vatId) {
        remark = `USt-IdNr. Kunde: ${vatId}\n${remark}`;
    }

    return {
        archived: false,
        voucherDate,
        address: {
            name: businessName,
            street: businessAddress.street,
            zip: businessAddress.zip,
            city: businessAddress.city,
            countryCode: businessAddress.countryCode || "DE",
        },
        lineItems,
        totalPrice: { currency: "EUR" },
        taxConditions: { taxType: vatClassification.taxType },
        paymentConditions: {
            paymentTermLabel: "Zahlung per SEPA-Lastschrift innerhalb von 14 Tagen",
            paymentTermDuration: 14,
        },
        shippingConditions: {
            shippingDate: periodEnd.toISOString(),
            shippingType: "serviceperiod",
        },
        title: "Rechnung",
        introduction: `Ihre monatliche LOKMA Plattform-Abrechnung für ${periodLabel}.`,
        remark,
    };
}
