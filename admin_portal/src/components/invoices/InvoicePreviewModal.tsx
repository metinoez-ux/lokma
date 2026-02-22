'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

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
}

interface InvoicePreviewModalProps {
    invoice: Invoice;
    onClose: () => void;
}

export default function InvoicePreviewModal({ invoice, onClose }: InvoicePreviewModalProps) {

    const t = useTranslations('AdminComponentInvoicepreviewmodal');
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

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-3xl mx-auto my-8 shadow-2xl print:shadow-none print:rounded-none">
                {/* Header with close button (hidden in print) */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 print:hidden">
                    <h2 className="text-xl font-bold text-gray-800">{t('fatura_onizleme')}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Invoice Content (PDF-like) */}
                <div className="p-8 bg-white text-gray-800" id="invoice-preview">
                    {/* LOKMA Header */}
                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-red-600">
                        <div>
                            <h1 className="text-3xl font-bold text-red-600 mb-1">LOKMA</h1>
                            <p className="text-sm text-gray-600">GmbH</p>
                            <p className="text-xs text-gray-500 mt-2">
                                Schulte-Braucks-Str. 1<br />
                                {t('41836_huckelhoven')}<br />
                                Deutschland
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                info@lokma.shop<br />
                                +49 2433 123456
                            </p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">RECHNUNG</h2>
                            <p className="text-lg font-mono text-red-600">{invoice.invoiceNumber}</p>
                            <div className="mt-4 text-sm text-gray-600">
                                <p><strong>Rechnungsdatum:</strong> {formatDate(invoice.issueDate)}</p>
                                <p><strong>Fälligkeitsdatum:</strong> {formatDate(invoice.dueDate)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Buyer Info */}
                    <div className="mb-8">
                        <p className="text-xs text-gray-500 mb-1">RECHNUNGSEMPFÄNGER</p>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="font-bold text-lg">{invoice.butcherName}</p>
                            {invoice.butcherAddress && (
                                <p className="text-gray-600">{invoice.butcherAddress}</p>
                            )}
                        </div>
                    </div>

                    {/* Period */}
                    {invoice.period && (
                        <div className="mb-6 text-sm text-gray-600">
                            <strong>Abrechnungszeitraum:</strong> {invoice.period}
                        </div>
                    )}

                    {/* Line Items Table */}
                    <table className="w-full mb-8">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Beschreibung</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Menge</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Einzelpreis</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Netto</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="px-4 py-4">
                                    <p className="font-medium">{invoice.description || 'LOKMA Abonnement'}</p>
                                    <p className="text-sm text-gray-500">{t('monatliche_nutzungsgebuhr')}</p>
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
                            <div className="flex justify-between py-2 text-gray-600">
                                <span>Zwischensumme (Netto):</span>
                                <span>{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between py-2 text-gray-600">
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
                    <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-600">
                        <p className="font-semibold mb-2">Zahlungsinformationen:</p>
                        <p>{t('bitte_uberweisen_sie_den_betrag_bis_zum')} {formatDate(invoice.dueDate)} auf folgendes Konto:</p>
                        <div className="mt-2 bg-gray-50 rounded-lg p-4 font-mono text-xs">
                            <p>{t('iban_de89_3704_0044_0532_0130_00_demo')}</p>
                            <p>{t('bic_cobadeffxxx')}</p>
                            <p>Verwendungszweck: {invoice.invoiceNumber}</p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-6 flex justify-center">
                        <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                            invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                            }`}>
                            {invoice.status === 'paid' ? '✅ BEZAHLT' :
                                invoice.status === 'pending' ? '⏳ OFFEN' :
                                    invoice.status === 'overdue' ? t('uberf_llig') :
                                        invoice.status.toUpperCase()}
                        </span>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
                        <p>{t('lokma_gmbh_schulte_braucks_str_1_41836_h')}</p>
                        <p className="mt-1">{t('steuernummer_demo_st_123456_ust_idnr_dem')}</p>
                    </div>
                </div>

                {/* Action Buttons (hidden in print) */}
                <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50 print:hidden">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                    >
                        {t('kapat')}
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={printing}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                        {printing ? t('hazirlaniyor') : t('yazdir')}
                    </button>
                    {invoice.pdfUrl && (
                        <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-center"
                        >
                            📄 PDF İndir
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
