import { MerchantInvoice, LOKMA_COMPANY_INFO } from '@/types';

// =============================================================================
// XRECHNUNG (E-Rechnung) XML ÜRETECİ
// Almanya B2B zorunlu e-fatura standardı (2025+)
// =============================================================================

/**
 * XRechnung (UBL 2.1) formatında XML fatura oluşturur
 * Almanya B2B e-fatura zorunluluğuna uygun
 */
export function generateXRechnungXML(invoice: MerchantInvoice): string {
    const issueDate = invoice.issuedAt || invoice.createdAt;
    const dueDate = invoice.paymentDueDate;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    
    <!-- XRechnung Profil -->
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    
    <!-- Fatura Temel Bilgileri -->
    <cbc:ID>${escapeXml(invoice.invoiceNumber)}</cbc:ID>
    <cbc:IssueDate>${formatDateISO(issueDate)}</cbc:IssueDate>
    <cbc:DueDate>${formatDateISO(dueDate)}</cbc:DueDate>
    <cbc:InvoiceTypeCode>${getInvoiceTypeCode(invoice.type)}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    
    <!-- Satıcı (AccountingSupplierParty) -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(invoice.seller.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(invoice.seller.address)}</cbc:StreetName>
                <cbc:CityName>${escapeXml(invoice.seller.city)}</cbc:CityName>
                <cbc:PostalZone>${escapeXml(invoice.seller.postalCode)}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>DE</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            ${invoice.seller.vatId ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${escapeXml(invoice.seller.vatId)}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : ''}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(invoice.seller.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
            ${invoice.seller.email ? `
            <cac:Contact>
                <cbc:ElectronicMail>${escapeXml(invoice.seller.email)}</cbc:ElectronicMail>
            </cac:Contact>` : ''}
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <!-- Alıcı (AccountingCustomerParty) -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(invoice.buyer.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(invoice.buyer.address)}</cbc:StreetName>
                <cbc:CityName>${escapeXml(invoice.buyer.city)}</cbc:CityName>
                <cbc:PostalZone>${escapeXml(invoice.buyer.postalCode)}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>DE</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            ${invoice.buyer.vatId ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${escapeXml(invoice.buyer.vatId)}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : ''}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(invoice.buyer.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <!-- Ödeme Koşulları -->
    <cac:PaymentTerms>
        <cbc:Note>Zahlbar innerhalb von 14 Tagen</cbc:Note>
    </cac:PaymentTerms>
    
    <!-- KDV Toplamı -->
    ${invoice.vatBreakdown.map(vat => `
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="EUR">${vat.vatAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${vat.netAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${vat.vatAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>${vat.rate}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>`).join('')}
    
    <!-- Fatura Toplamı -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="EUR">${invoice.netTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="EUR">${invoice.netTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="EUR">${invoice.grossTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="EUR">${invoice.grossTotal.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    
    <!-- Fatura Kalemleri -->
    ${invoice.lineItems.map((item, index) => `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${getUnitCode(item.unit)}">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="EUR">${item.netAmount.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Description>${escapeXml(item.description)}</cbc:Description>
            <cbc:Name>${escapeXml(item.description)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>${item.taxRate}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="EUR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`).join('')}
    
</Invoice>`;

    return xml;
}

// =============================================================================
// DATEV EXPORT (Muhasebeci için)
// =============================================================================

interface DATEVRecord {
    Umsatz: string;              // Tutar (brüt)
    'Soll/Haben': 'S' | 'H';     // Soll=Borç, Haben=Alacak
    'WKZ Umsatz': string;        // Para birimi
    Kurs: string;                // Döviz kuru
    'Basis-Umsatz': string;      // Temel tutar
    'WKZ Basis-Umsatz': string;
    Konto: string;               // Hesap kodu
    Gegenkonto: string;          // Karşı hesap
    'BU-Schlüssel': string;      // KDV kodu
    Belegdatum: string;          // Belge tarihi (TTMM)
    Belegfeld1: string;          // Fatura numarası
    Belegfeld2: string;          // Ek bilgi
    Buchungstext: string;        // Açıklama
}

/**
 * DATEV CSV formatında fatura export oluşturur
 */
export function generateDATEVExport(invoices: MerchantInvoice[]): string {
    // DATEV Header
    const header = [
        'Umsatz',
        'Soll/Haben',
        'WKZ Umsatz',
        'Kurs',
        'Basis-Umsatz',
        'WKZ Basis-Umsatz',
        'Konto',
        'Gegenkonto',
        'BU-Schlüssel',
        'Belegdatum',
        'Belegfeld1',
        'Belegfeld2',
        'Buchungstext'
    ].join(';');

    const rows: string[] = [header];

    for (const invoice of invoices) {
        const date = invoice.issuedAt || invoice.createdAt;
        const belegdatum = formatDATEVDate(date);

        // Her fatura kalemi için bir satır
        for (const item of invoice.lineItems) {
            const record: DATEVRecord = {
                Umsatz: item.grossAmount.toFixed(2).replace('.', ','),
                'Soll/Haben': 'S',
                'WKZ Umsatz': 'EUR',
                Kurs: '',
                'Basis-Umsatz': '',
                'WKZ Basis-Umsatz': '',
                Konto: getAccountCode(invoice.type, 'customer'), // Debitor hesabı
                Gegenkonto: getRevenueAccount(invoice.type),      // Gelir hesabı
                'BU-Schlüssel': getDATEVTaxCode(item.taxRate),
                Belegdatum: belegdatum,
                Belegfeld1: invoice.invoiceNumber,
                Belegfeld2: invoice.buyer.name.substring(0, 20),
                Buchungstext: item.description.substring(0, 60)
            };

            rows.push(Object.values(record).join(';'));
        }
    }

    return rows.join('\n');
}

// =============================================================================
// ZUGFeRD (PDF + XML) - Hibrit Format
// =============================================================================

/**
 * ZUGFeRD uyumlu PDF metadata oluşturur
 * PDF'e gömülecek XML datası
 */
export function generateZUGFeRDMetadata(invoice: MerchantInvoice): object {
    return {
        'zugferd:CrossIndustryInvoice': {
            '@xmlns:zugferd': 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
            'zugferd:ExchangedDocument': {
                ID: invoice.invoiceNumber,
                TypeCode: getInvoiceTypeCode(invoice.type),
                IssueDateTime: formatDateISO(invoice.issuedAt || invoice.createdAt)
            }
        }
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function escapeXml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatDateISO(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
}

function formatDATEVDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + month; // TTMM format
}

function getInvoiceTypeCode(type: string): string {
    switch (type) {
        case 'customer': return '380';      // Standard invoice
        case 'commission': return '380';     // Standard invoice
        case 'subscription': return '380';   // Standard invoice
        default: return '380';
    }
}

function getUnitCode(unit: string): string {
    const unitMap: Record<string, string> = {
        'Stück': 'C62',
        'kg': 'KGM',
        'g': 'GRM',
        'l': 'LTR',
        'ml': 'MLT',
        'Monat': 'MON',
        'pauschal': 'C62'
    };
    return unitMap[unit] || 'C62'; // C62 = Adet
}

function getDATEVTaxCode(taxRate: number): string {
    switch (taxRate) {
        case 19: return '3';   // 19% MwSt
        case 7: return '2';    // 7% ermäßigt
        case 0: return '0';    // Steuerfrei
        default: return '3';
    }
}

function getAccountCode(invoiceType: string, partyType: string): string {
    // Standart SKR03 Kontenrahmen
    if (partyType === 'customer') {
        return '10000'; // Debitoren Sammelkonto
    }
    return '10000';
}

function getRevenueAccount(invoiceType: string): string {
    // SKR03 Erlöskonten
    switch (invoiceType) {
        case 'customer': return '8400';      // Erlöse 19% USt
        case 'commission': return '8400';     // Provisionserlöse
        case 'subscription': return '8400';   // Abonnement-Erlöse
        default: return '8400';
    }
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * XRechnung XML dosyası olarak indir
 */
export function downloadXRechnungXML(invoice: MerchantInvoice): void {
    const xml = generateXRechnungXML(invoice);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `XRechnung_${invoice.invoiceNumber}.xml`;
    a.click();

    URL.revokeObjectURL(url);
}

/**
 * DATEV CSV dosyası olarak indir
 */
export function downloadDATEVExport(invoices: MerchantInvoice[], filename?: string): void {
    const csv = generateDATEVExport(invoices);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `DATEV_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
}
