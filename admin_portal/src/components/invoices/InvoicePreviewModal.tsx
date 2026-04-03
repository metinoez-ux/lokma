'use client';

import { useState } from 'react';
import { LOKMA_COMPANY_INFO } from '@/types';

interface Invoice {
 id: string;
 invoiceNumber: string;
 butcherName: string;
 butcherAddress?: string;
 description?: string;
 period?: string;
 subtotal: number;
 taxRate: number;
 taxAmount: number;
 grandTotal: number;
 status: string;
 issueDate: Date;
 dueDate: Date;
 pdfUrl?: string;
 // Lexware/Stripe fields
 stripePaymentIntentId?: string;
 stripeInvoiceId?: string;
 lexwareInvoiceId?: string;
 paymentMethod?: string;
}

interface InvoicePreviewModalProps {
 invoice: Invoice;
 onClose: () => void;
}

export default function InvoicePreviewModal({ invoice, onClose }: InvoicePreviewModalProps) {
 const [printing, setPrinting] = useState(false);

 const handlePrint = () => {
 setPrinting(true);
 setTimeout(() => {
 window.print();
 setPrinting(false);
 }, 100);
 };

 const formatDate = (date: Date) => {
 return new Date(date).toLocaleDateString('de-DE', {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric'
 });
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('de-DE', {
 style: 'currency',
 currency: 'EUR'
 }).format(amount);
 };

 // GoBD: German invoices are ALWAYS in German — no translation needed
 return (
 <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
 <div className="bg-background rounded-xl w-full max-w-3xl mx-auto my-8 shadow-2xl print:shadow-none print:rounded-none">
 {/* Header with close button (hidden in print) */}
 <div className="flex justify-between items-center p-4 border-b border-border/50 print:hidden">
 <h2 className="text-xl font-bold text-foreground/90">📄 Rechnungsvorschau</h2>
 <button
 onClick={onClose}
 className="text-muted-foreground/80 hover:text-foreground/80 text-2xl"
 >
 ×
 </button>
 </div>

 {/* Invoice Content (PDF-like) */}
 <div className="p-8 bg-background text-foreground/90" id="invoice-preview">
 {/* LOKMA Header */}
 <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-red-600">
 <div>
 <h1 className="text-3xl font-bold text-red-600 mb-1">{LOKMA_COMPANY_INFO.name.replace(' GmbH', '')}</h1>
 <p className="text-sm text-muted-foreground">GmbH</p>
 <p className="text-xs text-muted-foreground/80 mt-2">
 {LOKMA_COMPANY_INFO.address}<br />
 {LOKMA_COMPANY_INFO.postalCode} {LOKMA_COMPANY_INFO.city}<br />
 {LOKMA_COMPANY_INFO.country}
 </p>
 <p className="text-xs text-muted-foreground/80 mt-1">
 {LOKMA_COMPANY_INFO.email}<br />
 {LOKMA_COMPANY_INFO.phone}
 </p>
 </div>
 <div className="text-right">
 <h2 className="text-2xl font-bold text-foreground/90 mb-2">RECHNUNG</h2>
 <p className="text-lg font-mono text-red-600">{invoice.invoiceNumber}</p>
 <div className="mt-4 text-sm text-muted-foreground">
 <p><strong>Rechnungsdatum:</strong> {formatDate(invoice.issueDate)}</p>
 <p><strong>Fälligkeitsdatum:</strong> {formatDate(invoice.dueDate)}</p>
 </div>
 </div>
 </div>

 {/* Buyer Info */}
 <div className="mb-8">
 <p className="text-xs text-muted-foreground/80 mb-1">RECHNUNGSEMPFÄNGER</p>
 <div className="bg-muted/30 rounded-lg p-4">
 <p className="font-bold text-lg">{invoice.butcherName}</p>
 {invoice.butcherAddress && (
 <p className="text-muted-foreground">{invoice.butcherAddress}</p>
 )}
 </div>
 </div>

 {/* Period */}
 {invoice.period && (
 <div className="mb-6 text-sm text-muted-foreground">
 <strong>Abrechnungszeitraum:</strong> {invoice.period}
 </div>
 )}

 {/* Line Items Table */}
 <table className="w-full mb-8">
 <thead>
 <tr className="bg-muted">
 <th className="px-4 py-3 text-left text-sm font-semibold text-foreground/80">Beschreibung</th>
 <th className="px-4 py-3 text-center text-sm font-semibold text-foreground/80">Menge</th>
 <th className="px-4 py-3 text-right text-sm font-semibold text-foreground/80">Einzelpreis</th>
 <th className="px-4 py-3 text-right text-sm font-semibold text-foreground/80">Netto</th>
 </tr>
 </thead>
 <tbody>
 <tr className="border-b">
 <td className="px-4 py-4">
 <p className="font-medium">{invoice.description || 'LOKMA Abonnement'}</p>
 <p className="text-sm text-muted-foreground/80">Monatliche Nutzungsgebühr</p>
 </td>
 <td className="px-4 py-4 text-center">1</td>
 <td className="px-4 py-4 text-right">{formatCurrency(invoice.subtotal)}</td>
 <td className="px-4 py-4 text-right font-medium">{formatCurrency(invoice.subtotal)}</td>
 </tr>
 </tbody>
 </table>

 {/* Totals */}
 <div className="flex justify-end">
 <div className="w-72">
 <div className="flex justify-between py-2 text-muted-foreground">
 <span>Zwischensumme (Netto):</span>
 <span>{formatCurrency(invoice.subtotal)}</span>
 </div>
 <div className="flex justify-between py-2 text-muted-foreground">
 <span>MwSt. ({invoice.taxRate}%):</span>
 <span>{formatCurrency(invoice.taxAmount)}</span>
 </div>
 <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-gray-800 mt-2">
 <span>Gesamtbetrag:</span>
 <span className="text-red-600">{formatCurrency(invoice.grandTotal)}</span>
 </div>
 </div>
 </div>

 {/* Payment Info */}
 <div className="mt-8 pt-6 border-t border-border/50 text-sm text-muted-foreground">
 <p className="font-semibold mb-2">Zahlungsinformationen:</p>

 {/* Show Stripe/SEPA info if available */}
 {invoice.stripePaymentIntentId || invoice.stripeInvoiceId ? (
 <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
 <p className="text-blue-800 font-medium mb-2">💳 Automatischer Einzug via Stripe</p>
 {invoice.stripeInvoiceId && (
 <p className="text-blue-700 text-xs font-mono">Stripe Invoice: {invoice.stripeInvoiceId}</p>
 )}
 {invoice.stripePaymentIntentId && (
 <p className="text-blue-700 text-xs font-mono">Payment: {invoice.stripePaymentIntentId}</p>
 )}
 <p className="text-blue-600 text-xs mt-2">
 Der Betrag wird automatisch per SEPA-Lastschrift eingezogen.
 </p>
 </div>
 ) : (
 <>
 <p>Bitte überweisen Sie den Betrag bis zum {formatDate(invoice.dueDate)} auf folgendes Konto:</p>
 <div className="mt-2 bg-muted/30 rounded-lg p-4 font-mono text-xs">
 <p>IBAN: DE89 3704 0044 0532 0130 00</p>
 <p>BIC: COBADEFFXXX</p>
 <p>Verwendungszweck: {invoice.invoiceNumber}</p>
 </div>
 </>
 )}

 {/* Lexware Reference */}
 {invoice.lexwareInvoiceId && (
 <div className="mt-3 bg-green-50 rounded-lg p-3 border border-green-200">
 <p className="text-green-700 text-xs">
 📊 Lexware Referenz: <span className="font-mono">{invoice.lexwareInvoiceId}</span>
 </p>
 </div>
 )}
 </div>

 {/* Status Badge */}
 <div className="mt-6 flex justify-center">
 <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
 invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
 invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
 invoice.status === 'storno' ? 'bg-purple-100 text-purple-700' :
 'bg-muted text-foreground/80'
 }`}>
 {invoice.status === 'paid' ? '✅ BEZAHLT' :
 invoice.status === 'pending' ? '⏳ OFFEN' :
 invoice.status === 'overdue' ? '⚠️ ÜBERFÄLLIG' :
 invoice.status === 'storno' ? '🔄 STORNIERT' :
 invoice.status.toUpperCase()}
 </span>
 </div>

 {/* Footer — Company Legal Info */}
 <div className="mt-8 pt-4 border-t border-border/50 text-xs text-gray-400 text-center">
 <p>
 {LOKMA_COMPANY_INFO.name} | {LOKMA_COMPANY_INFO.address}, {LOKMA_COMPANY_INFO.postalCode} {LOKMA_COMPANY_INFO.city} | {LOKMA_COMPANY_INFO.email}
 </p>
 <p className="mt-1">
 Steuernummer: {LOKMA_COMPANY_INFO.taxId} | USt-IdNr: {LOKMA_COMPANY_INFO.vatId}
 </p>
 </div>
 </div>

 {/* Action Buttons (hidden in print) */}
 <div className="flex gap-3 p-4 border-t border-border/50 bg-muted/30 print:hidden">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
 >
 Schließen
 </button>
 <button
 onClick={handlePrint}
 disabled={printing}
 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
 >
 {printing ? 'Wird vorbereitet...' : '🖨️ Drucken'}
 </button>
 {invoice.pdfUrl && (
 <a
 href={invoice.pdfUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-center"
 >
 📄 PDF Herunterladen
 </a>
 )}
 </div>
 </div>
 </div>
 );
}
