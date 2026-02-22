'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, getDocs, where, Timestamp, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { Invoice } from '@/types';
import { getNextInvoiceNumber, stornoInvoice, logAuditEntry, VAT_RATES } from '@/lib/erp-utils';
import InvoicePreviewModal from '@/components/invoices/InvoicePreviewModal';
import { useTranslations } from 'next-intl';

// Plan fiyatları
const PLAN_PRICES: Record<string, number> = {
    free: 0,
    basic: 19.99,
    standard: 29.99,
    premium: 39.99,
    ultra: 59.99,
};

// Durum renkleri
const statusColors: Record<string, string> = {
    draft: 'bg-gray-600',
    pending: 'bg-yellow-600',
    paid: 'bg-green-600',
    failed: 'bg-red-600',
    cancelled: 'bg-gray-500',
    overdue: 'bg-amber-600',
    storno: 'bg-purple-600',
};

const statusLabels: Record<string, string> = {
    draft: 'Taslak',
    pending: 'Bekliyor',
    paid: 'Ödendi',
    failed: 'Başarısız',
    cancelled: 'İptal',
    overdue: 'Gecikmiş',
    storno: 'Storno',
};

export default function InvoicesPage() {

    const t = useTranslations('AdminInvoices');
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [currentUser, setCurrentUser] = useState<{ uid: string; email: string; displayName?: string } | null>(null);

    // Optimized: Manual Load State
    const [isLoadedAll, setIsLoadedAll] = useState(false);
    const [loadingAll, setLoadingAll] = useState(false);

    // Invoice Creation Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newInvoice, setNewInvoice] = useState({
        butcherName: '',
        butcherAddress: '',
        description: '',
        netAmount: 0,
        vatRate: 'REDUCED' as 'STANDARD' | 'REDUCED',
    });

    // Storno Modal
    const [showStornoModal, setShowStornoModal] = useState(false);
    const [stornoInvoiceId, setStornoInvoiceId] = useState<string | null>(null);
    const [stornoReason, setStornoReason] = useState('');
    const [processingStorno, setProcessingStorno] = useState(false);

    // Preview Modal
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>('');
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        paid: 0,
        failed: 0,
        totalAmount: 0,
        paidAmount: 0,
    });

    // Auth kontrolü
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            setCurrentUser({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || undefined,
            });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    // Faturaları yükle
    const loadInvoices = useCallback(async (loadAll = false) => {
        try {
            let q;
            if (loadAll) {
                q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
            } else {
                q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(50));
            }

            const snapshot = await getDocs(q);
            const invoiceList: Invoice[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                invoiceList.push({
                    id: doc.id,
                    ...data,
                    issueDate: data.issueDate?.toDate ? data.issueDate.toDate() : new Date(data.issueDate),
                    dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
                    paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : undefined,
                } as Invoice);
            });

            // İstatistikleri hesapla
            const total = invoiceList.length;
            const pending = invoiceList.filter(i => i.status === 'pending').length;
            const paid = invoiceList.filter(i => i.status === 'paid').length;
            const failed = invoiceList.filter(i => i.status === 'cancelled' || i.status === 'overdue').length;
            const totalAmount = invoiceList.reduce((sum, i) => sum + i.grandTotal, 0);
            const paidAmount = invoiceList.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.grandTotal, 0);

            setStats({ total, pending, paid, failed, totalAmount, paidAmount });
            setStats({ total, pending, paid, failed, totalAmount, paidAmount });
            setInvoices(invoiceList);
            if (loadAll) setIsLoadedAll(true);
        } catch (error) {
            console.error(t('fatura_yukleme_hatasi'), error);
        } finally {
            setLoadingAll(false);
        }
    }, []);

    const handleLoadAll = () => {
        setLoadingAll(true);
        loadInvoices(true);
    };

    useEffect(() => {
        if (!loading) {
            loadInvoices();
        }
    }, [loading, loadInvoices]);

    // ============= GoBD COMPLIANT INVOICE CREATION =============
    const handleCreateInvoice = async () => {
        if (!currentUser) return;
        if (!newInvoice.butcherName || newInvoice.netAmount <= 0) {
            alert(t('lutfen_musteri_adi_ve_tutar_girin'));
            return;
        }

        setCreating(true);
        try {
            // Get sequential invoice number (GoBD requirement)
            const invoiceNumber = await getNextInvoiceNumber();

            // Calculate VAT
            const vatRate = VAT_RATES[newInvoice.vatRate];
            const taxAmount = newInvoice.netAmount * vatRate;
            const grandTotal = newInvoice.netAmount + taxAmount;

            const now = new Date();
            const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

            const invoiceData = {
                invoiceNumber,
                butcherName: newInvoice.butcherName,
                butcherAddress: newInvoice.butcherAddress,
                description: newInvoice.description || t('manuel_fatura'),
                period,
                subtotal: newInvoice.netAmount,
                taxRate: vatRate * 100, // Store as percentage
                taxAmount,
                grandTotal,
                status: 'pending',
                issueDate: serverTimestamp(),
                dueDate: Timestamp.fromDate(dueDate),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: currentUser.uid,
            };

            const docRef = await addDoc(collection(db, 'invoices'), invoiceData);

            // Audit log
            await logAuditEntry({
                entityType: 'invoice',
                entityId: docRef.id,
                action: 'create',
                newData: { invoiceNumber, grandTotal, status: 'pending' },
                performedBy: currentUser,
            });

            // Reset and refresh
            setShowCreateModal(false);
            setNewInvoice({ butcherName: '', butcherAddress: '', description: '', netAmount: 0, vatRate: 'REDUCED' });
            await loadInvoices();
        } catch (error) {
            console.error(t('invoice_creation_error'), error);
            alert(t('fatura_olusturulurken_hata_olustu'));
        } finally {
            setCreating(false);
        }
    };

    // ============= STORNO (GoBD COMPLIANT CANCELLATION) =============
    const handleStorno = async () => {
        if (!currentUser || !stornoInvoiceId) return;
        if (stornoReason.trim().length < 10) {
            alert(t('storno_sebebi_en_az_10_karakter_olmalidi'));
            return;
        }

        setProcessingStorno(true);
        try {
            const result = await stornoInvoice(stornoInvoiceId, stornoReason, currentUser);

            if (result.success) {
                alert(`Fatura başarıyla storno edildi. Storno Fatura No: ${result.stornoInvoiceNumber}`);
                setShowStornoModal(false);
                setStornoInvoiceId(null);
                setStornoReason('');
                await loadInvoices();
            } else {
                alert(`Storno hatası: ${result.error}`);
            }
        } catch (error) {
            console.error('Storno error:', error);
            alert(t('storno_islemi_sirasinda_hata_olustu'));
        } finally {
            setProcessingStorno(false);
        }
    };

    // Filtrelenmiş faturalar
    const filteredInvoices = invoices.filter(invoice => {
        if (filterStatus !== 'all' && invoice.status !== filterStatus) return false;
        if (filterMonth && invoice.period !== filterMonth) return false;
        return true;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">{t('yukleniyor')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Page Title */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">📄 Faturalar</h1>
                        <p className="text-gray-400 text-sm">{t('b2b_abonelik_faturalari')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                // DATEV Export
                                import('@/services/eRechnungService').then(({ downloadDATEVExport }) => {
                                    // Convert legacy Invoice to MerchantInvoice format for export
                                    const merchantInvoices = filteredInvoices.map(inv => ({
                                        id: inv.id,
                                        invoiceNumber: inv.invoiceNumber,
                                        type: 'subscription' as const,
                                        status: 'issued' as const,
                                        seller: {
                                            name: 'LOKMA GmbH',
                                            address: 'Schulte-Braucks-Str. 1',
                                            city: t('huckelhoven'),
                                            postalCode: '41836',
                                            country: 'Deutschland'
                                        },
                                        buyer: {
                                            name: inv.butcherName,
                                            address: inv.butcherAddress || '',
                                            city: '',
                                            postalCode: '',
                                            country: 'Deutschland'
                                        },
                                        lineItems: [{
                                            description: 'LOKMA Abonnement',
                                            quantity: 1,
                                            unit: 'Monat',
                                            unitPrice: inv.subtotal,
                                            taxRate: inv.taxRate as 0 | 7 | 19,
                                            netAmount: inv.subtotal,
                                            vatAmount: inv.taxAmount,
                                            grossAmount: inv.grandTotal
                                        }],
                                        netTotal: inv.subtotal,
                                        vatBreakdown: [{ rate: inv.taxRate as 0 | 7 | 19, netAmount: inv.subtotal, vatAmount: inv.taxAmount }],
                                        vatTotal: inv.taxAmount,
                                        grossTotal: inv.grandTotal,
                                        currency: 'EUR',
                                        paymentStatus: 'pending' as const,
                                        paymentDueDate: new Date(),
                                        businessId: inv.butcherId || '',
                                        createdAt: new Date(),
                                        updatedAt: new Date(),
                                        issuedAt: new Date()
                                    }));
                                    downloadDATEVExport(merchantInvoices);
                                });
                            }}
                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500"
                            title="DATEV Format (Muhasebeci)"
                        >
                            📊 DATEV
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
                        >
                            {t('manuel_fatura')}
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 pb-6">

                {/* Manual Load Banner */}
                {!isLoadedAll && (
                    <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚡</span>
                            <div>
                                <h3 className="text-blue-200 font-bold">{t('hizli_yukleme_modu')}</h3>
                                <p className="text-blue-300/60 text-sm">{t('performans_icin_sadece_son_50_fatura_gos')}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLoadAll}
                            disabled={loadingAll}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                        >
                            {loadingAll ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-white rounded-full"></div>
                                    <span>{t('yukleniyor')}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('tumunu_yukle')}</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-white">{stats.total}</p>
                        <p className="text-gray-400 text-sm">{t('toplam')}</p>
                    </div>
                    <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
                        <p className="text-gray-400 text-sm">{t('bekleyen')}</p>
                    </div>
                    <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-green-400">{stats.paid}</p>
                        <p className="text-gray-400 text-sm">{t('odenen')}</p>
                    </div>
                    <div className="bg-red-600/20 border border-red-600/30 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-red-400">{stats.failed}</p>
                        <p className="text-gray-400 text-sm">{t('basarisiz')}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">€{stats.totalAmount.toFixed(2)}</p>
                        <p className="text-gray-400 text-sm">{t('toplam_tutar')}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">€{stats.paidAmount.toFixed(2)}</p>
                        <p className="text-gray-400 text-sm">Tahsil Edilen</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-xl p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">{t('durum')}</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                title={t('durum_filtresi')}
                            >
                                <option value="all">{t('tumu')}</option>
                                <option value="pending">{t('bekleyen')}</option>
                                <option value="paid">{t('odenen')}</option>
                                <option value="failed">{t('basarisiz')}</option>
                                <option value="overdue">{t('gecikmis')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">{t('donem')}</label>
                            <input
                                type="month"
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                placeholder="YYYY-MM"
                            />
                        </div>
                        <button
                            onClick={() => { setFilterStatus('all'); setFilterMonth(''); }}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 mt-5"
                        >
                            Filtreleri Temizle
                        </button>
                    </div>
                </div>

                {/* Invoice Table */}
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-gray-300 text-sm">{t('fatura_no')}</th>
                                <th className="px-4 py-3 text-left text-gray-300 text-sm">{t('musteri')}</th>
                                <th className="px-4 py-3 text-left text-gray-300 text-sm">{t('donem')}</th>
                                <th className="px-4 py-3 text-right text-gray-300 text-sm">{t('tutar')}</th>
                                <th className="px-4 py-3 text-center text-gray-300 text-sm">{t('durum')}</th>
                                <th className="px-4 py-3 text-center text-gray-300 text-sm">{t('son_odeme')}</th>
                                <th className="px-4 py-3 text-center text-gray-300 text-sm">{t('i_slemler')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                        {t('henuz_fatura_bulunmuyor')}
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-700/50">
                                        <td className="px-4 py-3">
                                            <span className="text-white font-mono">{invoice.invoiceNumber}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-white">{invoice.butcherName}</p>
                                                <p className="text-gray-500 text-xs">{invoice.butcherAddress}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">{invoice.period}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-white font-bold">€{invoice.grandTotal.toFixed(2)}</span>
                                            {invoice.surchargeAmount && invoice.surchargeAmount > 0 && (
                                                <span className="text-amber-400 text-xs ml-1">(+{invoice.surchargeRate}%)</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs text-white ${statusColors[invoice.status]}`}>
                                                {statusLabels[invoice.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-300 text-sm">
                                            {new Date(invoice.dueDate).toLocaleDateString('de-DE')}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                {invoice.pdfUrl && (
                                                    <a
                                                        href={invoice.pdfUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                                                    >
                                                        📄 PDF
                                                    </a>
                                                )}
                                                <Link
                                                    href={`/admin/invoices/${invoice.id}`}
                                                    className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                                                >
                                                    Detay
                                                </Link>
                                                <button
                                                    onClick={() => {
                                                        setPreviewInvoice(invoice);
                                                        setShowPreviewModal(true);
                                                    }}
                                                    className="px-3 py-1 bg-teal-600 text-white text-xs rounded hover:bg-teal-500"
                                                    title={t('fatura_onizleme')}
                                                >
                                                    {t('onizle')}
                                                </button>
                                                {invoice.status !== 'cancelled' && !invoice.isStorno && (
                                                    <button
                                                        onClick={() => {
                                                            setStornoInvoiceId(invoice.id);
                                                            setShowStornoModal(true);
                                                        }}
                                                        className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                                                        title={t('faturayi_i_ptal_et_storno')}
                                                    >
                                                        Storno
                                                    </button>
                                                )}
                                                {/* XRechnung XML İndirme */}
                                                <button
                                                    onClick={() => {
                                                        import('@/services/eRechnungService').then(({ downloadXRechnungXML }) => {
                                                            // Legacy Invoice → MerchantInvoice dönüşümü
                                                            const merchantInvoice = {
                                                                id: invoice.id,
                                                                invoiceNumber: invoice.invoiceNumber,
                                                                type: 'subscription' as const,
                                                                status: 'issued' as const,
                                                                seller: {
                                                                    name: 'LOKMA GmbH',
                                                                    address: 'Schulte-Braucks-Str. 1',
                                                                    city: t('huckelhoven'),
                                                                    postalCode: '41836',
                                                                    country: 'Deutschland',
                                                                    vatId: 'DEMO-UST-DE123456',
                                                                    email: 'info@lokma.shop'
                                                                },
                                                                buyer: {
                                                                    name: invoice.butcherName,
                                                                    address: invoice.butcherAddress || '',
                                                                    city: '',
                                                                    postalCode: '',
                                                                    country: 'Deutschland'
                                                                },
                                                                lineItems: [{
                                                                    description: invoice.description || 'LOKMA Abonnement',
                                                                    quantity: 1,
                                                                    unit: 'Monat',
                                                                    unitPrice: invoice.subtotal,
                                                                    taxRate: (invoice.taxRate || 7) as 0 | 7 | 19,
                                                                    netAmount: invoice.subtotal,
                                                                    vatAmount: invoice.taxAmount,
                                                                    grossAmount: invoice.grandTotal
                                                                }],
                                                                netTotal: invoice.subtotal,
                                                                vatBreakdown: [{
                                                                    rate: (invoice.taxRate || 7) as 0 | 7 | 19,
                                                                    netAmount: invoice.subtotal,
                                                                    vatAmount: invoice.taxAmount
                                                                }],
                                                                vatTotal: invoice.taxAmount,
                                                                grossTotal: invoice.grandTotal,
                                                                currency: 'EUR',
                                                                paymentStatus: (invoice.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid',
                                                                paymentDueDate: new Date(invoice.dueDate),
                                                                businessId: invoice.butcherId || '',
                                                                createdAt: new Date(invoice.createdAt),
                                                                updatedAt: new Date(invoice.updatedAt),
                                                                issuedAt: new Date(invoice.issueDate)
                                                            };
                                                            downloadXRechnungXML(merchantInvoice);
                                                        });
                                                    }}
                                                    className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-500"
                                                    title={t('xrechnung_xml_i_ndir_b2b_e_fatura')}
                                                >
                                                    XML
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Invoice Creation Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-bold text-white mb-4">{t('manuel_fatura_olustur')}</h2>
                        <p className="text-gray-400 text-sm mb-4">{t('gobd_uyumlu_ardisik_fatura_numarasi_otom')}</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">{t('musteri_adi')}</label>
                                <input
                                    type="text"
                                    value={newInvoice.butcherName}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, butcherName: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder={t('orn_tuna_kasap')}
                                />
                            </div>
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">Adres</label>
                                <input
                                    type="text"
                                    value={newInvoice.butcherAddress}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, butcherAddress: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder={t('orn_hauptstr_1_50667_koln')}
                                />
                            </div>
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">{t('aciklama')}</label>
                                <input
                                    type="text"
                                    value={newInvoice.description}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder={t('orn_ocak_2026_abonelik')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-300 text-sm mb-1">{t('net_tutar')}</label>
                                    <input
                                        type="number"
                                        value={newInvoice.netAmount || ''}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, netAmount: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-300 text-sm mb-1">{t('kdv_orani')}</label>
                                    <select
                                        value={newInvoice.vatRate}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, vatRate: e.target.value as 'STANDARD' | 'REDUCED' })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    >
                                        <option value="REDUCED">{t('7_gida')}</option>
                                        <option value="STANDARD">%19 (Standart)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Preview */}
                            {newInvoice.netAmount > 0 && (
                                <div className="bg-gray-900 rounded-lg p-3 text-sm">
                                    <div className="flex justify-between text-gray-400"><span>Net:</span><span>€{newInvoice.netAmount.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-gray-400"><span>KDV ({newInvoice.vatRate === 'REDUCED' ? '7%' : '19%'}):</span><span>€{(newInvoice.netAmount * VAT_RATES[newInvoice.vatRate]).toFixed(2)}</span></div>
                                    <div className="flex justify-between text-white font-bold border-t border-gray-700 mt-2 pt-2"><span>{t('toplam')}</span><span>€{(newInvoice.netAmount * (1 + VAT_RATES[newInvoice.vatRate])).toFixed(2)}</span></div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleCreateInvoice}
                                disabled={creating || !newInvoice.butcherName || newInvoice.netAmount <= 0}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                            >
                                {creating ? t('olusturuluyor') : t('fatura_olustur')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Storno Confirmation Modal */}
            {showStornoModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-bold text-red-400 mb-4">{t('fatura_storno_i_ptal')}</h2>
                        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 mb-4">
                            <p className="text-red-200 text-sm">
                                <strong>{t('gobd_uyarisi')}</strong> {t('almanya_mali_mevzuatina_gore_faturalar_s')}
                            </p>
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm mb-1">Storno Sebebi (zorunlu, min 10 karakter)</label>
                            <textarea
                                value={stornoReason}
                                onChange={(e) => setStornoReason(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                placeholder={t('orn_musteri_siparisi_iptal_etti_yanlis_t')}
                                rows={3}
                            />
                            <p className="text-gray-500 text-xs mt-1">{stornoReason.length}/10 karakter</p>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowStornoModal(false); setStornoInvoiceId(null); setStornoReason(''); }}
                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                            >
                                {t('vazgec')}
                            </button>
                            <button
                                onClick={handleStorno}
                                disabled={processingStorno || stornoReason.trim().length < 10}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                            >
                                {processingStorno ? t('i_sleniyor') : 'Storno Yap'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Preview Modal */}
            {showPreviewModal && previewInvoice && (
                <InvoicePreviewModal
                    invoice={previewInvoice}
                    onClose={() => {
                        setShowPreviewModal(false);
                        setPreviewInvoice(null);
                    }}
                />
            )}
        </div>
    );
}
