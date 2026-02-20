'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, collectionGroup, getDocs, getDoc, doc, updateDoc, query, orderBy, where, onSnapshot, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';

const reservationStatuses = {
    pending: { label: 'Beklemede', color: 'yellow', icon: '⏳' },
    confirmed: { label: 'Onaylandı', color: 'green', icon: '✅' },
    rejected: { label: 'Reddedildi', color: 'red', icon: '❌' },
    cancelled: { label: 'İptal', color: 'gray', icon: '🚫' },
} as const;

type ReservationStatus = keyof typeof reservationStatuses;

interface Reservation {
    id: string;
    businessId: string;
    businessName?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    partySize: number;
    reservationDate: Date;
    timeSlot: string;
    notes?: string;
    status: ReservationStatus;
    confirmedBy?: string;
    tableCardNumbers?: number[];
    createdAt: Date;
}

export default function ReservationsPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [businesses, setBusinesses] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [businessFilter, setBusinessFilter] = useState<string>('all');
    const [businessSearch, setBusinessSearch] = useState<string>('');
    const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
    const businessSearchRef = useRef<HTMLDivElement>(null);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    // Card number selection
    const [businessMaxTables, setBusinessMaxTables] = useState<Record<string, number>>({});
    const [showCardModal, setShowCardModal] = useState<{ reservation: Reservation } | null>(null);
    const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
    const [occupiedCards, setOccupiedCards] = useState<Set<number>>(new Set());
    const [cardModalLoading, setCardModalLoading] = useState(false);

    // Filter businesses based on search
    const filteredBusinesses = Object.entries(businesses).filter(([id, name]) =>
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
            const maxTablesMap: Record<string, number> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.hasReservation) {
                    map[doc.id] = data.companyName || doc.id;
                    maxTablesMap[doc.id] = data.maxReservationTables || 0;
                }
            });
            setBusinesses(map);
            setBusinessMaxTables(maxTablesMap);
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

    // Real-time reservations subscription
    useEffect(() => {
        if (!admin) return;
        setLoading(true);

        // Determine which businesses to query
        const targetBusinessId = admin.adminType !== 'super'
            ? ((admin as any).butcherId || (admin as any).restaurantId || (admin as any).marketId || (admin as any).businessId)
            : (businessFilter !== 'all' ? businessFilter : null);

        // Build date range
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        let endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        if (dateFilter === 'tomorrow') {
            startDate.setDate(startDate.getDate() + 1);
            endDate.setDate(endDate.getDate() + 1);
        } else if (dateFilter === 'week') {
            endDate.setDate(endDate.getDate() + 7);
        } else if (dateFilter === 'month') {
            endDate.setDate(endDate.getDate() + 30);
        } else if (dateFilter === 'all') {
            startDate = new Date(2020, 0, 1);
            endDate = new Date(2030, 11, 31);
        }

        // If we have a specific business, query its subcollection directly
        if (targetBusinessId) {
            const q = query(
                collection(db, 'businesses', targetBusinessId, 'reservations'),
                where('reservationDate', '>=', Timestamp.fromDate(startDate)),
                where('reservationDate', '<=', Timestamp.fromDate(endDate)),
                orderBy('reservationDate', 'desc')
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(d => {
                    const raw = d.data();
                    return {
                        id: d.id,
                        businessId: targetBusinessId,
                        businessName: raw.businessName || businesses[targetBusinessId] || '',
                        customerName: raw.customerName || '',
                        customerPhone: raw.customerPhone || '',
                        customerEmail: raw.customerEmail || '',
                        partySize: raw.partySize || 1,
                        reservationDate: raw.reservationDate?.toDate() || new Date(),
                        timeSlot: raw.timeSlot || '',
                        notes: raw.notes || '',
                        status: raw.status || 'pending',
                        confirmedBy: raw.confirmedBy || '',
                        tableCardNumbers: raw.tableCardNumbers || [],
                        createdAt: raw.createdAt?.toDate() || new Date(),
                    } as Reservation;
                });
                setReservations(data);
                setLoading(false);
            }, (error) => {
                console.error('Error loading reservations:', error);
                setLoading(false);
            });

            return () => unsubscribe();
        }

        // Super admin: query all businesses with reservations
        // Use collectionGroup for cross-business reservation queries
        const q = query(
            collectionGroup(db, 'reservations'),
            where('reservationDate', '>=', Timestamp.fromDate(startDate)),
            where('reservationDate', '<=', Timestamp.fromDate(endDate)),
            orderBy('reservationDate', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => {
                const raw = d.data();
                // Extract businessId from the document path: businesses/{businessId}/reservations/{resId}
                const pathParts = d.ref.path.split('/');
                const bizId = pathParts[1] || '';
                return {
                    id: d.id,
                    businessId: bizId,
                    businessName: raw.businessName || businesses[bizId] || '',
                    customerName: raw.customerName || '',
                    customerPhone: raw.customerPhone || '',
                    customerEmail: raw.customerEmail || '',
                    partySize: raw.partySize || 1,
                    reservationDate: raw.reservationDate?.toDate() || new Date(),
                    timeSlot: raw.timeSlot || '',
                    notes: raw.notes || '',
                    status: raw.status || 'pending',
                    confirmedBy: raw.confirmedBy || '',
                    tableCardNumbers: raw.tableCardNumbers || [],
                    createdAt: raw.createdAt?.toDate() || new Date(),
                } as Reservation;
            });
            setReservations(data);
            setLoading(false);
        }, (error) => {
            console.error('Error loading reservations:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [admin, dateFilter, businessFilter, businesses]);

    // Filter reservations
    const filteredReservations = reservations.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (businessFilter !== 'all' && r.businessId !== businessFilter) return false;
        return true;
    });

    // Stats
    const stats = {
        total: filteredReservations.length,
        pending: filteredReservations.filter(r => r.status === 'pending').length,
        confirmed: filteredReservations.filter(r => r.status === 'confirmed').length,
        rejected: filteredReservations.filter(r => r.status === 'rejected').length,
        cancelled: filteredReservations.filter(r => r.status === 'cancelled').length,
    };

    // Open card selection modal for confirmation
    const openCardModal = useCallback(async (reservation: Reservation) => {
        const maxTables = businessMaxTables[reservation.businessId] || 0;
        if (maxTables <= 0) {
            // No tables configured, confirm directly with empty card numbers
            await confirmWithCards(reservation, []);
            return;
        }
        setCardModalLoading(true);
        setShowCardModal({ reservation });
        setSelectedCards(new Set());
        try {
            // Fetch occupied card numbers from confirmed reservations
            const q = query(
                collection(db, 'businesses', reservation.businessId, 'reservations'),
                where('status', '==', 'confirmed')
            );
            const snap = await getDocs(q);
            const occupied = new Set<number>();
            snap.docs.forEach(d => {
                const cards = d.data().tableCardNumbers;
                if (Array.isArray(cards)) {
                    cards.forEach((c: number) => occupied.add(c));
                }
            });
            setOccupiedCards(occupied);
        } catch (e) {
            console.error('Error fetching occupied cards:', e);
            setOccupiedCards(new Set());
        } finally {
            setCardModalLoading(false);
        }
    }, [businessMaxTables]);

    // Confirm reservation with card numbers
    const confirmWithCards = async (reservation: Reservation, cardNumbers: number[]) => {
        try {
            const resRef = doc(db, 'businesses', reservation.businessId, 'reservations', reservation.id);
            await updateDoc(resRef, {
                status: 'confirmed',
                confirmedBy: admin?.displayName || admin?.email || 'Admin',
                tableCardNumbers: cardNumbers,
                tableCardAssignedBy: admin?.displayName || admin?.email || 'Admin',
                tableCardAssignedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            setReservations(prev =>
                prev.map(r => r.id === reservation.id ? { ...r, status: 'confirmed' as ReservationStatus, tableCardNumbers: cardNumbers } : r)
            );
            setSelectedReservation(null);
            setShowCardModal(null);
            const cardStr = cardNumbers.length > 0 ? ` (Masa ${cardNumbers.join(', ')})` : '';
            showToast(`Rezervasyon onaylandı ✅${cardStr}`, 'success');
        } catch (error) {
            console.error('Error confirming reservation:', error);
            showToast('Onaylama sırasında hata oluştu', 'error');
        }
    };

    // Handle status change
    const handleStatusChange = async (reservation: Reservation, newStatus: ReservationStatus) => {
        // For confirmation → open card selection modal
        if (newStatus === 'confirmed') {
            openCardModal(reservation);
            return;
        }

        try {
            const resRef = doc(db, 'businesses', reservation.businessId, 'reservations', reservation.id);
            const updateData: Record<string, any> = {
                status: newStatus,
                confirmedBy: admin?.displayName || admin?.email || 'Admin',
                updatedAt: Timestamp.now(),
            };
            // Clear card numbers if cancelling
            if (newStatus === 'cancelled') {
                updateData.tableCardNumbers = deleteField();
                updateData.tableCardAssignedBy = deleteField();
                updateData.tableCardAssignedAt = deleteField();
            }
            await updateDoc(resRef, updateData);

            // Update local state
            setReservations(prev =>
                prev.map(r => r.id === reservation.id ? { ...r, status: newStatus, tableCardNumbers: newStatus === 'cancelled' ? [] : r.tableCardNumbers } : r)
            );
            setSelectedReservation(null);
            showToast(
                newStatus === 'rejected' ? 'Rezervasyon reddedildi ❌' : 'Rezervasyon iptal edildi 🚫',
                'success'
            );
        } catch (error) {
            console.error('Error updating reservation:', error);
            showToast('Durum güncellenirken hata oluştu', 'error');
        }
    };

    // Format date
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('tr-TR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
            <div className="max-w-6xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            🍽️ Rezervasyon Merkezi
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {admin?.adminType === 'super'
                                ? 'Tüm işletmelerin rezervasyonlarını yönetin'
                                : 'İşletmenizin rezervasyonlarını yönetin'}
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex gap-3">
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
                            <p className="text-xs text-blue-300">Toplam</p>
                        </div>
                        <div className={`bg-yellow-600/20 border border-yellow-500/30 rounded-xl px-4 py-2 text-center ${stats.pending > 0 ? 'animate-pulse' : ''}`}>
                            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                            <p className="text-xs text-yellow-300">Bekleyen</p>
                        </div>
                        <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-green-400">{stats.confirmed}</p>
                            <p className="text-xs text-green-300">Onaylanan</p>
                        </div>
                        <div className="bg-red-600/20 border border-red-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
                            <p className="text-xs text-red-300">Reddedilen</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex flex-wrap gap-4">
                        {/* Date Filter */}
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                        >
                            <option value="today">📅 Bugün</option>
                            <option value="tomorrow">📅 Yarın</option>
                            <option value="week">📅 Bu Hafta</option>
                            <option value="month">📅 Bu Ay</option>
                            <option value="all">📅 Tümü</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                        >
                            <option value="all">Tüm Durumlar</option>
                            {Object.entries(reservationStatuses).map(([key, value]) => (
                                <option key={key} value={key}>{value.icon} {value.label}</option>
                            ))}
                        </select>

                        {/* Business Filter - Only show to Super Admins */}
                        {admin?.adminType === 'super' && (
                            <div ref={businessSearchRef} className="relative">
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        value={businessFilter === 'all' ? businessSearch : (businesses[businessFilter] || businessSearch)}
                                        onChange={(e) => {
                                            setBusinessSearch(e.target.value);
                                            setShowBusinessDropdown(true);
                                            if (e.target.value === '') {
                                                setBusinessFilter('all');
                                            }
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
            <div className="max-w-6xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center gap-2">
                        <div className={`flex-1 min-w-[100px] bg-yellow-600/20 border-2 border-yellow-500 rounded-lg p-4 text-center ${stats.pending > 0 ? 'animate-pulse' : ''}`}>
                            <p className={`text-yellow-400 text-3xl font-bold ${stats.pending > 0 ? 'animate-bounce' : ''}`}>{stats.pending}</p>
                            <p className="text-yellow-300 text-sm font-medium">🔔 Bekleyen</p>
                        </div>
                        <div className="text-gray-500 text-xl">→</div>
                        <div className="flex-1 min-w-[100px] bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center">
                            <p className="text-green-400 text-3xl font-bold">{stats.confirmed}</p>
                            <p className="text-gray-400 text-sm">✅ Onaylı</p>
                        </div>
                        <div className="text-gray-500 text-xl">|</div>
                        <div className="flex-1 min-w-[100px] bg-red-600/20 border border-red-600/30 rounded-lg p-4 text-center">
                            <p className="text-red-400 text-3xl font-bold">{stats.rejected}</p>
                            <p className="text-gray-400 text-sm">❌ Reddedilen</p>
                        </div>
                        <div className="text-gray-500 text-xl">|</div>
                        <div className="flex-1 min-w-[100px] bg-gray-600/20 border border-gray-600/30 rounded-lg p-4 text-center">
                            <p className="text-gray-400 text-3xl font-bold">{stats.cancelled}</p>
                            <p className="text-gray-500 text-sm">🚫 İptal</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reservations List */}
            <div className="max-w-6xl mx-auto">
                {loading ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-gray-400 mt-4">Rezervasyonlar yükleniyor...</p>
                    </div>
                ) : filteredReservations.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <p className="text-4xl mb-4">🍽️</p>
                        <p className="text-gray-400">Rezervasyon bulunamadı</p>
                    </div>
                ) : (
                    <div className="bg-gray-800 rounded-xl overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-2 p-4 bg-gray-700/50 text-gray-400 text-sm font-medium">
                            <div className="col-span-2">Müşteri</div>
                            <div className="col-span-2">İşletme</div>
                            <div className="col-span-2">Tarih & Saat</div>
                            <div className="col-span-1">Kişi</div>
                            <div className="col-span-2">Durum</div>
                            <div className="col-span-3">İşlemler</div>
                        </div>

                        {/* Reservation Rows */}
                        <div className="divide-y divide-gray-700">
                            {filteredReservations.map((reservation) => {
                                const statusInfo = reservationStatuses[reservation.status] || reservationStatuses.pending;
                                return (
                                    <div
                                        key={reservation.id}
                                        className="grid grid-cols-12 gap-2 p-4 hover:bg-gray-700/30 transition items-center"
                                    >
                                        {/* Customer */}
                                        <div className="col-span-2">
                                            <p className="text-white font-medium truncate">{reservation.customerName}</p>
                                            {reservation.customerPhone && (
                                                <a href={`tel:${reservation.customerPhone}`} className="text-blue-400 text-xs hover:underline">
                                                    📞 {reservation.customerPhone}
                                                </a>
                                            )}
                                        </div>

                                        {/* Business */}
                                        <div className="col-span-2">
                                            <p className="text-gray-300 text-sm truncate">
                                                {reservation.businessName || businesses[reservation.businessId] || reservation.businessId.slice(0, 8)}
                                            </p>
                                        </div>

                                        {/* Date & Time */}
                                        <div className="col-span-2">
                                            <p className="text-white text-sm">{formatDate(reservation.reservationDate)}</p>
                                            <p className="text-gray-400 text-xs">{reservation.timeSlot || formatTime(reservation.reservationDate)}</p>
                                        </div>

                                        {/* Party Size */}
                                        <div className="col-span-1">
                                            <span className="bg-purple-600/30 text-purple-300 px-2 py-1 rounded text-sm font-bold">
                                                👥 {reservation.partySize}
                                            </span>
                                            {reservation.tableCardNumbers && reservation.tableCardNumbers.length > 0 && (
                                                <div className="mt-1 flex gap-1">
                                                    {reservation.tableCardNumbers.map(n => (
                                                        <span key={n} className="bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded text-xs font-bold">
                                                            🃏{n}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-${statusInfo.color}-600/20 text-${statusInfo.color}-400 border border-${statusInfo.color}-500/30`}>
                                                {statusInfo.icon} {statusInfo.label}
                                            </span>
                                            {reservation.confirmedBy && reservation.status !== 'pending' && (
                                                <p className="text-gray-500 text-xs mt-1">
                                                    {reservation.status === 'confirmed' ? '✅' : '❌'} {reservation.confirmedBy}
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-3 flex items-center gap-2">
                                            {reservation.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusChange(reservation, 'confirmed')}
                                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition"
                                                    >
                                                        ✅ Onayla
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(reservation, 'rejected')}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
                                                    >
                                                        ❌ Reddet
                                                    </button>
                                                </>
                                            )}
                                            {reservation.status === 'confirmed' && (
                                                <button
                                                    onClick={() => handleStatusChange(reservation, 'cancelled')}
                                                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium transition"
                                                >
                                                    🚫 İptal Et
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedReservation(reservation)}
                                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition"
                                            >
                                                👁️ Detay
                                            </button>
                                            {reservation.notes && (
                                                <span className="text-yellow-400 text-xs" title={reservation.notes}>📝</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Reservation Detail Modal */}
            {selectedReservation && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                🍽️ Rezervasyon Detayı
                            </h2>
                            <button
                                onClick={() => setSelectedReservation(null)}
                                className="text-gray-400 hover:text-white text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Durum</span>
                                <span className={`px-3 py-1 rounded-full text-sm bg-${reservationStatuses[selectedReservation.status].color}-600/20 text-${reservationStatuses[selectedReservation.status].color}-400`}>
                                    {reservationStatuses[selectedReservation.status].icon} {reservationStatuses[selectedReservation.status].label}
                                </span>
                            </div>

                            {/* Customer */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Müşteri</span>
                                <div className="text-right">
                                    <p className="text-white font-medium">{selectedReservation.customerName}</p>
                                    {selectedReservation.customerPhone && (
                                        <a href={`tel:${selectedReservation.customerPhone}`} className="text-blue-400 text-sm">
                                            📞 {selectedReservation.customerPhone}
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Business */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">İşletme</span>
                                <span className="text-white">
                                    {selectedReservation.businessName || businesses[selectedReservation.businessId] || ''}
                                </span>
                            </div>

                            {/* Date */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Tarih</span>
                                <span className="text-white">{formatDate(selectedReservation.reservationDate)}</span>
                            </div>

                            {/* Time */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Saat</span>
                                <span className="text-white">{selectedReservation.timeSlot || formatTime(selectedReservation.reservationDate)}</span>
                            </div>

                            {/* Party Size */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Kişi Sayısı</span>
                                <span className="text-white font-bold text-lg">👥 {selectedReservation.partySize}</span>
                            </div>

                            {/* Table Card Numbers */}
                            {selectedReservation.tableCardNumbers && selectedReservation.tableCardNumbers.length > 0 && (
                                <div className="bg-green-600/10 border border-green-500/30 rounded-xl p-4">
                                    <h4 className="text-green-400 font-medium text-sm mb-2">🃏 Masa Kart Numarası</h4>
                                    <div className="flex gap-2">
                                        {selectedReservation.tableCardNumbers.map(n => (
                                            <span key={n} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xl font-bold">
                                                {n}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedReservation.notes && (
                                <div className="border-t border-gray-700 pt-4">
                                    <h4 className="text-yellow-400 font-medium text-sm mb-1 flex items-center gap-1">📝 Müşteri Notu</h4>
                                    <p className="text-white bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3">{selectedReservation.notes}</p>
                                </div>
                            )}

                            {/* Confirmed By */}
                            {selectedReservation.confirmedBy && selectedReservation.status !== 'pending' && (
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">İşlem Yapan</span>
                                    <span className="text-gray-300">{selectedReservation.confirmedBy}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="border-t border-gray-700 pt-4 flex gap-3">
                                {selectedReservation.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleStatusChange(selectedReservation, 'confirmed')}
                                            className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition"
                                        >
                                            ✅ Onayla
                                        </button>
                                        <button
                                            onClick={() => handleStatusChange(selectedReservation, 'rejected')}
                                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition"
                                        >
                                            ❌ Reddet
                                        </button>
                                    </>
                                )}
                                {selectedReservation.status === 'confirmed' && (
                                    <button
                                        onClick={() => handleStatusChange(selectedReservation, 'cancelled')}
                                        className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition"
                                    >
                                        🚫 İptal Et
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Card Number Selection Modal */}
            {showCardModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">🃏 Masa Kart Numarası Seçin</h2>
                            <p className="text-gray-400 text-sm mt-1">Müşteriye verilecek masa kartını seçin</p>
                            <div className="flex items-center gap-4 mt-3 text-xs">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Seçili</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-600 inline-block" /> Boş</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/50 border border-red-500/30 inline-block" /> Dolu</span>
                            </div>
                        </div>
                        <div className="p-6">
                            {cardModalLoading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto" />
                                    <p className="text-gray-400 mt-3 text-sm">Masa durumu kontrol ediliyor...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-3">
                                    {Array.from({ length: businessMaxTables[showCardModal.reservation.businessId] || 0 }, (_, i) => i + 1).map(num => {
                                        const isOccupied = occupiedCards.has(num);
                                        const isSelected = selectedCards.has(num);
                                        return (
                                            <button
                                                key={num}
                                                disabled={isOccupied}
                                                onClick={() => {
                                                    setSelectedCards(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(num)) next.delete(num);
                                                        else next.add(num);
                                                        return next;
                                                    });
                                                }}
                                                className={`aspect-square rounded-xl text-xl font-bold transition-all ${isOccupied
                                                    ? 'bg-red-900/30 border border-red-500/30 text-red-400/50 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-green-500 border-2 border-green-400 text-white shadow-lg shadow-green-500/30 scale-105'
                                                        : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                                                    }`}
                                            >
                                                {num}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 flex gap-3">
                            <button
                                onClick={() => { setShowCardModal(null); setSelectedCards(new Set()); }}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition"
                            >
                                İptal
                            </button>
                            <button
                                disabled={selectedCards.size === 0}
                                onClick={() => {
                                    const sorted = Array.from(selectedCards).sort((a, b) => a - b);
                                    confirmWithCards(showCardModal.reservation, sorted);
                                }}
                                className={`flex-[2] py-3 rounded-lg font-medium transition ${selectedCards.size === 0
                                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                    }`}
                            >
                                {selectedCards.size === 0
                                    ? 'Numara Seçin'
                                    : `✅ Onayla (${selectedCards.size} masa)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
