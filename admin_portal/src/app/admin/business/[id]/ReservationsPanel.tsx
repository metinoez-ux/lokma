"use client";

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteField,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Reservation {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    partySize: number;
    reservationDate: Date;
    notes: string;
    status: "pending" | "confirmed" | "rejected" | "cancelled";
    confirmedBy: string | null;
    tableCardNumbers: number[];
    createdAt: Date;
    businessId: string;
    businessName: string;
}

interface ReservationsPanelProps {
    businessId: string;
    businessName: string;
    staffName?: string; // Admin/staff display name for confirmedBy
}

export default function ReservationsPanel({
    businessId,
    businessName,
    staffName = "Admin",
}: ReservationsPanelProps) {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected" | "cancelled">("pending");
    const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "week" | "all">("today");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    // Card number selection
    const [maxTables, setMaxTables] = useState(0);
    const [showCardModal, setShowCardModal] = useState<{ resId: string } | null>(null);
    const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
    const [occupiedCards, setOccupiedCards] = useState<Set<number>>(new Set());
    const [cardModalLoading, setCardModalLoading] = useState(false);

    // Load maxReservationTables from business document
    useEffect(() => {
        const loadMaxTables = async () => {
            try {
                const bizDoc = await getDoc(doc(db, "businesses", businessId));
                if (bizDoc.exists()) {
                    setMaxTables(bizDoc.data()?.maxReservationTables || 0);
                }
            } catch (e) {
                console.error("Error loading maxTables:", e);
            }
        };
        loadMaxTables();
    }, [businessId]);

    const fetchReservations = useCallback(async () => {
        setLoading(true);
        try {
            const ref = collection(db, "businesses", businessId, "reservations");
            const q = query(ref, orderBy("reservationDate", "asc"));

            const snap = await getDocs(q);
            const items: Reservation[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    userId: data.userId || "",
                    userName: data.userName || "Misafir",
                    userEmail: data.userEmail || "",
                    userPhone: data.userPhone || "",
                    partySize: data.partySize || 0,
                    reservationDate: data.reservationDate?.toDate?.() || new Date(),
                    notes: data.notes || "",
                    status: data.status || "pending",
                    confirmedBy: data.confirmedBy || null,
                    tableCardNumbers: data.tableCardNumbers || [],
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    businessId: data.businessId || businessId,
                    businessName: data.businessName || businessName,
                };
            });

            setReservations(items);
        } catch (err) {
            console.error("Error fetching reservations:", err);
        } finally {
            setLoading(false);
        }
    }, [businessId, businessName]);

    useEffect(() => {
        fetchReservations();
    }, [fetchReservations]);

    // Filter by status
    const statusFiltered = filter === "all" ? reservations : reservations.filter((r) => r.status === filter);

    // Filter by date
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    const filtered = statusFiltered.filter((r) => {
        if (dateFilter === "today") return r.reservationDate >= todayStart && r.reservationDate < tomorrowStart;
        if (dateFilter === "tomorrow") return r.reservationDate >= tomorrowStart && r.reservationDate < tomorrowEnd;
        if (dateFilter === "week") return r.reservationDate >= todayStart && r.reservationDate < weekEnd;
        return true; // "all"
    });

    // Get occupied card numbers from currently confirmed reservations
    const getOccupiedCards = useCallback(async (): Promise<Set<number>> => {
        try {
            const q = query(
                collection(db, "businesses", businessId, "reservations"),
                where("status", "==", "confirmed")
            );
            const snap = await getDocs(q);
            const occupied = new Set<number>();
            snap.docs.forEach((d) => {
                const cards = d.data().tableCardNumbers;
                if (Array.isArray(cards)) {
                    cards.forEach((c: number) => occupied.add(c));
                }
            });
            return occupied;
        } catch (e) {
            console.error("Error fetching occupied cards:", e);
            return new Set();
        }
    }, [businessId]);

    // Open card selection modal
    const openCardModal = useCallback(async (resId: string) => {
        if (maxTables <= 0) {
            // No tables configured, confirm directly
            await confirmWithCards(resId, []);
            return;
        }
        setCardModalLoading(true);
        setShowCardModal({ resId });
        setSelectedCards(new Set());
        const occupied = await getOccupiedCards();
        setOccupiedCards(occupied);
        setCardModalLoading(false);
    }, [maxTables, getOccupiedCards]);

    // Confirm with selected card numbers
    const confirmWithCards = async (resId: string, cardNumbers: number[]) => {
        setActionLoading(resId);
        try {
            const resRef = doc(db, "businesses", businessId, "reservations", resId);
            await updateDoc(resRef, {
                status: "confirmed",
                confirmedBy: staffName,
                tableCardNumbers: cardNumbers,
                tableCardAssignedBy: staffName,
                tableCardAssignedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            setReservations((prev) =>
                prev.map((r) => (r.id === resId ? { ...r, status: "confirmed" as const, confirmedBy: staffName, tableCardNumbers: cardNumbers } : r))
            );
            setShowCardModal(null);
            const cardStr = cardNumbers.length > 0 ? ` (Masa ${cardNumbers.join(", ")})` : "";
            setNotification({ msg: `✅ Rezervasyon onaylandı${cardStr}`, type: "success" });
            setTimeout(() => setNotification(null), 3000);
        } catch (err) {
            console.error("Error confirming reservation:", err);
            setNotification({ msg: "Hata oluştu", type: "error" });
            setTimeout(() => setNotification(null), 3000);
        } finally {
            setActionLoading(null);
        }
    };

    async function handleStatusChange(resId: string, newStatus: "confirmed" | "rejected") {
        // For confirmation → open card modal
        if (newStatus === "confirmed") {
            openCardModal(resId);
            return;
        }

        setActionLoading(resId);
        try {
            const resRef = doc(db, "businesses", businessId, "reservations", resId);
            await updateDoc(resRef, {
                status: newStatus,
                confirmedBy: staffName,
                updatedAt: Timestamp.now(),
            });

            // Update local state
            setReservations((prev) =>
                prev.map((r) => (r.id === resId ? { ...r, status: newStatus, confirmedBy: staffName } : r))
            );

            setNotification({
                msg: "❌ Rezervasyon reddedildi",
                type: "success",
            });
            setTimeout(() => setNotification(null), 3000);
        } catch (err) {
            console.error("Error updating reservation:", err);
            setNotification({ msg: "Hata oluştu", type: "error" });
            setTimeout(() => setNotification(null), 3000);
        } finally {
            setActionLoading(null);
        }
    }

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
            confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
            rejected: "bg-red-500/20 text-red-400 border-red-500/30",
            cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        };
        const labels: Record<string, string> = {
            pending: "⏳ Bekliyor",
            confirmed: "✅ Onaylandı",
            rejected: "❌ Reddedildi",
            cancelled: "🚫 İptal",
        };
        return (
            <span className={`text-xs px-2 py-1 rounded-full border ${styles[status] || styles.pending}`}>
                {labels[status] || status}
            </span>
        );
    };

    const formatDate = (d: Date) =>
        d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

    const formatTime = (d: Date) =>
        d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    // Counters
    const pendingCount = reservations.filter((r) => r.status === "pending").length;
    const todayCount = reservations.filter(
        (r) => r.reservationDate >= todayStart && r.reservationDate < tomorrowStart && (r.status === "pending" || r.status === "confirmed")
    ).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        🍽️ Rezervasyon Yönetimi
                        {pendingCount > 0 && (
                            <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                                {pendingCount} bekliyor
                            </span>
                        )}
                    </h3>
                    <p className="text-sm text-gray-400">
                        Bugün {todayCount} aktif rezervasyon
                    </p>
                </div>
                <button
                    onClick={fetchReservations}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm transition"
                >
                    🔄 Yenile
                </button>
            </div>

            {/* Notification */}
            {notification && (
                <div
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${notification.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}
                >
                    {notification.msg}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {/* Date filter */}
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                    {(["today", "tomorrow", "week", "all"] as const).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDateFilter(d)}
                            className={`px-3 py-1 text-xs rounded-md transition ${dateFilter === d ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {d === "today" ? "Bugün" : d === "tomorrow" ? "Yarın" : d === "week" ? "Bu Hafta" : "Tümü"}
                        </button>
                    ))}
                </div>

                {/* Status filter */}
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                    {(["pending", "confirmed", "rejected", "cancelled", "all"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-3 py-1 text-xs rounded-md transition ${filter === s ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {s === "pending"
                                ? `⏳ Bekliyor (${reservations.filter((r) => r.status === "pending").length})`
                                : s === "confirmed"
                                    ? "✅ Onaylı"
                                    : s === "rejected"
                                        ? "❌ Red"
                                        : s === "cancelled"
                                            ? "🚫 İptal"
                                            : "Tümü"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-4xl mb-2">🍽️</p>
                    <p className="font-medium">Rezervasyon bulunamadı</p>
                    <p className="text-sm mt-1">Seçili filtreler için sonuç yok</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((res) => {
                        const isPast = res.reservationDate < now;
                        return (
                            <div
                                key={res.id}
                                className={`bg-gray-800 rounded-xl border ${res.status === "pending" ? "border-yellow-500/30" : "border-gray-700"
                                    } p-4 transition hover:border-gray-600`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    {/* Left: Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            {statusBadge(res.status)}
                                            {isPast && res.status !== "cancelled" && res.status !== "rejected" && (
                                                <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">Geçmiş</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <p className="text-gray-500 text-xs">Müşteri</p>
                                                <p className="text-white font-medium truncate">{res.userName}</p>
                                                {res.userPhone && (
                                                    <p className="text-gray-400 text-xs">{res.userPhone}</p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs">Tarih</p>
                                                <p className="text-white font-medium">{formatDate(res.reservationDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs">Saat</p>
                                                <p className="text-white font-medium text-lg">{formatTime(res.reservationDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs">Kişi</p>
                                                <p className="text-white font-medium text-lg">👥 {res.partySize}</p>
                                            </div>
                                        </div>

                                        {res.notes && (
                                            <div className="mt-2 bg-gray-700/50 rounded-lg px-3 py-2">
                                                <p className="text-xs text-gray-400">📝 Not:</p>
                                                <p className="text-sm text-gray-300">{res.notes}</p>
                                            </div>
                                        )}

                                        {res.confirmedBy && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                {res.status === "confirmed" ? "Onaylayan" : "İşlem yapan"}: {res.confirmedBy}
                                            </p>
                                        )}

                                        {/* Table Card Numbers */}
                                        {res.status === "confirmed" && res.tableCardNumbers.length > 0 && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-gray-500 text-xs">🃏 Masa No:</span>
                                                {res.tableCardNumbers.map((n) => (
                                                    <span key={n} className="bg-green-600 text-white px-2 py-0.5 rounded text-sm font-bold">
                                                        {n}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Actions */}
                                    {res.status === "pending" && !isPast && (
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => handleStatusChange(res.id, "confirmed")}
                                                disabled={actionLoading === res.id}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                                            >
                                                {actionLoading === res.id ? "..." : "✅ Onayla"}
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(res.id, "rejected")}
                                                disabled={actionLoading === res.id}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                                            >
                                                {actionLoading === res.id ? "..." : "❌ Reddet"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
                                    {Array.from({ length: maxTables }, (_, i) => i + 1).map((num) => {
                                        const isOccupied = occupiedCards.has(num);
                                        const isSelected = selectedCards.has(num);
                                        return (
                                            <button
                                                key={num}
                                                disabled={isOccupied}
                                                onClick={() => {
                                                    setSelectedCards((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(num)) next.delete(num);
                                                        else next.add(num);
                                                        return next;
                                                    });
                                                }}
                                                className={`aspect-square rounded-xl text-xl font-bold transition-all ${isOccupied
                                                        ? "bg-red-900/30 border border-red-500/30 text-red-400/50 cursor-not-allowed"
                                                        : isSelected
                                                            ? "bg-green-500 border-2 border-green-400 text-white shadow-lg shadow-green-500/30 scale-105"
                                                            : "bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500"
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
                                    confirmWithCards(showCardModal.resId, sorted);
                                }}
                                className={`flex-[2] py-3 rounded-lg font-medium transition ${selectedCards.size === 0
                                        ? "bg-gray-600 text-gray-500 cursor-not-allowed"
                                        : "bg-green-600 hover:bg-green-500 text-white"
                                    }`}
                            >
                                {selectedCards.size === 0
                                    ? "Numara Seçin"
                                    : `✅ Onayla (${selectedCards.size} masa)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
