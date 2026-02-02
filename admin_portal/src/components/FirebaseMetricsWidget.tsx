'use client';

import { useState, useEffect } from 'react';
import { FirebaseMetrics } from '@/services/firebase_metrics';

interface MetricCardProps {
    title: string;
    value: number;
    limit?: number;
    percentage?: number;
    icon: string;
    unit?: string;
    subtitle?: string;
}

function MetricCard({ title, value, limit, percentage, icon, unit = '', subtitle }: MetricCardProps) {
    const getColorClass = (pct?: number) => {
        if (!pct) return 'bg-gray-700';
        if (pct >= 90) return 'bg-red-600';
        if (pct >= 70) return 'bg-yellow-600';
        return 'bg-green-600';
    };

    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs text-gray-400">{subtitle}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
            <div className="text-2xl font-bold text-white mb-2">
                {(value ?? 0).toLocaleString()} {unit}
                {limit && <span className="text-sm text-gray-500"> / {(limit ?? 0).toLocaleString()}</span>}
            </div>
            {percentage !== undefined && percentage !== null && (
                <div className="space-y-1">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${getColorClass(percentage)}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <p className={`text-xs ${percentage >= 90 ? 'text-red-400' : percentage >= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {(percentage ?? 0).toFixed(1)}% kullanıldı
                    </p>
                </div>
            )}
        </div>
    );
}

interface FirebaseMetricsWidgetProps {
    dateFilter?: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'lastYear' | 'all';
}

export default function FirebaseMetricsWidget({ dateFilter = 'month' }: FirebaseMetricsWidgetProps) {
    const [metrics, setMetrics] = useState<FirebaseMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Get date label for display
    const getDateLabel = () => {
        switch (dateFilter) {
            case 'today': return 'Bugün';
            case 'yesterday': return 'Dün';
            case 'week': return 'Son 7 Gün';
            case 'month': return 'Son 30 Gün';
            case 'year': return 'Bu Yıl';
            case 'lastYear': return 'Geçen Yıl';
            case 'all': return 'Tüm Zamanlar';
            default: return 'Son 30 Gün';
        }
    };

    const fetchMetrics = async () => {
        try {
            setError(null);
            setLoading(true);
            const response = await fetch(`/api/metrics?period=${dateFilter}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Metrikler yüklenemedi');
            }

            const data = await response.json();
            setMetrics(data);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Metrics fetch error:', err);
            setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch metrics on mount or when dateFilter changes
        fetchMetrics();

        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [dateFilter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
                <p className="text-red-400 mb-2">⚠️ Metrikler yüklenemedi</p>
                <p className="text-sm text-gray-400">{error}</p>
                <button
                    onClick={fetchMetrics}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm"
                >
                    Tekrar Dene
                </button>
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">📊 Firebase Kullanım Metrikleri</h2>
                    <p className="text-sm text-gray-400">
                        📅 {getDateLabel()} | {lastUpdate && `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}`}
                    </p>
                </div>
                <button
                    onClick={fetchMetrics}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300"
                >
                    🔄 Yenile
                </button>
            </div>

            {/* Firestore Metrics */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Firestore (Günlük Limitler)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Okuma (Reads)"
                        value={metrics.firestore.reads.today}
                        limit={metrics.firestore.reads.limit}
                        percentage={metrics.firestore.reads.percentage}
                        icon="📖"
                        subtitle={getDateLabel()}
                    />
                    <MetricCard
                        title="Yazma (Writes)"
                        value={metrics.firestore.writes.today}
                        limit={metrics.firestore.writes.limit}
                        percentage={metrics.firestore.writes.percentage}
                        icon="✍️"
                        subtitle={getDateLabel()}
                    />
                    <MetricCard
                        title="Silme (Deletes)"
                        value={metrics.firestore.deletes.today}
                        limit={metrics.firestore.deletes.limit}
                        percentage={metrics.firestore.deletes.percentage}
                        icon="🗑️"
                        subtitle={getDateLabel()}
                    />
                    <MetricCard
                        title="Depolama"
                        value={metrics.firestore.storage.current}
                        limit={metrics.firestore.storage.limit}
                        percentage={metrics.firestore.storage.percentage}
                        icon="💾"
                        unit="GB"
                    />
                </div>
            </div>

            {/* User-Level Breakdown */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">👥 Kullanıcı Bazında Data Kullanımı (Tahmini)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        title="Super Admin Kullanımı"
                        value={metrics.usage.superAdmins.estimatedReads}
                        percentage={metrics.usage.superAdmins.percentage}
                        icon="👑"
                        subtitle="Master Catalog erişimi"
                    />
                    <MetricCard
                        title="İşletme Admin Kullanımı"
                        value={metrics.usage.businessAdmins.estimatedReads}
                        percentage={metrics.usage.businessAdmins.percentage}
                        icon="🏪"
                        subtitle="İşletme yönetimi"
                    />
                    <MetricCard
                        title="Son Kullanıcı Kullanımı"
                        value={metrics.usage.endUsers.estimatedReads}
                        percentage={metrics.usage.endUsers.percentage}
                        icon="👤"
                        subtitle="Mobil app kullanımı"
                    />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    ℹ️ Kullanıcı seviyesi metrikleri tahminidir (Super Admin: %60, İşletme Admin: %25, Son Kullanıcılar: %15)
                </p>
            </div>

            {/* Functions & Storage */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Diğer Servisler</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Functions Çağrısı"
                        value={metrics.functions.invocations.monthly}
                        icon="⚡"
                        subtitle={getDateLabel()}
                    />
                    <MetricCard
                        title="Functions Hataları"
                        value={metrics.functions.errors.count}
                        percentage={metrics.functions.errors.percentage}
                        icon="❌"
                        subtitle={`%${(metrics.functions.errors.percentage ?? 0).toFixed(1)} hata oranı`}
                    />
                    <MetricCard
                        title="Storage Bant Genişliği"
                        value={metrics.storage.bandwidth.monthly}
                        limit={metrics.storage.bandwidth.limit}
                        percentage={metrics.storage.bandwidth.percentage}
                        icon="📡"
                        unit="GB"
                        subtitle={getDateLabel()}
                    />
                    <MetricCard
                        title="Storage Boyutu"
                        value={metrics.storage.totalSize.current}
                        icon="📦"
                        unit="GB"
                    />
                </div>
            </div>

            {/* Info banner */}
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                    💡 <strong>Bilgi:</strong> Günlük limitler Pacific Time saat 00:00'da sıfırlanır.
                    Blaze plan ile limitler aşıldığında otomatik ücretlendirme yapılır.
                </p>
            </div>
        </div>
    );
}
