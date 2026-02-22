'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface DeliveryPauseLog {
    id: string;
    action: 'paused' | 'resumed';
    timestamp: Date;
    adminEmail: string;
    adminId: string;
}

interface OrderStats {
    totalOrders: number;
    completedOrders: number;
    avgPreparationTime: number; // minutes
    avgDeliveryTime: number; // minutes
}

interface BusinessInfo {
    id: string;
    companyName: string;
    brand: string;
    temporaryDeliveryPaused: boolean;
}

export default function BusinessPerformancePage() {
    
  const t = useTranslations('AdminBusiness[idPerformance');
const params = useParams();
    const businessId = params.id as string;

    const [business, setBusiness] = useState<BusinessInfo | null>(null);
    const [pauseLogs, setPauseLogs] = useState<DeliveryPauseLog[]>([]);
    const [orderStats, setOrderStats] = useState<OrderStats>({
        totalOrders: 0,
        completedOrders: 0,
        avgPreparationTime: 0,
        avgDeliveryTime: 0,
    });
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

    // Load business info
    useEffect(() => {
        const loadBusiness = async () => {
            try {
                const docRef = doc(db, 'businesses', businessId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setBusiness({
                        id: docSnap.id,
                        companyName: docSnap.data().companyName || t('i_sletme'),
                        brand: docSnap.data().brand || '',
                        temporaryDeliveryPaused: docSnap.data().temporaryDeliveryPaused || false,
                    });
                }
            } catch (error) {
                console.error('Error loading business:', error);
            }
        };
        loadBusiness();
    }, [businessId]);

    // Load delivery pause logs
    useEffect(() => {
        const logsRef = collection(db, 'businesses', businessId, 'deliveryPauseLogs');
        const q = query(logsRef, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
            })) as DeliveryPauseLog[];

            setPauseLogs(logsData);
            setLoading(false);
        }, (error) => {
            console.error('Error loading pause logs:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    // Load order stats
    useEffect(() => {
        const loadOrderStats = async () => {
            try {
                const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - daysAgo);

                const ordersRef = collection(db, 'meat_orders');
                const q = query(
                    ordersRef,
                    where('businessId', '==', businessId),
                    limit(500)
                );

                const snapshot = await getDocs(q);
                const orders = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    status: doc.data().status || '',
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                    updatedAt: doc.data().updatedAt?.toDate() || null,
                    completedAt: doc.data().completedAt?.toDate() || null,
                }));

                // Filter by date
                const filteredOrders = orders.filter(o => o.createdAt >= startDate);

                // Calculate stats
                const completed = filteredOrders.filter(o => o.status === 'completed');

                // Average preparation time (pending → ready)
                let totalPrepTime = 0;
                let prepCount = 0;

                // 🆕 Average fulfillment time (order → delivered/completed)
                let totalFulfillmentTime = 0;
                let fulfillmentCount = 0;

                completed.forEach(o => {
                    if (o.updatedAt && o.createdAt) {
                        const diffMs = o.updatedAt.getTime() - o.createdAt.getTime();
                        const diffMins = diffMs / (1000 * 60);
                        if (diffMins > 0 && diffMins < 180) { // Reasonable range
                            totalPrepTime += diffMins;
                            prepCount++;
                        }
                    }

                    // 🆕 Calculate fulfillment time (sipariş girişi → teslim)
                    const endTime = o.completedAt || o.updatedAt;
                    if (endTime && o.createdAt) {
                        const diffMs = endTime.getTime() - o.createdAt.getTime();
                        const diffMins = diffMs / (1000 * 60);
                        if (diffMins > 0 && diffMins < 180) {
                            totalFulfillmentTime += diffMins;
                            fulfillmentCount++;
                        }
                    }
                });

                setOrderStats({
                    totalOrders: filteredOrders.length,
                    completedOrders: completed.length,
                    avgPreparationTime: prepCount > 0 ? Math.round(totalPrepTime / prepCount) : 0,
                    avgDeliveryTime: fulfillmentCount > 0 ? Math.round(totalFulfillmentTime / fulfillmentCount) : 0,
                });
            } catch (error) {
                console.error('Error loading order stats:', error);
            }
        };
        loadOrderStats();
    }, [businessId, dateRange]);

    // Calculate pause statistics
    const pauseStats = useMemo(() => {
        const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);

        const filteredLogs = pauseLogs.filter(log => log.timestamp >= startDate);
        const pauseCount = filteredLogs.filter(log => log.action === 'paused').length;
        const resumeCount = filteredLogs.filter(log => log.action === 'resumed').length;

        // Calculate total paused duration
        let totalPausedMs = 0;
        let pauseStart: Date | null = null;

        // Process logs in chronological order
        const chronoLogs = [...filteredLogs].reverse();
        chronoLogs.forEach(log => {
            if (log.action === 'paused') {
                pauseStart = log.timestamp;
            } else if (log.action === 'resumed' && pauseStart) {
                totalPausedMs += log.timestamp.getTime() - pauseStart.getTime();
                pauseStart = null;
            }
        });

        // If still paused, add time until now
        if (pauseStart !== null) {
            totalPausedMs += Date.now() - (pauseStart as Date).getTime();
        }

        const totalPausedHours = Math.round(totalPausedMs / (1000 * 60 * 60));

        return {
            pauseCount,
            resumeCount,
            totalPausedHours,
        };
    }, [pauseLogs, dateRange]);

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-purple-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Link href={`/admin/business/${businessId}`} className="text-purple-200 hover:text-white text-sm">{t('i_sletmeye_don')}</Link>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <span className="text-2xl">📊</span>
                        </div>
                        <div>
                            <h1 className="font-bold">{business?.companyName || t('i_sletme')} - Performans</h1>
                            <p className="text-xs text-purple-200">
                                {business?.brand === 'tuna' && <span className="bg-purple-600 px-2 py-0.5 rounded text-xs mr-2">TUNA</span>}
                                {t('kurye_siparis_i_statistikleri')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Date Range Filter */}
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
                            className="bg-purple-600 text-white rounded-lg px-3 py-2 text-sm border-none"
                        >
                            <option value="7d">{t('son_7_gun')}</option>
                            <option value="30d">{t('son_30_gun')}</option>
                            <option value="90d">{t('son_90_gun')}</option>
                        </select>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Current Status Banner */}
                {business?.temporaryDeliveryPaused && (
                    <div className="bg-amber-600 text-white rounded-lg p-4 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⏸️</span>
                            <div>
                                <p className="font-bold">{t('kurye_hizmeti_su_an_durdurulmus')}</p>
                                <p className="text-sm text-amber-200">{t('admin_portal_dan_aktiflestirilebilir')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {/* Sipariş Sayısı */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-3xl font-bold text-white">{orderStats.totalOrders}</div>
                        <div className="text-sm text-gray-400">{t('toplam_siparis')}</div>
                    </div>
                    {/* Tamamlanan */}
                    <div className="bg-green-600/20 rounded-lg p-4 border-l-4 border-green-500">
                        <div className="text-3xl font-bold text-green-400">{orderStats.completedOrders}</div>
                        <div className="text-sm text-green-300">Tamamlanan</div>
                    </div>
                    {/* Ortalama Hazırlama */}
                    <div className="bg-blue-600/20 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="text-3xl font-bold text-blue-400">{orderStats.avgPreparationTime}<span className="text-lg">dk</span></div>
                        <div className="text-sm text-blue-300">{t('ort_hazirlama')}</div>
                    </div>
                    {/* 🆕 Ortalama Teslim Süresi */}
                    <div className="bg-purple-600/20 rounded-lg p-4 border-l-4 border-purple-500">
                        <div className="text-3xl font-bold text-purple-400">{orderStats.avgDeliveryTime}<span className="text-lg">dk</span></div>
                        <div className="text-sm text-purple-300">Ort. Teslim</div>
                    </div>
                    {/* Kurye Duraklama */}
                    <div className="bg-amber-600/20 rounded-lg p-4 border-l-4 border-amber-500">
                        <div className="text-3xl font-bold text-amber-400">{pauseStats.pauseCount}</div>
                        <div className="text-sm text-amber-300">{t('kurye_durdurma')}</div>
                    </div>
                </div>

                {/* Pause Statistics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">⏸️</span>
                            <span className="text-gray-400">{t('durdurma_sayisi')}</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-400">{pauseStats.pauseCount}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">▶️</span>
                            <span className="text-gray-400">Devam Ettirme</span>
                        </div>
                        <div className="text-2xl font-bold text-green-400">{pauseStats.resumeCount}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">⏱️</span>
                            <span className="text-gray-400">{t('toplam_durdurma_suresi')}</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-400">{pauseStats.totalPausedHours} <span className="text-lg">{t('saat')}</span></div>
                    </div>
                </div>

                {/* Delivery Pause Logs */}
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gray-750 border-b border-gray-700">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span>🛵</span> {t('kurye_acma_kapama_gecmisi')}
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-750">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{t('tarih')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{t('i_slem')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Admin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {pauseLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                                            {t('henuz_kurye_acma_kapama_kaydi_yok')}
                                        </td>
                                    </tr>
                                ) : (
                                    pauseLogs.map((log) => (
                                        <tr key={log.id} className={log.action === 'paused' ? 'bg-amber-900/20' : 'bg-green-900/20'}>
                                            <td className="px-4 py-3 text-sm text-gray-300">
                                                {formatDate(log.timestamp)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.action === 'paused' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-600 text-white text-xs font-medium">
                                                        ⏸️ Durduruldu
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-600 text-white text-xs font-medium">
                                                        ▶️ Devam Etti
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-300">
                                                {log.adminEmail}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
