'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Invoice, MerchantInvoice, LOKMA_COMPANY_INFO } from '@/types';
import { stornoInvoice, logAuditEntry } from '@/lib/erp-utils';
import InvoicePreviewModal from '@/components/invoices/InvoicePreviewModal';

// Legacy Invoice → MerchantInvoice conversion helper
function toLegacyMerchantInvoice(invoice: Invoice): MerchantInvoice {
    return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: 'subscription' as const,
        status: 'issued' as const,
        seller: {
            name: LOKMA_COMPANY_INFO.name,
            address: LOKMA_COMPANY_INFO.address,
            city: LOKMA_COMPANY_INFO.city,
            postalCode: LOKMA_COMPANY_INFO.postalCode,
            country: LOKMA_COMPANY_INFO.country,
            vatId: LOKMA_COMPANY_INFO.vatId,
            email: LOKMA_COMPANY_INFO.email,
            phone: LOKMA_COMPANY_INFO.phone,
            taxId: LOKMA_COMPANY_INFO.taxId,
        },
        buyer: {
            name: invoice.butcherName,
            address: invoice.butcherAddress || '',
            city: '',
            postalCode: '',
            country: 'Deutschland',
        },
        lineItems: [{
            description: invoice.description || 'LOKMA Abonnement',
            quantity: 1,
            unit: 'Monat',
            unitPrice: invoice.subtotal,
            taxRate: (invoice.taxRate || 19) as 0 | 7 | 19,
            netAmount: invoice.subtotal,
            vatAmount: invoice.taxAmount,
            grossAmount: invoice.grandTotal,
        }],
        netTotal: invoice.subtotal,
        vatBreakdown: [{
            rate: (invoice.taxRate || 19) as 0 | 7 | 19,
            netAmount: invoice.subtotal,
            vatAmount: invoice.taxAmount,
        }],
        vatTotal: invoice.taxAmount,
        grossTotal: invoice.grandTotal,
        currency: 'EUR',
        paymentStatus: (invoice.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid',
        paymentDueDate: new Date(invoice.dueDate),
        businessId: invoice.butcherId || '',
        createdAt: new Date(invoice.createdAt),
        updatedAt: new Date(invoice.updatedAt),
        issuedAt: new Date(invoice.issueDate),
        periodStart: invoice.periodStart ? new Date(invoice.periodStart) : undefined,
        periodEnd: invoice.periodEnd ? new Date(invoice.periodEnd) : undefined,
        pdfUrl: invoice.pdfUrl,
    };
}

// Helper functions
function formatCurrency(amount: number, currency = 'EUR'): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}

function formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-600',
    pending: 'bg-yellow-600',
    paid: 'bg-green-600',
    failed: 'bg-red-600',
    cancelled: 'bg-red-800',
    overdue: 'bg-orange-600',
    storno: 'bg-red-800',
};

const statusLabels: Record<string, string> = {
    draft: 'Entwurf',
    pending: 'Ausstehend',
    paid: 'Bezahlt',
    failed: 'Fehlgeschlagen',
    cancelled: 'Storniert',
    overdue: 'Überfällig',
    storno: 'Storniert',
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const invoiceId = params?.id as string;

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [showStornoModal, setShowStornoModal] = useState(false);
    const [stornoReason, setStornoReason] = useState('');
    const [stornoLoading, setStornoLoading] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const [lexwareSending, setLexwareSending] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Auth check
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            // Check admin status
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (!adminDoc.exists() || adminDoc.data()?.adminType !== 'super') {
                router.push('/admin/dashboard');
                return;
            }
            setCurrentUser({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
            });
        });
        return () => unsub();
    }, [router]);

    // Load invoice
    useEffect(() => {
        if (!invoiceId) return;

        const loadInvoice = async () => {
            try {
                setLoading(true);
                const invoiceDoc = await getDoc(doc(db, 'invoices', invoiceId));

                if (!invoiceDoc.exists()) {
                    setError('Fatura bulunamadı');
                    return;
                }

                const data = invoiceDoc.data();
                setInvoice({
                    ...data,
                    id: invoiceDoc.id,
                    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt || data.createdAt),
                    issueDate: data.issueDate?.toDate?.() || new Date(data.issueDate || data.createdAt),
                    dueDate: data.dueDate?.toDate?.() || new Date(data.dueDate),
                    periodStart: data.periodStart?.toDate?.() || (data.periodStart ? new Date(data.periodStart) : undefined),
                    periodEnd: data.periodEnd?.toDate?.() || (data.periodEnd ? new Date(data.periodEnd) : undefined),
                    paidAt: data.paidAt?.toDate?.() || (data.paidAt ? new Date(data.paidAt) : undefined),
                    cancelledAt: data.cancelledAt?.toDate?.() || (data.cancelledAt ? new Date(data.cancelledAt) : undefined),
                } as Invoice);

                // Load audit logs
                try {
                    const auditQuery = query(
                        collection(db, 'erp_audit_log'),
                        where('entityId', '==', invoiceDoc.id),
                        where('entityType', '==', 'invoice'),
                    );
                    const auditSnapshot = await getDocs(auditQuery);
                    const logs = auditSnapshot.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                        timestamp: d.data().timestamp?.toDate?.() || new Date(d.data().createdAt),
                    }));
                    logs.sort((a, b) => b.timestamp - a.timestamp);
                    setAuditLogs(logs);
                } catch (e) {
                    console.warn('Audit log yükleme hatası:', e);
                }
            } catch (err) {
                console.error('Fatura yükleme hatası:', err);
                setError('Fatura yüklenirken hata oluştu');
            } finally {
                setLoading(false);
            }
        };

        loadInvoice();
    }, [invoiceId]);

    // Handle PDF download
    const handleDownloadPDF = async () => {
        if (!invoice) return;
        setPdfGenerating(true);

        try {
            const { generateInvoicePDF } = await import('@/services/invoicePDFService');
            const merchantInvoice = toLegacyMerchantInvoice(invoice);
            const pdfBlob = await generateInvoicePDF(merchantInvoice);

            // Download
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoice.invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF oluşturma hatası:', err);
            alert('PDF oluşturulurken hata oluştu');
        } finally {
            setPdfGenerating(false);
        }
    };

    // Handle XRechnung XML download
    const handleDownloadXML = async () => {
        if (!invoice) return;

        try {
            const { downloadXRechnungXML } = await import('@/services/eRechnungService');
            const merchantInvoice = toLegacyMerchantInvoice(invoice);
            downloadXRechnungXML(merchantInvoice);
        } catch (err) {
            console.error('XML oluşturma hatası:', err);
            alert('XML oluşturulurken hata oluştu');
        }
    };

    // Handle Send to Lexware
    const handleSendToLexware = async () => {
        if (!invoice || !currentUser) return;

        const confirmed = window.confirm(
            `Rechnung ${invoice.invoiceNumber} (${formatCurrency(invoice.grandTotal)}) an Lexware senden?\n\nDiese Aktion erstellt eine offizielle Rechnung in Lexware Office.`
        );
        if (!confirmed) return;

        setLexwareSending(true);
        try {
            const res = await fetch('/api/admin/lexware/send-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: invoice.id,
                    sentBy: currentUser.email || currentUser.uid,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                alert(`Lexware Fehler: ${data.error}${data.details ? '\n' + data.details : ''}`);
                return;
            }

            alert(`✅ Erfolgreich an Lexware gesendet!\n\nLexware-Nr.: ${data.voucherNumber || data.lexwareId}`);
            window.location.reload();
        } catch (err) {
            console.error('Lexware send error:', err);
            alert('Fehler beim Senden an Lexware');
        } finally {
            setLexwareSending(false);
        }
    };

    // Handle Storno
    const handleStorno = async () => {
        if (!invoice || !currentUser || stornoReason.length < 10) return;
        setStornoLoading(true);

        try {
            const result = await stornoInvoice(invoice.id, stornoReason, currentUser);

            if (result.success) {
                alert(`Fatura başarıyla storniert! Storno Nr.: ${result.stornoInvoiceNumber}`);
                setShowStornoModal(false);
                // Reload
                window.location.reload();
            } else {
                alert(`Storno hatası: ${result.error}`);
            }
        } catch (err) {
            console.error('Storno hatası:', err);
            alert('Storno işlemi başarısız');
        } finally {
            setStornoLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-white mb-2">Fatura Bulunamadı</h2>
                    <p className="text-gray-400 mb-6">{error || 'Bu fatura mevcut değil veya silinmiş olabilir.'}</p>
                    <Link href="/admin/invoices" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500">
                        ← Faturalara Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/invoices" className="text-gray-400 hover:text-white transition-colors">
                            ← Zurück
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                📄 Rechnung {invoice.invoiceNumber}
                                <span className={`px-3 py-1 rounded-full text-xs text-white ${statusColors[invoice.status]}`}>
                                    {statusLabels[invoice.status] || invoice.status}
                                </span>
                                {invoice.isStorno && (
                                    <span className="px-3 py-1 rounded-full text-xs text-white bg-red-800">
                                        Storno
                                    </span>
                                )}
                                {invoice.isCancelled && (
                                    <span className="px-3 py-1 rounded-full text-xs text-white bg-red-900">
                                        🔄 Storniert
                                    </span>
                                )}
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">
                                Erstellt am {formatDate(invoice.createdAt)} | Fällig am {formatDate(invoice.dueDate)}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowPreview(true)}
                            className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-500 transition-colors"
                        >
                            👁️ Vorschau
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={pdfGenerating}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
                        >
                            {pdfGenerating ? '⏳ Generiere...' : '📄 PDF'}
                        </button>
                        <button
                            onClick={handleDownloadXML}
                            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 transition-colors"
                        >
                            📋 XRechnung XML
                        </button>
                        {/* Lexware Send Button */}
                        {!(invoice as any).lexwareInvoiceId ? (
                            <button
                                onClick={handleSendToLexware}
                                disabled={lexwareSending}
                                className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-500 transition-colors disabled:opacity-50"
                            >
                                {lexwareSending ? '⏳ Wird gesendet...' : '📤 An Lexware senden'}
                            </button>
                        ) : (
                            <span className="px-4 py-2 bg-green-800/50 text-green-300 text-sm rounded-lg border border-green-700 flex items-center gap-1">
                                ✅ Lexware: {(invoice as any).lexwareVoucherNumber || (invoice as any).lexwareInvoiceId}
                            </span>
                        )}
                        {invoice.status !== 'cancelled' && !invoice.isStorno && !invoice.isCancelled && (
                            <button
                                onClick={() => setShowStornoModal(true)}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 transition-colors"
                            >
                                ❌ Stornieren
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Invoice Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Parties */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Seller */}
                            <div className="bg-gray-800 rounded-xl p-5">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Absender (Verkäufer)</h3>
                                <p className="text-white font-bold">{LOKMA_COMPANY_INFO.name}</p>
                                <p className="text-gray-300 text-sm">{LOKMA_COMPANY_INFO.address}</p>
                                <p className="text-gray-300 text-sm">{LOKMA_COMPANY_INFO.postalCode} {LOKMA_COMPANY_INFO.city}</p>
                                <p className="text-gray-500 text-xs mt-2">Steuernr.: {LOKMA_COMPANY_INFO.taxId}</p>
                                <p className="text-gray-500 text-xs">USt-IdNr.: {LOKMA_COMPANY_INFO.vatId}</p>
                            </div>

                            {/* Buyer */}
                            <div className="bg-gray-800 rounded-xl p-5">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Empfänger (Käufer)</h3>
                                <p className="text-white font-bold">{invoice.butcherName}</p>
                                <p className="text-gray-300 text-sm">{invoice.butcherAddress || '-'}</p>
                                {invoice.butcherTaxId && (
                                    <p className="text-gray-500 text-xs mt-2">USt-IdNr.: {invoice.butcherTaxId}</p>
                                )}
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="bg-gray-800 rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-700">
                                <h3 className="text-white font-semibold">Rechnungspositionen</h3>
                            </div>
                            <table className="w-full">
                                <thead className="bg-gray-700/50">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-gray-400 text-xs uppercase">Beschreibung</th>
                                        <th className="px-5 py-3 text-right text-gray-400 text-xs uppercase">Menge</th>
                                        <th className="px-5 py-3 text-right text-gray-400 text-xs uppercase">Einzelpreis</th>
                                        <th className="px-5 py-3 text-right text-gray-400 text-xs uppercase">MwSt</th>
                                        <th className="px-5 py-3 text-right text-gray-400 text-xs uppercase">Gesamt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {invoice.items && invoice.items.length > 0 ? (
                                        invoice.items.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-700/30">
                                                <td className="px-5 py-3 text-white">{item.description}</td>
                                                <td className="px-5 py-3 text-right text-gray-300">{item.quantity}</td>
                                                <td className="px-5 py-3 text-right text-gray-300">{formatCurrency(item.unitPrice)}</td>
                                                <td className="px-5 py-3 text-right text-gray-300">{invoice.taxRate}%</td>
                                                <td className="px-5 py-3 text-right text-white font-medium">{formatCurrency(item.total)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td className="px-5 py-3 text-white">{invoice.description || 'LOKMA Abonnement'}</td>
                                            <td className="px-5 py-3 text-right text-gray-300">1</td>
                                            <td className="px-5 py-3 text-right text-gray-300">{formatCurrency(invoice.subtotal)}</td>
                                            <td className="px-5 py-3 text-right text-gray-300">{invoice.taxRate}%</td>
                                            <td className="px-5 py-3 text-right text-white font-medium">{formatCurrency(invoice.subtotal)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="px-5 py-4 border-t border-gray-700 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Zwischensumme (netto)</span>
                                    <span className="text-white">{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">MwSt ({invoice.taxRate}%)</span>
                                    <span className="text-white">{formatCurrency(invoice.taxAmount)}</span>
                                </div>
                                {invoice.surchargeAmount && invoice.surchargeAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-amber-400">Zuschlag ({invoice.surchargeRate}%)</span>
                                        <span className="text-amber-400">+{formatCurrency(invoice.surchargeAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-600">
                                    <span className="text-white">Gesamtbetrag</span>
                                    <span className="text-white">{formatCurrency(invoice.grandTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Storno Info */}
                        {(invoice.isCancelled || invoice.isStorno) && (
                            <div className="bg-red-900/30 border border-red-700 rounded-xl p-5">
                                <h3 className="text-red-400 font-semibold mb-2">⚠️ Stornierungsinformationen</h3>
                                {invoice.stornoReason && (
                                    <p className="text-gray-300 text-sm"><strong>Grund:</strong> {invoice.stornoReason || invoice.cancelReason}</p>
                                )}
                                {invoice.stornoInvoiceNumber && (
                                    <p className="text-gray-300 text-sm"><strong>Storno-Rechnungsnr.:</strong> {invoice.stornoInvoiceNumber}</p>
                                )}
                                {invoice.originalInvoiceNumber && (
                                    <p className="text-gray-300 text-sm"><strong>Original-Rechnungsnr.:</strong> {invoice.originalInvoiceNumber}</p>
                                )}
                                {invoice.cancelledAt && (
                                    <p className="text-gray-300 text-sm"><strong>Storniert am:</strong> {formatDate(invoice.cancelledAt)}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Metadata & Actions */}
                    <div className="space-y-6">
                        {/* Invoice Metadata */}
                        <div className="bg-gray-800 rounded-xl p-5">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Rechnungsdetails</h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-gray-500 text-xs">Rechnungsnummer</span>
                                    <p className="text-white font-mono">{invoice.invoiceNumber}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs">Zeitraum</span>
                                    <p className="text-white">{invoice.period || `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs">Rechnungsdatum</span>
                                    <p className="text-white">{formatDate(invoice.issueDate || invoice.createdAt)}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs">Fälligkeitsdatum</span>
                                    <p className="text-white">{formatDate(invoice.dueDate)}</p>
                                </div>
                                {invoice.paidAt && (
                                    <div>
                                        <span className="text-gray-500 text-xs">Bezahlt am</span>
                                        <p className="text-green-400">{formatDate(invoice.paidAt)}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500 text-xs">Währung</span>
                                    <p className="text-white">{invoice.currency || 'EUR'}</p>
                                </div>
                                {/* Lexware Reference */}
                                {(invoice as any).lexwareInvoiceId && (
                                    <>
                                        <div className="pt-3 border-t border-gray-700">
                                            <span className="text-gray-500 text-xs">Lexware Invoice ID</span>
                                            <p className="text-orange-400 font-mono text-xs break-all">{(invoice as any).lexwareInvoiceId}</p>
                                        </div>
                                        {(invoice as any).lexwareVoucherNumber && (
                                            <div>
                                                <span className="text-gray-500 text-xs">Lexware Rechnungsnr.</span>
                                                <p className="text-orange-400 font-mono">{(invoice as any).lexwareVoucherNumber}</p>
                                            </div>
                                        )}
                                        {(invoice as any).lexwareSentAt && (
                                            <div>
                                                <span className="text-gray-500 text-xs">An Lexware gesendet</span>
                                                <p className="text-orange-300 text-sm">
                                                    {formatDate((invoice as any).lexwareSentAt)}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div className="bg-gray-800 rounded-xl p-5">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Zahlungsinformationen</h3>
                            <div className="space-y-3">
                                {invoice.paymentMethod && (
                                    <div>
                                        <span className="text-gray-500 text-xs">Zahlungsmethode</span>
                                        <p className="text-white uppercase">{invoice.paymentMethod}</p>
                                    </div>
                                )}
                                {invoice.stripePaymentIntentId && (
                                    <div>
                                        <span className="text-gray-500 text-xs">Stripe Payment Intent</span>
                                        <p className="text-blue-400 font-mono text-xs break-all">{invoice.stripePaymentIntentId}</p>
                                    </div>
                                )}
                                {invoice.stripeInvoiceId && (
                                    <div>
                                        <span className="text-gray-500 text-xs">Stripe Invoice</span>
                                        <p className="text-blue-400 font-mono text-xs break-all">{invoice.stripeInvoiceId}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Audit Trail */}
                        {auditLogs.length > 0 && (
                            <div className="bg-gray-800 rounded-xl p-5">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                                    Änderungsverlauf (GoBD)
                                </h3>
                                <div className="space-y-3">
                                    {auditLogs.map((log) => (
                                        <div key={log.id} className="border-l-2 border-gray-600 pl-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-gray-500">
                                                    {log.timestamp?.toLocaleDateString?.('de-DE') || '-'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${log.action === 'storno' ? 'bg-red-900 text-red-300' :
                                                    log.action === 'payment_received' ? 'bg-green-900 text-green-300' :
                                                        'bg-gray-700 text-gray-300'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </div>
                                            {log.reason && (
                                                <p className="text-gray-400 text-xs mt-1">{log.reason}</p>
                                            )}
                                            <p className="text-gray-500 text-xs">
                                                {log.performedBy?.displayName || log.performedBy?.email || '-'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {invoice.notes && (
                            <div className="bg-gray-800 rounded-xl p-5">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notizen</h3>
                                <p className="text-gray-300 text-sm">{invoice.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <InvoicePreviewModal
                    invoice={invoice}
                    onClose={() => setShowPreview(false)}
                />
            )}

            {/* Storno Modal */}
            {showStornoModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-bold text-white mb-2">⚠️ Rechnung stornieren</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            GoBD: Rechnungen dürfen nicht gelöscht werden. Stattdessen wird eine Stornorechnung erstellt.
                        </p>

                        <div className="mb-4">
                            <label className="block text-gray-300 text-sm mb-1">Stornierungsgrund (min. 10 Zeichen)</label>
                            <textarea
                                value={stornoReason}
                                onChange={(e) => setStornoReason(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none"
                                placeholder="Grund für die Stornierung eingeben..."
                            />
                            <p className="text-gray-500 text-xs mt-1">{stornoReason.length}/10 Zeichen Minimum</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowStornoModal(false); setStornoReason(''); }}
                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleStorno}
                                disabled={stornoLoading || stornoReason.length < 10}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                            >
                                {stornoLoading ? '⏳ Wird storniert...' : '❌ Stornieren'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
