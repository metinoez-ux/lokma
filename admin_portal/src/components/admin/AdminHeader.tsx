'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, doc, getDoc, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { AdminType } from '@/types';
import { getRoleLabel } from '@/lib/business-types';
import { locales, localeNames, localeFlags, Locale } from '@/i18n';
import {
    checkHealth, sendPrinterAlert,
    PrinterSettings, DEFAULT_PRINTER_SETTINGS,
    PrinterHealthState, DEFAULT_HEALTH_STATE,
} from '@/services/printerService';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const localeToBcp47: Record<string, string> = {
    de: 'de-DE', en: 'en-US', tr: 'tr-TR', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', nl: 'nl-NL',
};



interface PendingInvitation {
    id: string;
    phone: string;
    role: string;
    businessName?: string;
    businessType?: string;
    invitedByName: string;
    createdAt: Date;
    status: 'pending' | 'registered' | 'approved' | 'rejected';
}

export default function AdminHeader() {
    const t = useTranslations('AdminNav');
    const currentLocale = useLocale();
    const { admin } = useAdmin();
    const adminTypeLabels: Record<string, string> = {
        super: t('superAdmin'),
        kermes: t('kermesAdmin'),
        kermes_staff: t('kermesStaff'),
        cenaze_fonu: t('cenazeFonu'),
        restoran: t('restoranAdmin'),
        restoran_staff: t('restoranStaff'),
        mutfak: t('mutfak'),
        garson: t('garson'),
        teslimat: t('teslimat'),
        kasap: t('kasapAdmin'),
        kasap_staff: t('kasapStaff'),
        bakkal: t('bakkal'),
        market: t('marketAdmin'),
        market_staff: t('marketStaff'),
        hali_yikama: t('haliYikama'),
        hali_surucu: t('haliSurucu'),
        transfer_surucu: t('transferSurucu'),
        tur_rehberi: t('turRehberi'),
    };
    const router = useRouter();
    const pathname = usePathname();
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
    const [loggingOut, setLoggingOut] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [tabletProfileOpen, setTabletProfileOpen] = useState(false);
    const tabletProfileRef = useRef<HTMLDivElement>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [pendingOrderCount, setPendingOrderCount] = useState(0);
    const [oldestPendingTime, setOldestPendingTime] = useState<Date | null>(null);
    const [pendingWaitStr, setPendingWaitStr] = useState('');

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Pending orders wait time string updater
    useEffect(() => {
        if (!oldestPendingTime) { setPendingWaitStr(''); return; }
        const update = () => {
            const diff = Math.floor((Date.now() - oldestPendingTime.getTime()) / 1000);
            if (diff < 60) setPendingWaitStr(`${diff}s`);
            else if (diff < 3600) setPendingWaitStr(`${Math.floor(diff / 60)}m`);
            else setPendingWaitStr(`${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60)}m`);
        };
        update();
        const iv = setInterval(update, 1000);
        return () => clearInterval(iv);
    }, [oldestPendingTime]);

    // Real-time pending orders listener
    const businessId = useAdminBusinessId();
    useEffect(() => {
        if (!admin) return;
        const isSuperAdmin = admin.adminType === 'super';
        const bId = businessId;
        if (!isSuperAdmin && !bId) return;

        // Composite index gerektirmeyen basit sorgu
        const constraints = isSuperAdmin
            ? [where('status', '==', 'pending'), limit(50)]
            : [where('businessId', '==', bId), where('status', '==', 'pending'), limit(50)];

        const q = query(collection(db, 'meat_orders'), ...constraints);
        const unsub = onSnapshot(q, (snap) => {
            setPendingOrderCount(snap.size);
            if (snap.size > 0) {
                // En eski pending siparisi client-side bul
                let oldestDate: Date | null = null;
                snap.docs.forEach(doc => {
                    const ts = doc.data().createdAt;
                    let d: Date | null = null;
                    if (ts instanceof Timestamp) d = ts.toDate();
                    else if (ts?.seconds) d = new Date(ts.seconds * 1000);
                    if (d && (!oldestDate || d < oldestDate)) oldestDate = d;
                });
                setOldestPendingTime(oldestDate || new Date());
            } else {
                setOldestPendingTime(null);
            }
        }, (error) => {
            console.error('[AdminHeader] Pending orders listener error:', error);
            setPendingOrderCount(0);
            setOldestPendingTime(null);
        });
        return () => unsub();
    }, [admin, businessId]);

    // Printer health monitoring state
    const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
    const [printerHealth, setPrinterHealth] = useState<PrinterHealthState>(DEFAULT_HEALTH_STATE);
    const printerHealthRef = useRef<PrinterHealthState>(DEFAULT_HEALTH_STATE);
    const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load printer settings from Firestore for non-super admins
    useEffect(() => {
        const loadPrinterSettings = async () => {
            if (admin?.butcherId && admin?.adminType !== 'super') {
                try {
                    const businessDoc = await getDoc(doc(db, 'businesses', admin.butcherId));
                    if (businessDoc.exists()) {
                        const data = businessDoc.data();
                        if (data.printerSettings) {
                            setPrinterSettings({
                                enabled: data.printerSettings.enabled || false,
                                printerIp: data.printerSettings.printerIp || '',
                                printerPort: data.printerSettings.printerPort || 9100,
                                autoPrint: data.printerSettings.autoPrint || false,
                                printCopies: data.printerSettings.printCopies || 1,
                                printServerUrl: data.printerSettings.printServerUrl || '',
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error loading printer settings:', error);
                }
            }
        };
        loadPrinterSettings();
    }, [admin?.butcherId, admin?.adminType]);

    // Printer health heartbeat (every 30s)
    useEffect(() => {
        if (!printerSettings.enabled || !printerSettings.printerIp || admin?.adminType === 'super') {
            setPrinterHealth(DEFAULT_HEALTH_STATE);
            printerHealthRef.current = DEFAULT_HEALTH_STATE;
            return;
        }

        const runHealthCheck = async () => {
            const prev = printerHealthRef.current;
            const result = await checkHealth(printerSettings);

            const newState: PrinterHealthState = {
                status: result.online ? 'online' : 'offline',
                lastChecked: new Date(),
                lastOnline: result.online ? new Date() : prev.lastOnline,
                responseTimeMs: result.responseTimeMs,
                consecutiveFailures: result.online ? 0 : prev.consecutiveFailures + 1,
                error: result.error,
            };

            if (!result.online && newState.consecutiveFailures < 2) {
                newState.status = 'checking';
            }

            printerHealthRef.current = newState;
            setPrinterHealth(newState);

            // Transition: online/checking -> offline
            if (prev.status !== 'offline' && newState.status === 'offline') {
                const bName = businessInfo?.companyName || 'LOKMA Marketplace';
                sendPrinterAlert({
                    type: 'offline',
                    businessName: bName,
                    printerIp: printerSettings.printerIp,
                    printerPort: printerSettings.printerPort,
                    errorDetails: result.error,
                    adminEmail: admin?.email,
                });
            }

            // Transition: offline -> online
            if (prev.status === 'offline' && newState.status === 'online') {
                const bName = businessInfo?.companyName || 'LOKMA Marketplace';
                sendPrinterAlert({
                    type: 'online',
                    businessName: bName,
                    printerIp: printerSettings.printerIp,
                    printerPort: printerSettings.printerPort,
                    adminEmail: admin?.email,
                });
            }
        };

        runHealthCheck();
        healthIntervalRef.current = setInterval(runHealthCheck, 15000);

        return () => {
            if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [printerSettings.enabled, printerSettings.printerIp, printerSettings.printerPort, admin?.adminType]);

    // Language change handler (replaces LanguageSwitcher component)
    const handleLocaleChange = (newLocale: Locale) => {
        router.replace(pathname, { locale: newLocale });
    };

    const toggleSection = (section: string) => {
        setExpandedSection(prev => prev === section ? null : section);
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
        setExpandedSection(null);
    };

    // Close tablet profile dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tabletProfileRef.current && !tabletProfileRef.current.contains(e.target as Node)) {
                setTabletProfileOpen(false);
            }
        };
        if (tabletProfileOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside as any);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside as any);
        };
    }, [tabletProfileOpen]);

    // Check if a nav item is active (simplified - pathname only)
    const isActiveNav = (href: string) => {
        // Extract base path (remove query params)
        const basePath = href.split('?')[0];
        // For dashboard views, check if we're on dashboard and query matches
        if (href.includes('?view=')) {
            // Check if URL contains the view indicator
            return pathname === '/admin/dashboard';
        }
        return pathname === basePath || pathname?.startsWith(basePath + '/');
    };

    // Business Info - for displaying in header
    const [businessInfo, setBusinessInfo] = useState<{
        id: string;
        companyName: string;
        phone?: string;
        streetAddress?: string;
        postalCode?: string;
        city?: string;
        country?: string;
        imageUrl?: string;
    } | null>(null);

    // Stats counts and lists removed (handled in Analytics page)

    // Load pending invitations - TEMPORARILY DISABLED to fix page loading
    useEffect(() => {
        // Query disabled until Firestore index is created
        // TODO: Create composite index for admin_invitations then re-enable
        setPendingInvitations([]);
    }, [admin]);

    // Load business info for non-super admins
    useEffect(() => {
        const loadBusinessInfo = async () => {
            if (admin?.butcherId && admin?.adminType !== 'super') {
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const businessDoc = await getDoc(doc(db, 'businesses', admin.butcherId));
                    if (businessDoc.exists()) {
                        const data = businessDoc.data();
                        setBusinessInfo({
                            id: businessDoc.id,
                            companyName: data.companyName || data.brand || t('businessLabel'),
                            phone: data.phone || data.phoneNumber || '',
                            streetAddress: data.address?.street || data.streetAddress || '',
                            postalCode: data.address?.postalCode || data.postalCode || '',
                            city: data.address?.city || data.city || '',
                            country: data.address?.country || data.country || '',
                            imageUrl: data.imageUrl || '',
                        });
                    }
                } catch (error) {
                    console.error('Error loading business info:', error);
                }
            }
        };
        loadBusinessInfo();
    }, [admin?.butcherId, admin?.adminType]);

    // Stats loading removed

    // handleChipClick removed

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoggingOut(true);
        // Clear cached admin profile immediately for instant UI feedback
        localStorage.removeItem('mira_admin_profile');
        try {
            await auth.signOut();
        } catch (err) {
            console.error('Logout error:', err);
        }
        // Hard redirect with locale prefix for clean state
        window.location.href = `/${currentLocale}/login`;
    };

    return (
        <>
            {/* ═══════════════════════════════════════════════════════════════════
                SUPER ADMIN TOOLBAR - Kirmizi bar (sadece super admin gorur)
            ═══════════════════════════════════════════════════════════════════ */}
            {admin?.adminType === 'super' && (
                <>
                {/* COMPACT TABLET BAR - visible only on tablet/mobile */}
                <div className="min-[1921px]:hidden bg-[var(--header-bg)] border-b border-[var(--header-border)] relative z-40">
                    <div className="px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="flex items-center justify-center w-9 h-9 rounded-lg text-foreground hover:text-white hover:bg-white/10 transition"
                                aria-label="Menu"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {mobileMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                            <span className="text-sm font-light tabular-nums tracking-wider text-white">
                                {currentTime.toLocaleTimeString(localeToBcp47[currentLocale] || 'de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-gray-500 text-xs">|</span>
                            <span className="text-xs text-muted-foreground">
                                {currentTime.toLocaleDateString(localeToBcp47[currentLocale] || 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span className="text-gray-500 text-xs">|</span>
                            <span className="text-xs text-muted-foreground">
                                {currentTime.toLocaleDateString(localeToBcp47[currentLocale] || 'de-DE', { weekday: 'short' })}
                            </span>
                            {/* Printer status compact */}
                            <Link
                                href="/admin/settings"
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition ${!printerSettings.enabled || !printerSettings.printerIp ? 'text-gray-500' : printerHealth.status === 'online' ? 'text-green-800 dark:text-green-400' : printerHealth.status === 'offline' ? 'text-red-800 dark:text-red-400 animate-pulse' : 'text-yellow-800 dark:text-yellow-400'}`}
                                title={`Printer: ${printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Checking...' : 'Not configured'}`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                <span className={`w-1.5 h-1.5 rounded-full ${!printerSettings.enabled || !printerSettings.printerIp ? 'bg-slate-500 dark:bg-slate-400' : printerHealth.status === 'online' ? 'bg-green-400' : printerHealth.status === 'offline' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                            </Link>
                        </div>

                        {/* Center: Pending Orders Chip */}
                        {pendingOrderCount > 0 && (
                            <button
                                onClick={() => router.push('/admin/orders')}
                                className="flex items-center gap-1.5 bg-yellow-600/25 border border-yellow-500/50 rounded-full px-3 py-1 animate-pulse hover:bg-yellow-600/40 transition"
                            >
                                <span className="text-yellow-800 dark:text-yellow-400 text-xs font-bold">{pendingOrderCount}</span>
                                <span className="text-yellow-300 text-[10px]">{t('pendingOrders')}</span>
                                {pendingWaitStr && (
                                    <span className="text-yellow-500 text-[10px] font-mono">{pendingWaitStr}</span>
                                )}
                            </button>
                        )}
                        <div className="relative" ref={tabletProfileRef}>
                            <button 
                                onClick={() => setTabletProfileOpen(!tabletProfileOpen)}
                                className="flex items-center gap-1.5 hover:bg-white/10 rounded-lg px-2 py-1 transition"
                            >
                                <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-white/10">
                                    {admin.photoURL ? (
                                        <img
                                            src={admin.photoURL}
                                            alt={admin.displayName || t('profile')}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-foreground font-bold text-sm">
                                            {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="hidden sm:flex flex-col items-start ml-1">
                                    <span className="text-white text-xs font-medium max-w-[110px] truncate leading-tight">
                                        {admin.displayName || 'Super Admin'}
                                    </span>
                                    <span className="text-red-400 font-bold text-[10px] leading-tight uppercase tracking-wider">
                                        {t('superAdmin')}
                                    </span>
                                </div>
                                <span className="text-slate-400 text-[10px] ml-1">{`\u25BC`}</span>
                            </button>
                            {tabletProfileOpen && (
                            <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border z-50 min-w-[200px]">
                                <Link href="/admin/settings" onClick={() => setTabletProfileOpen(false)} className="block px-4 py-3 border-b border-border hover:bg-muted/50 transition">
                                    <p className="text-foreground text-sm font-medium truncate">{admin.displayName || 'Super Admin'}</p>
                                    <p className="text-muted-foreground text-xs truncate">{admin.email || ''}</p>
                                </Link>
                                <div className="py-2 border-b border-border">
                                    <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('language')}</p>
                                    <div className="flex flex-wrap gap-1 px-3 py-1">
                                        {locales.map((l) => (
                                            <button
                                                key={l}
                                                onClick={() => { handleLocaleChange(l); setTabletProfileOpen(false); }}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition ${l === currentLocale ? 'bg-blue-600/30 text-blue-300 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                            >
                                                <span>{localeFlags[l]}</span>
                                                <span>{localeNames[l]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onMouseDown={handleLogout}
                                    disabled={loggingOut}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-900/40 hover:text-red-800 dark:text-red-400 transition text-xs font-medium rounded-b-lg disabled:opacity-50"
                                >
                                    {loggingOut ? '...' : t('logout')}
                                </button>
                            </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FULL DESKTOP BAR - hidden on tablet */}
                <div className="hidden min-[1921px]:block bg-[var(--header-bg)] border-b border-[var(--header-border)] shadow-md relative z-40">
                    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4">

                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                            {/* 1. Analytik */}
                            <Link
                                href="/admin/analytics"
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/analytics')
                                    ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {t('analytics')}
                            </Link>
                            {/* Business Nav - Super Admin Only */}
                            {admin?.adminType === 'super' && (
                            <div className="relative group">
                                <Link
                                    href="/admin/business"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/business') || isActiveNav('/admin/sectors') || isActiveNav('/admin/kermes') || isActiveNav('/admin/benutzerverwaltung') || isActiveNav('/admin/customers') || isActiveNav('/admin/partners') || isActiveNav('/admin/drivers') || isActiveNav('/admin/volunteers') || isActiveNav('/admin/staff-shifts') || isActiveNav('/admin/superadmins') || isActiveNav('/admin/drivers/tips') || isActiveNav('/admin/sponsored-ads')
                                        ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    Lokma Partner
                                    <span className="text-[10px]">▼</span>
                                </Link>
                                {/* Dropdown */}
                                <div className="absolute left-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/business" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('businesses')}
                                        </Link>
                                        <Link href="/admin/benutzerverwaltung" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('benutzerverwaltung')}
                                        </Link>
                                        <Link href="/admin/sectors" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('sectors')}
                                        </Link>
                                        <Link href="/admin/kermes" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('kermes')}
                                        </Link>
                                        <div className="border-t border-border my-1" />
                                        <Link href="/admin/drivers/tips" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('trinkgeld')}
                                        </Link>
                                        <Link href="/admin/staff-shifts" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('arbeitszeiten')}
                                        </Link>
                                        <Link href="/admin/sponsored-ads" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('sponsoredAds')}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* 2. Bestellungen */}
                            <Link
                                href="/admin/orders"
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/orders')
                                    ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {t('orders')}
                            </Link>

                            {/* 3. Reservierungen */}
                            <Link
                                href="/admin/reservations"
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/reservations')
                                    ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {t('reservations')}
                            </Link>

                            {/* 4. Produkte & Kategorien */}
                            <div className="relative group">
                                <button
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                        isActiveNav('/admin/products') || isActiveNav('/admin/ai-menu')
                                            ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {t('productsCategories')} <span className="text-[10px] opacity-70">&#9660;</span>
                                </button>
                                <div className="absolute left-0 top-full pt-1 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                                    <div className="bg-card border border-border rounded-xl shadow-2xl shadow-black/50 py-2 min-w-[200px] overflow-hidden">
                                        <Link href="/admin/products" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('productsCategories')}
                                        </Link>
                                        <Link href="/admin/ai-menu" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('aiMenu')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Buchhaltung */}
                            <div className="relative group">
                                <Link
                                    href="/admin/invoices"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/invoices') || isActiveNav('/admin/commissions') || isActiveNav('/admin/plans')
                                        ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('accounting')}
                                    <span className="text-[10px]">&#9660;</span>
                                </Link>
                                <div className="absolute left-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[180px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/invoices" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('invoices')}
                                        </Link>
                                        <Link href="/admin/commissions" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('commissions')}
                                        </Link>
                                        <Link href="/admin/plans" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('plans')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Kampagnen */}
                            <div className="relative group">
                                <Link
                                    href="/admin/promotions"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/promotions') || isActiveNav('/admin/coupons') || isActiveNav('/admin/deals') || isActiveNav('/admin/promotion-templates')
                                        ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('promotions')}
                                    <span className="text-[10px]">&#9660;</span>
                                </Link>
                                <div className="absolute left-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/promotions" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('businessCampaigns')}
                                        </Link>
                                        <Link href="/admin/coupons" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('coupons')}
                                        </Link>
                                        <Link href="/admin/deals" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('deals')}
                                        </Link>
                                        <div className="border-t border-border my-1"></div>
                                        <Link href="/admin/promotion-templates" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('campaignTemplates')}
                                        </Link>
                                    </div>
                                </div>
                            </div>



                            {/* 8. Service */}
                            <div className="relative group">
                                <Link
                                    href="/admin/activity-logs"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/activity-logs') || isActiveNav('/admin/reports')
                                        ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('service')}
                                    <span className="text-[10px]">&#9660;</span>
                                </Link>
                                <div className="absolute left-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/activity-logs" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('activityLogs')}
                                        </Link>
                                        <Link href="/admin/reports" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground">
                                            {t('reports')}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Settings, Profile */}
                        <div className="flex items-center shrink-0 gap-2">
                            <ThemeToggle />
                            {/* Einstellungen Nav — en sag taraf */}
                            <div className="relative group">
                                <button
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                        isActiveNav('/admin/settings') ||
                                        isActiveNav('/admin/ui-translations') || isActiveNav('/admin/image-generator') ||
                                        isActiveNav('/admin/ameise')
                                            ? 'bg-white/10 border border-[var(--header-border)] text-white shadow-inner'
                                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {t('settings')}
                                    <span className="text-[10px]">&#9660;</span>
                                </button>
                                <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[240px] overflow-hidden">
                                    <div className="py-1">
                                        <p className="px-4 py-1.5 text-[10px] uppercase font-bold text-gray-500 tracking-wider">{t('settings')}</p>
                                        <Link href="/admin/settings" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('iotSettings')}
                                        </Link>
                                        <Link href="/admin/settings/company" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('companySettings')}
                                        </Link>
                                        <Link href="/admin/ui-translations" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('uiTranslations')}
                                        </Link>
                                        <Link href="/admin/image-generator" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('imageGen')}
                                        </Link>
                                        <Link href="/admin/ameise" className="px-4 py-2.5 text-xs transition-colors text-foreground hover:bg-muted hover:text-foreground block">
                                            {t('ameise')}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            <div className="relative group ml-2">
                                <button className="flex items-center gap-1.5 hover:bg-white/10 rounded-lg px-2 py-1 transition">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-white/10 shadow-sm">
                                        {admin.photoURL ? (
                                            <img
                                                src={admin.photoURL}
                                                alt={admin.displayName || t('profile')}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-foreground font-bold text-sm">
                                                {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="hidden md:flex flex-col items-start ml-2">
                                        <span className="text-foreground text-sm font-bold max-w-[120px] truncate leading-tight">
                                            {admin.displayName || 'Metin Öz'}
                                        </span>
                                        <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold leading-tight uppercase tracking-wider border border-red-500/20">
                                            {t('superAdmin')}
                                        </span>
                                    </div>
                                    <span className="text-slate-400 text-[10px] ml-1">▼</span>
                                </button>

                                {/* Dropdown Menu (including Settings) */}
                                <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
                                    <Link href="/admin/settings" className="block px-4 py-3 border-b border-border hover:bg-muted/50 transition">
                                        <p className="text-foreground text-sm font-medium truncate">
                                            {admin.displayName || 'Super Admin'}
                                        </p>
                                        <p className="text-muted-foreground text-xs truncate">
                                            {admin.email || admin.phone || ''}
                                        </p>
                                    </Link>

                                    {/* Language Selection */}
                                    <div className="py-2 border-b border-border">
                                        <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('language')}</p>
                                        <div className="flex flex-wrap gap-1 px-3 py-1">
                                            {locales.map((l) => (
                                                <button
                                                    key={l}
                                                    onClick={() => handleLocaleChange(l)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition ${l === currentLocale ? 'bg-blue-600/30 text-blue-300 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                                >
                                                    <span>{localeFlags[l]}</span>
                                                    <span>{localeNames[l]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>



                                    <button
                                        onMouseDown={handleLogout}
                                        disabled={loggingOut}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-900/40 hover:text-red-800 dark:text-red-400 transition text-xs font-medium rounded-b-lg disabled:opacity-50"
                                    >
                                        {loggingOut ? '...' : t('logout')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MOBILE SLIDE-IN PANEL (Super Admin) */}
                    {mobileMenuOpen && (
                        <>
                            <div
                                className="min-[1921px]:hidden fixed inset-0 bg-black/60 z-40"
                                onClick={closeMobileMenu}
                            />
                            <div className="min-[1921px]:hidden fixed top-0 left-0 h-full w-72 bg-background border-r border-border z-50 overflow-y-auto shadow-2xl">
                                <div className="p-4 border-b border-border flex items-center justify-between">
                                    <span className="text-white font-semibold text-sm">Menu</span>
                                    <button onClick={closeMobileMenu} className="text-muted-foreground hover:text-white text-xl">{'\u2715'}</button>
                                </div>
                                <nav className="py-2">
                                    {/* 1. Analytik */}
                                    <Link href="/admin/analytics" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('analytics')}</Link>

                                    {/* 2. Lokma Partner - Super Admin Only */}
                                    {admin?.adminType === 'super' && (
                                    <div>
                                        <button onClick={() => toggleSection('business')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            Lokma Partner
                                            <span className={`text-xs transition-transform ${expandedSection === 'business' ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
                                        </button>
                                        {expandedSection === 'business' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/business" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('businesses')}</Link>
                                                <Link href="/admin/benutzerverwaltung" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('benutzerverwaltung')}</Link>
                                                <Link href="/admin/sectors" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('sectors')}</Link>
                                                <Link href="/admin/kermes" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('kermes')}</Link>
                                                <Link href="/admin/sponsored-ads" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('sponsoredAds')}</Link>
                                            </div>
                                        )}
                                    </div>
                                    )}

                                    {/* 2. Bestellungen */}
                                    <Link href="/admin/orders" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('orders')}</Link>

                                    {/* 3. Reservierungen */}
                                    <Link href="/admin/reservations" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('reservations')}</Link>

                                    {/* 4. Produkte & Kategorien */}
                                    <div>
                                        <button onClick={() => toggleSection('products')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('productsCategories')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'products' ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
                                        </button>
                                        {expandedSection === 'products' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/products" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('productsCategories')}</Link>
                                                <Link href="/admin/ai-menu" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('aiMenu')}</Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* 5. Buchhaltung */}
                                    <div>
                                        <button onClick={() => toggleSection('accounting')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('accounting')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'accounting' ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
                                        </button>
                                        {expandedSection === 'accounting' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/invoices" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('invoices')}</Link>
                                                <Link href="/admin/commissions" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('commissions')}</Link>
                                                <Link href="/admin/plans" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('plans')}</Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* 6. Kampagnen */}
                                    <div>
                                        <button onClick={() => toggleSection('promotions')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('promotions')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'promotions' ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
                                        </button>
                                        {expandedSection === 'promotions' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/promotions" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('businessCampaigns')}</Link>
                                                <Link href="/admin/coupons" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('coupons')}</Link>
                                                <Link href="/admin/deals" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('deals')}</Link>
                                                <Link href="/admin/promotion-templates" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('campaignTemplates')}</Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* 8. Service */}
                                    <div>
                                        <button onClick={() => toggleSection('service')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('service')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'service' ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
                                        </button>
                                        {expandedSection === 'service' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/activity-logs" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('activityLogs')}</Link>
                                                <Link href="/admin/reports" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('reports')}</Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* 9. Einstellungen */}
                                    <div className="border-t border-border mt-1 pt-1">
                                        <button onClick={() => toggleSection('platform')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('settings')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'platform' ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
                                        </button>
                                        {expandedSection === 'platform' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/settings" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('iotSettings')}</Link>
                                                <Link href="/admin/settings/company" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('companySettings')}</Link>
                                                <Link href="/admin/ui-translations" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('uiTranslations')}</Link>
                                                <Link href="/admin/image-generator" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('imageGen')}</Link>
                                                <Link href="/admin/ameise" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('ameise')}</Link>
                                            </div>
                                        )}
                                    </div>
                                </nav>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                UNIFIED ADMIN BAR - Business info + Navigation in one compact row
            ═══════════════════════════════════════════════════════════════════ */}
            {admin && admin.adminType !== 'super' && (
                <div className="bg-card border-b border-border">
                    <div className="max-w-7xl mx-auto px-4 py-2">
                        <div className="flex items-center gap-4">
                            {/* Business Logo + Name + Address (compact) */}
                            {businessInfo && (
                                <div
                                    onClick={() => router.push('/admin/orders')}
                                    className="flex items-center gap-3 shrink-0 mr-2 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1 -mx-2 -my-1 transition"
                                    title={t('orders')}
                                >
                                    <div className="w-9 h-9 bg-white/10 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                                        {businessInfo.imageUrl ? (
                                            <img
                                                src={businessInfo.imageUrl}
                                                alt={businessInfo.companyName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-foreground font-bold text-sm">
                                                {businessInfo.companyName.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-foreground font-semibold text-sm truncate leading-tight">
                                            {businessInfo.companyName}
                                        </h1>
                                        {(businessInfo.streetAddress || businessInfo.city) && (
                                            <p className="text-muted-foreground text-xs truncate leading-tight">
                                                {businessInfo.streetAddress && `${businessInfo.streetAddress}, `}{businessInfo.postalCode} {businessInfo.city}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Separator */}
                            {businessInfo && <div className="w-px h-6 bg-slate-600 shrink-0" />}

                            {/* Hamburger button - visible only on tablet/mobile */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="min-[1921px]:hidden flex items-center justify-center w-8 h-8 rounded-md text-foreground hover:text-white hover:bg-white/10 transition"
                                aria-label="Menu"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {mobileMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>

                            {/* Tablet-only status info */}
                            <div className="min-[1921px]:hidden flex items-center gap-2 flex-1 justify-center">
                                <span className="text-sm font-light tabular-nums tracking-wider text-white">
                                    {currentTime.toLocaleTimeString(localeToBcp47[currentLocale] || 'de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-gray-500 text-xs">|</span>
                                <span className="text-xs text-muted-foreground">
                                    {currentTime.toLocaleDateString(localeToBcp47[currentLocale] || 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <span className="text-gray-500 text-xs">|</span>
                                <span className="text-xs text-muted-foreground">
                                    {currentTime.toLocaleDateString(localeToBcp47[currentLocale] || 'de-DE', { weekday: 'short' })}
                                </span>
                                {/* Printer status compact */}
                                <Link
                                    href="/admin/settings"
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition ${
                                        !printerSettings.enabled || !printerSettings.printerIp
                                            ? 'text-gray-500'
                                            : printerHealth.status === 'online'
                                            ? 'text-green-800 dark:text-green-400'
                                            : printerHealth.status === 'offline'
                                            ? 'text-red-800 dark:text-red-400 animate-pulse'
                                            : 'text-yellow-800 dark:text-yellow-400'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        !printerSettings.enabled || !printerSettings.printerIp ? 'bg-slate-500 dark:bg-slate-400' :
                                        printerHealth.status === 'online' ? 'bg-green-400' :
                                        printerHealth.status === 'offline' ? 'bg-red-500' :
                                        'bg-yellow-400'
                                    }`} />
                                </Link>
                                {/* Pending orders chip */}
                                {pendingOrderCount > 0 && (
                                    <button
                                        onClick={() => router.push('/admin/orders')}
                                        className="flex items-center gap-1 bg-yellow-600/25 border border-yellow-500/50 rounded-full px-2 py-0.5 animate-pulse hover:bg-yellow-600/40 transition"
                                    >
                                        <span className="text-yellow-800 dark:text-yellow-400 text-[10px] font-bold">{pendingOrderCount}</span>
                                        <span className="text-yellow-300 text-[10px]">{t('pendingOrders')}</span>
                                        {pendingWaitStr && (
                                            <span className="text-yellow-500 text-[10px] font-mono">{pendingWaitStr}</span>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Navigation Chips - hidden on tablet, visible on desktop */}
                            <div className="hidden min-[1921px]:flex flex-wrap items-center gap-1.5 flex-1">
                                {[
                                    { href: '/admin/orders', label: t('orders') },
                                    { href: '/admin/statistics', label: t('dashboard') },
                                    { href: '/admin/reservations', label: t('reservations') },
                                    { href: '/admin/dashboard?view=customers', label: t('customers') },
                                    { href: '/admin/orders/suppliers', label: t('suppliers') },
                                    { href: '/admin/products', label: t('productsCategories') },
                                    { href: '/admin/promotions', label: t('promotions') },
                                    { href: '/admin/reports', label: t('reports') },
                                ].map(({ href, label }) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav(href)
                                            ? 'bg-accent border border-border text-foreground shadow-inner'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                            }`}
                                    >
                                        {label}
                                    </Link>
                                ))}

                                {/* Sponsored Ads for Regular Admin */}
                                <Link
                                    href="/admin/sponsored-ads"
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/sponsored-ads')
                                        ? 'bg-accent border border-border text-foreground shadow-inner'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                        }`}
                                >
                                    {t('sponsoredAds')}
                                </Link>

                                {/* Personel Dropdown for Regular Admin */}
                                <div className="relative group">
                                    <button
                                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/staff-dashboard') ||
                                            isActiveNav('/admin/staff-shifts')
                                            ? 'bg-accent border border-border text-foreground shadow-inner'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                            }`}
                                    >
                                        {t('staff')}
                                        <span className="text-[10px]">▼</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                        <div className="py-1">
                                            <Link
                                                href="/admin/staff-dashboard"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/staff-dashboard') ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted hover:text-foreground'}`}
                                            >
                                                {t('staff')}
                                            </Link>
                                            <Link
                                                href="/admin/staff-shifts"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/staff-shifts') ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted hover:text-foreground'}`}
                                            >
                                                {t('shifts')}
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {/* Settings Dropdown for Regular Admin */}
                                <div className="relative group">
                                    <button
                                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/settings') ||
                                            isActiveNav('/admin/delivery-settings')
                                            ? 'bg-accent border border-border text-foreground shadow-inner'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                            }`}
                                    >
                                        {t('settings')}
                                        <span className="text-[10px]">▼</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px] overflow-hidden">
                                        <div className="py-1">
                                            <Link
                                                href="/admin/settings"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/settings') ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted hover:text-foreground'}`}
                                            >
                                                {t('settings')}
                                            </Link>
                                            <Link
                                                href="/admin/delivery-settings"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/delivery-settings') ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted hover:text-foreground'}`}
                                            >
                                                {t('teslimat_ayarlari')}
                                            </Link>
                                            {/* Add AI Menu here for regular admins as well if it's available for them */}
                                            {admin?.adminType === 'restoran' && (
                                                <Link
                                                    href="/admin/ai-menu"
                                                    className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/ai-menu') ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted hover:text-foreground'}`}
                                                >
                                                    {t('aiMenu')}
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Printer Status + Profile & Role */}
                            <div className="flex items-center shrink-0 gap-3 z-50">
                                <ThemeToggle />
                                {/* Printer Health Indicator (Hidden for non-super admins temporarily) */}
                                {(admin?.adminType as string) === 'super' && (
                                    <Link
                                        href="/admin/settings/printer"
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                            !printerSettings.enabled || !printerSettings.printerIp
                                                ? 'bg-muted/50 border border-border text-muted-foreground'
                                                : printerHealth.status === 'online'
                                                ? 'bg-green-600/20 border border-green-500/50 text-green-800 dark:text-green-400'
                                                : printerHealth.status === 'offline'
                                                ? 'bg-red-600/20 border border-red-500/50 text-red-800 dark:text-red-400 animate-pulse'
                                                : printerHealth.status === 'checking'
                                                ? 'bg-yellow-600/20 border border-yellow-500/50 text-yellow-800 dark:text-yellow-400'
                                                : 'bg-muted/50 border border-border text-muted-foreground'
                                        }`}
                                        title={`Drucker: ${printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Pruefe...' : 'Nicht konfiguriert'}${printerHealth.responseTimeMs ? ` (${printerHealth.responseTimeMs}ms)` : ''}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
                                            !printerSettings.enabled || !printerSettings.printerIp ? 'bg-slate-500 dark:bg-slate-400' :
                                            printerHealth.status === 'online' ? 'bg-green-400' :
                                            printerHealth.status === 'offline' ? 'bg-red-500 animate-ping' :
                                            printerHealth.status === 'checking' ? 'bg-yellow-400 animate-pulse' :
                                            'bg-slate-500 dark:bg-slate-400'
                                        }`} />
                                        <span className="truncate max-w-[80px]">
                                            {!printerSettings.enabled || !printerSettings.printerIp
                                                ? 'Drucker'
                                                : printerHealth.status === 'online' ? 'Online'
                                                : printerHealth.status === 'offline' ? 'OFFLINE'
                                                : printerHealth.status === 'checking' ? 'Pruefe...'
                                                : 'Drucker'}
                                        </span>
                                    </Link>
                                )}
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 hover:bg-accent/50 rounded-lg px-2 py-1 transition">
                                        <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-primary/10">
                                            {admin.photoURL ? (
                                                <img
                                                    src={admin.photoURL}
                                                    alt={admin.displayName || t('profile')}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-foreground font-bold text-xs">
                                                    {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="hidden md:flex flex-col items-start">
                                            <span className="text-foreground text-xs font-medium max-w-[100px] truncate leading-tight">
                                                {admin.displayName || admin.email?.split('@')[0] || 'Admin'}
                                            </span>
                                            <span className="text-muted-foreground text-[10px] leading-tight">
                                                {getRoleLabel(admin.adminType) || adminTypeLabels[admin.adminType as AdminType] || admin.adminType}
                                            </span>
                                        </div>
                                        <span className="text-muted-foreground text-[10px]">▼</span>
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
                                        <Link href="/admin/settings" className="block px-4 py-3 border-b border-border hover:bg-muted/50 transition">
                                            <p className="text-foreground text-sm font-medium truncate">
                                                {admin.displayName || 'Admin'}
                                            </p>
                                            <p className="text-muted-foreground text-xs truncate">
                                                {admin.email || admin.phone || ''}
                                            </p>
                                        </Link>
                                        {/* Language Selection */}
                                        <div className="py-2 border-b border-border">
                                            <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('language')}</p>
                                            <div className="flex flex-wrap gap-1 px-3 py-1">
                                                {locales.map((l) => (
                                                    <button
                                                        key={l}
                                                        onClick={() => handleLocaleChange(l)}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition ${l === currentLocale ? 'bg-blue-600/30 text-blue-300 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                                    >
                                                        <span>{localeFlags[l]}</span>
                                                        <span>{localeNames[l]}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <Link
                                            href="/account"
                                            className="w-full flex items-center gap-2 px-4 py-3 text-blue-800 dark:text-blue-400 hover:bg-blue-900/30 hover:text-blue-300 transition text-sm border-b border-border"
                                        >
                                            {t('myAccount')}
                                        </Link>
                                        <button
                                            onMouseDown={handleLogout}
                                            disabled={loggingOut}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-red-800 dark:text-red-400 hover:bg-red-900/30 hover:text-red-300 transition text-sm disabled:opacity-50"
                                        >
                                            {loggingOut ? '...' : t('logout')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MOBILE SLIDE-IN PANEL (Regular Admin) */}
                    {mobileMenuOpen && (
                        <>
                            <div
                                className="min-[1921px]:hidden fixed inset-0 bg-black/60 z-40"
                                onClick={closeMobileMenu}
                            />
                            <div className="min-[1921px]:hidden fixed top-0 left-0 h-full w-72 bg-background border-r border-border z-50 overflow-y-auto shadow-2xl">
                                <div className="p-4 border-b border-border flex items-center justify-between">
                                    <span className="text-foreground font-semibold text-sm">Menu</span>
                                    <button onClick={closeMobileMenu} className="text-muted-foreground hover:text-foreground text-xl">{`\u2715`}</button>
                                </div>
                                <nav className="py-2">
                                    <Link href="/admin/orders" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('orders')}</Link>
                                    <Link href="/admin/reservations" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('reservations')}</Link>
                                    <Link href="/admin/statistics" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('dashboard')}</Link>
                                    <Link href="/admin/dashboard?view=customers" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('customers')}</Link>
                                    <Link href="/admin/orders/suppliers" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('suppliers')}</Link>
                                    <Link href="/admin/products" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('productsCategories')}</Link>
                                    <Link href="/admin/promotions" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('promotions')}</Link>
                                    <Link href="/admin/reports" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('reports')}</Link>
                                    <Link href="/admin/sponsored-ads" onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('sponsoredAds')}</Link>

                                    {/* Personel section */}
                                    <div className="border-t border-border mt-1 pt-1">
                                        <button onClick={() => toggleSection('staff')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('staff')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'staff' ? 'rotate-180' : ''}`}>{`\u25BC`}</span>
                                        </button>
                                        {expandedSection === 'staff' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/staff-dashboard" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('staff')}</Link>
                                                <Link href="/admin/staff-shifts" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('shifts')}</Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* Settings section */}
                                    <div>
                                        <button onClick={() => toggleSection('settings')} className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted">
                                            {t('settings')}
                                            <span className={`text-xs transition-transform ${expandedSection === 'settings' ? 'rotate-180' : ''}`}>{`\u25BC`}</span>
                                        </button>
                                        {expandedSection === 'settings' && (
                                            <div className="bg-muted/50 py-1">
                                                <Link href="/admin/settings" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('settings')}</Link>
                                                <Link href="/admin/delivery-settings" onClick={closeMobileMenu} className="block px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">{t('teslimat_ayarlari')}</Link>
                                            </div>
                                        )}
                                    </div>
                                </nav>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Pending Invitations Modal */}
            {showPendingModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <span>⏳</span> {t('pendingInvitations')}
                            </h3>
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="text-muted-foreground hover:text-foreground text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {pendingInvitations.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="text-5xl">✅</span>
                                <p className="text-muted-foreground mt-4">{t('noPendingInvitations')}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pendingInvitations.map((invitation) => (
                                    <div
                                        key={invitation.id}
                                        className="bg-gray-700 rounded-lg p-4 border-l-4 border-yellow-500"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-lg">
                                                        {invitation.status === 'registered' ? '✅' : '📱'}
                                                    </span>
                                                    <span className="text-foreground font-medium">
                                                        {invitation.phone}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${invitation.status === 'registered'
                                                        ? 'bg-green-600/30 text-green-800 dark:text-green-400'
                                                        : 'bg-yellow-600/30 text-yellow-800 dark:text-yellow-400'
                                                        }`}>
                                                        {invitation.status === 'registered' ? t('registrationComplete') : t('waitingForLink')}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <span className="text-gray-500">{t('roleLabel')}:</span>
                                                        <span className="text-foreground ml-2">
                                                            {adminTypeLabels[invitation.role as AdminType] || invitation.role}
                                                        </span>
                                                    </div>
                                                    {invitation.businessName && (
                                                        <div>
                                                            <span className="text-gray-500">{t('businessLabel')}:</span>
                                                            <span className="text-foreground ml-2">{invitation.businessName}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-gray-500">{t('invitedByLabel')}:</span>
                                                        <span className="text-foreground ml-2">{invitation.invitedByName}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">{t('dateLabel')}:</span>
                                                        <span className="text-foreground ml-2">
                                                            {invitation.createdAt.toLocaleDateString(localeToBcp47[currentLocale] || 'de-DE')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons - only for registered status */}
                                            {invitation.status === 'registered' && (
                                                <div className="flex flex-col gap-2 ml-4">
                                                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
                                                        ✓ {t('approve')}
                                                    </button>
                                                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
                                                        ✗ {t('reject')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setShowPendingModal(false)}
                            className="w-full mt-6 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-medium transition-colors"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
