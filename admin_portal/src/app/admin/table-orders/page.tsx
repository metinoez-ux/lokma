'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';

const sessionStatuses = {
    active: { label: 'Aktif', icon: '🟢', badge: 'bg-green-600/20 text-green-400 border-green-500/30', cardBorder: 'border-green-500/40 hover:border-green-400', headerBg: 'bg-green-600/10' },
    ordering: { label: 'Sipariş', icon: '🔵', badge: 'bg-blue-600/20 text-blue-400 border-blue-500/30', cardBorder: 'border-blue-500/40 hover:border-blue-400', headerBg: 'bg-blue-600/10' },
    paying: { label: 'Ödeme', icon: '🟡', badge: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30', cardBorder: 'border-yellow-500/40 hover:border-yellow-400', headerBg: 'bg-yellow-600/10' },
    cancelled: { label: 'İptal', icon: '🔴', badge: 'bg-red-600/20 text-red-400 border-red-500/30', cardBorder: 'border-red-500/40 hover:border-red-400', headerBg: 'bg-red-600/10' },
    closed: { label: 'Kapandı', icon: '⚫', badge: 'bg-gray-600/20 text-gray-400 border-gray-600/30', cardBorder: 'border-gray-600/40 hover:border-gray-500', headerBg: 'bg-gray-700/30' },
} as const;

type SessionStatus = keyof typeof sessionStatuses;

interface GroupItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string;
    itemNote?: string;
}

interface Participant {
    participantId: string;
    userId: string;
    name: string;
    isHost: boolean;
    items: GroupItem[];
    subtotal: number;
    paymentStatus: string; // 'pending' | 'paid'
    paymentMethod?: string;
    paidAt?: Timestamp;
}

interface TableGroupSession {
    id: string;
    businessId: string;
    businessName: string;
    tableNumber: string;
    status: SessionStatus;
    hostUserId: string;
    hostName: string;
    participants: Participant[];
    grandTotal: number;
    paidTotal: number;
    paymentType?: string;
    paidByUserId?: string;
    createdAt: Timestamp;
    closedAt?: Timestamp;
    cancelledAt?: Timestamp;
    cancelledBy?: string;
    cancelReason?: string;
}

export default function TableOrdersPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [sessions, setSessions] = useState<TableGroupSession[]>([]);
    const [businesses, setBusinesses] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [businessFilter, setBusinessFilter] = useState<string>('all');
    const [businessSearch, setBusinessSearch] = useState<string>('');
    const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
    const businessSearchRef = useRef<HTMLDivElement>(null);
    const [selectedSession, setSelectedSession] = useState<TableGroupSession | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<{ session: TableGroupSession; reason: string } | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);

    // Filter businesses based on search
    const filteredBusinesses = Object.entries(businesses).filter(([, name]) =>
        name.toLowerCase().includes(businessSearch.toLowerCase())
    );

    // Click outside handler for business dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (businessSearchRef.current && !businessSearchRef.current.contains(event.target as Node)) {
                setShowBusinessDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Load businesses
    useEffect(() => {
        const loadBusinesses = async () => {
            const snapshot = await getDocs(collection(db, 'businesses'));
            const map: Record<string, string> = {};
            snapshot.docs.forEach(d => {
                const data = d.data();
                map[d.id] = data.companyName || d.id;
            });
            setBusinesses(map);
        };
        loadBusinesses();
    }, []);

    // Auto-set business filter for non-super admins
    useEffect(() => {
        if (admin && admin.adminType !== 'super') {
            const businessId = (admin as any).butcherId
                || (admin as any).restaurantId
                || (admin as any).marketId
                || (admin as any).businessId;
            if (businessId) {
                setBusinessFilter(businessId);
            }
        }
    }, [admin]);

    // Real-time sessions subscription
    useEffect(() => {
        if (!admin) return;
        setLoading(true);

        const targetBusinessId = admin.adminType !== 'super'
            ? ((admin as any).butcherId || (admin as any).restaurantId || (admin as any).marketId || (admin as any).businessId)
            : (businessFilter !== 'all' ? businessFilter : null);

        // Build query constraints
        const constraints: any[] = [orderBy('createdAt', 'desc')];

        if (statusFilter !== 'all') {
            constraints.unshift(where('status', '==', statusFilter));
        }
        if (targetBusinessId) {
            constraints.unshift(where('businessId', '==', targetBusinessId));
        }

        const q = query(collection(db, 'table_group_sessions'), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => {
                const raw = d.data();
                return {
                    id: d.id,
                    businessId: raw.businessId || '',
                    businessName: raw.businessName || '',
                    tableNumber: raw.tableNumber?.toString() || '',
                    status: (raw.status || 'active') as SessionStatus,
                    hostUserId: raw.hostUserId || '',
                    hostName: raw.hostName || '',
                    participants: (raw.participants as any[] || []).map((p: any) => ({
                        participantId: p.participantId || '',
                        userId: p.userId || '',
                        name: p.name || '',
                        isHost: p.isHost || false,
                        items: (p.items || []).map((item: any) => ({
                            productId: item.productId || '',
                            productName: item.productName || '',
                            quantity: item.quantity || 0,
                            unitPrice: item.unitPrice || 0,
                            totalPrice: item.totalPrice || 0,
                            imageUrl: item.imageUrl,
                            itemNote: item.itemNote,
                        })),
                        subtotal: p.subtotal || 0,
                        paymentStatus: p.paymentStatus || 'pending',
                        paymentMethod: p.paymentMethod,
                        paidAt: p.paidAt,
                    })),
                    grandTotal: raw.grandTotal || 0,
                    paidTotal: raw.paidTotal || 0,
                    paymentType: raw.paymentType,
                    paidByUserId: raw.paidByUserId,
                    createdAt: raw.createdAt || Timestamp.now(),
                    closedAt: raw.closedAt,
                    cancelledAt: raw.cancelledAt,
                    cancelledBy: raw.cancelledBy,
                    cancelReason: raw.cancelReason,
                } as TableGroupSession;
            });
            setSessions(data);
            setLoading(false);
        }, (error) => {
            console.error('Error loading table group sessions:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [admin, statusFilter, businessFilter]);

    // Close a session
    const handleCloseSession = async (session: TableGroupSession) => {
        try {
            await updateDoc(doc(db, 'table_group_sessions', session.id), {
                status: 'closed',
                closedAt: Timestamp.now(),
            });
            setSelectedSession(null);
            showToast(`Masa ${session.tableNumber} oturumu kapatıldı ✅`, 'success');
        } catch (error) {
            console.error('Error closing session:', error);
            showToast('Oturum kapatılırken hata oluştu', 'error');
        }
    };

    // Cancel a session (admin action — for abandoned/stuck sessions)
    const handleCancelSession = async () => {
        if (!cancelConfirm) return;
        setCancelLoading(true);
        try {
            const adminName = admin?.displayName || admin?.email || 'Admin';
            await updateDoc(doc(db, 'table_group_sessions', cancelConfirm.session.id), {
                status: 'cancelled',
                cancelledAt: Timestamp.now(),
                cancelledBy: adminName,
                cancelReason: cancelConfirm.reason.trim() || 'Admin tarafından iptal edildi',
                closedAt: Timestamp.now(),
            });
            setSelectedSession(null);
            setCancelConfirm(null);
            showToast(`Masa ${cancelConfirm.session.tableNumber} oturumu iptal edildi ✅`, 'success');
        } catch (error) {
            console.error('Error cancelling session:', error);
            showToast('Oturum iptal edilirken hata oluştu', 'error');
        } finally {
            setCancelLoading(false);
        }
    };

    // Stats
    const stats = {
        total: sessions.length,
        active: sessions.filter(s => s.status === 'active').length,
        ordering: sessions.filter(s => s.status === 'ordering').length,
        paying: sessions.filter(s => s.status === 'paying').length,
        cancelled: sessions.filter(s => s.status === 'cancelled').length,
        totalRevenue: sessions.reduce((sum, s) => sum + s.grandTotal, 0),
        paidRevenue: sessions.reduce((sum, s) => sum + s.paidTotal, 0),
    };

    // Aggregated items for a session
    const getAggregatedItems = (session: TableGroupSession) => {
        const result: Record<string, { productName: string; quantity: number; totalPrice: number; unitPrice: number }> = {};
        for (const p of session.participants) {
            for (const item of p.items) {
                if (result[item.productName]) {
                    result[item.productName].quantity += item.quantity;
                    result[item.productName].totalPrice += item.totalPrice;
                } else {
                    result[item.productName] = {
                        productName: item.productName,
                        quantity: item.quantity,
                        totalPrice: item.totalPrice,
                        unitPrice: item.unitPrice,
                    };
                }
            }
        }
        return Object.values(result);
    };

    const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;

    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        return date.toLocaleDateString('tr-TR', {
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
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

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            🪑 Masa Grup Siparişleri
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {admin?.adminType === 'super'
                                ? 'Tüm işletmelerin grup masa oturumlarını yönetin'
                                : 'İşletmenizin masa oturumlarını takip edin'}
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex gap-3">
                        <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-green-400">{stats.active}</p>
                            <p className="text-xs text-green-300">Aktif</p>
                        </div>
                        <div className={`bg-blue-600/20 border border-blue-500/30 rounded-xl px-4 py-2 text-center ${stats.ordering > 0 ? 'animate-pulse' : ''}`}>
                            <p className="text-2xl font-bold text-blue-400">{stats.ordering}</p>
                            <p className="text-xs text-blue-300">Sipariş</p>
                        </div>
                        <div className={`bg-yellow-600/20 border border-yellow-500/30 rounded-xl px-4 py-2 text-center ${stats.paying > 0 ? 'animate-pulse' : ''}`}>
                            <p className="text-2xl font-bold text-yellow-400">{stats.paying}</p>
                            <p className="text-xs text-yellow-300">Ödeme</p>
                        </div>
                        <div className="bg-amber-600/20 border border-amber-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-lg font-bold text-amber-400">{formatCurrency(stats.totalRevenue)}</p>
                            <p className="text-xs text-amber-300">Toplam</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex flex-wrap gap-4">
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                        >
                            <option value="all">Tüm Durumlar</option>
                            {Object.entries(sessionStatuses).map(([key, value]) => (
                                <option key={key} value={key}>{value.icon} {value.label}</option>
                            ))}
                        </select>

                        {/* Business Filter - Only show to Super Admins */}
                        {admin?.adminType === 'super' && (
                            <div ref={businessSearchRef} className="relative">
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        value={businessSearch || (businessFilter !== 'all' ? (businesses[businessFilter] || '') : '')}
                                        onChange={(e) => {
                                            setBusinessSearch(e.target.value);
                                            setBusinessFilter('all');
                                            setShowBusinessDropdown(true);
                                        }}
                                        onFocus={() => setShowBusinessDropdown(true)}
                                        placeholder="🔍 İşletme Ara..."
                                        className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 w-64"
                                    />
                                    {businessFilter !== 'all' && (
                                        <button
                                            onClick={() => {
                                                setBusinessFilter('all');
                                                setBusinessSearch('');
                                            }}
                                            className="ml-2 text-gray-400 hover:text-white"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {showBusinessDropdown && (
                                    <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                                        <div
                                            className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-green-400 font-medium"
                                            onClick={() => {
                                                setBusinessFilter('all');
                                                setBusinessSearch('');
                                                setShowBusinessDropdown(false);
                                            }}
                                        >
                                            ✓ Tüm İşletmeler
                                        </div>
                                        {filteredBusinesses.slice(0, 15).map(([id, name]) => (
                                            <div
                                                key={id}
                                                className={`px-4 py-2 hover:bg-gray-700 cursor-pointer text-white ${businessFilter === id ? 'bg-purple-600/30 text-purple-300' : ''}`}
                                                onClick={() => {
                                                    setBusinessFilter(id);
                                                    setBusinessSearch('');
                                                    setShowBusinessDropdown(false);
                                                }}
                                            >
                                                {name}
                                            </div>
                                        ))}
                                        {filteredBusinesses.length === 0 && businessSearch && (
                                            <div className="px-4 py-2 text-gray-500">
                                                Sonuç bulunamadı
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Flow */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center gap-2">
                        <div
                            className={`flex-1 min-w-[100px] rounded-lg p-4 text-center cursor-pointer transition border-2 ${statusFilter === 'active' ? 'bg-green-600/30 border-green-500' : 'bg-green-600/10 border-green-600/30 hover:bg-green-600/20'}`}
                            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                        >
                            <p className={`text-green-400 text-3xl font-bold ${stats.active > 0 ? 'animate-bounce' : ''}`}>{stats.active}</p>
                            <p className="text-green-300 text-sm font-medium">🟢 Aktif</p>
                        </div>
                        <div className="text-gray-500 text-xl">→</div>
                        <div
                            className={`flex-1 min-w-[100px] rounded-lg p-4 text-center cursor-pointer transition border-2 ${statusFilter === 'ordering' ? 'bg-blue-600/30 border-blue-500' : 'bg-blue-600/10 border-blue-600/30 hover:bg-blue-600/20'}`}
                            onClick={() => setStatusFilter(statusFilter === 'ordering' ? 'all' : 'ordering')}
                        >
                            <p className="text-blue-400 text-3xl font-bold">{stats.ordering}</p>
                            <p className="text-gray-400 text-sm">🔵 Sipariş</p>
                        </div>
                        <div className="text-gray-500 text-xl">→</div>
                        <div
                            className={`flex-1 min-w-[100px] rounded-lg p-4 text-center cursor-pointer transition border-2 ${statusFilter === 'paying' ? 'bg-yellow-600/30 border-yellow-500' : 'bg-yellow-600/10 border-yellow-600/30 hover:bg-yellow-600/20'}`}
                            onClick={() => setStatusFilter(statusFilter === 'paying' ? 'all' : 'paying')}
                        >
                            <p className="text-yellow-400 text-3xl font-bold">{stats.paying}</p>
                            <p className="text-gray-400 text-sm">🟡 Ödeme</p>
                        </div>
                        <div className="text-gray-500 text-xl">→</div>
                        <div
                            className={`flex-1 min-w-[100px] rounded-lg p-4 text-center cursor-pointer transition border-2 ${statusFilter === 'closed' ? 'bg-gray-500/30 border-gray-400' : 'bg-gray-600/10 border-gray-600/30 hover:bg-gray-600/20'}`}
                            onClick={() => setStatusFilter(statusFilter === 'closed' ? 'all' : 'closed')}
                        >
                            <p className="text-gray-400 text-3xl font-bold">{sessions.filter(s => s.status === 'closed').length}</p>
                            <p className="text-gray-500 text-sm">⚫ Kapandı</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sessions Grid */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                        <p className="text-gray-400 mt-4">Masa oturumları yükleniyor...</p>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <p className="text-4xl mb-4">🪑</p>
                        <p className="text-gray-400">Oturum bulunamadı</p>
                        <p className="text-gray-500 text-sm mt-1">Filtreleri değiştirmeyi deneyin</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {sessions.map((session) => {
                            const statusInfo = sessionStatuses[session.status] ?? sessionStatuses.active;
                            const aggregatedItems = getAggregatedItems(session);
                            const paidCount = session.participants.filter(p => p.paymentStatus === 'paid').length;
                            const remaining = session.grandTotal - session.paidTotal;

                            return (
                                <div
                                    key={session.id}
                                    className={`bg-gray-800 rounded-xl overflow-hidden border transition hover:shadow-lg cursor-pointer ${statusInfo.cardBorder}`}
                                    onClick={() => setSelectedSession(session)}
                                >
                                    {/* Card Header */}
                                    <div className={`px-4 py-3 flex items-center justify-between ${statusInfo.headerBg}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl font-bold text-white bg-gray-700/60 px-3 py-1 rounded-lg">
                                                🪑 {session.tableNumber}
                                            </span>
                                            <div>
                                                <p className="text-white font-medium text-sm truncate max-w-[140px]">
                                                    {session.businessName || businesses[session.businessId] || ''}
                                                </p>
                                                <p className="text-gray-400 text-xs">
                                                    {formatDate(session.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.badge}`}>
                                            {statusInfo.icon} {statusInfo.label}
                                        </span>
                                    </div>

                                    {/* Participants */}
                                    <div className="px-4 py-3 border-b border-gray-700/50">
                                        <div className="flex items-center gap-1 mb-2">
                                            <span className="text-gray-400 text-xs">👥 Katılımcılar ({session.participants.length})</span>
                                            <span className="text-gray-600 text-xs ml-auto">
                                                {paidCount}/{session.participants.length} ödedi
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {session.participants.map(p => (
                                                <span
                                                    key={p.participantId}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${p.paymentStatus === 'paid'
                                                        ? 'bg-green-600/20 text-green-400'
                                                        : 'bg-gray-700 text-gray-300'
                                                        } ${p.isHost ? 'ring-1 ring-amber-400/50' : ''}`}
                                                >
                                                    {p.isHost && '👑'} {p.name}
                                                    {p.paymentStatus === 'paid' && ' ✅'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Aggregated Items */}
                                    {aggregatedItems.length > 0 && (
                                        <div className="px-4 py-2 border-b border-gray-700/50">
                                            <div className="space-y-1">
                                                {aggregatedItems.slice(0, 4).map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-300 truncate max-w-[60%]">
                                                            {item.productName} <span className="text-gray-500">×{item.quantity}</span>
                                                        </span>
                                                        <span className="text-gray-400 font-medium">{formatCurrency(item.totalPrice)}</span>
                                                    </div>
                                                ))}
                                                {aggregatedItems.length > 4 && (
                                                    <p className="text-gray-500 text-xs">
                                                        +{aggregatedItems.length - 4} ürün daha
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Totals */}
                                    <div className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <span className="text-gray-400 text-xs">Toplam</span>
                                            <p className="text-white font-bold text-lg">{formatCurrency(session.grandTotal)}</p>
                                        </div>
                                        {session.paidTotal > 0 && (
                                            <div className="text-right">
                                                <span className="text-green-400 text-xs">Ödenen</span>
                                                <p className="text-green-400 font-bold">{formatCurrency(session.paidTotal)}</p>
                                            </div>
                                        )}
                                        {remaining > 0 && session.grandTotal > 0 && (
                                            <div className="text-right">
                                                <span className="text-amber-400 text-xs">Kalan</span>
                                                <p className="text-amber-400 font-bold">{formatCurrency(remaining)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Session Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setSelectedSession(null)}>
                    <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🪑</span>
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        Masa {selectedSession.tableNumber}
                                    </h2>
                                    <p className="text-gray-400 text-sm">
                                        {selectedSession.businessName || businesses[selectedSession.businessId] || ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm ${sessionStatuses[selectedSession.status].badge}`}>
                                    {sessionStatuses[selectedSession.status].icon} {sessionStatuses[selectedSession.status].label}
                                </span>
                                <button
                                    onClick={() => setSelectedSession(null)}
                                    className="text-gray-400 hover:text-white text-xl ml-2"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Session Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-700/30 rounded-lg p-3">
                                    <span className="text-gray-400 text-xs">Host</span>
                                    <p className="text-white font-medium">👑 {selectedSession.hostName}</p>
                                </div>
                                <div className="bg-gray-700/30 rounded-lg p-3">
                                    <span className="text-gray-400 text-xs">Açılış</span>
                                    <p className="text-white font-medium">{formatDate(selectedSession.createdAt)}</p>
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-gray-700/20 border border-gray-600/30 rounded-xl p-4">
                                <h3 className="text-white font-bold text-sm mb-3">💰 Hesap Özeti</h3>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-2xl font-bold text-white">{formatCurrency(selectedSession.grandTotal)}</p>
                                        <p className="text-gray-400 text-xs">Toplam</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-400">{formatCurrency(selectedSession.paidTotal)}</p>
                                        <p className="text-green-400/70 text-xs">Ödenen</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-amber-400">{formatCurrency(selectedSession.grandTotal - selectedSession.paidTotal)}</p>
                                        <p className="text-amber-400/70 text-xs">Kalan</p>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                {selectedSession.grandTotal > 0 && (
                                    <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, (selectedSession.paidTotal / selectedSession.grandTotal) * 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Aggregated Items */}
                            {(() => {
                                const items = getAggregatedItems(selectedSession);
                                if (items.length === 0) return null;
                                return (
                                    <div>
                                        <h3 className="text-white font-bold text-sm mb-3">🛒 Sipariş Özeti ({items.length} ürün)</h3>
                                        <div className="bg-gray-700/20 rounded-xl overflow-hidden">
                                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-700/40 text-gray-400 text-xs font-medium">
                                                <div className="col-span-6">Ürün</div>
                                                <div className="col-span-2 text-center">Adet</div>
                                                <div className="col-span-2 text-right">Birim Fiy.</div>
                                                <div className="col-span-2 text-right">Toplam</div>
                                            </div>
                                            <div className="divide-y divide-gray-700/50">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-2 items-center">
                                                        <div className="col-span-6 text-white text-sm truncate">{item.productName}</div>
                                                        <div className="col-span-2 text-center">
                                                            <span className="bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded text-xs font-bold">
                                                                ×{item.quantity}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-2 text-right text-gray-400 text-sm">{formatCurrency(item.unitPrice)}</div>
                                                        <div className="col-span-2 text-right text-white font-medium text-sm">{formatCurrency(item.totalPrice)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Participants Breakdown */}
                            <div>
                                <h3 className="text-white font-bold text-sm mb-3">👥 Katılımcılar ({selectedSession.participants.length})</h3>
                                <div className="space-y-3">
                                    {selectedSession.participants.map((p) => (
                                        <div key={p.participantId} className={`bg-gray-700/20 rounded-xl p-4 border ${p.paymentStatus === 'paid' ? 'border-green-500/30' : 'border-gray-600/30'
                                            }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium">
                                                        {p.isHost && '👑 '}{p.name}
                                                    </span>
                                                    {p.isHost && (
                                                        <span className="text-amber-400 text-xs bg-amber-600/20 px-2 py-0.5 rounded">Host</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.paymentStatus === 'paid'
                                                        ? 'bg-green-600/20 text-green-400'
                                                        : 'bg-yellow-600/20 text-yellow-400'
                                                        }`}>
                                                        {p.paymentStatus === 'paid' ? '✅ Ödendi' : '⏳ Bekliyor'}
                                                    </span>
                                                    {p.paymentMethod && (
                                                        <span className="text-gray-500 text-xs">
                                                            {p.paymentMethod === 'cash' ? '💵' : '💳'} {p.paymentMethod}
                                                        </span>
                                                    )}
                                                    <span className="text-white font-bold">{formatCurrency(p.subtotal)}</span>
                                                </div>
                                            </div>
                                            {p.items.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {p.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-xs">
                                                            <span className="text-gray-400">
                                                                {item.productName} <span className="text-gray-500">×{item.quantity}</span>
                                                                {item.itemNote && <span className="text-yellow-400 ml-1">📝 {item.itemNote}</span>}
                                                            </span>
                                                            <span className="text-gray-300">{formatCurrency(item.totalPrice)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cancellation Info */}
                            {selectedSession.status === 'cancelled' && (
                                <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4">
                                    <h3 className="text-red-400 font-bold text-sm mb-2">🔴 İptal Bilgisi</h3>
                                    <div className="space-y-1 text-sm">
                                        <p className="text-gray-300">
                                            <span className="text-gray-500">İptal Eden:</span>{' '}
                                            {selectedSession.cancelledBy || '-'}
                                        </p>
                                        <p className="text-gray-300">
                                            <span className="text-gray-500">Sebep:</span>{' '}
                                            {selectedSession.cancelReason || '-'}
                                        </p>
                                        <p className="text-gray-300">
                                            <span className="text-gray-500">Tarih:</span>{' '}
                                            {formatDate(selectedSession.cancelledAt)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            {selectedSession.status !== 'closed' && selectedSession.status !== 'cancelled' && (
                                <div className="border-t border-gray-700 pt-4 space-y-3">
                                    <button
                                        onClick={() => setCancelConfirm({ session: selectedSession, reason: '' })}
                                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                                    >
                                        🔴 Oturumu İptal Et
                                    </button>
                                    <button
                                        onClick={() => handleCloseSession(selectedSession)}
                                        className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                                    >
                                        ⚫ Normal Kapatma
                                    </button>
                                </div>
                            )}

                            {selectedSession.closedAt && (
                                <div className="text-gray-500 text-xs text-center">
                                    Kapatılma: {formatDate(selectedSession.closedAt)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {cancelConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]" onClick={() => !cancelLoading && setCancelConfirm(null)}>
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <span className="text-4xl">⚠️</span>
                            <h3 className="text-xl font-bold text-white mt-3">
                                Oturumu İptal Et
                            </h3>
                            <p className="text-gray-400 text-sm mt-2">
                                Masa {cancelConfirm.session.tableNumber} — {cancelConfirm.session.businessName || ''}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                                {cancelConfirm.session.participants.length} katılımcı · {formatCurrency(cancelConfirm.session.grandTotal)} toplam
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="text-gray-400 text-sm font-medium block mb-2">
                                İptal Sebebi (opsiyonel)
                            </label>
                            <textarea
                                value={cancelConfirm.reason}
                                onChange={(e) => setCancelConfirm({ ...cancelConfirm, reason: e.target.value })}
                                placeholder="Örn: Host restoranı terk etti, sipariş yarıda kaldı..."
                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none resize-none"
                                rows={3}
                                disabled={cancelLoading}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelConfirm(null)}
                                disabled={cancelLoading}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition disabled:opacity-50"
                            >
                                Vazgeç
                            </button>
                            <button
                                onClick={handleCancelSession}
                                disabled={cancelLoading}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {cancelLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                        İptal Ediliyor...
                                    </>
                                ) : (
                                    '🔴 İptal Et'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
