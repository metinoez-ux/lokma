'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp, limit } from 'firebase/firestore';
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
            snapshot.forEach((doc) => {
                const data = doc.data();
                list.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                } as CommissionRecord);
            });
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
                        <h1 className="text-2xl font-bold text-white">💰 Komisyon Raporu</h1>
                        <p className="text-gray-400 text-sm">İşletme bazlı komisyon takibi ve raporlama</p>
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
                    <div className="bg-orange-600/20 border border-orange-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-orange-400">€{stats.totalCommission.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Toplam Komisyon</p>
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
                        <p className="text-gray-400 text-xs">Kart Komisyon</p>
                    </div>
                    <div className="bg-purple-600/20 border border-purple-600/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-400">€{stats.cashCommission.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">Nakit Komisyon</p>
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
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Komisyon</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Kart</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Nakit</th>
                                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Bekleyen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {businessSummaries.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                            Bu dönemde komisyon kaydı bulunmuyor
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
                                            </td>
                                            <td className="px-4 py-3 text-right text-white">{bs.totalOrders}</td>
                                            <td className="px-4 py-3 text-right text-white">€{bs.totalOrderAmount.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-orange-400 font-bold">€{bs.totalCommission.toFixed(2)}</span>
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
                                        <td className="px-4 py-3 text-right text-orange-400 font-bold">€{stats.totalCommission.toFixed(2)}</td>
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
                                    <th className="px-3 py-3 text-right text-gray-300 text-xs">Komisyon</th>
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
                                            Komisyon kaydı bulunmuyor
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-700/50 text-sm">
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
                                                <span className="text-orange-400 font-bold">€{r.totalCommission.toFixed(2)}</span>
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
            </div>
        </div>
    );
}
