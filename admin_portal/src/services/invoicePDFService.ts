import { jsPDF } from 'jspdf';
import { MerchantInvoice, LOKMA_COMPANY_INFO } from '@/types';

// LOKMA Logo (Base64 encoded - loaded at runtime)
let logoBase64: string | null = null;

async function loadLogo(): Promise<string | null> {
    if (logoBase64) return logoBase64;

    try {
        // Browser ortamında logo'yu fetch et
        if (typeof window !== 'undefined') {
            const response = await fetch('/logo_website_lokma_red.png');
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    logoBase64 = reader.result as string;
                    resolve(logoBase64);
                };
                reader.readAsDataURL(blob);
            });
        }
        return null;
    } catch (e) {
        console.warn('Logo yüklenemedi:', e);
        return null;
    }
}

// =============================================================================
// ALMAN FATURA PDF ÜRETECİ (GoBD Uyumlu)
// =============================================================================

/**
 * Almanya standartlarına uygun fatura PDF'i oluşturur
 */
export async function generateInvoicePDF(invoice: MerchantInvoice): Promise<Blob> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Logo yükle
    const logo = await loadLogo();

    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // ─────────────────────────────────────────────────────────────────────────
    // HEADER - Logo ve Satıcı Bilgileri
    // ─────────────────────────────────────────────────────────────────────────

    // Logo (sağ üst köşe)
    if (logo) {
        try {
            // Wide format LOKMA text logo (aspect ratio ~4:1)
            doc.addImage(logo, 'PNG', pageWidth - margin - 50, margin - 3, 50, 14);
        } catch (e) {
            console.warn('Logo eklenemedi:', e);
        }
    }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.seller.name, margin, y);

    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.seller.address, margin, y);
    y += 4;
    doc.text(`${invoice.seller.postalCode} ${invoice.seller.city}`, margin, y);
    y += 4;
    if (invoice.seller.phone) {
        doc.text(`Tel: ${invoice.seller.phone}`, margin, y);
        y += 4;
    }
    if (invoice.seller.email) {
        doc.text(`E-Mail: ${invoice.seller.email}`, margin, y);
        y += 4;
    }

    // Vergi numaraları (sağ taraf)
    const rightX = pageWidth - margin;
    doc.setFontSize(8);
    let taxY = margin + 14;
    if (invoice.seller.taxId) {
        doc.text(`Steuernr.: ${invoice.seller.taxId}`, rightX, taxY, { align: 'right' });
        taxY += 4;
    }
    if (invoice.seller.vatId) {
        doc.text(`USt-IdNr.: ${invoice.seller.vatId}`, rightX, taxY, { align: 'right' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ALICI BİLGİLERİ
    // ─────────────────────────────────────────────────────────────────────────

    y += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.buyer.name, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.buyer.address, margin, y);
    y += 4;
    doc.text(`${invoice.buyer.postalCode} ${invoice.buyer.city}`, margin, y);
    if (invoice.buyer.country && invoice.buyer.country !== 'Deutschland') {
        y += 4;
        doc.text(invoice.buyer.country, margin, y);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FATURA BAŞLIĞI
    // ─────────────────────────────────────────────────────────────────────────

    y += 20;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');

    const titleMap = {
        customer: 'RECHNUNG',
        commission: 'PROVISIONSRECHNUNG',
        subscription: 'ABONNEMENT-RECHNUNG'
    };
    doc.text(titleMap[invoice.type] || 'RECHNUNG', margin, y);

    // Fatura detayları (sağ taraf)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const detailsX = rightX;
    let detailY = y - 10;

    doc.text(`Rechnungsnummer: ${invoice.invoiceNumber}`, detailsX, detailY, { align: 'right' });
    detailY += 5;
    doc.text(`Rechnungsdatum: ${formatDate(invoice.issuedAt || invoice.createdAt)}`, detailsX, detailY, { align: 'right' });
    detailY += 5;
    doc.text(`Fällig am: ${formatDate(invoice.paymentDueDate)}`, detailsX, detailY, { align: 'right' });

    if (invoice.periodStart && invoice.periodEnd) {
        detailY += 5;
        doc.text(`Zeitraum: ${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`, detailsX, detailY, { align: 'right' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FATURA KALEMLERİ TABLOSU
    // ─────────────────────────────────────────────────────────────────────────

    y += 15;

    // Tablo basI (header)
    doc.setFillColor(50, 50, 50);
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    // Column positions (left-edge for text, right-edge for numbers)
    const colPos = margin + 2;        // Beschreibung (left-aligned)
    const colQty = margin + 95;       // Menge
    const colUnit = margin + 112;     // Einheit
    const colPrice = margin + 135;    // Einzelpreis (right-align)
    const colTax = margin + 150;      // MwSt
    const colTotal = margin + contentWidth - 2; // Gesamt (right-align)

    doc.text('Beschreibung', colPos, y + 5.5);
    doc.text('Menge', colQty, y + 5.5);
    doc.text('Einheit', colUnit, y + 5.5);
    doc.text('Einzelpreis', colPrice, y + 5.5, { align: 'right' });
    doc.text('MwSt', colTax, y + 5.5);
    doc.text('Gesamt', colTotal, y + 5.5, { align: 'right' });

    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Tablo icerigi
    invoice.lineItems.forEach((item, index) => {
        const rowY = y + (index * 7) + 5;

        // Alternatif satir rengi
        if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(margin, y + (index * 7), contentWidth, 7, 'F');
        }

        doc.setFontSize(9);
        doc.text(truncateText(item.description, 55), colPos, rowY);
        doc.text(item.quantity.toString(), colQty, rowY);
        doc.text(item.unit, colUnit, rowY);
        doc.text(formatCurrency(item.unitPrice), colPrice, rowY, { align: 'right' });
        doc.text(`${item.taxRate}%`, colTax, rowY);
        doc.text(formatCurrency(item.grossAmount), colTotal, rowY, { align: 'right' });
    });

    y += (invoice.lineItems.length * 7) + 10;

    // ─────────────────────────────────────────────────────────────────────────
    // TOPLAMLAR
    // ─────────────────────────────────────────────────────────────────────────

    const summaryX = margin + 120;
    const summaryValueX = rightX;

    // Ara çizgi
    doc.setDrawColor(200, 200, 200);
    doc.line(summaryX, y, rightX, y);
    y += 7;

    doc.setFontSize(10);
    doc.text('Zwischensumme (netto):', summaryX, y);
    doc.text(formatCurrency(invoice.netTotal), summaryValueX, y, { align: 'right' });

    // KDV dağılımı
    invoice.vatBreakdown.forEach(vat => {
        y += 5;
        doc.text(`MwSt ${vat.rate}%:`, summaryX, y);
        doc.text(formatCurrency(vat.vatAmount), summaryValueX, y, { align: 'right' });
    });

    y += 8;
    doc.setDrawColor(50, 50, 50);
    doc.line(summaryX, y, rightX, y);
    y += 7;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Gesamtbetrag:', summaryX, y);
    doc.text(formatCurrency(invoice.grossTotal) + ' €', summaryValueX, y, { align: 'right' });

    // ─────────────────────────────────────────────────────────────────────────
    // ÖDEME BİLGİLERİ
    // ─────────────────────────────────────────────────────────────────────────

    y += 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (invoice.paymentStatus === 'paid') {
        doc.setTextColor(0, 128, 0);
        doc.text('✓ BEZAHLT', margin, y);
        if (invoice.paidAt) {
            y += 5;
            doc.text(`Bezahlt am: ${formatDate(invoice.paidAt)}`, margin, y);
        }
        doc.setTextColor(0, 0, 0);
    } else {
        doc.text('Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:', margin, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`IBAN: ${LOKMA_COMPANY_INFO.iban || 'DE89 3704 0044 0532 0130 00'}`, margin, y);
        y += 4;
        doc.text(`BIC: ${LOKMA_COMPANY_INFO.bic || 'COBADEFFXXX'}`, margin, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        doc.text(`Kontoinhaber: ${LOKMA_COMPANY_INFO.name}`, margin, y);
        y += 4;
        doc.text(`Verwendungszweck: ${invoice.invoiceNumber}`, margin, y);

        // Stripe SEPA info
        if (invoice.paymentMethod === 'sepa' || invoice.paymentMethod === 'stripe') {
            y += 8;
            doc.setFontSize(8);
            doc.text('Der Betrag wird automatisch per SEPA-Lastschrift eingezogen.', margin, y);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────────────────────────────────────

    const footerY = 280;
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(`${invoice.seller.name} | ${invoice.seller.address}, ${invoice.seller.postalCode} ${invoice.seller.city}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Steuernr.: ${invoice.seller.taxId || '-'} | USt-IdNr.: ${invoice.seller.vatId || '-'}`, pageWidth / 2, footerY + 4, { align: 'center' });

    // Sayfa numarası
    doc.text(`Seite 1 von 1`, rightX, footerY + 4, { align: 'right' });

    // PDF blob olarak döndür
    return doc.output('blob');
}

// =============================================================================
// YARDIMCI FONKSİYONLAR
// =============================================================================

function formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatCurrency(amount: number): string {
    return amount.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * PDF'i Firebase Storage'a yükler ve URL döner
 */
export async function uploadInvoicePDF(
    invoiceId: string,
    pdfBlob: Blob
): Promise<string> {
    // TODO: Firebase Storage'a yükle
    // const storageRef = ref(storage, `invoices/${invoiceId}.pdf`);
    // await uploadBytes(storageRef, pdfBlob);
    // return getDownloadURL(storageRef);

    // Şimdilik placeholder
    return `https://storage.googleapis.com/lokma-invoices/${invoiceId}.pdf`;
}

/**
 * Fatura oluştur ve PDF üret
 */
export async function generateAndUploadInvoicePDF(invoice: MerchantInvoice): Promise<string> {
    const pdfBlob = await generateInvoicePDF(invoice);
    const pdfUrl = await uploadInvoicePDF(invoice.id, pdfBlob);
    return pdfUrl;
}
