'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { AdminType } from '@/types';
import { getRoleLabel } from '@/lib/business-types';
import { LanguageSwitcher } from '../LanguageSwitcher';



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

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

    const handleLogout = async () => {
        await auth.signOut();
        window.location.href = '/login';
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

                            {/* Users & Logisitics Nav */}
                            <div className="relative group">
                                <Link
                                    href="/admin/dashboard"
                                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${isActiveNav('/admin/dashboard') || isActiveNav('/admin/drivers') || isActiveNav('/admin/staff-shifts')
                                        ? 'bg-white/15 text-white'
                                        : 'text-red-100 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {t('userManagement')}
                                    <span className="text-[10px]">▼</span>
                                </Link>
                                {/* Dropdown */}
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
                                    <div className="py-1">
                                        <Link href="/admin/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('userManagement')}
                                        </Link>
                                        <Link href="/admin/drivers" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('drivers')}
                                        </Link>
                                        <Link href="/admin/staff-shifts" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                                            {t('shifts')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Accounting Nav */}
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
                                <div className="absolute left-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] overflow-hidden">
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

                            {/* Main Nav Links */}
                            {[
                                { href: '/admin/orders', label: t('orders') },
                                { href: '/admin/products', label: t('productsCategories') },
                                { href: '/admin/activity-logs', label: t('activityLogs') },
                                { href: '/admin/analytics', label: t('analytics') },
                                { href: '/admin/reservations', label: t('reservations') },
                                { href: '/admin/reports', label: '🚩 Meldungen' },
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

                        {/* Right Side - Settings, Locale, Profile */}
                        <div className="flex items-center shrink-0 gap-2">
                            <LanguageSwitcher />
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
                                            Süper Admin
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

                                    <div className="py-2 border-b border-gray-700">
                                        <p className="px-4 py-1 text-[10px] uppercase font-bold text-gray-500">{t('settings')}</p>
                                        <Link
                                            href="/admin/settings"
                                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition text-xs"
                                        >
                                            {t('settings')}
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
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-900/40 hover:text-red-400 transition text-xs font-medium rounded-b-lg"
                                    >
                                        🚪 {t('logout')}
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
                                    { href: '/admin/reports', label: '🚩 Meldungen' },
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

                            {/* Profile & Role */}
                            <div className="flex items-center shrink-0 gap-4 z-50">
                                <LanguageSwitcher />
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
                                    <div className="absolute right-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px]">
                                        <div className="px-4 py-3 border-b border-gray-700">
                                            <p className="text-white text-sm font-medium truncate">
                                                {admin.displayName || 'Admin'}
                                            </p>
                                            <p className="text-gray-400 text-xs truncate">
                                                {admin.email || (admin as any).phoneNumber || ''}
                                            </p>
                                        </div>
                                        <Link
                                            href="/account"
                                            className="w-full flex items-center gap-2 px-4 py-3 text-blue-400 hover:bg-blue-900/30 hover:text-blue-300 transition text-sm border-b border-gray-700"
                                        >
                                            {t('myAccount')}
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition text-sm"
                                        >
                                            {t('logout')}
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
