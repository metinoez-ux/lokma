'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';
import { AdminType } from '@/types';
import { getRoleLabel } from '@/lib/business-types';
import { locales, localeNames, localeFlags, Locale } from '@/i18n';
import {
    checkHealth, sendPrinterAlert,
    PrinterSettings, DEFAULT_PRINTER_SETTINGS,
    PrinterHealthState, DEFAULT_HEALTH_STATE,
} from '@/services/printerService';



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

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

            // Transition: online -> offline
            if (prev.status === 'online' && newState.status === 'offline') {
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
        healthIntervalRef.current = setInterval(runHealthCheck, 30000);

        return () => {
            if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [printerSettings.enabled, printerSettings.printerIp, printerSettings.printerPort, admin?.adminType]);

    // Language change handler (replaces LanguageSwitcher component)
    const handleLocaleChange = (newLocale: Locale) => {
        router.replace(pathname, { locale: newLocale });
    };

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
                SUPER ADMIN TOOLBAR - Kırmızı bar (sadece super admin görür)
            ═══════════════════════════════════════════════════════════════════ */}
            {admin?.adminType === 'super' && (
                <div className="bg-gradient-to-r from-red-800 via-rose-700 to-red-800 border-b border-red-900 shadow-sm relative z-40">
                    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4">
                        {/* Clock */}
                        <div className="flex items-center gap-2 shrink-0 text-red-100">
                            <span className="text-xl font-light tabular-nums tracking-wider text-white">
                                {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-6 bg-red-700/50 shrink-0 mx-2" />

                        {/* Navigation Chips — uniform minimal style, no icons, no borders */}
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                            {/* Business Nav */}
                            <div className="relative group">
                                <Link
                                    href="/admin/business"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/business') || isActiveNav('/admin/sectors') || isActiveNav('/admin/kermes')
                                        ? 'bg-white/15 text-white'
                                        : 'text-red-100 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('businesses')}
                                    <span className="text-[10px]">▼</span>
                                </Link>
                                {/* Dropdown */}
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/business" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('businesses')}
                                        </Link>
                                        <Link href="/admin/sectors" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('sectors')}
                                        </Link>
                                        <Link href="/admin/kermes" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('kermes')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Personen Nav — 5 Category User Segregation */}
                            <div className="relative group">
                                <button
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/dashboard') || isActiveNav('/admin/customers') || isActiveNav('/admin/partners') || isActiveNav('/admin/superadmins') || isActiveNav('/admin/drivers') || isActiveNav('/admin/volunteers') || isActiveNav('/admin/staff-shifts') || isActiveNav('/admin/drivers/tips')
                                        ? 'bg-white/15 text-white'
                                        : 'text-red-100 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('benutzerverwaltung')}
                                    <span className="text-[10px]">▼</span>
                                </button>
                                {/* Mega Dropdown — 5 Categories */}
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[220px] overflow-hidden">
                                    <div className="py-1">
                                        {/* Category Header */}
                                        <p className="px-4 py-1.5 text-[10px] uppercase font-bold text-gray-500 tracking-wider">{t('personen')}</p>
                                        <Link href="/admin/customers" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">👤</span> {t('customers')}
                                        </Link>
                                        <Link href="/admin/partners" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">🏪</span> {t('partners')}
                                        </Link>
                                        {admin?.adminType === 'super' && (
                                        <Link href="/admin/superadmins" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">👑</span> {t('superAdmins')}
                                        </Link>
                                        )}
                                        <Link href="/admin/drivers" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">🚗</span> {t('drivers')}
                                        </Link>
                                        <Link href="/admin/volunteers" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">🤝</span> {t('volunteers')}
                                        </Link>
                                        {/* Separator */}
                                        <div className="border-t border-gray-700 my-1"></div>
                                        {/* Operational Links */}
                                        <Link href="/admin/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">📋</span> {t('allUsers')}
                                        </Link>
                                        <Link href="/admin/drivers/tips" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">💰</span> {t('tips')}
                                        </Link>
                                        <Link href="/admin/staff-shifts" className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            <span className="text-sm">📅</span> {t('shifts')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Accounting Nav — Sadece Muhasebe */}
                            <div className="relative group">
                                <Link
                                    href="/admin/invoices"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/invoices') || isActiveNav('/admin/commissions') || isActiveNav('/admin/plans')
                                        ? 'bg-white/15 text-white'
                                        : 'text-red-100 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('accounting')}
                                    <span className="text-[10px]">▼</span>
                                </Link>
                                {/* Dropdown */}
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[180px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/invoices" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('invoices')}
                                        </Link>
                                        <Link href="/admin/commissions" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('commissions')}
                                        </Link>
                                        <Link href="/admin/plans" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('plans')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Promosyon Nav — Bağımsız Menü */}
                            <div className="relative group">
                                <Link
                                    href="/admin/promotions"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/promotions') || isActiveNav('/admin/coupons') || isActiveNav('/admin/deals') || isActiveNav('/admin/promotion-templates')
                                        ? 'bg-white/15 text-white'
                                        : 'text-red-100 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('promotions')}
                                    <span className="text-[10px]">▼</span>
                                </Link>
                                {/* Dropdown */}
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/promotions" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('businessCampaigns')}
                                        </Link>
                                        <Link href="/admin/coupons" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('coupons')}
                                        </Link>
                                        <Link href="/admin/deals" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('deals')}
                                        </Link>
                                        <div className="border-t border-gray-600 my-1"></div>
                                        <Link href="/admin/promotion-templates" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('campaignTemplates')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Service Nav */}
                            <div className="relative group">
                                <Link
                                    href="/admin/activity-logs"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/activity-logs') || isActiveNav('/admin/reports')
                                        ? 'bg-white/15 text-white'
                                        : 'text-red-100 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('service')}
                                    <span className="text-[10px]">▼</span>
                                </Link>
                                {/* Dropdown */}
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/activity-logs" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('activityLogs')}
                                        </Link>
                                        <Link href="/admin/reports" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('reports')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Main Nav Links */}
                            {[
                                { href: '/admin/orders', label: t('orders') },
                                { href: '/admin/products', label: t('productsCategories') },
                                { href: '/admin/analytics', label: t('analytics') },
                                { href: '/admin/reservations', label: t('reservations') },
                            ].map((item) => {
                                const active = isActiveNav(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${active
                                            ? 'bg-white/15 text-white'
                                            : 'text-red-100 hover:text-white hover:bg-white/10'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Right Side - Settings, Profile */}
                        <div className="flex items-center shrink-0 gap-2">
                            <div className="relative group ml-2">
                                <button className="flex items-center gap-1.5 hover:bg-white/10 rounded-lg px-2 py-1 transition">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-white/10 shadow-sm">
                                        {(admin as any).photoURL ? (
                                            <img
                                                src={(admin as any).photoURL}
                                                alt={admin.displayName || t('profile')}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-white font-bold text-sm">
                                                {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="hidden md:flex flex-col items-start ml-1">
                                        <span className="text-white text-xs font-medium max-w-[100px] truncate leading-tight">
                                            {admin.displayName || 'Super Admin'}
                                        </span>
                                        <span className="text-red-200 text-[10px] leading-tight font-medium">
                                            {t('superAdmin')}
                                        </span>
                                    </div>
                                    <span className="text-red-200 text-[10px] ml-1">▼</span>
                                </button>

                                {/* Dropdown Menu (including Settings) */}
                                <div className="absolute right-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
                                    <div className="px-4 py-3 border-b border-gray-700">
                                        <p className="text-white text-sm font-medium truncate">
                                            {admin.displayName || 'Super Admin'}
                                        </p>
                                        <p className="text-gray-400 text-xs truncate">
                                            {admin.email || (admin as any).phoneNumber || ''}
                                        </p>
                                    </div>

                                    {/* Language Selection */}
                                    <div className="py-2 border-b border-gray-700">
                                        <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('language')}</p>
                                        <div className="flex flex-wrap gap-1 px-3 py-1">
                                            {locales.map((l) => (
                                                <button
                                                    key={l}
                                                    onClick={() => handleLocaleChange(l)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition ${l === currentLocale ? 'bg-blue-600/30 text-blue-300 font-medium' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                                >
                                                    <span>{localeFlags[l]}</span>
                                                    <span>{localeNames[l]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="py-2 border-b border-gray-700">
                                        <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('settings')}</p>
                                        <Link
                                            href="/admin/settings"
                                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition text-xs"
                                        >
                                            {t('settings')}
                                        </Link>
                                        <Link
                                            href="/admin/settings/company"
                                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition text-xs"
                                        >
                                            {t('companySettings')}
                                        </Link>
                                        <Link
                                            href="/admin/ui-translations"
                                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition text-xs"
                                        >
                                            {t('uiTranslations')}
                                        </Link>
                                        <Link
                                            href="/admin/image-generator"
                                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition text-xs"
                                        >
                                            {t('imageGen')}
                                        </Link>
                                        <Link
                                            href="/admin/ai-menu"
                                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition text-xs"
                                        >
                                            {t('aiMenu')}
                                        </Link>
                                    </div>

                                    <button
                                        onMouseDown={handleLogout}
                                        disabled={loggingOut}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-900/40 hover:text-red-400 transition text-xs font-medium rounded-b-lg disabled:opacity-50"
                                    >
                                        {loggingOut ? '...' : t('logout')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                UNIFIED ADMIN BAR - Business info + Navigation in one compact row
            ═══════════════════════════════════════════════════════════════════ */}
            {admin && admin.adminType !== 'super' && (
                <div className="bg-slate-800 border-b border-slate-700">
                    <div className="max-w-7xl mx-auto px-4 py-2">
                        <div className="flex items-center gap-4">
                            {/* Business Logo + Name + Address (compact) */}
                            {businessInfo && (
                                <div className="flex items-center gap-3 shrink-0 mr-2">
                                    <div className="w-9 h-9 bg-white/10 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                                        {businessInfo.imageUrl ? (
                                            <img
                                                src={businessInfo.imageUrl}
                                                alt={businessInfo.companyName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-white font-bold text-sm">
                                                {businessInfo.companyName.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-white font-semibold text-sm truncate leading-tight">
                                            {businessInfo.companyName}
                                        </h1>
                                        {(businessInfo.streetAddress || businessInfo.city) && (
                                            <p className="text-slate-400 text-xs truncate leading-tight">
                                                {businessInfo.streetAddress && `${businessInfo.streetAddress}, `}{businessInfo.postalCode} {businessInfo.city}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Separator */}
                            {businessInfo && <div className="w-px h-6 bg-slate-600 shrink-0" />}

                            {/* Navigation Chips — uniform muted style, no icons */}
                            <div className="flex flex-wrap items-center gap-1.5 flex-1">
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
                                            ? 'bg-white/15 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                    >
                                        {label}
                                    </Link>
                                ))}

                                {/* Personel Dropdown for Regular Admin */}
                                <div className="relative group">
                                    <button
                                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/staff-dashboard') ||
                                            isActiveNav('/admin/staff-shifts')
                                            ? 'bg-white/15 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                    >
                                        {t('staff')}
                                        <span className="text-[10px]">▼</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 top-full mt-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                        <div className="py-1">
                                            <Link
                                                href="/admin/staff-dashboard"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/staff-dashboard') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                            >
                                                {t('staff')}
                                            </Link>
                                            <Link
                                                href="/admin/staff-shifts"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/staff-shifts') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
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
                                            ? 'bg-white/15 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                    >
                                        {t('settings')}
                                        <span className="text-[10px]">▼</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 top-full mt-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px] overflow-hidden">
                                        <div className="py-1">
                                            <Link
                                                href="/admin/settings"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/settings') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                            >
                                                {t('settings')}
                                            </Link>
                                            <Link
                                                href="/admin/delivery-settings"
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/delivery-settings') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                            >
                                                {t('teslimat_ayarlari')}
                                            </Link>
                                            {/* Add AI Menu here for regular admins as well if it's available for them */}
                                            {admin?.adminType === t('restoran') && (
                                                <Link
                                                    href="/admin/ai-menu"
                                                    className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${isActiveNav('/admin/ai-menu') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
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
                                {/* Printer Health Indicator */}
                                <Link
                                    href="/admin/settings/printer"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                        !printerSettings.enabled || !printerSettings.printerIp
                                            ? 'bg-gray-700/50 border border-gray-600 text-gray-400'
                                            : printerHealth.status === 'online'
                                            ? 'bg-green-600/20 border border-green-500/50 text-green-400'
                                            : printerHealth.status === 'offline'
                                            ? 'bg-red-600/20 border border-red-500/50 text-red-400 animate-pulse'
                                            : printerHealth.status === 'checking'
                                            ? 'bg-yellow-600/20 border border-yellow-500/50 text-yellow-400'
                                            : 'bg-gray-700/50 border border-gray-600 text-gray-400'
                                    }`}
                                    title={`Drucker: ${printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Pruefe...' : 'Nicht konfiguriert'}${printerHealth.responseTimeMs ? ` (${printerHealth.responseTimeMs}ms)` : ''}`}
                                >
                                    <span className={`w-2 h-2 rounded-full inline-block ${
                                        !printerSettings.enabled || !printerSettings.printerIp ? 'bg-gray-500' :
                                        printerHealth.status === 'online' ? 'bg-green-400' :
                                        printerHealth.status === 'offline' ? 'bg-red-500 animate-ping' :
                                        printerHealth.status === 'checking' ? 'bg-yellow-400 animate-pulse' :
                                        'bg-gray-500'
                                    }`} />
                                    {!printerSettings.enabled || !printerSettings.printerIp
                                        ? 'Drucker'
                                        : printerHealth.status === 'online' ? 'Online'
                                        : printerHealth.status === 'offline' ? 'OFFLINE'
                                        : printerHealth.status === 'checking' ? 'Pruefe...'
                                        : 'Drucker'}
                                </Link>
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 hover:bg-white/5 rounded-lg px-2 py-1 transition">
                                        <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-white/10">
                                            {(admin as any).photoURL ? (
                                                <img
                                                    src={(admin as any).photoURL}
                                                    alt={admin.displayName || t('profile')}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-white font-bold text-xs">
                                                    {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="hidden md:flex flex-col items-start">
                                            <span className="text-slate-300 text-xs font-medium max-w-[100px] truncate leading-tight">
                                                {admin.displayName || admin.email?.split('@')[0] || 'Admin'}
                                            </span>
                                            <span className="text-slate-500 text-[10px] leading-tight">
                                                {getRoleLabel(admin.adminType) || adminTypeLabels[admin.adminType as AdminType] || admin.adminType}
                                            </span>
                                        </div>
                                        <span className="text-slate-500 text-[10px]">▼</span>
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
                                        <div className="px-4 py-3 border-b border-gray-700">
                                            <p className="text-white text-sm font-medium truncate">
                                                {admin.displayName || 'Admin'}
                                            </p>
                                            <p className="text-gray-400 text-xs truncate">
                                                {admin.email || (admin as any).phoneNumber || ''}
                                            </p>
                                        </div>
                                        {/* Language Selection */}
                                        <div className="py-2 border-b border-gray-700">
                                            <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('language')}</p>
                                            <div className="flex flex-wrap gap-1 px-3 py-1">
                                                {locales.map((l) => (
                                                    <button
                                                        key={l}
                                                        onClick={() => handleLocaleChange(l)}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition ${l === currentLocale ? 'bg-blue-600/30 text-blue-300 font-medium' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                                    >
                                                        <span>{localeFlags[l]}</span>
                                                        <span>{localeNames[l]}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <Link
                                            href="/account"
                                            className="w-full flex items-center gap-2 px-4 py-3 text-blue-400 hover:bg-blue-900/30 hover:text-blue-300 transition text-sm border-b border-gray-700"
                                        >
                                            {t('myAccount')}
                                        </Link>
                                        <button
                                            onMouseDown={handleLogout}
                                            disabled={loggingOut}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition text-sm disabled:opacity-50"
                                        >
                                            {loggingOut ? '...' : t('logout')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Invitations Modal */}
            {showPendingModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <span>⏳</span> {t('pendingInvitations')}
                            </h3>
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {pendingInvitations.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="text-5xl">✅</span>
                                <p className="text-gray-400 mt-4">{t('noPendingInvitations')}</p>
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
                                                    <span className="text-white font-medium">
                                                        {invitation.phone}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${invitation.status === 'registered'
                                                        ? 'bg-green-600/30 text-green-400'
                                                        : 'bg-yellow-600/30 text-yellow-400'
                                                        }`}>
                                                        {invitation.status === 'registered' ? t('registrationComplete') : t('waitingForLink')}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <span className="text-gray-500">{t('roleLabel')}:</span>
                                                        <span className="text-gray-300 ml-2">
                                                            {adminTypeLabels[invitation.role as AdminType] || invitation.role}
                                                        </span>
                                                    </div>
                                                    {invitation.businessName && (
                                                        <div>
                                                            <span className="text-gray-500">{t('businessLabel')}:</span>
                                                            <span className="text-gray-300 ml-2">{invitation.businessName}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-gray-500">{t('invitedByLabel')}:</span>
                                                        <span className="text-gray-300 ml-2">{invitation.invitedByName}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">{t('dateLabel')}:</span>
                                                        <span className="text-gray-300 ml-2">
                                                            {invitation.createdAt.toLocaleDateString('tr-TR')}
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
