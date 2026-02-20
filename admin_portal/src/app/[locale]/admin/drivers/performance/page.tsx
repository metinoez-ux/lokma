'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DeliveryRecord {
    id: string;
    orderNumber?: string;
    courierId: string;
    courierName: string;
    deliveredAt: Date;
    totalAmount: number;
    paymentMethod: string;
    deliveryProof?: {
        type: string;
        distanceKm?: number;
        gps?: {
            latitude: number;
            longitude: number;
            isApproximate?: boolean;
        };
    };
}

interface DriverStats {
    courierId: string;
    courierName: string;
    deliveryCount: number;
    totalKm: number;
    cashTotal: number;
    cardTotal: number;
    lastDeliveryAt?: Date;
}

export default function DriverPerformancePage() {
    const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    // Calculate date range based on view mode
    const dateRange = useMemo(() => {
        const selected = new Date(selectedDate);
        const start = new Date(selected);
        const end = new Date(selected);

        if (viewMode === 'daily') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (viewMode === 'weekly') {
            // Start of week (Monday)
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else {
            // Monthly
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    }, [selectedDate, viewMode]);

    const [error, setError] = useState<string | null>(null);

    // Fetch completed deliveries
    useEffect(() => {
        setError(null);
        const q = query(
            collection(db, 'meat_orders'),
            where('status', '==', 'delivered'),
            where('deliveredAt', '>=', Timestamp.fromDate(dateRange.start)),
            where('deliveredAt', '<=', Timestamp.fromDate(dateRange.end)),
            orderBy('deliveredAt', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const records: DeliveryRecord[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.courierId) {
                    records.push({
                        id: doc.id,
                        orderNumber: data.orderNumber,
                        courierId: data.courierId,
                        courierName: data.courierName || 'Bilinmiyor',
                        deliveredAt: data.deliveredAt?.toDate() || new Date(),
                        totalAmount: data.totalAmount || 0,
                        paymentMethod: data.paymentMethod || '',
                        deliveryProof: data.deliveryProof,
                    });
                }
            });
            setDeliveries(records);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching deliveries:', err);
            setError('Teslimat verileri yüklenemedi. Lütfen sayfayı yenileyin.');
            setLoading(false);
        });

        return () => unsub();
    }, [dateRange]);

    // Aggregate stats by driver
    const driverStats = useMemo<DriverStats[]>(() => {
        const statsMap = new Map<string, DriverStats>();

        deliveries.forEach((d) => {
            const existing = statsMap.get(d.courierId);
            const isCash = d.paymentMethod === 'cash' || d.paymentMethod === 'nakit';
            const distanceKm = d.deliveryProof?.distanceKm || 0;

            if (existing) {
                existing.deliveryCount++;
                existing.totalKm += distanceKm;
                if (isCash) {
                    existing.cashTotal += d.totalAmount;
                } else {
                    existing.cardTotal += d.totalAmount;
                }
                if (!existing.lastDeliveryAt || d.deliveredAt > existing.lastDeliveryAt) {
                    existing.lastDeliveryAt = d.deliveredAt;
                }
            } else {
                statsMap.set(d.courierId, {
                    courierId: d.courierId,
                    courierName: d.courierName,
                    deliveryCount: 1,
                    totalKm: distanceKm,
                    cashTotal: isCash ? d.totalAmount : 0,
                    cardTotal: isCash ? 0 : d.totalAmount,
                    lastDeliveryAt: d.deliveredAt,
                });
            }
        });

        return Array.from(statsMap.values()).sort(
            (a, b) => b.deliveryCount - a.deliveryCount
        );
    }, [deliveries]);

    // Totals
    const totals = useMemo(() => {
        return driverStats.reduce(
            (acc, d) => ({
                deliveries: acc.deliveries + d.deliveryCount,
                km: acc.km + d.totalKm,
                cash: acc.cash + d.cashTotal,
                card: acc.card + d.cardTotal,
            }),
            { deliveries: 0, km: 0, cash: 0, card: 0 }
        );
    }, [driverStats]);

    const formatDate = (date: Date) =>
        date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">
                        Sürücü Performans Raporu
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Teslimat sayısı, km, nakit ve kart tahsilatları
                    </p>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center border border-gray-700">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Tarih
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Görünüm
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-gray-600">
                            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-4 py-2 text-sm font-medium ${viewMode === mode
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {mode === 'daily' && 'Günlük'}
                                    {mode === 'weekly' && 'Haftalık'}
                                    {mode === 'monthly' && 'Aylık'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
                        <span className="text-red-400 text-xl">⚠️</span>
                        <p className="text-red-300 text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                        <div className="text-sm text-gray-400">Toplam Teslimat</div>
                        <div className="text-2xl font-bold text-white">
                            {totals.deliveries}
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                        <div className="text-sm text-gray-400">Toplam KM</div>
                        <div className="text-2xl font-bold text-blue-600">
                            🛣️ {totals.km.toFixed(1)} km
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                        <div className="text-sm text-gray-400">Nakit Tahsilat</div>
                        <div className="text-2xl font-bold text-green-600">
                            💰 {totals.cash.toFixed(2)}€
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                        <div className="text-sm text-gray-400">Kart Tahsilat</div>
                        <div className="text-2xl font-bold text-purple-600">
                            💳 {totals.card.toFixed(2)}€
                        </div>
                    </div>
                </div>

                {/* Driver Stats Table */}
                <div className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
                    <table className="min-w-full">
                        <thead className="bg-gray-700/50 border-b border-gray-600">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                                    Sürücü
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">
                                    Teslimat
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">
                                    KM
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                                    Nakit
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                                    Kart
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                                    Son Teslimat
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : driverStats.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                        Bu dönemde teslimat bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                driverStats.map((driver) => (
                                    <tr key={driver.courierId} className="hover:bg-gray-700/50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-white">
                                                {driver.courierName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                                                {driver.deliveryCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-blue-600 font-medium">
                                            {driver.totalKm > 0 ? `${driver.totalKm.toFixed(1)} km` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-green-600 font-medium">
                                            {driver.cashTotal > 0
                                                ? `${driver.cashTotal.toFixed(2)}€`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-purple-600 font-medium">
                                            {driver.cardTotal > 0
                                                ? `${driver.cardTotal.toFixed(2)}€`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 text-sm">
                                            {driver.lastDeliveryAt
                                                ? formatDate(driver.lastDeliveryAt)
                                                : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Privacy Notice */}
                <div className="mt-4 text-center text-xs text-gray-400">
                    🔒 Gizlilik: Müşteri adres ve telefon bilgileri bu raporda gösterilmez
                </div>
            </div>
        </div>
    );
}
