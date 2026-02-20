'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp, limit, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';

// Types
interface CommissionRecord {
    id: string;
    orderId: string;
    businessId: string;
    businessName: string;
    planId: string;
    planName: string;
    orderTotal: number;
    courierType: 'click_collect' | 'own_courier' | 'lokma_courier';
    commissionRate: number;
    commissionAmount: number;
    perOrderFee: number;
    totalCommission: number;
    netCommission: number;
    vatAmount: number;
    vatRate: number;
    paymentMethod: string;
    collectionStatus: 'auto_collected' | 'pending' | 'invoiced' | 'paid';
    period: string;
    createdAt: Date;
    orderNumber?: string;
}

interface BusinessSummary {
    businessId: string;
    businessName: string;
    planName: string;
    commissionRate: number;
    totalOrders: number;
    totalOrderAmount: number;
    totalCommission: number;
    cardCommission: number;
    cashCommission: number;
    pendingAmount: number;
    collectedAmount: number;
}

const courierLabels: Record<string, string> = {
    click_collect: '🛒 Gel-Al',
    own_courier: '🏪 Kendi Kurye',
    lokma_courier: '🚗 LOKMA Kurye',
};

const statusColors: Record<string, string> = {
    auto_collected: 'bg-green-600',
    pending: 'bg-yellow-600',
    invoiced: 'bg-blue-600',
    paid: 'bg-emerald-600',
};

const statusLabels: Record<string, string> = {
    auto_collected: 'Otomatik Tahsil',
    pending: 'Bekliyor',
    invoiced: 'Faturalandı',
    paid: 'Ödendi',
};

export default function CommissionsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<CommissionRecord[]>([]);
    const [filterPeriod, setFilterPeriod] = useState<string>('');
    const [filterBusiness, setFilterBusiness] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [orderLoading, setOrderLoading] = useState(false);

    // Fetch full order details from meat_orders
    const loadOrderDetail = useCallback(async (orderId: string, commissionRecord: CommissionRecord) => {
        setOrderLoading(true);
        try {
            const orderDoc = await getDoc(doc(db, 'meat_orders', orderId));
            if (orderDoc.exists()) {
                const data = orderDoc.data();
                setSelectedOrder({
                    ...data,
                    id: orderDoc.id,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null,
                    deliveredAt: data.deliveredAt?.toDate ? data.deliveredAt.toDate() : data.deliveredAt ? new Date(data.deliveredAt) : null,
                    claimedAt: data.claimedAt?.toDate ? data.claimedAt.toDate() : data.claimedAt ? new Date(data.claimedAt) : null,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
                    commission: commissionRecord,
                });
            } else {
                // Order not found, show commission data only
                setSelectedOrder({ id: orderId, notFound: true, commission: commissionRecord });
            }
        } catch (error) {
            console.error('Error loading order detail:', error);
            setSelectedOrder({ id: orderId, notFound: true, commission: commissionRecord });
        } finally {
            setOrderLoading(false);
        }
    }, []);

    // Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    // Load commission records
    const loadRecords = useCallback(async () => {
        try {
            const q = query(
                collection(db, 'commission_records'),
                orderBy('createdAt', 'desc'),
                limit(500)
            );
            const snapshot = await getDocs(q);
            const list: CommissionRecord[] = [];
            snapshot.forEach((d) => {
                const data = d.data();
                list.push({
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                } as CommissionRecord);
            });

            // Resolve generic "İşletme" names from businesses collection
            const genericRecords = list.filter(r => r.businessName === 'İşletme' || !r.businessName);
            if (genericRecords.length > 0) {
                const uniqueIds = [...new Set(genericRecords.map(r => r.businessId))];
                for (const bizId of uniqueIds) {
                    try {
                        const bizDoc = await getDoc(doc(db, 'businesses', bizId));
                        if (bizDoc.exists()) {
                            const bizData = bizDoc.data();
                            const realName = bizData.companyName || bizData.name || bizData.businessName || bizData.brand || 'İşletme';
                            list.forEach(r => {
                                if (r.businessId === bizId && (r.businessName === 'İşletme' || !r.businessName)) {
                                    r.businessName = realName;
                                }
                            });
                        }
                    } catch (e) { /* skip */ }
                }
            }

            setRecords(list);
        } catch (error) {
            console.error('Commission records loading error:', error);
        }
    }, []);

    useEffect(() => {
        if (!loading) loadRecords();
    }, [loading, loadRecords]);

    // Set default period to current month
    useEffect(() => {
        const now = new Date();
        setFilterPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }, []);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filterPeriod && r.period !== filterPeriod) return false;
            if (filterBusiness !== 'all' && r.businessId !== filterBusiness) return false;
            if (filterStatus !== 'all' && r.collectionStatus !== filterStatus) return false;
            return true;
        });
    }, [records, filterPeriod, filterBusiness, filterStatus]);

    // Business summaries
    const businessSummaries = useMemo(() => {
        const map = new Map<string, BusinessSummary>();
        filteredRecords.forEach(r => {
            const existing = map.get(r.businessId) || {
                businessId: r.businessId,
                businessName: r.businessName,
                planName: r.planName,
                commissionRate: r.commissionRate,
                totalOrders: 0,
                totalOrderAmount: 0,
                totalCommission: 0,
                cardCommission: 0,
                cashCommission: 0,
                pendingAmount: 0,
                collectedAmount: 0,
            };
            existing.totalOrders++;
            existing.totalOrderAmount += r.orderTotal;
            existing.totalCommission += r.totalCommission;
            const isCard = r.paymentMethod === 'card' || r.paymentMethod === 'stripe';
            if (isCard) {
                existing.cardCommission += r.totalCommission;
                existing.collectedAmount += r.totalCommission;
            } else {
                existing.cashCommission += r.totalCommission;
                if (r.collectionStatus === 'pending') {
                    existing.pendingAmount += r.totalCommission;
                } else {
                    existing.collectedAmount += r.totalCommission;
                }
            }
            map.set(r.businessId, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.totalCommission - a.totalCommission);
    }, [filteredRecords]);

    // Unique businesses for filter
    const uniqueBusinesses = useMemo(() => {
        const map = new Map<string, string>();
        records.forEach(r => map.set(r.businessId, r.businessName));
        return Array.from(map.entries());
    }, [records]);

    // Overall stats
    const stats = useMemo(() => {
        const totalCommission = filteredRecords.reduce((s, r) => s + r.totalCommission, 0);
        const totalOrders = filteredRecords.length;
        const totalOrderAmount = filteredRecords.reduce((s, r) => s + r.orderTotal, 0);
        const pendingAmount = filteredRecords
            .filter(r => r.collectionStatus === 'pending')
            .reduce((s, r) => s + r.totalCommission, 0);
        const collectedAmount = filteredRecords
            .filter(r => r.collectionStatus === 'auto_collected' || r.collectionStatus === 'paid')
            .reduce((s, r) => s + r.totalCommission, 0);
        const cardCommission = filteredRecords
            .filter(r => r.paymentMethod === 'card' || r.paymentMethod === 'stripe')
            .reduce((s, r) => s + r.totalCommission, 0);
        const cashCommission = filteredRecords
            .filter(r => r.paymentMethod === 'cash')
            .reduce((s, r) => s + r.totalCommission, 0);
        const vatTotal = filteredRecords.reduce((s, r) => s + r.vatAmount, 0);

        return { totalCommission, totalOrders, totalOrderAmount, pendingAmount, collectedAmount, cardCommission, cashCommission, vatTotal };
    }, [filteredRecords]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Page Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">💰 Provizyon Raporu</h1>
                        <p className="text-gray-400 text-sm">İşletme bazlı provizyon takibi ve raporlama</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'summary' ? 'detail' : 'summary')}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                        >
                            {viewMode === 'summary' ? '📋 Detay Görünümü' : '📊 Özet Görünümü'}
                        </button>
                        <button
                            onClick={loadRecords}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
                        >
                            🔄 Yenile
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                        <p className="text-gray-400 text-xs">Sipariş</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">€{stats.totalOrderAmount.toFixed(0)}</p>
                        <p className="text-gray-400 text-xs">Ciro</p>
                    </div>
                    <div className="bg-amber-600/20 border border-amber-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-amber-400">€{stats.totalCommission.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Toplam Provizyon</p>
                    </div>
                    <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">€{stats.collectedAmount.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Tahsil Edilen</p>
                    </div>
                    <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-400">€{stats.pendingAmount.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Bekleyen (Nakit)</p>
                    </div>
                    <div className="bg-blue-600/20 border border-blue-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-400">€{stats.cardCommission.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Kart Provizyon</p>
                    </div>
                    <div className="bg-purple-600/20 border border-purple-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-400">€{stats.cashCommission.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Nakit Provizyon</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-gray-300">€{stats.vatTotal.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">KDV Toplam</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-xl p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">Dönem</label>
                            <input
                                type="month"
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">İşletme</label>
                            <select
                                value={filterBusiness}
                                onChange={(e) => setFilterBusiness(e.target.value)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                            >
                                <option value="all">Tümü</option>
                                {uniqueBusinesses.map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">Tahsilat Durumu</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                            >
                                <option value="all">Tümü</option>
                                <option value="auto_collected">Otomatik Tahsil</option>
                                <option value="pending">Bekliyor</option>
                                <option value="invoiced">Faturalandı</option>
                                <option value="paid">Ödendi</option>
                            </select>
                        </div>
                        <button
                            onClick={() => { setFilterPeriod(''); setFilterBusiness('all'); setFilterStatus('all'); }}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 mt-5"
                        >
                            Temizle
                        </button>
                    </div>
                </div>

                {/* Summary View */}
                {viewMode === 'summary' ? (
                    <div className="bg-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-gray-300 text-sm">İşletme</th>
                                    <th className="px-4 py-3 text-left text-gray-300 text-sm">Plan</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Sipariş</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Ciro</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Provizyon</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Kart</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Nakit</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Bekleyen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {businessSummaries.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                            Bu dönemde provizyon kaydı bulunmuyor
                                        </td>
                                    </tr>
                                ) : (
                                    businessSummaries.map((bs) => (
                                        <tr
                                            key={bs.businessId}
                                            className="hover:bg-gray-700/50 cursor-pointer"
                                            onClick={() => {
                                                setFilterBusiness(bs.businessId);
                                                setViewMode('detail');
                                            }}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="text-white font-medium">{bs.businessName}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-gray-400 text-sm">{bs.planName}</span>
                                                <span className="text-amber-400 text-xs ml-1">%{bs.commissionRate}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-white">{bs.totalOrders}</td>
                                            <td className="px-4 py-3 text-right text-white">€{bs.totalOrderAmount.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-amber-400 font-bold">€{bs.totalCommission.toFixed(2)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-400">€{bs.cardCommission.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-purple-400">€{bs.cashCommission.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                {bs.pendingAmount > 0 ? (
                                                    <span className="text-yellow-400 font-bold">€{bs.pendingAmount.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-green-400">✓ Tahsil</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {/* Footer totals */}
                            {businessSummaries.length > 0 && (
                                <tfoot className="bg-gray-900 border-t-2 border-gray-600">
                                    <tr>
                                        <td className="px-4 py-3 text-white font-bold" colSpan={2}>TOPLAM</td>
                                        <td className="px-4 py-3 text-right text-white font-bold">{stats.totalOrders}</td>
                                        <td className="px-4 py-3 text-right text-white font-bold">€{stats.totalOrderAmount.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-amber-400 font-bold">€{stats.totalCommission.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-blue-400 font-bold">€{stats.cardCommission.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-purple-400 font-bold">€{stats.cashCommission.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-yellow-400 font-bold">€{stats.pendingAmount.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                ) : (
                    /* Detail View */
                    <div className="bg-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-3 py-3 text-left text-gray-300 text-xs">Sipariş</th>
                                    <th className="px-3 py-3 text-left text-gray-300 text-xs">İşletme</th>
                                    <th className="px-3 py-3 text-center text-gray-300 text-xs">Teslimat</th>
                                    <th className="px-3 py-3 text-right text-gray-300 text-xs">Tutar</th>
                                    <th className="px-3 py-3 text-right text-gray-300 text-xs">Oran</th>
                                    <th className="px-3 py-3 text-right text-gray-300 text-xs">Provizyon</th>
                                    <th className="px-3 py-3 text-right text-gray-300 text-xs">Net + KDV</th>
                                    <th className="px-3 py-3 text-center text-gray-300 text-xs">Ödeme</th>
                                    <th className="px-3 py-3 text-center text-gray-300 text-xs">Durum</th>
                                    <th className="px-3 py-3 text-center text-gray-300 text-xs">Tarih</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                                            Provizyon kaydı bulunmuyor
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-700/50 text-sm cursor-pointer" onClick={() => loadOrderDetail(r.orderId, r)}>
                                            <td className="px-3 py-2">
                                                <span className="text-white font-mono text-xs">#{r.orderNumber || r.orderId.slice(0, 6)}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="text-white text-xs">{r.businessName}</span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="text-gray-300 text-xs">{courierLabels[r.courierType] || r.courierType}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-white">€{r.orderTotal.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right text-gray-400">%{r.commissionRate}</td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-amber-400 font-bold">€{r.totalCommission.toFixed(2)}</span>
                                                    {r.perOrderFee > 0 && (
                                                        <span className="text-[10px] text-yellow-400/70">+€{r.perOrderFee.toFixed(2)} ücret</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className="text-gray-300 text-xs">
                                                    €{r.netCommission.toFixed(2)} + €{r.vatAmount.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs ${r.paymentMethod === 'card' || r.paymentMethod === 'stripe' ? 'bg-blue-600/30 text-blue-300' : 'bg-purple-600/30 text-purple-300'}`}>
                                                    {r.paymentMethod === 'card' || r.paymentMethod === 'stripe' ? '💳 Kart' : '💵 Nakit'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusColors[r.collectionStatus]}`}>
                                                    {statusLabels[r.collectionStatus]}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-400 text-xs">
                                                {r.createdAt.toLocaleDateString('de-DE')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Order Detail Modal */}
                {(selectedOrder || orderLoading) && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
                        <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700" onClick={(e) => e.stopPropagation()}>
                            {orderLoading ? (
                                <div className="p-12 text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-4"></div>
                                    <p className="text-gray-400">Sipariş detayları yükleniyor...</p>
                                </div>
                            ) : selectedOrder?.notFound ? (
                                <div className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-white">📋 Sipariş #{selectedOrder.commission?.orderNumber || selectedOrder.id?.slice(0, 6)}</h3>
                                        <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                                    </div>
                                    <p className="text-gray-400">Sipariş detayı bulunamadı. Sadece provizyon bilgileri mevcut.</p>
                                    {selectedOrder.commission && (
                                        <div className="mt-4 bg-gray-900/50 rounded-lg p-4">
                                            <p className="text-gray-300 text-sm">💰 Provizyon: <span className="text-amber-400 font-bold">€{selectedOrder.commission.totalCommission.toFixed(2)}</span></p>
                                            <p className="text-gray-300 text-sm">📦 Tutar: €{selectedOrder.commission.orderTotal.toFixed(2)}</p>
                                        </div>
                                    )}
                                </div>
                            ) : selectedOrder && (
                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-5">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">📋 Sipariş #{selectedOrder.orderNumber || selectedOrder.id?.slice(0, 6)}</h3>
                                            <p className="text-gray-400 text-sm mt-0.5">{selectedOrder.butcherName || selectedOrder.businessName || selectedOrder.commission?.businessName}</p>
                                        </div>
                                        <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mb-5">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedOrder.status === 'delivered' ? 'bg-green-600/30 text-green-300' :
                                            selectedOrder.status === 'cancelled' ? 'bg-red-600/30 text-red-300' :
                                                selectedOrder.status === 'ready' ? 'bg-blue-600/30 text-blue-300' :
                                                    selectedOrder.status === 'preparing' ? 'bg-yellow-600/30 text-yellow-300' :
                                                        'bg-gray-600/30 text-gray-300'
                                            }`}>
                                            {selectedOrder.status === 'delivered' ? '✅ Teslim Edildi' :
                                                selectedOrder.status === 'cancelled' ? '❌ İptal' :
                                                    selectedOrder.status === 'ready' ? '📦 Hazır' :
                                                        selectedOrder.status === 'preparing' ? '🍳 Hazırlanıyor' :
                                                            selectedOrder.status === 'pending' ? '⏳ Bekliyor' :
                                                                selectedOrder.status}
                                        </span>
                                        <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${selectedOrder.deliveryMethod === 'delivery' ? 'bg-purple-600/30 text-purple-300' : 'bg-cyan-600/30 text-cyan-300'
                                            }`}>
                                            {selectedOrder.deliveryMethod === 'delivery' ? '🚗 Kurye ile Teslimat' : '🛒 Gel-Al'}
                                        </span>
                                    </div>

                                    {/* Customer Info */}
                                    <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                        <h4 className="text-gray-400 text-xs font-medium mb-3 uppercase tracking-wider">👤 Müşteri Bilgileri</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-gray-500 text-xs">Ad Soyad</p>
                                                <p className="text-white text-sm font-medium">{selectedOrder.customerName || selectedOrder.userDisplayName || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs">Telefon</p>
                                                <p className="text-white text-sm">{selectedOrder.customerPhone || selectedOrder.userPhone || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs">E-posta</p>
                                                <p className="text-white text-sm">{selectedOrder.userEmail || '-'}</p>
                                            </div>
                                            {selectedOrder.deliveryAddress && (
                                                <div>
                                                    <p className="text-gray-500 text-xs">Teslimat Adresi</p>
                                                    <p className="text-white text-sm">{selectedOrder.deliveryAddress}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    {selectedOrder.items && selectedOrder.items.length > 0 && (
                                        <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                            <h4 className="text-gray-400 text-xs font-medium mb-3 uppercase tracking-wider">🛍️ Sipariş İçeriği</h4>
                                            <div className="space-y-2">
                                                {selectedOrder.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-700/50 last:border-0">
                                                        <div className="flex-1">
                                                            <p className="text-white text-sm font-medium">{item.productName || item.name}</p>
                                                            <p className="text-gray-400 text-xs">{item.quantity}x · €{(item.unitPrice || item.price || 0).toFixed(2)}/{item.unit || 'adet'}</p>
                                                        </div>
                                                        <p className="text-amber-400 font-bold text-sm">€{(item.totalPrice || (item.quantity * (item.unitPrice || item.price || 0))).toFixed(2)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
                                                <span className="text-white font-bold">Toplam</span>
                                                <span className="text-amber-400 font-bold text-lg">€{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Courier Info */}
                                    {(selectedOrder.courierName || selectedOrder.courierId) && (
                                        <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                            <h4 className="text-gray-400 text-xs font-medium mb-3 uppercase tracking-wider">🚗 Kurye Bilgileri</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-gray-500 text-xs">Kurye Adı</p>
                                                    <p className="text-white text-sm font-medium">{selectedOrder.courierName || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs">Kurye Telefon</p>
                                                    <p className="text-white text-sm">{selectedOrder.courierPhone || '-'}</p>
                                                </div>
                                                {selectedOrder.deliveryProof && (
                                                    <div className="col-span-2">
                                                        <p className="text-gray-500 text-xs">Teslimat Kanıtı</p>
                                                        <p className="text-white text-sm">
                                                            {selectedOrder.deliveryProof.type === 'personal_handoff' ? '🤝 Elden Teslim' :
                                                                selectedOrder.deliveryProof.type === 'left_at_door' ? '🚪 Kapıda Bırakıldı' :
                                                                    selectedOrder.deliveryProof.type || '-'}
                                                            {selectedOrder.deliveryProof.distanceKm !== undefined && (
                                                                <span className="text-gray-400 ml-2">({selectedOrder.deliveryProof.distanceKm.toFixed(1)} km)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timestamps */}
                                    <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                        <h4 className="text-gray-400 text-xs font-medium mb-3 uppercase tracking-wider">⏱️ Zaman Çizelgesi</h4>
                                        <div className="space-y-2">
                                            {selectedOrder.createdAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-sm">📝 Sipariş Oluşturuldu</span>
                                                    <span className="text-white text-sm">{selectedOrder.createdAt.toLocaleString('de-DE')}</span>
                                                </div>
                                            )}
                                            {selectedOrder.statusHistory?.ready && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-sm">📦 Hazır</span>
                                                    <span className="text-white text-sm">{(selectedOrder.statusHistory.ready.toDate ? selectedOrder.statusHistory.ready.toDate() : new Date(selectedOrder.statusHistory.ready)).toLocaleString('de-DE')}</span>
                                                </div>
                                            )}
                                            {selectedOrder.claimedAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-sm">🚗 Kurye Aldı</span>
                                                    <span className="text-white text-sm">{selectedOrder.claimedAt.toLocaleString('de-DE')}</span>
                                                </div>
                                            )}
                                            {selectedOrder.deliveredAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-sm">✅ Teslim Edildi</span>
                                                    <span className="text-white text-sm">{selectedOrder.deliveredAt.toLocaleString('de-DE')}</span>
                                                </div>
                                            )}
                                            {selectedOrder.createdAt && selectedOrder.deliveredAt && (
                                                <div className="flex justify-between pt-2 border-t border-gray-700/50">
                                                    <span className="text-gray-400 text-sm">⏱️ Toplam Süre</span>
                                                    <span className="text-amber-400 text-sm font-medium">
                                                        {Math.round((selectedOrder.deliveredAt.getTime() - selectedOrder.createdAt.getTime()) / 60000)} dk
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Commission & Payment */}
                                    {selectedOrder.commission && (
                                        <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 mb-4">
                                            <h4 className="text-amber-400 text-xs font-medium mb-3 uppercase tracking-wider">💰 Provizyon Detayı</h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-300 text-sm">Sipariş Tutarı</span>
                                                    <span className="text-white text-sm">€{selectedOrder.commission.orderTotal.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-300 text-sm">Oran ({selectedOrder.commission.courierType === 'click_collect' ? 'Gel-Al' : selectedOrder.commission.courierType === 'own_courier' ? 'Kendi Kurye' : 'LOKMA Kurye'})</span>
                                                    <span className="text-white text-sm">%{selectedOrder.commission.commissionRate}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-300 text-sm">Provizyon</span>
                                                    <span className="text-amber-400 text-sm font-bold">€{selectedOrder.commission.commissionAmount.toFixed(2)}</span>
                                                </div>
                                                {selectedOrder.commission.perOrderFee > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-300 text-sm">Sipariş Başı Ücret</span>
                                                        <span className="text-white text-sm">€{selectedOrder.commission.perOrderFee.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between pt-2 border-t border-amber-700/30">
                                                    <span className="text-gray-300 text-sm">Net Provizyon</span>
                                                    <span className="text-white text-sm">€{selectedOrder.commission.netCommission.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-300 text-sm">KDV (%{selectedOrder.commission.vatRate})</span>
                                                    <span className="text-white text-sm">€{selectedOrder.commission.vatAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t border-amber-700/30">
                                                    <span className="text-white text-sm font-bold">Toplam Provizyon</span>
                                                    <span className="text-amber-400 font-bold">€{selectedOrder.commission.totalCommission.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-gray-300 text-sm">Ödeme</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${selectedOrder.commission.paymentMethod === 'card' || selectedOrder.commission.paymentMethod === 'stripe' ? 'bg-blue-600/30 text-blue-300' : 'bg-purple-600/30 text-purple-300'}`}>
                                                        {selectedOrder.commission.paymentMethod === 'card' || selectedOrder.commission.paymentMethod === 'stripe' ? '💳 Kart' : '💵 Nakit'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300 text-sm">Tahsilat</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusColors[selectedOrder.commission.collectionStatus]}`}>
                                                        {statusLabels[selectedOrder.commission.collectionStatus]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Order Note */}
                                    {selectedOrder.notes && (
                                        <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                            <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">📝 Sipariş Notu</h4>
                                            <p className="text-white text-sm">{selectedOrder.notes}</p>
                                        </div>
                                    )}

                                    {/* Close Button */}
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                                    >
                                        Kapat
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
