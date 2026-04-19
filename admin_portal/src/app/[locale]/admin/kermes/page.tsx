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
 const [badges, setBadges] = useState<{id: string, name: string, iconUrl: string}[]>([]);
 const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [timeStatusFilter, setTimeStatusFilter] = useState<'all' | 'past' | 'active' | 'future' | 'archived'>('all');
  const [selectedBadge, setSelectedBadge] = useState<string>('all');
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'status' | 'newest'>('status');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const router = useRouter();

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, countryFilter, selectedBadge, selectedModality, timeStatusFilter, sortOrder]);

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
 return { label: 'Geçmiş', color: 'bg-gray-600', border: 'border-gray-500', text: 'text-foreground', bg: 'bg-card/50' };
 case 'active':
 return { label: t('aktif'), color: 'bg-green-600', border: 'border-green-500', text: 'text-green-800 dark:text-green-400', bg: 'bg-green-900/20' };
 case 'future':
 return { label: 'Yaklaşan', color: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-800 dark:text-blue-400', bg: 'bg-blue-900/20' };
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

 useEffect(() => {
 const loadBadges = async () => {
 try {
 const snapshot = await getDocs(query(collection(db, 'platform_brands'), orderBy('createdAt', 'desc')));
 setBadges(snapshot.docs.map(d => ({ 
 id: d.id, 
 name: d.data().name,
 iconUrl: d.data().iconUrl || ''
 })));
 } catch (error) {
 console.error('Error loading badges:', error);
 }
 };
 loadBadges();
 }, []);

 // Turkish character normalization for search
 const normalizeForSearch = (text: any): string => {
 if (text === null || typeof text === 'undefined') return '';
 return String(text).toLowerCase()
 .replace(/ş/g, 's').replace(/Ş/g, 's')
 .replace(/ı/g, 'i').replace(/İ/g, 'i')
 .replace(/ü/g, 'u').replace(/Ü/g, 'u')
 .replace(/ö/g, 'o').replace(/Ö/g, 'o')
 .replace(/ç/g, 'c').replace(/Ç/g, 'c')
 .replace(/ğ/g, 'g').replace(/Ğ/g, 'g');
 };

 const normalizeCountry = (country: any): string => {
   if (!country) return 'Bilinmiyor';
   const raw = String(country).toUpperCase().trim();
   if (['DE', 'GERMANY', 'DEUTSCHLAND', 'ALMANYA'].includes(raw)) return 'Almanya';
   if (['TR', 'TURKEY', 'TÜRKIYE', 'TÜRKİYE'].includes(raw)) return 'Türkiye';
   if (['AT', 'AUSTRIA', 'ÖSTERREICH', 'AVUSTURYA'].includes(raw)) return 'Avusturya';
   if (['BG', 'BULGARIA', 'BULGARISTAN', 'BULGARİSTAN'].includes(raw)) return 'Bulgaristan';
   if (['RS', 'SERBIA', 'SIRBISTAN', 'SIRBİSTAN'].includes(raw)) return 'Sırbistan';
   if (['HU', 'HUNGARY', 'MACARISTAN', 'MACARİSTAN'].includes(raw)) return 'Macaristan';
   if (['FR', 'FRANCE', 'FRANSA'].includes(raw)) return 'Fransa';
   if (['NL', 'NETHERLANDS', 'HOLLANDA'].includes(raw)) return 'Hollanda';
   if (['BE', 'BELGIUM', 'BELÇIKA', 'BELÇİKA'].includes(raw)) return 'Belçika';
   if (['CH', 'SWITZERLAND', 'ISVIÇRE', 'İSVİÇRE'].includes(raw)) return 'İsviçre';
   return String(country).charAt(0).toUpperCase() + String(country).slice(1).toLowerCase();
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

 // Rozet Filtresi
 if (selectedBadge !== 'all') {
 if (selectedBadge === 'none') {
   if (event.activeBadgeIds && event.activeBadgeIds.length > 0) return false;
 } else {
   if (!event.activeBadgeIds?.includes(selectedBadge)) return false;
 }
 }

 // Sipariş Türü Filtresi
 if (selectedModality !== 'all') {
 const e = event as any;
 if (selectedModality === 'menu_only' && !e.isMenuOnly) return false;
 if (selectedModality === 'takeaway' && (e.isMenuOnly || !e.hasTakeaway)) return false;
 if (selectedModality === 'delivery' && (e.isMenuOnly || !e.hasDelivery)) return false;
 if (selectedModality === 'dine_in' && (e.isMenuOnly || !e.hasDineIn)) return false;
 }

 // Ülke veya Sıla Yolu Filtresi
 if (countryFilter !== 'all') {
 const e = event as any;
 if (countryFilter === 'sila_yolu') {
   const isSilaStrict = !!e.isSilaYolu;
   const isSilaSoft = e.title && typeof e.title === 'string' && e.title.toLowerCase().includes('sıla');
   if (!isSilaStrict && !isSilaSoft) return false;
 } else {
   if (normalizeCountry(e.country) !== countryFilter) return false;
 }
 }

 if (!searchQuery) return true;

 const query = normalizeForSearch(searchQuery);

 // Search across multiple fields - cast to any for extended fields
 const e = event as any;
 const searchableFields = [
 e.title,
 e.description,
 e.city,
 e.postalCode,
 e.address,
 e.location,
 e.country,
 normalizeCountry(e.country) === 'Avusturya' ? 'österreich austria avusturya' : '',
 normalizeCountry(e.country) === 'Almanya' ? 'deutschland germany almanya' : '',
 normalizeCountry(e.country) === 'Türkiye' ? 'türkiye turkey' : '',
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

 return searchableFields.some(field => {
  if (field === null || field === undefined) return false;
  let strField = '';
  if (typeof field === 'object') {
    try {
      const seen = new WeakSet();
      strField = JSON.stringify(field, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return;
          seen.add(value);
        }
        return value;
      });
    } catch (e) {
      strField = '';
    }
  } else {
    strField = String(field);
  }
  return normalizeForSearch(strField).includes(query) || strField.includes(searchQuery);
 });
 })
 // Sort
 .sort((a, b) => {
 if (sortOrder === 'newest') {
 const aTime = (a as any).createdAt?.seconds || 0;
 const bTime = (b as any).createdAt?.seconds || 0;
 return bTime - aTime;
 }
 // Default Status-based Sort: Active first, then Future, then Past
 const order = { active: 0, future: 1, past: 2 };
 return order[getKermesTimeStatus(a)] - order[getKermesTimeStatus(b)];
 });

 const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
 const paginatedEvents = filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

 const uniqueCountries = Array.from(new Set(events.map((e: any) => e.country ? normalizeCountry(e.country) : null).filter(Boolean))).sort();

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
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
          ← Admin Paneli
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {t('kermes_yonetimi')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('tum_kermesleri_yonetin')} {filteredEvents.length} kermes
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(admin.role === 'super_admin' || (admin.role as string) === 'admin_kermes') && (
              <Link
                href="/admin/kermes/new"
                className="px-6 py-3 bg-white hover:bg-gray-200 text-black dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900 rounded-xl font-bold transition shadow-sm w-full sm:w-auto inline-flex justify-center whitespace-nowrap"
              >
                <span>➕</span>
                {t('yeni_kermes_ekle')}
              </Link>
            )}
          </div>
        </div>

        {/* SİSTEM AYARLARI */}
        <div className="mt-8 border border-border/50 rounded-xl bg-card p-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>⚙️</span> SİSTEM AYARLARI
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/settings/kermes-menus" className="px-4 py-2 rounded-lg border border-border/50 bg-background text-foreground text-sm font-medium hover:bg-muted transition">Kermes-Menüs</Link>
            <Link href="/admin/settings/kermes-features" className="px-4 py-2 rounded-lg border border-border/50 bg-background text-foreground text-sm font-medium hover:bg-muted transition">Kermes-Funktionen</Link>
            <Link href="/admin/settings/kermes-categories" className="px-4 py-2 rounded-lg border border-border/50 bg-background text-foreground text-sm font-medium hover:bg-muted transition">Markalar & Rozetler</Link>
            <Link href="/admin/settings/kermes-donation-funds" className="px-4 py-2 rounded-lg border border-border/50 bg-background text-foreground text-sm font-medium hover:bg-muted transition">Bagis Fonlari</Link>
            <Link href="/admin/settings/kermes-gender-types" className="px-4 py-2 rounded-lg border border-border/50 bg-background text-foreground text-sm font-medium hover:bg-muted transition">Bolum Tipleri</Link>
            <Link href="/admin/settings/kermes-stock-images" className="px-4 py-2 rounded-lg border border-border/50 bg-background text-foreground text-sm font-medium hover:bg-muted transition">Archivbilder</Link>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-card border border-border/50 rounded-xl p-4">
          {/* TOP ROW: Search */}
          <div className="relative w-full mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
            <input
              type="text"
              placeholder={t('i_sim_posta_kodu_sehir_veya_yetkili_kisi')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background shadow-sm border border-border/50 rounded-lg text-foreground placeholder:-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition"
            />
          </div>

          {/* BOTTOM ROW: Filters */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full">
            <select
              title="Sıralama"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'status' | 'newest')}
              className="flex-1 w-full lg:w-auto px-3 py-2.5 bg-background shadow-sm text-foreground rounded-lg border border-border/50 focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition appearance-none"
            >
              <option value="status">Tarihe Göre (Önce Aktif)</option>
              <option value="newest">En Son Eklenenler</option>
            </select>

            <select
              title="Ülke Filtresi & Sıla Yolu"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="flex-1 w-full lg:w-auto px-3 py-2.5 bg-background shadow-sm text-foreground rounded-lg border border-border/50 focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition appearance-none"
            >
              <option value="all">Tüm Ülkeler</option>
              <option value="sila_yolu">Sıla Yolu Kermesleri</option>
              {uniqueCountries.map((country: any) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>

            <select
              title="Siparis turu filtrele"
              value={selectedModality}
              onChange={(e) => setSelectedModality(e.target.value)}
              className="flex-1 w-full lg:w-auto px-3 py-2.5 bg-background shadow-sm text-foreground rounded-lg border border-border/50 focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition appearance-none"
            >
              <option value="all">Tüm Sipariş Türleri</option>
              <option value="menu_only">Sadece Menü</option>
              <option value="takeaway">Gel-Al</option>
              <option value="delivery">Kurye</option>
              <option value="dine_in">Masa</option>
            </select>

            <select
              title="Rozet filtrele"
              value={selectedBadge}
              onChange={(e) => setSelectedBadge(e.target.value)}
              className="flex-1 w-full lg:w-auto px-3 py-2.5 bg-background shadow-sm text-foreground rounded-lg border border-border/50 focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition appearance-none"
            >
              <option value="all">Tüm Badgeler</option>
              <option value="none">Sertifikasız Kermesler</option>
              {badges.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              title="Zaman durumu filtrele"
              value={timeStatusFilter}
              onChange={(e) => setTimeStatusFilter(e.target.value as 'all' | 'past' | 'active' | 'future' | 'archived')}
              className="flex-1 w-full lg:w-auto px-3 py-2.5 bg-background shadow-sm text-foreground rounded-lg border border-border/50 focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition appearance-none"
            >
              <option value="all">{t('tum_kermesler') || 'Tüm Kermesler'}</option>
              <option value="active">{t('aktif_devam_eden') || 'Aktif (Devam Eden)'}</option>
              <option value="future">{t('yaklasan') || 'Yaklaşan'}</option>
              <option value="past">{t('gecmis') || 'Geçmiş'}</option>
              {admin.role === 'super_admin' && (
                <option value="archived">{t('arsivlenmis') || 'Arşivlenmiş'}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="max-w-6xl mx-auto">
        {filteredEvents.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">K</div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {events.length === 0 ? t('henuz_kermes_yok') : t('sonuc_bulunamadi')}
            </h2>
            <p className="text-muted-foreground mb-6">
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

 {paginatedEvents.map((event) => {
 const timeStatus = getKermesTimeStatus(event);
 const statusConfig = getStatusConfig(timeStatus);
 const e = event as any;

  const getTimeStatusDisplay = (event: any) => {
     const e = event;
     const parseLocal = (d: any) => {
       if (!d) return null;
       if (d.toDate) return d.toDate();
       if (d.seconds) return new Date(d.seconds * 1000);
       if (typeof d === 'string') return new Date(d);
       if (d instanceof Date) return d;
       return null;
     };
     const startDate = parseLocal(e.startDate) || parseLocal(e.date);
     const endDate = parseLocal(e.endDate) || startDate;
     if (!startDate) return { text: '-', color: 'text-muted-foreground' };
     
     const now = new Date();
     const start = new Date(startDate);
     start.setHours(0,0,0,0);
     const end = endDate ? new Date(endDate) : new Date(start);
     end.setHours(23,59,59,999);
     
     const formatTime = (ms: number) => {
       const totalHrs = Math.floor(ms / (1000 * 60 * 60));
       const days = Math.floor(totalHrs / 24);
       const hrs = totalHrs % 24;
       const months = Math.floor(days / 30);
       const remainingDays = days % 30;
       
       let parts = [];
       if (months > 0) parts.push(`${months} ay`);
       if (remainingDays > 0) parts.push(`${remainingDays} gün`);
       if (hrs > 0 && months === 0) parts.push(`${hrs} saat`);
       return parts.join(' ') || '< 1 saat';
     };

     if (now < start) {
       const ms = start.getTime() - now.getTime();
       return { text: `${formatTime(ms)} kaldı`, color: 'text-cyan-400' };
     } else if (now > end) {
       const ms = now.getTime() - end.getTime();
       return { text: `${formatTime(ms)} geçti`, color: 'text-slate-400' };
     } else {
       const ms = now.getTime() - start.getTime();
       const totalHrs = Math.floor(ms / (1000 * 60 * 60));
       const days = Math.floor(totalHrs / 24);
       const hrs = totalHrs % 24;
       return { text: `${days + 1}. Günü (${hrs} saat)`, color: 'text-green-400 font-bold' };
     }
   };
   const timeDisplay = getTimeStatusDisplay(event);

 const contactPhone = e.contactPhone || event.organizationPhone;
 const contactName = e.contactFirstName && e.contactLastName
 ? `${e.contactFirstName} ${e.contactLastName}`
 : e.contactName || '-';

 return (
 <div
 key={event.id}
 className={`${statusConfig.bg} rounded-xl p-4 border ${statusConfig.border}/30 hover:border-slate-500/50 transition cursor-pointer group`}
 onClick={() => router.push(`/admin/kermes/${event.id}`)}
 >
 <div className="flex items-center gap-4">
 
 <div className={`w-1 h-12 rounded-full ${statusConfig.color}`} />
  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1.8fr_1.5fr_1fr_1fr_0.5fr_1fr] gap-4 items-center">
 
 <div className="min-w-0">
 <h3 className="text-foreground font-semibold truncate transition text-base">
 {event.title || 'İsimsiz Kermes'}
 </h3>
 <div className="flex flex-wrap gap-1.5 mt-1.5">
 {e.isMenuOnly ? (
 <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-md text-[10px] font-medium border border-gray-700">
 Sadece Menü
 </span>
 ) : (
 <>
 {e.hasTakeaway && (
 <span className="px-2 py-0.5 bg-orange-950/50 text-orange-400 rounded-md text-[10px] font-medium border border-orange-500/30">
 🛍️ Gel-Al
 </span>
 )}
 {e.hasDelivery && (
 <span className="px-2 py-0.5 bg-blue-950/50 text-blue-400 rounded-md text-[10px] font-medium border border-blue-500/30">
 🛵 Kurye
 </span>
 )}
 {e.hasDineIn && (
 <span className="px-2 py-0.5 bg-green-950/50 text-green-400 rounded-md text-[10px] font-medium border border-green-500/30">
 Masa
 </span>
 )}
 </>
 )}

 {event.activeBadgeIds && event.activeBadgeIds.map(badgeId => {
 const badgeDef = badges.find(b => b.id === badgeId);
 if (!badgeDef) return null;
 return (
 <span key={badgeId} className="px-2 py-0.5 bg-[#1C1F2E] text-gray-200 rounded-md text-[10px] font-bold border border-gray-700/50 shadow-sm flex items-center gap-1.5">
 {badgeDef.iconUrl ? (
 <img src={badgeDef.iconUrl} alt={badgeDef.name} className="w-3.5 h-3.5 object-contain" />
 ) : (
 <span>🏆</span>
 )}
 {badgeDef.name}
 </span>
 );
 })}
 </div>
 </div>

 <div className="hidden md:block">
 <span className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">{t('tarih')}</span>
 <p className="text-gray-200 text-sm truncate">{formatDateRange(event)}</p>
 </div>

 <div className="hidden md:block">
 <span className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">Konum</span>
 <p className="text-gray-200 text-sm truncate">{getLocationDisplay(event)}</p>
 </div>

 <div className="hidden md:block">
 <span className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">Sorumlu</span>
 <p className="text-gray-200 text-sm truncate">{contactName}</p>
 </div>

 <div className="hidden md:block">
 <span className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">{t('menu')}</span>
 <p className="text-cyan-400 font-medium text-sm">{event.productCount || 0} {t('urun')}</p>
 </div>

 <div className="hidden md:block">
 <span className="text-muted-foreground/60 text-[11px] uppercase tracking-wider">Durum</span>
 <p className={`text-sm font-medium ${timeDisplay.color}`}>{timeDisplay.text}</p>
 </div>

 </div>

 <div className="flex gap-2 flex-shrink-0 ml-2">
  <Link
 href={`/admin/kermes/${event.id}`}
 className="w-10 h-10 flex items-center justify-center bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition shadow-md"
 onClick={(ev) => ev.stopPropagation()}
 >
 ✏️
 </Link>
  </div>
 </div>

 
 <div className="md:hidden mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
 <div><span className="text-muted-foreground/80"></span> {formatDateRange(event)}</div>
 <div><span className="text-muted-foreground/80">📍</span> {getLocationDisplay(event)}</div>
 <div><span className="text-muted-foreground/80">📞</span> {contactPhone || '-'}</div>
 <div><span className="text-muted-foreground/80">🍽️</span> {event.productCount || 0} {t('urun')}</div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {totalPages > 1 && (
  <div className="flex justify-center items-center gap-2 mt-8 mb-4 flex-wrap">
    <button
      onClick={() => setCurrentPage(1)}
      disabled={currentPage === 1}
      className="px-4 py-2 bg-card border border-border/50 rounded-lg disabled:opacity-50 hover:bg-muted transition text-foreground font-medium"
      title={t('birinci_sayfa') || '1. Sayfa'}
    >
      İlk
    </button>
    <button
      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
      className="px-4 py-2 bg-card border border-border/50 rounded-lg disabled:opacity-50 hover:bg-muted transition text-foreground"
    >
      Önceki
    </button>
    
    <div className="flex items-center gap-2 mx-2">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sayfa</span>
      <input
        type="number"
        min={1}
        max={totalPages}
        value={currentPage}
        onChange={(e) => {
          let val = parseInt(e.target.value);
          if (isNaN(val)) return;
          if (val < 1) val = 1;
          if (val > totalPages) val = totalPages;
          setCurrentPage(val);
        }}
        className="w-14 h-10 text-center bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground font-medium"
      />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">/ {totalPages}</span>
    </div>

    <button
      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
      disabled={currentPage === totalPages}
      className="px-4 py-2 bg-card border border-border/50 rounded-lg disabled:opacity-50 hover:bg-muted transition text-foreground"
    >
      Sonraki
    </button>
    <button
      onClick={() => setCurrentPage(totalPages)}
      disabled={currentPage === totalPages}
      className="px-4 py-2 bg-card border border-border/50 rounded-lg disabled:opacity-50 hover:bg-muted transition text-foreground font-medium"
      title={t('sonuncu_sayfa') || 'Son Sayfa'}
    >
      Son
    </button>
  </div>
 )}
 </div>

 
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
