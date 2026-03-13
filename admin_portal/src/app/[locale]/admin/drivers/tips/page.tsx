'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface DriverTipData {
    driverId: string;
    driverName: string;
    driverEmail: string;
    totalTips: number;
    tippedDeliveries: number;
    totalDeliveries: number;
    avgTip: number;
    bankRegistered: boolean;
    payoutFrequency: string;
    legalDeclarationStatus: string;
}

interface TipEntry {
    orderId: string;
    deliveredAt: Date;
    city: string;
    orderTotal: number;
    tipAmount: number;
    driverName: string;
    driverId: string;
    paymentMethod: string;
    customerName: string;
}

export default function DriverTipsOverviewPage() {
    const t = useTranslations('AdminDriversTips');
    const { admin } = useAdmin();
    const isSuperAdminUser = admin?.adminType === 'super';
    const [loading, setLoading] = useState(true);
    const [drivers, setDrivers] = useState<DriverTipData[]>([]);
    const [tipEntries, setTipEntries] = useState<TipEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [periodFilter, setPeriodFilter] = useState<'week' | 'month' | 'all'>('month');
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');

    // Calculate date range based on period filter
    const getDateRange = () => {
        const now = new Date();
        if (periodFilter === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return weekAgo;
        } else if (periodFilter === 'month') {
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            return monthAgo;
        }
        return new Date(2020, 0, 1); // "all time"
    };

    // Load driver data and tip entries
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Load all drivers (admins with isDriver=true or role=driver)
                const adminsSnap = await getDocs(collection(db, 'admins'));
                const driverDocs = adminsSnap.docs.filter(d => {
                    const data = d.data();
                    return data.isDriver === true || data.role === 'driver';
                });

                // 2. Load completed orders with tips
                const dateFrom = getDateRange();
                const ordersQuery = query(
                    collection(db, 'orders'),
                    where('status', '==', 'delivered'),
                    where('deliveredAt', '>=', Timestamp.fromDate(dateFrom)),
                    orderBy('deliveredAt', 'desc')
                );

                let ordersSnap;
                try {
                    ordersSnap = await getDocs(ordersQuery);
                } catch {
                    // Fallback: if composite index missing, load all delivered orders
                    const fallbackQuery = query(
                        collection(db, 'orders'),
                        where('status', '==', 'delivered')
                    );
                    ordersSnap = await getDocs(fallbackQuery);
                }

                // Build a map of driverId -> driver info
                const driverMap = new Map<string, { name: string; email: string; bankAccount: any; payoutPreferences: any; legalDeclaration: any }>();
                driverDocs.forEach(d => {
                    const data = d.data();
                    driverMap.set(d.id, {
                        name: data.name || data.displayName || t('unnamed'),
                        email: data.email || '',
                        bankAccount: data.bankAccount || null,
                        payoutPreferences: data.payoutPreferences || null,
                        legalDeclaration: data.legalDeclaration || null,
                    });
                });

                // Build tip entries from orders
                const entries: TipEntry[] = [];
                const driverStats = new Map<string, { totalTips: number; tippedCount: number; totalCount: number }>();

                ordersSnap.docs.forEach(orderDoc => {
                    const data = orderDoc.data();
                    const courierId = data.courierId;
                    if (!courierId) return;

                    const tipAmount = data.tipAmount || 0;
                    const deliveredAt = data.deliveredAt?.toDate?.() || new Date();

                    // Only include if within date range (for fallback query)
                    if (deliveredAt < dateFrom) return;

                    // Extract city from address (GDPR safe — no street/customer data)
                    const address = data.deliveryAddress || data.address || {};
                    const city = address.city || address.stadt || '';

                    entries.push({
                        orderId: orderDoc.id,
                        deliveredAt,
                        city,
                        orderTotal: data.grandTotal || data.total || 0,
                        tipAmount,
                        driverName: driverMap.get(courierId)?.name || t('unknown_driver'),
                        driverId: courierId,
                        paymentMethod: data.paymentMethod || 'card',
                        customerName: data.customerName || data.userName || '',
                    });

                    // Aggregate stats per driver
                    const existing = driverStats.get(courierId) || { totalTips: 0, tippedCount: 0, totalCount: 0 };
                    existing.totalTips += tipAmount;
                    existing.totalCount += 1;
                    if (tipAmount > 0) existing.tippedCount += 1;
                    driverStats.set(courierId, existing);
                });

                // Build driver tip data
                const driverTipList: DriverTipData[] = [];
                driverMap.forEach((info, driverId) => {
                    const stats = driverStats.get(driverId) || { totalTips: 0, tippedCount: 0, totalCount: 0 };
                    driverTipList.push({
                        driverId,
                        driverName: info.name,
                        driverEmail: info.email,
                        totalTips: stats.totalTips,
                        tippedDeliveries: stats.tippedCount,
                        totalDeliveries: stats.totalCount,
                        avgTip: stats.tippedCount > 0 ? stats.totalTips / stats.tippedCount : 0,
                        bankRegistered: !!info.bankAccount?.iban,
                        payoutFrequency: info.payoutPreferences?.frequency || t('frequency_not_set'),
                        legalDeclarationStatus: info.legalDeclaration?.accepted ? t('legal_accepted') : t('legal_pending'),
                    });
                });

                // Sort by totalTips descending
                driverTipList.sort((a, b) => b.totalTips - a.totalTips);

                setDrivers(driverTipList);
                setTipEntries(entries);
            } catch (error) {
                console.error('Error loading tip data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [periodFilter]);

    // Filtered drivers
    const filteredDrivers = useMemo(() => {
        if (!searchQuery) return drivers;
        const q = searchQuery.toLowerCase();
        return drivers.filter(d =>
            d.driverName.toLowerCase().includes(q) ||
            d.driverEmail.toLowerCase().includes(q)
        );
    }, [drivers, searchQuery]);

    // Filtered tip entries (selected driver or all)
    const filteredEntries = useMemo(() => {
        let list = tipEntries;
        if (selectedDriverId) {
            list = list.filter(e => e.driverId === selectedDriverId);
        }
        return list.sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime());
    }, [tipEntries, selectedDriverId]);

    // Summary stats
    const summary = useMemo(() => {
        const totalTips = drivers.reduce((acc, d) => acc + d.totalTips, 0);
        const totalDeliveries = drivers.reduce((acc, d) => acc + d.totalDeliveries, 0);
        const tippedDeliveries = drivers.reduce((acc, d) => acc + d.tippedDeliveries, 0);
        const bankRegistered = drivers.filter(d => d.bankRegistered).length;
        const pendingLegal = drivers.filter(d => d.legalDeclarationStatus.includes('❌')).length;
        return { totalTips, totalDeliveries, tippedDeliveries, bankRegistered, pendingLegal };
    }, [drivers]);

    const formatCurrency = (amount: number) => `${amount.toFixed(2)} €`;
    const formatDate = (date: Date) => date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formatTime = (date: Date) => date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            💰 {t('title')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/admin/drivers"
                            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 text-sm"
                        >
                            {t('back_to_drivers')}
                        </Link>
                        <Link
                            href="/admin/drivers/performance"
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                        >
                            {t('performance')}
                        </Link>
                    </div>
                </div>

                {/* Period Filter */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: 'week', label: t('period_week') },
                        { key: 'month', label: t('period_month') },
                        { key: 'all', label: t('period_all') },
                    ].map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriodFilter(p.key as 'week' | 'month' | 'all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                periodFilter === p.key
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-4 border-l-4 border-amber-500">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(summary.totalTips)}</div>
                        <div className="text-sm text-amber-700 dark:text-amber-300">{t('total_tips')}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.totalDeliveries}</div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">{t('deliveries')}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border-l-4 border-green-500">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.tippedDeliveries}</div>
                        <div className="text-sm text-green-700 dark:text-green-300">{t('tipped')}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border-l-4 border-purple-500">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary.bankRegistered}/{drivers.length}</div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">{t('bank_registered')}</div>
                    </div>
                    <div className={`rounded-lg p-4 border-l-4 ${summary.pendingLegal > 0 ? 'bg-red-50 dark:bg-red-900/30 border-red-500' : 'bg-green-50 dark:bg-green-900/30 border-green-500'}`}>
                        <div className={`text-2xl font-bold ${summary.pendingLegal > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{summary.pendingLegal}</div>
                        <div className={`text-sm ${summary.pendingLegal > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{t('pending_legal')}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-gray-200 dark:bg-gray-800 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => { setActiveTab('overview'); setSelectedDriverId(null); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'overview' ? 'bg-amber-500 text-black' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        {t('tab_drivers')}
                    </button>
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'details' ? 'bg-amber-500 text-black' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        {t('tab_details')}
                    </button>
                </div>

                {/* Search */}
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                {/* ---- TAB: OVERVIEW (Driver Summary Table) ---- */}
                {activeTab === 'overview' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                                        <th className="px-4 py-3 font-medium">{t('th_driver')}</th>
                                        <th className="px-4 py-3 font-medium text-right">{t('th_total_tips')}</th>
                                        <th className="px-4 py-3 font-medium text-center">{t('th_deliveries')}</th>
                                        <th className="px-4 py-3 font-medium text-center">{t('th_tipped')}</th>
                                        <th className="px-4 py-3 font-medium text-right">{t('th_avg_tip')}</th>
                                        <th className="px-4 py-3 font-medium text-center">{t('th_bank')}</th>
                                        <th className="px-4 py-3 font-medium text-center">{t('th_payout')}</th>
                                        <th className="px-4 py-3 font-medium text-center">{t('th_declaration')}</th>
                                        <th className="px-4 py-3 font-medium text-center">{t('th_action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDrivers.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                                {searchQuery ? t('no_search_results') : t('no_driver_data')}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDrivers.map(driver => (
                                            <tr key={driver.driverId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900 dark:text-white">{driver.driverName}</div>
                                                    <div className="text-xs text-gray-400 dark:text-gray-500">{driver.driverEmail}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-amber-400">
                                                    {formatCurrency(driver.totalTips)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{driver.totalDeliveries}</td>
                                                <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{driver.tippedDeliveries}</td>
                                                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(driver.avgTip)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block w-2 h-2 rounded-full ${driver.bankRegistered ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                        driver.payoutFrequency === 'weekly' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                                                        driver.payoutFrequency === 'monthly' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' :
                                                        driver.payoutFrequency === 'manual' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                                                        'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                                                    }`}>
                                                        {driver.payoutFrequency === 'weekly' ? t('frequency_weekly') :
                                                         driver.payoutFrequency === 'monthly' ? t('frequency_monthly') :
                                                         driver.payoutFrequency === 'manual' ? t('frequency_manual') : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm">
                                                    {driver.legalDeclarationStatus}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => { setSelectedDriverId(driver.driverId); setActiveTab('details'); }}
                                                        className="text-amber-400 hover:text-amber-300 text-xs font-medium"
                                                    >
                                                        {t('detail_btn')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ---- TAB: DETAILS (Individual Tip Entries) ---- */}
                {activeTab === 'details' && (
                    <div>
                        {/* Driver filter chips */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={() => setSelectedDriverId(null)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                    !selectedDriverId ? 'bg-amber-500 text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                {t('all_drivers')}
                            </button>
                            {drivers.filter(d => d.totalDeliveries > 0).map(d => (
                                <button
                                    key={d.driverId}
                                    onClick={() => setSelectedDriverId(d.driverId)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                        selectedDriverId === d.driverId ? 'bg-amber-500 text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {d.driverName} ({formatCurrency(d.totalTips)})
                                </button>
                            ))}
                        </div>

                        {/* GDPR Notice — only for non-super admins */}
                        {!isSuperAdminUser && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                            <span className="text-blue-500 dark:text-blue-400">🛡️</span>
                            <span className="text-blue-700 dark:text-blue-300 text-xs">
                                {t('gdpr_notice')}
                            </span>
                        </div>
                        )}
                        {isSuperAdminUser && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                            <span className="text-green-500 dark:text-green-400">🔓</span>
                            <span className="text-green-700 dark:text-green-300 text-xs">
                                Super Admin: Volle Transparenz aktiv — Kundennamen, Bestell-IDs und alle Details sind sichtbar.
                            </span>
                        </div>
                        )}

                        {/* Tip entries table */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                                            <th className="px-4 py-3 font-medium">{t('th_date')}</th>
                                            <th className="px-4 py-3 font-medium">{t('th_time')}</th>
                                            <th className="px-4 py-3 font-medium">{t('th_driver')}</th>
                                            {isSuperAdminUser && <th className="px-4 py-3 font-medium">Kunde</th>}
                                            {isSuperAdminUser && <th className="px-4 py-3 font-medium">Bestell-ID</th>}
                                            <th className="px-4 py-3 font-medium">{t('th_city')}</th>
                                            <th className="px-4 py-3 font-medium text-right">{t('th_order_total')}</th>
                                            <th className="px-4 py-3 font-medium text-center">{t('th_payment')}</th>
                                            <th className="px-4 py-3 font-medium text-right">{t('th_tip')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEntries.length === 0 ? (
                                            <tr>
                                                <td colSpan={isSuperAdminUser ? 9 : 7} className="px-4 py-8 text-center text-gray-500">
                                                    {t('no_entries')}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredEntries.slice(0, 200).map(entry => (
                                                <tr key={entry.orderId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(entry.deliveredAt)}</td>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatTime(entry.deliveredAt)}</td>
                                                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{entry.driverName}</td>
                                                    {isSuperAdminUser && <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-medium">{entry.customerName || '—'}</td>}
                                                    {isSuperAdminUser && <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{entry.orderId.substring(0, 12)}...</td>}
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{entry.city || '—'}</td>
                                                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(entry.orderTotal)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-sm">{entry.paymentMethod === 'cash' ? '💵' : '💳'}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {entry.tipAmount > 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-xs">
                                                                +{formatCurrency(entry.tipAmount)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                {filteredEntries.length > 200 && (
                                    <div className="px-4 py-3 text-center text-gray-500 text-sm border-t border-gray-200 dark:border-gray-700">
                                        {t('showing_first', { count: filteredEntries.length })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
