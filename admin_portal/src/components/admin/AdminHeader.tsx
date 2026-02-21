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

const adminTypeLabels: Record<AdminType, string> = {
    super: '👑 Super Admin',
    kermes: '🎪 Kermes Admin',
    kermes_staff: '🎪 Kermes Personel',
    cenaze_fonu: '⚫ Cenaze Fonu',
    restoran: '🍽️ Restoran Sahibi',
    restoran_staff: '👨‍🍳 Restoran Personel',
    mutfak: '👨‍🍳 Mutfak',
    garson: '🧑‍💼 Garson',
    teslimat: '🚗 Teslimat',
    kasap: '🥩 Kasap Sahibi',
    kasap_staff: '👷 Kasap Personel',
    bakkal: '🏪 Bakkal',
    market: '🛒 Market Sahibi',
    market_staff: '🛒 Market Personel',
    hali_yikama: '🧹 Halı Yıkama',
    hali_surucu: '🛵 Halı Sürücü',
    transfer_surucu: '✈️ Transfer Sürücü',
    tur_rehberi: '🗺️ Tur Rehberi',
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
    const { admin } = useAdmin();
    const router = useRouter();
    const pathname = usePathname();
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

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

    // Stats counts
    const [statsLoaded, setStatsLoaded] = useState(false);
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalAdmins, setTotalAdmins] = useState(0);
    const [totalSubAdmins, setTotalSubAdmins] = useState(0);
    const [totalSuperAdmins, setTotalSuperAdmins] = useState(0);
    const [totalBusinesses, setTotalBusinesses] = useState(0);
    const [showStatsList, setShowStatsList] = useState<'users' | 'admins' | 'subadmins' | 'superadmins' | null>(null);

    // Lists for dropdown display
    const [usersList, setUsersList] = useState<any[]>([]);
    const [adminsList, setAdminsList] = useState<any[]>([]);
    const [listsLoading, setListsLoading] = useState(false);

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
                            companyName: data.companyName || data.brand || 'İşletme',
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

    // Load stats counts for Super Admin
    useEffect(() => {
        if (admin?.adminType === 'super' && !statsLoaded) {
            const loadStats = async () => {
                try {
                    // Count users
                    const usersSnap = await getDocs(collection(db, 'users'));
                    const totalUsersCount = usersSnap.size;

                    // Count admins by type
                    const adminsSnap = await getDocs(collection(db, 'admins'));
                    let adminCount = 0;
                    let subAdminCount = 0;
                    let superAdminCount = 0;

                    // Build admin UID set for customer calculation
                    const adminUids = new Set<string>();
                    adminsSnap.docs.forEach(doc => {
                        const data = doc.data();
                        // Collect admin UIDs for filtering
                        adminUids.add(doc.id);
                        if (data.firebaseUid) adminUids.add(data.firebaseUid);

                        if (data.adminType === 'super') {
                            superAdminCount++;
                        } else if (data.adminType?.includes('_staff')) {
                            subAdminCount++;
                        } else {
                            adminCount++;
                        }
                    });

                    // CRITICAL FIX: Calculate ACTUAL customer count
                    // Customers = users who are NOT admins
                    let customerCount = 0;
                    usersSnap.docs.forEach(userDoc => {
                        if (!adminUids.has(userDoc.id)) {
                            customerCount++;
                        }
                    });

                    // Show customer count (not total users) in the header
                    setTotalUsers(customerCount);
                    setTotalAdmins(adminCount);
                    setTotalSubAdmins(subAdminCount);
                    setTotalSuperAdmins(superAdminCount);

                    // Count businesses
                    const businessesSnap = await getDocs(collection(db, 'businesses'));
                    setTotalBusinesses(businessesSnap.size);

                    setStatsLoaded(true);
                } catch (error) {
                    console.error('Error loading stats:', error);
                }
            };
            loadStats();
        }
    }, [admin, statsLoaded]);

    // Load lists for dropdown display
    const handleChipClick = async (type: 'users' | 'admins' | 'subadmins' | 'superadmins') => {
        if (showStatsList === type) {
            setShowStatsList(null);
            return;
        }

        setShowStatsList(type);
        setListsLoading(true);

        try {
            if (type === 'users') {
                const snapshot = await getDocs(query(collection(db, 'users'), limit(50)));
                setUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } else {
                const snapshot = await getDocs(collection(db, 'admins'));
                const allAdmins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

                if (type === 'admins') {
                    setAdminsList(allAdmins.filter((a: any) => !a.adminType?.includes('_staff') && a.adminType !== 'super'));
                } else if (type === 'subadmins') {
                    setAdminsList(allAdmins.filter((a: any) => a.adminType?.includes('_staff')));
                } else if (type === 'superadmins') {
                    setAdminsList(allAdmins.filter((a: any) => a.adminType === 'super'));
                }
            }
        } catch (error) {
            console.error('Error loading list:', error);
        }
        setListsLoading(false);
    };

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
                <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 border-b border-indigo-700">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            {/* Stats Chips - Left Side - Consistent pill style */}
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/admin/dashboard?filter=users"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-white text-xs bg-blue-600/80 hover:bg-blue-500 border border-blue-400/50"
                                    title="Tüm Kullanıcılar"
                                >
                                    👥 <span className="font-bold">{totalUsers}</span>
                                </Link>
                                <Link
                                    href="/admin/dashboard?filter=admins"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-white text-xs bg-green-600/80 hover:bg-green-500 border border-green-400/50"
                                    title="İşletme Adminleri"
                                >
                                    🎫 <span className="font-bold">{totalAdmins}</span>
                                </Link>
                                <Link
                                    href="/admin/dashboard?filter=subadmins"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-white text-xs bg-amber-600/80 hover:bg-amber-500 border border-amber-400/50"
                                    title="Sub Adminler (Personel)"
                                >
                                    👷 <span className="font-bold">{totalSubAdmins}</span>
                                </Link>
                                <Link
                                    href="/admin/dashboard?filter=superadmins"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-white text-xs bg-purple-600/80 hover:bg-purple-500 border border-purple-400/50"
                                    title="Super Adminler"
                                >
                                    👑 <span className="font-bold">{totalSuperAdmins}</span>
                                </Link>
                                <Link
                                    href="/admin/business"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-white text-xs bg-cyan-600/80 hover:bg-cyan-500 border border-cyan-400/50"
                                    title={`${totalBusinesses} İşletme`}
                                >
                                    🏪 <span className="font-bold">{totalBusinesses}</span>
                                </Link>
                            </div>

                            {/* Right Side - Super Admin Profile Dropdown */}
                            <div className="flex items-center gap-4">
                                <LanguageSwitcher />
                                <div className="relative group">
                                    <button className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-3 py-1.5 transition">
                                        <span className="text-indigo-200 text-sm font-medium hidden md:block">👑 Super Admin</span>
                                        {/* Profile Picture */}
                                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-400/50 flex items-center justify-center bg-indigo-700/50">
                                            {(admin as any).photoURL ? (
                                                <img
                                                    src={(admin as any).photoURL}
                                                    alt={admin.displayName || 'Profil'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-white font-bold text-sm">
                                                    {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-indigo-300 text-xs">▼</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[180px]">
                                        <div className="px-4 py-3 border-b border-gray-700">
                                            <p className="text-white text-sm font-medium truncate">
                                                {admin.displayName || 'Super Admin'}
                                            </p>
                                            <p className="text-gray-400 text-xs truncate">
                                                {admin.email || (admin as any).phoneNumber || ''}
                                            </p>
                                            <p className="text-violet-400 text-xs mt-1">👑 Super Admin</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition text-sm"
                                        >
                                            🚪 {t('logout')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {/* Navigation Chips - Consistent styling with active underline */}
                            {[
                                { href: '/admin/business', icon: '🏪', label: t('businesses') },
                                { href: '/admin/orders', icon: '📦', label: t('orders') },
                                { href: '/admin/products', icon: '📋', label: t('masterCatalog') },
                                { href: '/admin/invoices', icon: '📄', label: t('invoices') },
                                { href: '/admin/commissions', icon: '💰', label: t('commissions') },
                                { href: '/admin/plans', icon: '📅', label: t('plans') },
                                { href: '/admin/activity-logs', icon: '📝', label: t('activityLogs') },
                                { href: '/admin/dashboard', icon: '👥', label: t('userManagement') },
                                { href: '/admin/analytics', icon: '📊', label: t('analytics') },
                                { href: '/admin/sectors', icon: '🏭', label: t('sectors') },
                                { href: '/admin/kermes', icon: '🎪', label: t('kermes') },
                                { href: '/admin/drivers', icon: '🚗', label: t('drivers') },
                                { href: '/admin/reservations', icon: '🍽️', label: t('reservations') },
                                { href: '/admin/staff-shifts', icon: '⏱️', label: t('shifts') },
                                { href: '/admin/image-generator', icon: '🎨', label: t('imageGen') },
                                { href: '/admin/ai-menu', icon: '🤖', label: t('aiMenu') },
                                { href: '/admin/ui-translations', icon: '🌍', label: t('uiTranslations') },
                                { href: '/admin/settings', icon: '⚙️', label: t('settings') },
                            ].map((item) => {
                                const active = isActiveNav(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${active
                                            ? 'bg-white/20 border-white/40 text-white'
                                            : 'bg-indigo-800/50 hover:bg-indigo-700 border-indigo-600 text-indigo-100'
                                            }`}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        <span className="text-sm font-medium">{item.label}</span>
                                        {/* Active indicator - colored bar at bottom */}
                                        {active && (
                                            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-full" />
                                        )}
                                    </Link>
                                );
                            })}
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
                                    { href: '/admin/staff-dashboard', label: t('staff') },
                                    { href: '/admin/settings', label: t('settings') },
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
                            </div>

                            {/* Profile & Role */}
                            <div className="flex items-center shrink-0 gap-4">
                                <LanguageSwitcher />
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 hover:bg-white/5 rounded-lg px-2 py-1 transition">
                                        <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-white/10">
                                            {(admin as any).photoURL ? (
                                                <img
                                                    src={(admin as any).photoURL}
                                                    alt={admin.displayName || 'Profil'}
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
                                            Hesabım
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition text-sm"
                                        >
                                            Çıkış Yap
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Modal Panel */}
            {showStatsList && (
                <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 pt-20" onClick={() => setShowStatsList(null)}>
                    <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[70vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h3 className="text-white font-bold">
                                {showStatsList === 'users' && `👥 Tüm Kullanıcılar (${usersList.length})`}
                                {showStatsList === 'admins' && `🎫 İşletme Adminleri (${adminsList.length})`}
                                {showStatsList === 'subadmins' && `👷 Sub Adminler (${adminsList.length})`}
                                {showStatsList === 'superadmins' && `👑 Super Adminler (${adminsList.length})`}
                            </h3>
                            <button
                                onClick={() => setShowStatsList(null)}
                                className="text-gray-400 hover:text-white text-2xl px-2"
                            >
                                ×
                            </button>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
                            {listsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                                    <span className="ml-3 text-gray-400">Yükleniyor...</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-700">
                                    {showStatsList === 'users' ? (
                                        usersList.length === 0 ? (
                                            <p className="text-gray-400 text-center py-8">Kullanıcı bulunamadı</p>
                                        ) : (
                                            usersList.map((user, index) => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center gap-3 p-3 hover:bg-gray-700/50 transition"
                                                >
                                                    <span className="text-gray-500 text-xs w-6">{index + 1}</span>
                                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                                        {(user.firstName || user.displayName || user.email || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white font-medium">
                                                            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.displayName || 'İsimsiz'}
                                                        </p>
                                                        <p className="text-gray-400 text-sm">{user.email || user.phoneNumber || '-'}</p>
                                                    </div>
                                                    {/* Platform indicator */}
                                                    {(user.appSource || user.platform) && (
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${(user.appSource || user.platform)?.toLowerCase()?.includes('lokma')
                                                            ? 'bg-red-600/30 text-red-300'
                                                            : 'bg-purple-600/30 text-purple-300'
                                                            }`}>
                                                            {(user.appSource || user.platform)?.toLowerCase()?.includes('lokma') ? '🍖 LOKMA' : '✨ MIRA'}
                                                        </span>
                                                    )}
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        adminsList.length === 0 ? (
                                            <p className="text-gray-400 text-center py-8">Admin bulunamadı</p>
                                        ) : (
                                            adminsList.map((admin, index) => (
                                                <div
                                                    key={admin.id}
                                                    className="flex items-center gap-3 p-3 hover:bg-gray-700/50 transition"
                                                >
                                                    <span className="text-gray-500 text-xs w-6">{index + 1}</span>
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${admin.adminType === 'super' ? 'bg-purple-600' :
                                                        admin.adminType?.includes('_staff') ? 'bg-amber-600' : 'bg-green-600'
                                                        }`}>
                                                        {(admin.displayName || admin.email || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white font-medium">{admin.displayName || 'İsimsiz'}</p>
                                                        <p className="text-gray-400 text-sm">{admin.email || admin.phoneNumber || '-'}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${admin.adminType === 'super' ? 'bg-purple-600/30 text-purple-300' :
                                                        admin.adminType?.includes('_staff') ? 'bg-amber-600/30 text-amber-300' : 'bg-green-600/30 text-green-300'
                                                        }`}>
                                                        {adminTypeLabels[admin.adminType as AdminType] || admin.adminType}
                                                    </span>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            )}
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
                                <span>⏳</span> Onay Bekleyen Davetiyeler
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
                                <p className="text-gray-400 mt-4">Bekleyen davetiye yok</p>
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
                                                        {invitation.status === 'registered' ? 'Kayıt Tamamlandı' : 'Link Bekleniyor'}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <span className="text-gray-500">Rol:</span>
                                                        <span className="text-gray-300 ml-2">
                                                            {adminTypeLabels[invitation.role as AdminType] || invitation.role}
                                                        </span>
                                                    </div>
                                                    {invitation.businessName && (
                                                        <div>
                                                            <span className="text-gray-500">İşletme:</span>
                                                            <span className="text-gray-300 ml-2">{invitation.businessName}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-gray-500">Davet Eden:</span>
                                                        <span className="text-gray-300 ml-2">{invitation.invitedByName}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Tarih:</span>
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
                                                        ✓ Onayla
                                                    </button>
                                                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
                                                        ✗ Reddet
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
                            Kapat
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
