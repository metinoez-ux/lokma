'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';

// Report statuses
const reportStatuses = {
    new: { label: 'Neu', color: 'yellow', icon: '🆕' },
    in_review: { label: 'In Bearbeitung', color: 'blue', icon: '🔍' },
    resolved: { label: 'Erledigt', color: 'green', icon: '✅' },
    dismissed: { label: 'Abgelehnt', color: 'gray', icon: '❌' },
} as const;

type ReportStatus = keyof typeof reportStatuses;

// Topic labels
const topicLabels: Record<string, string> = {
    food_safety: '🍽️ Lebensmittelsicherheit',
    description: '📝 Beschreibung',
    images: '🖼️ Bilder',
    allergens: '⚠️ Allergene',
    forbidden: '🚫 Verbotene Inhaltsstoffe',
    other: '📋 Sonstiges',
};

interface LegalReport {
    id: string;
    status: ReportStatus;
    businessId: string;
    businessName: string;
    productId?: string;
    productName?: string;
    category?: string;
    topic: string;
    reason: string;
    description: string;
    reporterName: string;
    reporterEmail: string;
    reporterUserId?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    adminNotes?: string;
}

export default function ReportsPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [reports, setReports] = useState<LegalReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedReport, setSelectedReport] = useState<LegalReport | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [adminNotes, setAdminNotes] = useState('');

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Real-time subscription to legal_reports
    useEffect(() => {
        if (adminLoading || !admin) return;

        setLoading(true);

        let q;
        if (admin.adminType === 'super') {
            // Super admins see all reports
            q = query(
                collection(db, 'legal_reports'),
                orderBy('createdAt', 'desc')
            );
        } else {
            // Business admins see only their business reports
            const businessId = (admin as any).butcherId
                || (admin as any).restaurantId
                || (admin as any).marketId
                || (admin as any).businessId;
            if (!businessId) {
                setLoading(false);
                return;
            }
            q = query(
                collection(db, 'legal_reports'),
                where('businessId', '==', businessId),
                orderBy('createdAt', 'desc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            })) as LegalReport[];
            setReports(data);
            setLoading(false);
        }, (error) => {
            console.error('Error loading reports:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [admin, adminLoading]);

    // Filter reports
    const filteredReports = reports.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        return true;
    });

    // Stats
    const stats = {
        total: reports.length,
        new: reports.filter(r => r.status === 'new').length,
        inReview: reports.filter(r => r.status === 'in_review').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
    };

    // Update report status
    const handleStatusChange = async (reportId: string, newStatus: ReportStatus) => {
        try {
            const updateData: Record<string, any> = {
                status: newStatus,
                updatedAt: new Date(),
            };
            if (adminNotes.trim()) {
                updateData.adminNotes = adminNotes.trim();
            }
            await updateDoc(doc(db, 'legal_reports', reportId), updateData);
            showToast('Status aktualisiert', 'success');
            setSelectedReport(null);
            setAdminNotes('');
        } catch (error) {
            console.error('Error updating report:', error);
            showToast('Fehler beim Aktualisieren', 'error');
        }
    };

    // Format date
    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        return date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            🚩 Meldungen — Rechtliche Bedenken
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Eingegangene Beschwerden und Meldungen von Nutzern
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex gap-2 shrink-0">
                        <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-yellow-400">{stats.new}</p>
                            <p className="text-[10px] text-yellow-300">Neu</p>
                        </div>
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-blue-400">{stats.inReview}</p>
                            <p className="text-[10px] text-blue-300">In Bearbeitung</p>
                        </div>
                        <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-green-400">{stats.resolved}</p>
                            <p className="text-[10px] text-green-300">Erledigt</p>
                        </div>
                        <div className="bg-gray-600/20 border border-gray-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-gray-400">{stats.total}</p>
                            <p className="text-[10px] text-gray-300">Gesamt</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 mb-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                    >
                        <option value="all">Alle Status</option>
                        {Object.entries(reportStatuses).map(([key, value]) => (
                            <option key={key} value={key}>{value.icon} {value.label}</option>
                        ))}
                    </select>
                </div>

                {/* Reports List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="text-center py-20 bg-gray-800 rounded-xl">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-gray-400">Keine Meldungen gefunden</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredReports.map((report) => {
                            const statusInfo = reportStatuses[report.status] || reportStatuses.new;
                            return (
                                <div
                                    key={report.id}
                                    onClick={() => {
                                        setSelectedReport(report);
                                        setAdminNotes(report.adminNotes || '');
                                    }}
                                    className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 transition-colors border border-gray-700 hover:border-orange-500/30"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${report.status === 'new' ? 'bg-yellow-600/30 text-yellow-300' :
                                                        report.status === 'in_review' ? 'bg-blue-600/30 text-blue-300' :
                                                            report.status === 'resolved' ? 'bg-green-600/30 text-green-300' :
                                                                'bg-gray-600/30 text-gray-300'
                                                    }`}>
                                                    {statusInfo.icon} {statusInfo.label}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {formatDate(report.createdAt)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm text-orange-400 font-medium">
                                                    {topicLabels[report.topic] || report.topic}
                                                </span>
                                                <span className="text-gray-600">•</span>
                                                <span className="text-sm text-gray-400 truncate">
                                                    {report.reason}
                                                </span>
                                            </div>
                                            <p className="text-sm text-white truncate">{report.description}</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                <span>🏪 {report.businessName}</span>
                                                {report.productName && <span>📦 {report.productName}</span>}
                                                <span>👤 {report.reporterName}</span>
                                            </div>
                                        </div>
                                        <span className="text-gray-600 text-xl">›</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
                    <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    🚩 Meldung Details
                                </h2>
                                <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                            </div>

                            {/* Status */}
                            <div className="mb-4">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedReport.status === 'new' ? 'bg-yellow-600/30 text-yellow-300' :
                                        selectedReport.status === 'in_review' ? 'bg-blue-600/30 text-blue-300' :
                                            selectedReport.status === 'resolved' ? 'bg-green-600/30 text-green-300' :
                                                'bg-gray-600/30 text-gray-300'
                                    }`}>
                                    {(reportStatuses[selectedReport.status] || reportStatuses.new).icon}{' '}
                                    {(reportStatuses[selectedReport.status] || reportStatuses.new).label}
                                </span>
                                <span className="text-xs text-gray-500 ml-3">{formatDate(selectedReport.createdAt)}</span>
                            </div>

                            {/* Info */}
                            <div className="space-y-3 mb-6">
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Thema</p>
                                    <p className="text-sm text-white">{topicLabels[selectedReport.topic] || selectedReport.topic}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Grund</p>
                                    <p className="text-sm text-white">{selectedReport.reason}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Beschreibung</p>
                                    <p className="text-sm text-white whitespace-pre-wrap">{selectedReport.description}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <p className="text-xs text-gray-400 mb-1">🏪 Geschäft</p>
                                        <p className="text-sm text-white">{selectedReport.businessName}</p>
                                    </div>
                                    {selectedReport.productName && (
                                        <div className="bg-gray-700/50 rounded-lg p-3">
                                            <p className="text-xs text-gray-400 mb-1">📦 Produkt</p>
                                            <p className="text-sm text-white">{selectedReport.productName}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <p className="text-xs text-gray-400 mb-1">👤 Melder</p>
                                        <p className="text-sm text-white">{selectedReport.reporterName}</p>
                                    </div>
                                    <div className="bg-gray-700/50 rounded-lg p-3">
                                        <p className="text-xs text-gray-400 mb-1">📧 E-Mail</p>
                                        <p className="text-sm text-orange-400">{selectedReport.reporterEmail}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Notes */}
                            <div className="mb-4">
                                <label className="text-xs text-gray-400 block mb-1">Admin Notizen</label>
                                <textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    className="w-full bg-gray-700 text-white text-sm rounded-lg p-3 border border-gray-600 focus:border-orange-500 outline-none resize-none"
                                    rows={3}
                                    placeholder="Notizen zur Bearbeitung…"
                                />
                            </div>

                            {/* Status Actions */}
                            <div className="flex flex-wrap gap-2">
                                {selectedReport.status !== 'in_review' && (
                                    <button
                                        onClick={() => handleStatusChange(selectedReport.id, 'in_review')}
                                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                                    >
                                        🔍 In Bearbeitung
                                    </button>
                                )}
                                {selectedReport.status !== 'resolved' && (
                                    <button
                                        onClick={() => handleStatusChange(selectedReport.id, 'resolved')}
                                        className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
                                    >
                                        ✅ Erledigt
                                    </button>
                                )}
                                {selectedReport.status !== 'dismissed' && (
                                    <button
                                        onClick={() => handleStatusChange(selectedReport.id, 'dismissed')}
                                        className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-xl transition-colors"
                                    >
                                        ❌ Ablehnen
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
