"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePDF = generateInvoicePDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
// LOKMA Company Info
const COMPANY = {
    name: "LOKMA Marketplace GmbH",
    street: "Musterstraße 1",
    city: "70173 Stuttgart",
    country: "Deutschland",
    taxId: "DE123456789",
    email: "info@lokma.shop",
    phone: "+49 711 1234567",
    iban: "DE89 3704 0044 0532 0130 00",
    bic: "COBADEFFXXX",
    bank: "Commerzbank Stuttgart",
};
function formatDate(ts) {
    const d = ts instanceof Date ? ts : ts.toDate();
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function formatCurrency(amount) {
    return `€${amount.toFixed(2).replace(".", ",")}`;
}
/**
 * Generate a PDF invoice and return as a Buffer
 */
async function generateInvoicePDF(invoice) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({
                size: "A4",
                margin: 50,
                info: {
                    Title: `Rechnung ${invoice.invoiceNumber}`,
                    Author: COMPANY.name,
                    Subject: `Rechnung für ${invoice.butcherName}`,
                },
            });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            // ═══════════════════════════════════════════
            // HEADER — Company Info
            // ═══════════════════════════════════════════
            doc.fontSize(20)
                .font("Helvetica-Bold")
                .fillColor("#E65100")
                .text("LOKMA", 50, 50);
            doc.fontSize(8)
                .font("Helvetica")
                .fillColor("#666666")
                .text(`${COMPANY.name} · ${COMPANY.street} · ${COMPANY.city}`, 50, 75);
            // ═══════════════════════════════════════════
            // RECIPIENT — Business Address
            // ═══════════════════════════════════════════
            doc.fontSize(11)
                .font("Helvetica")
                .fillColor("#000000")
                .text(invoice.butcherName, 50, 120)
                .text(invoice.butcherAddress || "", 50, 135);
            // ═══════════════════════════════════════════
            // INVOICE META — Right Side
            // ═══════════════════════════════════════════
            const metaX = 380;
            doc.fontSize(9)
                .font("Helvetica")
                .fillColor("#333333")
                .text("Rechnungsnummer:", metaX, 120)
                .font("Helvetica-Bold")
                .text(invoice.invoiceNumber, metaX + 110, 120)
                .font("Helvetica")
                .text("Rechnungsdatum:", metaX, 138)
                .font("Helvetica-Bold")
                .text(formatDate(invoice.issueDate || new Date()), metaX + 110, 138)
                .font("Helvetica")
                .text("Fälligkeitsdatum:", metaX, 156)
                .font("Helvetica-Bold")
                .text(formatDate(invoice.dueDate), metaX + 110, 156)
                .font("Helvetica")
                .text("Leistungszeitraum:", metaX, 174)
                .font("Helvetica-Bold")
                .text(invoice.period, metaX + 110, 174);
            // ═══════════════════════════════════════════
            // TITLE
            // ═══════════════════════════════════════════
            doc.moveDown(2);
            const titleY = 220;
            doc.fontSize(16)
                .font("Helvetica-Bold")
                .fillColor("#1a1a1a")
                .text("RECHNUNG", 50, titleY);
            const typeLabel = invoice.type === "commission" ? "Provisionsabrechnung" : "Abonnementrechnung";
            doc.fontSize(10)
                .font("Helvetica")
                .fillColor("#666666")
                .text(typeLabel, 50, titleY + 22);
            // ═══════════════════════════════════════════
            // LINE ITEMS TABLE
            // ═══════════════════════════════════════════
            const tableTop = titleY + 55;
            const col1 = 50; // Pos.
            const col2 = 80; // Beschreibung
            const col3 = 370; // Menge
            const col4 = 420; // Einzelpreis
            const col5 = 490; // Betrag
            // Table Header
            doc.fontSize(8)
                .font("Helvetica-Bold")
                .fillColor("#ffffff");
            doc.rect(col1, tableTop, 500, 20).fill("#333333");
            doc.fillColor("#ffffff")
                .text("Pos.", col1 + 5, tableTop + 5, { width: 25 })
                .text("Beschreibung", col2 + 5, tableTop + 5, { width: 280 })
                .text("Menge", col3, tableTop + 5, { width: 45, align: "right" })
                .text("Einzelpreis", col4, tableTop + 5, { width: 65, align: "right" })
                .text("Betrag", col5, tableTop + 5, { width: 55, align: "right" });
            // Table Rows
            let rowY = tableTop + 25;
            let pos = 1;
            doc.fontSize(9)
                .font("Helvetica")
                .fillColor("#1a1a1a");
            if (invoice.type === "commission") {
                // Commission invoice line items
                if (invoice.cardCommission && invoice.cardCommission > 0) {
                    const bgColor = pos % 2 === 0 ? "#f5f5f5" : "#ffffff";
                    doc.rect(col1, rowY - 3, 500, 18).fill(bgColor);
                    doc.fillColor("#1a1a1a")
                        .text(String(pos), col1 + 5, rowY, { width: 25 })
                        .text("Provision – Kartenzahlung", col2 + 5, rowY, { width: 280 })
                        .text("1", col3, rowY, { width: 45, align: "right" })
                        .text(formatCurrency(invoice.cardCommission), col4, rowY, { width: 65, align: "right" })
                        .text(formatCurrency(invoice.cardCommission), col5, rowY, { width: 55, align: "right" });
                    rowY += 20;
                    pos++;
                }
                if (invoice.cashCommission && invoice.cashCommission > 0) {
                    const bgColor = pos % 2 === 0 ? "#f5f5f5" : "#ffffff";
                    doc.rect(col1, rowY - 3, 500, 18).fill(bgColor);
                    doc.fillColor("#1a1a1a")
                        .text(String(pos), col1 + 5, rowY, { width: 25 })
                        .text("Provision – Barzahlung", col2 + 5, rowY, { width: 280 })
                        .text("1", col3, rowY, { width: 45, align: "right" })
                        .text(formatCurrency(invoice.cashCommission), col4, rowY, { width: 65, align: "right" })
                        .text(formatCurrency(invoice.cashCommission), col5, rowY, { width: 55, align: "right" });
                    rowY += 20;
                    pos++;
                }
            }
            else {
                // Subscription invoice — single line
                doc.rect(col1, rowY - 3, 500, 18).fill("#ffffff");
                doc.fillColor("#1a1a1a")
                    .text(String(pos), col1 + 5, rowY, { width: 25 })
                    .text(invoice.description, col2 + 5, rowY, { width: 280 })
                    .text("1", col3, rowY, { width: 45, align: "right" })
                    .text(formatCurrency(invoice.subtotal), col4, rowY, { width: 65, align: "right" })
                    .text(formatCurrency(invoice.subtotal), col5, rowY, { width: 55, align: "right" });
                rowY += 20;
            }
            // ═══════════════════════════════════════════
            // TOTALS
            // ═══════════════════════════════════════════
            rowY += 10;
            doc.moveTo(col3, rowY).lineTo(col5 + 55, rowY).stroke("#cccccc");
            rowY += 10;
            doc.fontSize(9).font("Helvetica");
            doc.text("Nettobetrag:", col3, rowY, { width: 120, align: "right" });
            doc.text(formatCurrency(invoice.subtotal), col5, rowY, { width: 55, align: "right" });
            rowY += 16;
            doc.text(`USt. ${invoice.taxRate}%:`, col3, rowY, { width: 120, align: "right" });
            doc.text(formatCurrency(invoice.taxAmount), col5, rowY, { width: 55, align: "right" });
            rowY += 16;
            doc.moveTo(col3, rowY).lineTo(col5 + 55, rowY).stroke("#333333");
            rowY += 8;
            doc.fontSize(12).font("Helvetica-Bold");
            doc.text("Gesamtbetrag:", col3, rowY, { width: 120, align: "right" });
            doc.fillColor("#E65100").text(formatCurrency(invoice.grandTotal), col5, rowY, { width: 55, align: "right" });
            // ═══════════════════════════════════════════
            // ORDER SUMMARY (Commission only)
            // ═══════════════════════════════════════════
            if (invoice.type === "commission" && invoice.orderCount) {
                rowY += 35;
                doc.fontSize(9)
                    .font("Helvetica")
                    .fillColor("#666666")
                    .text(`Anzahl Bestellungen im Zeitraum: ${invoice.orderCount}`, col1, rowY);
            }
            // ═══════════════════════════════════════════
            // PAYMENT INFO
            // ═══════════════════════════════════════════
            const paymentY = 620;
            doc.rect(col1, paymentY, 500, 70).fill("#f8f8f8");
            doc.fontSize(9)
                .font("Helvetica-Bold")
                .fillColor("#333333")
                .text("Zahlungsinformationen", col1 + 10, paymentY + 8);
            doc.fontSize(8)
                .font("Helvetica")
                .fillColor("#555555")
                .text(`Empfänger: ${COMPANY.name}`, col1 + 10, paymentY + 25)
                .text(`IBAN: ${COMPANY.iban}`, col1 + 10, paymentY + 38)
                .text(`BIC: ${COMPANY.bic}`, col1 + 10, paymentY + 51)
                .text(`Bank: ${COMPANY.bank}`, col1 + 250, paymentY + 38)
                .text(`Verwendungszweck: ${invoice.invoiceNumber}`, col1 + 250, paymentY + 51);
            // ═══════════════════════════════════════════
            // FOOTER
            // ═══════════════════════════════════════════
            const footerY = 750;
            doc.fontSize(7)
                .font("Helvetica")
                .fillColor("#999999")
                .text(`${COMPANY.name} · ${COMPANY.street} · ${COMPANY.city} · USt-IdNr.: ${COMPANY.taxId} · ${COMPANY.email}`, col1, footerY, { align: "center", width: 500 });
            doc.fontSize(7).text("Diese Rechnung wurde maschinell erstellt und ist ohne Unterschrift gültig.", col1, footerY + 12, { align: "center", width: 500 });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
//# sourceMappingURL=invoicePdf.js.map