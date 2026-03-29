'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export interface UnifiedUser {
    id: string;
    source: 'users' | 'admins';
    email: string;
    displayName: string;
    phone: string;
    photoURL?: string;
    role: string;
    businessId?: string;
    kermesId?: string;
    createdAt?: Date;
    isActive?: boolean;
}

type RoleFilter = 'all' | 'customer' | 'super' | 'lokma_admin' | 'kermes_admin' | 'driver' | 'staff';

export default function BenutzerverwaltungPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();

    const [users, setUsers] = useState<UnifiedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Permission check
    const isSuperAdmin = admin?.adminType === 'super';

    useEffect(() => {
        if (!adminLoading && admin) {
            fetchData();
        }
    }, [adminLoading, admin]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let fetchedUsers: UnifiedUser[] = [];

            // 1. Fetch Admins Collection (Drivers, Staff, Super Admins, Lokma Admins, Kermes Admins)
            let adminsQuery = query(collection(db, 'admins'));
            if (!isSuperAdmin) {
                // If normal admin, only fetch their own business/kermes staff
                if (admin?.businessId) {
                    adminsQuery = query(collection(db, 'admins'), where('businessId', '==', admin.businessId));
                } else if (admin?.kermesId) {
                    adminsQuery = query(collection(db, 'admins'), where('kermesId', '==', admin.kermesId));
                } else {
                    // Fallback if they don't have businessId/kermesId, fetch nothing to be safe
                    adminsQuery = query(collection(db, 'admins'), where('businessId', '==', 'NONE')); 
                }
            }
            
            const adminsSnap = await getDocs(adminsQuery);
            const adminsData: UnifiedUser[] = adminsSnap.docs.map(doc => {
                const data = doc.data();
                
                // Determine normalized role
                let normalizedRole = 'staff';
                if (data.adminType === 'super') normalizedRole = 'super';
                else if (data.adminType === 'admin' || data.adminType === 'lokma_admin') normalizedRole = 'lokma_admin';
                else if (data.adminType === 'kermes_admin') normalizedRole = 'kermes_admin';
                else if (data.adminType === 'driver' || (data.roles && data.roles.includes('driver'))) normalizedRole = 'driver';

                return {
                    id: doc.id,
                    source: 'admins',
                    email: data.email || '',
                    displayName: data.displayName || data.name || data.email?.split('@')[0] || 'Bilinmiyor',
                    phone: data.phone || data.phoneNumber || '',
                    photoURL: data.photoURL || '',
                    role: normalizedRole,
                    businessId: data.businessId,
                    kermesId: data.kermesId,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                    isActive: data.isActive !== false,
                };
            });

            fetchedUsers = [...fetchedUsers, ...adminsData];

            // 2. Fetch Users Collection (Customers) - ONLY for Super Admin
            if (isSuperAdmin) {
                // For performance, limit to recent 500 customers initially
                const usersQ = query(collection(db, 'users'), limit(500));
                const usersSnap = await getDocs(usersQ);
                const customersData: UnifiedUser[] = usersSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        source: 'users',
                        email: data.email || '',
                        displayName: data.displayName || data.name || data.firstName || 'Müşteri',
                        phone: data.phone || data.phoneNumber || '',
                        photoURL: data.photoURL || '',
                        role: 'customer',
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                        isActive: true,
                    };
                });
                fetchedUsers = [...fetchedUsers, ...customersData];
            }

            // Sort by recent by default
            fetchedUsers.sort((a, b) => {
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            setUsers(fetchedUsers);
        } catch (error) {
            console.error("Error fetching unified users:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Role Filter
            if (roleFilter !== 'all' && user.role !== roleFilter) return false;

            // Search Term
            if (searchQuery.trim()) {
                const term = searchQuery.toLowerCase();
                const matchesName = user.displayName?.toLowerCase().includes(term);
                const matchesEmail = user.email?.toLowerCase().includes(term);
                const matchesPhone = user.phone?.includes(term);
                if (!matchesName && !matchesEmail && !matchesPhone) return false;
            }

            return true;
        });
    }, [users, roleFilter, searchQuery]);


    // Handlers
    const handleEditUser = (user: UnifiedUser) => {
        // Route to the appropriate management page based on role/source
        if (user.role === 'customer') {
            router.push(`/admin/customers`); 
            // In a real app we might push to an exact ID, but sending them to the list is fine for now
        } else if (user.role === 'driver') {
            router.push(`/admin/drivers`);
        } else if (user.role === 'super') {
            router.push(`/admin/superadmins`);
        } else if (user.role === 'lokma_admin') {
            router.push(`/admin/partners`);
        } else if (user.role === 'kermes_admin') {
            router.push(`/admin/volunteers`);
        } else {
            router.push(`/admin/staff-shifts`);
        }
    };

    const getRoleBadgeInfo = (role: string) => {
        switch (role) {
            case 'super': return { bg: 'bg-red-600/20 text-red-500', label: 'Super Admin' };
            case 'lokma_admin': return { bg: 'bg-purple-600/20 text-purple-500', label: 'Lokma Partner' };
            case 'kermes_admin': return { bg: 'bg-orange-600/20 text-orange-500', label: 'Kermes Admin' };
            case 'driver': return { bg: 'bg-blue-600/20 text-blue-500', label: 'Sürücü (Fahrer)' };
            case 'staff': return { bg: 'bg-gray-600/20 text-gray-400', label: 'Personel (Staff)' };
            case 'customer': return { bg: 'bg-green-600/20 text-green-500', label: 'Müşteri (Kunde)' };
            default: return { bg: 'bg-gray-800 text-gray-400', label: 'Bilinmiyor' };
        }
    };


    if (adminLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    if (!admin) return null;

    return (
        <div className="min-h-screen bg-background text-foreground pb-12">
            <div className="max-w-7xl mx-auto px-4 py-8">
                
                {/* Header & Quick Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Benutzerverwaltung</h1>
                        <p className="text-muted-foreground mt-1">
                            {isSuperAdmin 
                                ? 'Tüm kullanıcıları, personeli ve iş ortaklarını "C-Level" RBAC görünümü ile yönetin.'
                                : 'Size bağlı personelleri ve sürücüleri bu listeden yönetebilirsiniz.'}
                        </p>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="bg-pink-600 hover:bg-pink-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-pink-600/20 transition-all flex items-center gap-2"
                        >
                            <span>+ Benutzer hinzufügen</span>
                            <span className="text-xs">▼</span>
                        </button>

                        {showAddMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl py-2 z-50">
                                {isSuperAdmin && (
                                    <>
                                        <button onClick={() => router.push('/admin/superadmins')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">👑 Super Admin Ekle</button>
                                        <button onClick={() => router.push('/admin/partners')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">🏪 Lokma Partner Ekle</button>
                                        <button onClick={() => router.push('/admin/volunteers')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">🎪 Kermes Partner Ekle</button>
                                    </>
                                )}
                                <button onClick={() => router.push('/admin/drivers')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">🚗 Sürücü (Fahrer) Ekle</button>
                                <button onClick={() => router.push('/admin/staff-shifts')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">👥 Personel Ekle</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters & Search Bar */}
                <div className="bg-card border border-border rounded-2xl p-4 mb-6 shadow-sm flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Name, E-Mail oder Telefon suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                        />
                    </div>

                    <div className="flex-shrink-0 flex items-center flex-wrap gap-2">
                        <FilterPill active={roleFilter === 'all'} label="Tümü" count={users.length} onClick={() => setRoleFilter('all')} />
                        
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'customer'} label="Kunden" count={users.filter(u => u.role === 'customer').length} onClick={() => setRoleFilter('customer')} />
                        )}
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'lokma_admin'} label="Partner" count={users.filter(u => u.role === 'lokma_admin').length} onClick={() => setRoleFilter('lokma_admin')} />
                        )}
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'kermes_admin'} label="Kermes" count={users.filter(u => u.role === 'kermes_admin').length} onClick={() => setRoleFilter('kermes_admin')} />
                        )}

                        <FilterPill active={roleFilter === 'driver'} label="Fahrer" count={users.filter(u => u.role === 'driver').length} onClick={() => setRoleFilter('driver')} />
                        <FilterPill active={roleFilter === 'staff'} label="Personal" count={users.filter(u => u.role === 'staff').length} onClick={() => setRoleFilter('staff')} />
                        
                        {isSuperAdmin && (
                            <FilterPill active={roleFilter === 'super'} label="Super Admins" count={users.filter(u => u.role === 'super').length} onClick={() => setRoleFilter('super')} />
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-800/50 border-b border-border">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Benutzer</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Kontakt</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rolle (RBAC)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
                                                <p>Kullanıcılar yükleniyor...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            <div className="text-4xl mb-3">👻</div>
                                            <p>Suche ergab keine Treffer.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => {
                                        const roleInfo = getRoleBadgeInfo(user.role);
                                        return (
                                            <tr key={user.id} className="hover:bg-gray-800/30 transition-colors group">
                                                {/* User Identity Column */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center border border-gray-600">
                                                            {user.photoURL ? (
                                                                <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-gray-300 font-medium text-sm">
                                                                    {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-foreground">{user.displayName}</div>
                                                            <div className="text-xs text-muted-foreground font-mono">ID: {user.id.slice(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Contact Details */}
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-300">{user.email || '—'}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{user.phone || '—'}</div>
                                                </td>

                                                {/* RBAC Role Tag */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleInfo.bg} border border-current/20`}>
                                                            {roleInfo.label}
                                                        </span>
                                                        {user.businessId && user.businessId !== 'NONE' && (
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                🏪 Lokma #{user.businessId.slice(0,4)}
                                                            </span>
                                                        )}
                                                        {user.kermesId && user.kermesId !== 'NONE' && (
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                🎪 Kermes #{user.kermesId.slice(0,4)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Status Tag */}
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${user.isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                        {user.isActive ? 'Aktiv' : 'Inaktiv'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleEditUser(user)}
                                                        className="inline-flex items-center justify-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-sm font-medium rounded-lg transition-colors text-white"
                                                    >
                                                        Details ➔
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {!loading && filteredUsers.length > 0 && (
                        <div className="border-t border-border px-6 py-4 flex items-center justify-between text-sm text-muted-foreground bg-gray-800/30">
                            <div>Toplam <b>{filteredUsers.length}</b> kullanıcı listelendi (Filtre: {roleFilter.toUpperCase()})</div>
                            {isSuperAdmin && roleFilter === 'customer' && (
                                <div className="text-xs text-yellow-500/80">
                                    💡 Performans için son 500 müşteri gösterilmektedir.
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

// Helper Filter Component
function FilterPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border flex items-center gap-1.5
                ${active 
                    ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/20' 
                    : 'bg-card border-border text-gray-400 hover:text-gray-200 hover:bg-gray-800 hover:border-gray-600'}
            `}
        >
            <span>{label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-500'}`}>
                {count}
            </span>
        </button>
    );
}
