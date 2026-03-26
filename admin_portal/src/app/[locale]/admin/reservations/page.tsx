'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, collectionGroup, getDocs, getDoc, doc, updateDoc, query, orderBy, where, onSnapshot, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { useTranslations } from 'next-intl';
import TableManagementPanel from '@/components/TableManagementPanel';

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
    const t = useTranslations('AdminReservations');
    const { admin, loading: adminLoading } = useAdmin();
    const adminBusinessId = useAdminBusinessId();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [businesses, setBusinesses] = useState<Record<string, string>>({});
    const [businessCountries, setBusinessCountries] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<string>('today');
    const [businessFilter, setBusinessFilter] = useState<string>('all');
    const [businessSearch, setBusinessSearch] = useState<string>('');
    const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
    const businessSearchRef = useRef<HTMLDivElement>(null);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    // Card number selection
    const [businessMaxTables, setBusinessMaxTables] = useState<Record<string, number>>({});
    const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
    const [occupiedCards, setOccupiedCards] = useState<Set<number>>(new Set());
    const [cardModalLoading, setCardModalLoading] = useState(false);
    // Cancel confirmation modal
    const [showCancelModal, setShowCancelModal] = useState<{ reservation: Reservation } | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelNote, setCancelNote] = useState("");
    // Printer state
    const [printingId, setPrintingId] = useState<string | null>(null);
    const printedAutoRef = useRef<Set<string>>(new Set());
    // Table management
    const [showTableManagement, setShowTableManagement] = useState(false);

    const filteredBusinesses = Object.entries(businesses).filter(([id, name]) =>
        name.toLowerCase().includes(businessSearch.toLowerCase())
    );

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

    useEffect(() => {
        const loadBusinesses = async () => {
            const snapshot = await getDocs(collection(db, 'businesses'));
            const map: Record<string, string> = {};
            const maxTablesMap: Record<string, number> = {};
            const countriesMap: Record<string, string> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.hasReservation) {
                    map[doc.id] = data.companyName || doc.id;
                    maxTablesMap[doc.id] = data.maxReservationTables || 0;
                    countriesMap[doc.id] = data.country || 'DE';
                }
            });
            setBusinesses(map);
            setBusinessMaxTables(maxTablesMap);
            setBusinessCountries(countriesMap);
        };
        loadBusinesses();
    }, []);

    useEffect(() => {
        if (admin && admin.adminType !== 'super' && adminBusinessId) {
            setBusinessFilter(adminBusinessId);
        }
    }, [admin, adminBusinessId]);

    useEffect(() => {
        if (!admin) return;
        setLoading(true);
        const targetBusinessId = admin.adminType !== 'super' ? adminBusinessId : (businessFilter !== 'all' ? businessFilter : null);

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

        if (targetBusinessId) {
            const q = query(
                collection(db, 'businesses', targetBusinessId, 'reservations'),
                where('reservationDate', '>=', Timestamp.fromDate(startDate)),
                where('reservationDate', '<=', Timestamp.fromDate(endDate)),
                orderBy('reservationDate', 'desc')
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setReservations(snapshot.docs.map(d => parseReservation(d, targetBusinessId)));
                setLoading(false);
            }, (error) => { console.error(error); setLoading(false); });
            return () => unsubscribe();
        }

        const q = query(
            collectionGroup(db, 'reservations'),
            where('reservationDate', '>=', Timestamp.fromDate(startDate)),
            where('reservationDate', '<=', Timestamp.fromDate(endDate)),
            orderBy('reservationDate', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReservations(snapshot.docs.map(d => parseReservation(d, d.ref.path.split('/')[1] || '')));
            setLoading(false);
        }, (error) => { console.error(error); setLoading(false); });
        return () => unsubscribe();
    }, [admin, dateFilter, businessFilter, businesses]);

    const parseReservation = (d: any, bId: string): Reservation => {
        const raw = d.data();
        return {
            id: d.id,
            businessId: bId,
            businessName: raw.businessName || businesses[bId] || '',
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
        };
    };

    const filteredReservations = useMemo(() => {
        return reservations.filter(r => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (businessFilter !== 'all' && r.businessId !== businessFilter) return false;
            return true;
        }).sort((a, b) => {
            // Pending first, then time
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return a.timeSlot.localeCompare(b.timeSlot);
        });
    }, [reservations, statusFilter, businessFilter]);

    // Update selected reservation dynamically if it changes in firestore via subscription
    useEffect(() => {
        if (selectedReservation) {
            const updated = reservations.find(r => r.id === selectedReservation.id);
            if (updated) setSelectedReservation(updated);
        }
    }, [reservations]);

    const stats = useMemo(() => ({
        total: filteredReservations.length,
        pending: filteredReservations.filter(r => r.status === 'pending').length,
        confirmed: filteredReservations.filter(r => r.status === 'confirmed').length,
        rejected: filteredReservations.filter(r => r.status === 'rejected').length,
        cancelled: filteredReservations.filter(r => r.status === 'cancelled').length,
    }), [filteredReservations]);

    const fetchOccupiedCards = async (reservation: Reservation) => {
        setCardModalLoading(true);
        try {
             // Sadece ayni gundeki onayli rezervasyonlarin masalarini doluluk olarak isaretle
             const today = new Date(reservation.reservationDate);
             today.setHours(0,0,0,0);
             const endOfDay = new Date(today);
             endOfDay.setHours(23,59,59,999);

            const q = query(
                collection(db, 'businesses', reservation.businessId, 'reservations'),
                where('status', '==', 'confirmed'),
                where('reservationDate', '>=', Timestamp.fromDate(today)),
                where('reservationDate', '<=', Timestamp.fromDate(endOfDay))
            );
            const snap = await getDocs(q);
            const occupied = new Set<number>();
            snap.docs.forEach(d => {
                if (d.id === reservation.id) return; // Don't mark its own tables as occupied
                const cards = d.data().tableCardNumbers;
                if (Array.isArray(cards)) cards.forEach((c: number) => occupied.add(c));
            });
            setOccupiedCards(occupied);
        } catch (e) { console.error(e); } finally { setCardModalLoading(false); }
    };

    // Auto-fetch occupied cards when a reservation is selected, to build the inline grid
    useEffect(() => {
        if (selectedReservation && (selectedReservation.status === 'pending' || selectedReservation.status === 'confirmed')) {
            setSelectedCards(new Set(selectedReservation.tableCardNumbers || []));
            fetchOccupiedCards(selectedReservation);
        } else {
            setSelectedCards(new Set());
            setOccupiedCards(new Set());
        }
    }, [selectedReservation]);

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
            const cardStr = cardNumbers.length > 0 ? ` (Masa ${cardNumbers.join(', ')})` : '';
            showToast(`Rezervasyon onaylandı ✅${cardStr}`, 'success');
        } catch (error) {
            console.error('Error confirming reservation:', error);
            showToast(t('onaylama_sirasinda_hata_olustu'), 'error');
        }
    };

    const handleStatusChange = async (reservation: Reservation, newStatus: ReservationStatus) => {
        try {
            const resRef = doc(db, 'businesses', reservation.businessId, 'reservations', reservation.id);
            const updateData: Record<string, any> = {
                status: newStatus,
                confirmedBy: admin?.displayName || admin?.email || 'Admin',
                updatedAt: Timestamp.now(),
            };
            if (newStatus === 'cancelled') {
                updateData.tableCardNumbers = deleteField();
                updateData.tableCardAssignedBy = deleteField();
                updateData.tableCardAssignedAt = deleteField();
            }
            await updateDoc(resRef, updateData);
            showToast(newStatus === 'rejected' ? 'Rezervasyon reddedildi ❌' : t('rezervasyon_iptal_edildi'), 'success');
            if (newStatus === 'rejected') setSelectedReservation(null);
        } catch (error) {
            showToast(t('durum_guncellenirken_hata_olustu'), 'error');
        }
    };

    async function handleCancel() {
        if (!showCancelModal || !cancelReason) return;
        const reservation = showCancelModal.reservation;
        try {
            const resRef = doc(db, 'businesses', reservation.businessId, 'reservations', reservation.id);
            await updateDoc(resRef, {
                status: 'cancelled',
                cancellationReason: cancelReason,
                cancellationNote: cancelNote.trim() || '',
                cancelledBy: admin?.displayName || admin?.email || 'Admin',
                cancelledAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                tableCardNumbers: deleteField(),
                tableCardAssignedBy: deleteField(),
                tableCardAssignedAt: deleteField(),
            });
            setShowCancelModal(null);
            setSelectedReservation(null);
            setCancelReason('');
            setCancelNote('');
            showToast('Rezervasyon iptal edildi', 'success');
        } catch (err) {
            showToast(t('durum_guncellenirken_hata_olustu'), 'error');
        }
    }

    async function handleReactivate(reservation: Reservation) {
        try {
            const resRef = doc(db, 'businesses', reservation.businessId, 'reservations', reservation.id);
            await updateDoc(resRef, {
                status: 'pending',
                reactivatedBy: admin?.displayName || admin?.email || 'Admin',
                reactivatedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                cancellationReason: deleteField(),
                cancellationNote: deleteField(),
                cancelledBy: deleteField(),
                cancelledAt: deleteField(),
            });
            showToast('Rezervasyon tekrar aktif edildi', 'success');
        } catch (err) {
            showToast(t('durum_guncellenirken_hata_olustu'), 'error');
        }
    }

    const handlePrintReservation = async (reservation: Reservation) => {
        const printerIp = typeof window !== 'undefined' ? localStorage.getItem('printerIp') || '' : '';
        const printerPort = typeof window !== 'undefined' ? parseInt(localStorage.getItem('printerPort') || '9100') : 9100;
        if (!printerIp) { showToast(t('printer_ip_not_set'), 'error'); return; }
        setPrintingId(reservation.id);
        try {
            const bizName = reservation.businessName || businesses[reservation.businessId] || 'LOKMA';
            const res = await fetch('/api/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    printerIp, printerPort, businessName: bizName,
                    reservation: {
                        id: reservation.id, customerName: reservation.customerName,
                        customerPhone: reservation.customerPhone, partySize: reservation.partySize,
                        reservationDate: reservation.reservationDate.toISOString(),
                        timeSlot: reservation.timeSlot, notes: reservation.notes,
                        tableCardNumbers: reservation.tableCardNumbers,
                    },
                }),
            });
            if (res.ok) showToast(t('reservation_printed'), 'success');
            else showToast(`Yazdirma hatasi: ${(await res.json()).error}`, 'error');
        } catch (err: any) { showToast(`Yazdirma hatasi: ${err.message}`, 'error'); } finally { setPrintingId(null); }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const printerIp = typeof window !== 'undefined' ? localStorage.getItem('printerIp') || '' : '';
            if (!printerIp) return;
            const now = new Date();
            reservations.forEach((r) => {
                if (r.status !== 'confirmed' || printedAutoRef.current.has(r.id)) return;
                const resDateTime = new Date(r.reservationDate);
                if (r.timeSlot) {
                    const [hh, mm] = r.timeSlot.split(':').map(Number);
                    if (!isNaN(hh) && !isNaN(mm)) resDateTime.setHours(hh, mm, 0, 0);
                }
                const diffMin = (resDateTime.getTime() - now.getTime()) / 60000;
                if (diffMin > 0 && diffMin <= 20) {
                    printedAutoRef.current.add(r.id);
                    handlePrintReservation(r);
                }
            });
        }, 60000);
        return () => clearInterval(interval);
    }, [reservations, businesses]);

    const formatDate = (date: Date) => date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    const formatTime = (date: Date) => date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    if (adminLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;

    // Time Slot Grouping for Roster
    const timeGroups = useMemo(() => {
        const groups: Record<string, Reservation[]> = {};
        filteredReservations.forEach(r => {
            const timeKey = r.timeSlot || formatTime(r.reservationDate);
            if (!groups[timeKey]) groups[timeKey] = [];
            groups[timeKey].push(r);
        });
        return Object.keys(groups).sort().map(k => ({ time: k, reservations: groups[k] }));
    }, [filteredReservations]);

    const CANCEL_REASONS = ["Masa musait degil", "Isletme kapali", "Personel yetersiz", "Musteri ile iletisim kurulamadi", "Diger"];

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* --- TOP NAVBAR --- */}
            <div className="flex-none bg-card border-b border-border p-4 shadow-sm z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        🍽️ Rezervasyon
                    </h1>
                    <div className="h-6 w-px bg-border mx-2 hidden md:block"></div>
                    
                    {/* Filters Inline */}
                    <div className="flex items-center gap-2">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="h-10 px-3 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        >
                            <option value="today">{t('bugun')}</option>
                            <option value="tomorrow">{t('yarin')}</option>
                            <option value="week">📅 Bu Hafta</option>
                            <option value="month">📅 Bu Ay</option>
                            <option value="all">{t('tumu')}</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-10 px-3 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        >
                            <option value="all">{t('tum_durumlar')}</option>
                            {Object.entries(reservationStatuses).map(([key, value]) => (
                                <option key={key} value={key}>{value.icon} {value.label}</option>
                            ))}
                        </select>
                        
                        {admin?.adminType === 'super' && (
                            <div ref={businessSearchRef} className="relative hidden md:block">
                                <input
                                    type="text"
                                    value={businessFilter === 'all' ? businessSearch : (businesses[businessFilter] || businessSearch)}
                                    onChange={(e) => { setBusinessSearch(e.target.value); setShowBusinessDropdown(true); if (!e.target.value) setBusinessFilter('all'); }}
                                    onFocus={() => setShowBusinessDropdown(true)}
                                    placeholder={t('i_sletme_ara')}
                                    className="h-10 px-3 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm w-48"
                                />
                                {businessFilter !== 'all' && (
                                    <button onClick={() => { setBusinessFilter('all'); setBusinessSearch(''); }} className="absolute right-2 top-2 text-gray-400 hover:text-white">✕</button>
                                )}
                                {showBusinessDropdown && (
                                    <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                                        <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-green-400 font-medium" onClick={() => { setBusinessFilter('all'); setBusinessSearch(''); setShowBusinessDropdown(false); }}>{t('tum_i_sletmeler')}</div>
                                        {filteredBusinesses.map(([id, name]) => (
                                            <div key={id} className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white truncate" onClick={() => { setBusinessFilter(id); setBusinessSearch(''); setShowBusinessDropdown(false); }}>
                                                {name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Stats & Actions */}
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-3">
                        <div className="flex flex-col items-center leading-tight">
                            <span className="text-xl font-bold text-foreground">{stats.total}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{t('toplam')}</span>
                        </div>
                        <div className="h-6 w-px bg-border"></div>
                        <div className="flex flex-col items-center leading-tight">
                            <span className={`text-xl font-bold text-yellow-500 ${stats.pending > 0 ? 'animate-pulse' : ''}`}>{stats.pending}</span>
                            <span className="text-[10px] text-yellow-600/70 uppercase">{t('bekleyen')}</span>
                        </div>
                        <div className="h-6 w-px bg-border"></div>
                        <div className="flex flex-col items-center leading-tight">
                            <span className="text-xl font-bold text-green-500">{stats.confirmed}</span>
                            <span className="text-[10px] text-green-600/70 uppercase">{t('onayli')}</span>
                        </div>
                    </div>
                    
                    {(businessFilter !== 'all' || admin?.adminType !== 'super') && (
                        <button
                            onClick={() => setShowTableManagement(!showTableManagement)}
                            className={`h-10 px-4 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${showTableManagement ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                        >
                            Masa Yönetimi
                        </button>
                    )}
                </div>
            </div>

            {/* --- MAIN MASTER-DETAIL LAYOUT --- */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT PANE: The Roster (Scrollable List) */}
                <div className="w-full md:w-[380px] lg:w-[420px] flex-none border-r border-border bg-[#0f1115] overflow-y-auto flex flex-col">
                    {loading ? (
                         <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                             <p className="text-muted-foreground text-sm">{t('rezervasyonlar_yukleniyor')}</p>
                         </div>
                    ) : filteredReservations.length === 0 ? (
                        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                            <span className="text-4xl mb-3 opacity-50">📭</span>
                            <p className="text-muted-foreground text-sm font-medium">{t('rezervasyon_bulunamadi')}</p>
                        </div>
                    ) : (
                        <div className="pb-24">
                            {timeGroups.map((group) => (
                                <div key={group.time} className="mb-2">
                                    <div className="sticky top-0 bg-[#0f1115]/95 backdrop-blur-md px-4 py-2 border-y border-border/40 z-10 flex justify-between items-center shadow-sm">
                                        <span className="font-bold text-gray-300 text-sm tracking-wide">{group.time}</span>
                                        <span className="text-xs text-gray-500 font-medium">{group.reservations.length} rezervasyon</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-2">
                                        {group.reservations.map((r) => {
                                            const isSelected = selectedReservation?.id === r.id;
                                            const sInfo = reservationStatuses[r.status];
                                            const isPending = r.status === 'pending';
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setSelectedReservation(r)}
                                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${
                                                        isSelected 
                                                            ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-900/10' 
                                                            : isPending
                                                                ? 'bg-yellow-900/10 border-yellow-500/20 hover:border-yellow-500/40'
                                                                : 'bg-card border-border/50 hover:border-gray-500/50 hover:bg-gray-800/50'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold truncate max-w-[200px] ${isSelected ? 'text-blue-100' : 'text-foreground'}`}>
                                                                {r.customerName}
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                                                {r.businessName}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {r.tableCardNumbers && r.tableCardNumbers.length > 0 && (
                                                                <span className="bg-green-600/20 border border-green-500/30 text-green-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                                    T{r.tableCardNumbers.join(',')}
                                                                </span>
                                                            )}
                                                            <span className="bg-purple-600/20 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                                                👥 {r.partySize}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-${sInfo.color}-900/30 text-${sInfo.color}-400`}>
                                                            <span>{sInfo.icon}</span> {sInfo.label}
                                                        </span>
                                                        {r.notes && (
                                                            <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 flex items-center gap-1">
                                                                📝 Not
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT PANE: Detail & Command Center */}
                <div className="hidden md:flex flex-1 flex-col bg-background overflow-hidden relative">
                    {/* Inline Table Management Dashboard if toggled */}
                    {showTableManagement && adminBusinessId && (
                         <div className="absolute inset-0 bg-background z-40 overflow-y-auto p-6">
                             <div className="flex justify-between items-center mb-6">
                                 <h2 className="text-2xl font-bold">Masa Yönetimi Dashboard</h2>
                                 <button onClick={() => setShowTableManagement(false)} className="text-gray-400 hover:text-white px-4 py-2 bg-gray-800 rounded-lg">Kapat</button>
                             </div>
                             <TableManagementPanel
                                businessId={adminBusinessId}
                                businessName={businesses[adminBusinessId] || ''}
                                country={businessCountries[adminBusinessId]}
                            />
                         </div>
                    )}

                    {!selectedReservation ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                            <div className="w-24 h-24 mb-6 rounded-full bg-gray-800 flex items-center justify-center shadow-inner">
                                <span className="text-4xl">🍽️</span>
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Rezervasyon Seçilmedi</h2>
                            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                                Sol taraftaki listeden bir rezervasyon seçerek detayları görüntüleyebilir, masa ataması yapabilir ve durumu güncelleyebilirsiniz.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col h-full overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
                            {/* Selected Reservation Header */}
                            <div className="p-8 border-b border-border bg-card/30">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-${reservationStatuses[selectedReservation.status].color}-600/20 text-${reservationStatuses[selectedReservation.status].color}-400 border border-${reservationStatuses[selectedReservation.status].color}-500/30`}>
                                                {reservationStatuses[selectedReservation.status].icon} {reservationStatuses[selectedReservation.status].label}
                                            </span>
                                            <span className="text-sm font-medium text-muted-foreground">
                                                ID: <span className="text-gray-400 font-mono">{selectedReservation.id.slice(-6).toUpperCase()}</span>
                                            </span>
                                        </div>
                                        <h2 className="text-4xl font-bold text-foreground tracking-tight mt-1">{selectedReservation.customerName}</h2>
                                        
                                        <div className="flex items-center gap-6 mt-4 opacity-80">
                                            <span className="flex items-center gap-2 text-sm">
                                                <span className="text-xl">👥</span> <span className="font-medium text-lg">{selectedReservation.partySize} Kişi</span>
                                            </span>
                                            <span className="flex items-center gap-2 text-sm">
                                                <span className="text-xl">🕒</span> <span className="font-medium text-lg">{selectedReservation.timeSlot || formatTime(selectedReservation.reservationDate)}</span>
                                            </span>
                                            <span className="flex items-center gap-2 text-sm">
                                                <span className="text-xl">📅</span> <span className="font-medium">{formatDate(selectedReservation.reservationDate)}</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons Right Align */}
                                    <div className="flex flex-col gap-3 items-end">
                                        {selectedReservation.customerPhone && (
                                            <a href={`tel:${selectedReservation.customerPhone}`} className="px-5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl font-medium flex items-center gap-2 transition whitespace-nowrap">
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                Ara ({selectedReservation.customerPhone})
                                            </a>
                                        )}
                                        {selectedReservation.status === 'confirmed' && (
                                             <button
                                                 onClick={() => handlePrintReservation(selectedReservation)}
                                                 disabled={printingId === selectedReservation.id}
                                                 className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 rounded-xl font-medium flex items-center gap-2 transition"
                                             >
                                                 {printingId === selectedReservation.id ? 'Yazdırılıyor...' : '🖨️ Fiş Yazdır'}
                                             </button>
                                         )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8">
                                {/* Left Side Details */}
                                <div className="xl:col-span-1 space-y-6">
                                    {/* Primary Workflow Actions */}
                                    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Aksiyonlar</h3>
                                        <div className="flex flex-col gap-3">
                                            {selectedReservation.status === 'pending' && (
                                                <button onClick={() => handleStatusChange(selectedReservation, 'confirmed')} className="w-full py-4 text-center rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]">
                                                    ✅ Onayla (Kabul Et)
                                                </button>
                                            )}
                                            
                                            {selectedReservation.status === 'pending' && (
                                                <button onClick={() => handleStatusChange(selectedReservation, 'rejected')} className="w-full py-3 text-center rounded-xl font-bold bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 transition-all">
                                                    ❌ Reddet
                                                </button>
                                            )}

                                            {selectedReservation.status === 'confirmed' && (
                                                <div className="flex flex-col gap-3">
                                                    <button onClick={() => confirmWithCards(selectedReservation, Array.from(selectedCards).sort((a,b)=>a-b))} disabled={selectedCards.size === 0} className={`w-full py-4 text-center rounded-xl font-bold transition-all active:scale-[0.98] ${selectedCards.size > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}>
                                                        {selectedCards.size > 0 ? `🪑 Masaya Oturt ve Kaydet` : 'Masa Seçimi Bekleniyor'}
                                                    </button>
                                                    <button onClick={() => { setShowCancelModal({ reservation: selectedReservation }); setCancelReason(''); setCancelNote(''); }} className="w-full py-3 text-center rounded-xl font-bold bg-gray-800 hover:bg-gray-700 text-red-400 border border-gray-700 transition-all">
                                                        İptal Et / No-Show
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes Component */}
                                    {selectedReservation.notes && (
                                        <div className="bg-yellow-900/10 rounded-2xl border border-yellow-600/20 p-5">
                                            <h3 className="text-sm font-semibold text-yellow-500/70 uppercase tracking-wider mb-3 flex items-center gap-2">📝 Müşteri Notu</h3>
                                            <p className="text-yellow-100 text-base leading-relaxed bg-black/20 p-4 rounded-xl">
                                                "{selectedReservation.notes}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side Table Management */}
                                <div className="xl:col-span-2">
                                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm min-h-full">
                                        <div className="flex justify-between items-end mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-foreground">Masa Ataması</h3>
                                                <p className="text-sm text-muted-foreground mt-1">Bu misafir için uygun masaları aşağıdan seçin.</p>
                                            </div>
                                            <div className="flex gap-4 text-xs font-medium">
                                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-700 border border-gray-600"></div> Boş</div>
                                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div> Seçili</div>
                                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-900/40 border border-red-500/30"></div> Dolu</div>
                                            </div>
                                        </div>

                                        {(selectedReservation.status === 'pending' || selectedReservation.status === 'confirmed') ? (
                                            cardModalLoading ? (
                                                <div className="h-64 flex flex-col items-center justify-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-4"></div>
                                                    <span className="text-muted-foreground text-sm">Masa durumları kontrol ediliyor...</span>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                                    {Array.from({ length: businessMaxTables[selectedReservation.businessId] || 0 }, (_, i) => i + 1).map(num => {
                                                        const isOccupied = occupiedCards.has(num);
                                                        const isSelected = selectedCards.has(num);
                                                        const isOriginalSelection = (selectedReservation.tableCardNumbers || []).includes(num);
                                                        
                                                        // if it was originally selected, it can be unselected. if it's occupied by OTHERS, it's locked.
                                                        const lockedOccupied = isOccupied && !isOriginalSelection;

                                                        return (
                                                            <button
                                                                key={num}
                                                                disabled={lockedOccupied}
                                                                onClick={() => {
                                                                    setSelectedCards(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(num)) next.delete(num);
                                                                        else next.add(num);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className={`relative aspect-square rounded-xl text-xl md:text-2xl font-black transition-all duration-200 outline-none focus:ring-4 focus:ring-green-500/30 active:scale-95 ${lockedOccupied
                                                                    ? 'bg-red-900/10 border border-red-900/30 text-red-500/30 cursor-not-allowed'
                                                                    : isSelected
                                                                        ? 'bg-gradient-to-br from-green-400 to-green-600 border-none text-white shadow-lg shadow-green-500/40 scale-105 z-10'
                                                                        : 'bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                                                                    }`}
                                                            >
                                                                {num}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )
                                        ) : (
                                            <div className="h-48 flex items-center justify-center bg-black/10 rounded-xl border border-dashed border-gray-700">
                                                <p className="text-muted-foreground text-sm">Bu rezervasyon durumu için masa seçimi yapılamaz ({reservationStatuses[selectedReservation.status].label}).</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* KEEP EXISTING CANCEL MODAL IN MOBILE/FALLBACK VİEW */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground">Rezervasyonu İptal Et</h2>
                            <p className="text-muted-foreground text-sm mt-1">İptal veya No-Show sebebini seçin</p>
                        </div>
                        <div className="p-6 space-y-3">
                            {CANCEL_REASONS.map((reason) => (
                                <label key={reason} className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition border ${cancelReason === reason ? 'bg-red-900/20 border-red-500/50' : 'bg-gray-800/50 border-transparent hover:bg-gray-800'}`}>
                                    <input type="radio" value={reason} checked={cancelReason === reason} onChange={(e) => setCancelReason(e.target.value)} className="w-4 h-4 accent-red-500" />
                                    <span className="text-sm font-medium text-gray-200">{reason}</span>
                                </label>
                            ))}
                            <textarea
                                value={cancelNote} onChange={(e) => setCancelNote(e.target.value)}
                                placeholder="Ek açıklama (isteğe bağlı)..." rows={3}
                                className="w-full mt-4 bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
                            />
                        </div>
                        <div className="p-4 border-t border-border flex gap-3">
                            <button onClick={() => { setShowCancelModal(null); setCancelReason(''); setCancelNote(''); }} className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold transition">Vazgeç</button>
                            <button disabled={!cancelReason} onClick={handleCancel} className={`flex-[2] py-3.5 rounded-xl font-bold transition ${!cancelReason ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'}`}>İptali Onayla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
