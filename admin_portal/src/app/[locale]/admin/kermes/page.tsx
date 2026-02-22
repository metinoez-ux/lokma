'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { KermesEvent } from '@/types';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

type KermesWithOrg = KermesEvent & {
    organizationName?: string;
    organizationPhone?: string;
    organizationAddress?: string;
    organizationCity?: string;
    organizationPostalCode?: string;
    productCount?: number;
};

export default function KermesListPage() {
    
  const t = useTranslations('AdminKermes');
const { admin, loading: adminLoading } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<KermesWithOrg[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [timeStatusFilter, setTimeStatusFilter] = useState<'all' | 'past' | 'active' | 'future' | 'archived'>('all');
    const router = useRouter();

    // Calculate kermes status based on dates
    type TimeStatus = 'past' | 'active' | 'future';
    const getKermesTimeStatus = (event: KermesWithOrg): TimeStatus => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const parseDate = (date: any): Date | null => {
            if (!date) return null;

            // Firestore Timestamp object
            if (date && typeof date.toDate === 'function') {
                return date.toDate();
            }
            // Firestore Timestamp as plain object (seconds, nanoseconds)
            if (date && typeof date === 'object' && 'seconds' in date) {
                return new Date(date.seconds * 1000);
            }
            // ISO string or date string
            if (typeof date === 'string') {
                const parsed = new Date(date);
                if (!isNaN(parsed.getTime())) return parsed;
            }
            // Already a Date
            if (date instanceof Date) {
                return date;
            }
            return null;
        };

        const e = event as any;
        const startDate = parseDate(e.startDate) || parseDate(e.date);
        const endDate = parseDate(e.endDate) || startDate;

        if (!startDate) return 'future'; // Tarihi belirsiz

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : start;
        end.setHours(23, 59, 59, 999);

        if (now < start) return 'future';
        if (now > end) return 'past';
        return 'active';
    };

    // Check if kermes should be auto-deactivated (1 day after end date)
    const shouldAutoDeactivate = (event: KermesWithOrg): boolean => {
        const e = event as any;
        const parseDate = (date: any): Date | null => {
            if (!date) return null;
            if (date && typeof date.toDate === 'function') return date.toDate();
            if (date && typeof date === 'object' && 'seconds' in date) return new Date(date.seconds * 1000);
            if (typeof date === 'string') {
                const parsed = new Date(date);
                if (!isNaN(parsed.getTime())) return parsed;
            }
            if (date instanceof Date) return date;
            return null;
        };

        const endDate = parseDate(e.endDate) || parseDate(e.startDate) || parseDate(e.date);
        if (!endDate) return false;

        const now = new Date();
        const oneDayAfterEnd = new Date(endDate);
        oneDayAfterEnd.setDate(oneDayAfterEnd.getDate() + 1);
        oneDayAfterEnd.setHours(23, 59, 59, 999);

        return now > oneDayAfterEnd && event.isActive === true;
    };

    const getStatusConfig = (status: TimeStatus) => {
        switch (status) {
            case 'past':
                return { label: 'Geçmiş', color: 'bg-gray-600', border: 'border-gray-500', text: 'text-gray-300', bg: 'bg-gray-800/50' };
            case 'active':
                return { label: t('aktif'), color: 'bg-green-600', border: 'border-green-500', text: 'text-green-400', bg: 'bg-green-900/20' };
            case 'future':
                return { label: 'Yaklaşan', color: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-900/20' };
        }
    };

    // Format date range - check both 'date' and 'startDate' fields for compatibility
    const formatDateRange = (event: KermesWithOrg) => {
        const formatDate = (date: any) => {
            if (!date) return null;
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        // Try startDate first, then fallback to date
        const startDate = (event as any).startDate || (event as any).date;
        const endDate = (event as any).endDate;
        const start = formatDate(startDate);
        const end = formatDate(endDate);
        if (start && end && start !== end) {
            return `${start} - ${end}`;
        }
        return start || t('tarih_yok');
    };

    // Get location display - try multiple fields
    const getLocationDisplay = (event: KermesWithOrg) => {
        // Priority: city > location > address > organizationCity
        return event.city || event.location || event.address || event.organizationCity || '-';
    };

    // Load all kermes events with organization details
    const loadEvents = useCallback(async () => {
        if (!admin) return;

        setLoading(true);
        try {
            const eventsQuery = query(
                collection(db, 'kermes_events'),
                orderBy('createdAt', 'desc')
            );
            const eventsSnapshot = await getDocs(eventsQuery);
            let allEvents = eventsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesEvent));

            // Filter for non-super-admin users
            if (admin.role !== 'super_admin') {
                allEvents = allEvents.filter(e => e.organizerId === admin.id);
            }

            // Fetch organization details and product counts for each kermes
            const eventsWithOrg = await Promise.all(
                allEvents.map(async (event) => {
                    let orgData: any = {};
                    let productCount = 0;

                    // Get organization info
                    if (event.organizationId) {
                        try {
                            const orgDoc = await getDoc(doc(db, 'organizations', event.organizationId));
                            if (orgDoc.exists()) {
                                orgData = orgDoc.data();
                            }
                        } catch (err) {
                            console.error(`Error loading org ${event.organizationId}:`, err);
                        }
                    }

                    // Get product count
                    try {
                        const productsSnapshot = await getDocs(collection(db, 'kermes_events', event.id, 'products'));
                        productCount = productsSnapshot.size;
                    } catch (err) {
                        console.error(`Error loading products for ${event.id}:`, err);
                    }

                    return {
                        ...event,
                        organizationName: orgData.name || orgData.shortName,
                        organizationPhone: orgData.phone,
                        organizationAddress: orgData.address,
                        organizationCity: orgData.city,
                        organizationPostalCode: orgData.postalCode,
                        productCount,
                    } as KermesWithOrg;
                })
            );

            setEvents(eventsWithOrg);

            // Auto-deactivate kermeses that ended more than 1 day ago
            for (const event of eventsWithOrg) {
                if (shouldAutoDeactivate(event)) {
                    try {
                        await updateDoc(doc(db, 'kermes_events', event.id), {
                            isActive: false,
                            autoDeactivatedAt: new Date(),
                        });
                        console.log(`Auto-deactivated kermes: ${event.title}`);
                    } catch (err) {
                        console.error(`Error auto-deactivating ${event.id}:`, err);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading events:', error);
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => {
        if (!adminLoading && admin) {
            loadEvents();
        }
    }, [adminLoading, admin, loadEvents]);

    // Turkish character normalization for search
    const normalizeForSearch = (text: string | null | undefined): string => {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/ş/g, 's').replace(/Ş/g, 's')
            .replace(/ı/g, 'i').replace(/İ/g, 'i')
            .replace(/ü/g, 'u').replace(/Ü/g, 'u')
            .replace(/ö/g, 'o').replace(/Ö/g, 'o')
            .replace(/ç/g, 'c').replace(/Ç/g, 'c')
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'g');
    };

    // Filter events
    const filteredEvents = events
        .filter(event => {
            // Arşiv filtresi
            if (timeStatusFilter === 'archived') {
                return event.isArchived === true;
            }
            // Normal filtre - arşivlenmiş olanları hariç tut
            return !event.isArchived;
        })
        .filter(event => {
            // Time status filter (archived seçiliyse atla)
            if (timeStatusFilter !== 'all' && timeStatusFilter !== 'archived') {
                const timeStatus = getKermesTimeStatus(event);
                if (timeStatus !== timeStatusFilter) return false;
            }

            if (!searchQuery) return true;

            const query = normalizeForSearch(searchQuery);

            // Search across multiple fields - cast to any for extended fields
            const e = event as any;
            const searchableFields = [
                e.title,
                e.city,
                e.postalCode,
                e.address,
                e.location,
                e.contactName,
                e.contactFirstName,
                e.contactLastName,
                e.contactPhone,
                event.organizationName,
                event.organizationCity,
                event.organizationPostalCode,
                event.organizationAddress,
                event.organizationPhone,
            ];

            return searchableFields.some(field =>
                normalizeForSearch(field)?.includes(query) ||
                field?.includes(searchQuery)
            );
        })
        // Sort: Active first, then Future, then Past
        .sort((a, b) => {
            const order = { active: 0, future: 1, past: 2 };
            return order[getKermesTimeStatus(a)] - order[getKermesTimeStatus(b)];
        });

    const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

    const handleArchive = (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setConfirmArchiveId(eventId);
    };

    const handleArchiveConfirm = async () => {
        if (!confirmArchiveId) return;
        try {
            await updateDoc(doc(db, 'kermes_events', confirmArchiveId), {
                isArchived: true,
                archivedAt: new Date(),
            });
            loadEvents();
        } catch (error) {
            console.error('Error archiving:', error);
        }
        setConfirmArchiveId(null);
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!admin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">{t('erisim_reddedildi')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <Link href="/admin/dashboard" className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2">
                    ← Admin Paneli
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            {t('kermes_yonetimi')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {t('tum_kermesleri_yonetin')} {filteredEvents.length} kermes
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Super Admin Only: Settings Buttons */}
                        {admin.role === 'super_admin' && (
                            <>
                                <Link
                                    href="/admin/settings/kermes-menus"
                                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center gap-2 text-sm border border-gray-600"
                                >
                                    <span>🍽️</span>
                                    {t('kermes_menuleri')}
                                </Link>
                                <Link
                                    href="/admin/settings/kermes-categories"
                                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center gap-2 text-sm border border-gray-600"
                                >
                                    <span>📂</span>
                                    {t('menu_kategorileri')}
                                </Link>
                                <Link
                                    href="/admin/settings/kermes-features"
                                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center gap-2 text-sm border border-gray-600"
                                >
                                    <span>⭐</span>
                                    {t('kermes_ozellikleri')}
                                </Link>
                                <Link
                                    href="/admin/settings/kermes-stock-images"
                                    className="px-4 py-2.5 bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-600 hover:to-teal-600 text-white rounded-lg font-medium transition flex items-center gap-2 text-sm border border-cyan-600"
                                >
                                    <span>🖼️</span>
                                    {t('stok_gorseller')}
                                </Link>
                            </>
                        )}
                        {/* Create button for Super Admin and Kermes Admin */}
                        {(admin.role === 'super_admin' || (admin.role as string) === 'admin_kermes') && (
                            <Link
                                href="/admin/kermes/new"
                                className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
                            >
                                <span>➕</span>
                                {t('yeni_kermes_ekle')}
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input
                                type="text"
                                placeholder={t('i_sim_posta_kodu_sehir_veya_yetkili_kisi')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>

                        {/* Time Status Filter */}
                        <select
                            value={timeStatusFilter}
                            onChange={(e) => setTimeStatusFilter(e.target.value as 'all' | 'past' | 'active' | 'future' | 'archived')}
                            className="px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-pink-500 min-w-[180px]"
                        >
                            <option value="all">{t('tum_kermesler')}</option>
                            <option value="active">{t('aktif_devam_eden')}</option>
                            <option value="future">{t('yaklasan')}</option>
                            <option value="past">{t('gecmis')}</option>
                            {admin.role === 'super_admin' && (
                                <option value="archived">{t('arsivlenmis')}</option>
                            )}
                        </select>
                    </div>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="max-w-6xl mx-auto">
                {filteredEvents.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="text-6xl mb-4">🎪</div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            {events.length === 0 ? t('henuz_kermes_yok') : t('sonuc_bulunamadi')}
                        </h2>
                        <p className="text-gray-400 mb-6">
                            {events.length === 0 ? t('i_lk_kermes_etkinliginizi_olusturun') : t('arama_kriterlerinize_uygun_kermes_buluna')}
                        </p>
                        {events.length === 0 && (admin.role === 'super_admin' || (admin.role as string) === 'admin_kermes') && (
                            <Link
                                href="/admin/kermes/new"
                                className="inline-block bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-lg font-semibold"
                            >
                                {t('kermes_olustur')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredEvents.map((event) => {
                            const timeStatus = getKermesTimeStatus(event);
                            const statusConfig = getStatusConfig(timeStatus);
                            const e = event as any;
                            const contactPhone = e.contactPhone || event.organizationPhone;
                            const contactName = e.contactFirstName && e.contactLastName
                                ? `${e.contactFirstName} ${e.contactLastName}`
                                : e.contactName || '-';

                            return (
                                <div
                                    key={event.id}
                                    className={`${statusConfig.bg} rounded-xl p-4 border ${statusConfig.border}/30 hover:border-pink-500/50 transition cursor-pointer group`}
                                    onClick={() => router.push(`/admin/kermes/${event.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Status Indicator */}
                                        <div className={`w-2 h-16 rounded-full ${statusConfig.color}`} />

                                        {/* Icon */}
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                                            🎪
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                                            {/* Title & Org */}
                                            <div className="md:col-span-2">
                                                <h3 className="text-white font-semibold truncate group-hover:text-pink-400 transition">
                                                    {event.title || 'İsimsiz Kermes'}
                                                </h3>
                                                {event.organizationName && (
                                                    <p className="text-gray-400 text-sm truncate">{event.organizationName}</p>
                                                )}
                                            </div>

                                            {/* Date */}
                                            <div className="hidden md:block">
                                                <span className="text-gray-500 text-xs">{t('tarih')}</span>
                                                <p className="text-white text-sm truncate">{formatDateRange(event)}</p>
                                            </div>

                                            {/* Location */}
                                            <div className="hidden md:block">
                                                <span className="text-gray-500 text-xs">📍 Konum</span>
                                                <p className="text-white text-sm truncate">{getLocationDisplay(event)}</p>
                                            </div>

                                            {/* Contact */}
                                            <div className="hidden md:block">
                                                <span className="text-gray-500 text-xs">📞 Sorumlu</span>
                                                <p className="text-white text-sm truncate">{contactName}</p>
                                                {contactPhone && (
                                                    <a
                                                        href={`tel:${contactPhone}`}
                                                        className="text-cyan-400 text-xs hover:text-cyan-300"
                                                        onClick={(ev) => ev.stopPropagation()}
                                                    >
                                                        {contactPhone}
                                                    </a>
                                                )}
                                            </div>

                                            {/* Menu Count */}
                                            <div className="hidden md:block">
                                                <span className="text-gray-500 text-xs">{t('menu')}</span>
                                                <p className="text-cyan-400 text-sm">{event.productCount || 0} {t('urun')}</p>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusConfig.color} text-white hidden sm:block`}>
                                            {statusConfig.label}
                                        </span>

                                        {/* Actions */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            <Link
                                                href={`/admin/kermes/${event.id}`}
                                                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition text-sm font-medium"
                                                onClick={(ev) => ev.stopPropagation()}
                                            >
                                                ✏️
                                            </Link>
                                            <button
                                                onClick={(ev) => handleArchive(event.id, ev)}
                                                className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-amber-600 hover:text-white transition text-sm"
                                            >
                                                📦
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mobile Details */}
                                    <div className="md:hidden mt-3 pt-3 border-t border-gray-700/50 grid grid-cols-2 gap-2 text-xs">
                                        <div><span className="text-gray-500">📅</span> {formatDateRange(event)}</div>
                                        <div><span className="text-gray-500">📍</span> {getLocationDisplay(event)}</div>
                                        <div><span className="text-gray-500">📞</span> {contactPhone || '-'}</div>
                                        <div><span className="text-gray-500">🍽️</span> {event.productCount || 0} {t('urun')}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Archive Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmArchiveId}
                onClose={() => setConfirmArchiveId(null)}
                onConfirm={handleArchiveConfirm}
                title={t('kermes_arsivle')}
                message={t('bu_kermesi_arsivlemek_istediginize_emin_')}
                itemName={events.find(e => e.id === confirmArchiveId)?.title}
                variant="warning"
                confirmText={t('evet_arsivle')}
                loadingText={t('arsivleniyor')}
            />
        </div>
    );
}
