'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc, query, where, orderBy, limit, startAt, endAt, startAfter, DocumentData } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { normalizeTurkish } from '@/lib/utils';
import { Admin } from '@/types';
import { useAdmin } from '@/components/providers/AdminProvider';
import {
    getModuleBusinessTypes,
    getAllRoles,
    getRoleLabel,
    getRoleIcon,
    isAdminRole,
    getRolesForBusinessTypes,
    getBusinessTypeIcon,
    RoleConfig
} from '@/lib/business-types';


interface StaffMember {
    id: string;
    displayName: string;
    email?: string;
    phoneNumber?: string;
    adminType: string;
    role: string;
    butcherId?: string;
    butcherName?: string;
    restaurantId?: string;
    restaurantName?: string;
    isActive: boolean;
    createdAt?: Date;
    workerId?: string;
}

interface Butcher {
    id: string;
    companyName: string;
    city?: string;
    postalCode?: string;
    customerNumber?: string;
    brand?: string;
    state?: string;
    country?: string;
    streetAddress?: string;
    // Sektör bilgileri (çoklu sektör desteği)
    types?: string[];    // ['kasap', 'market'] gibi
    type?: string;       // Eski format: tek sektör
}

// Dinamik rol bilgisi fonksiyonu - BUSINESS_TYPES'tan otomatik oluşturulur
const getAdminTypeInfo = (adminType: string): { label: string; emoji: string; color: string } => {
    // Super admin özel durum
    if (adminType === 'super') {
        return { label: 'Super Admin', emoji: '🌟', color: 'bg-purple-600' };
    }

    // Sektör admin/personel rolleri
    const roleConfig = getAllRoles().find(r => r.value === adminType);
    if (roleConfig) {
        const isStaff = adminType.endsWith('_staff');
        const baseType = isStaff ? adminType.replace('_staff', '') : adminType;
        const businessIcon = getBusinessTypeIcon(baseType);

        // Renk paleti - sektöre göre
        const colorMap: Record<string, string> = {
            kasap: isStaff ? 'bg-red-500' : 'bg-red-600',
            market: isStaff ? 'bg-green-500' : 'bg-green-600',
            restoran: isStaff ? 'bg-orange-500' : 'bg-orange-600',
            pastane: isStaff ? 'bg-pink-500' : 'bg-pink-600',
            cicekci: isStaff ? 'bg-purple-500' : 'bg-purple-600',
            cigkofte: isStaff ? 'bg-emerald-500' : 'bg-emerald-600',
            cafe: isStaff ? 'bg-amber-500' : 'bg-amber-600',
            catering: isStaff ? 'bg-indigo-500' : 'bg-indigo-600',
            firin: isStaff ? 'bg-yellow-500' : 'bg-yellow-600',
            kermes: isStaff ? 'bg-violet-500' : 'bg-violet-600',
            eticaret: isStaff ? 'bg-cyan-500' : 'bg-cyan-600',
        };

        return {
            label: roleConfig.label,
            emoji: isStaff ? '👤' : businessIcon,
            color: colorMap[baseType] || 'bg-gray-600',
        };
    }

    // Default
    return { label: adminType || 'Diğer', emoji: '👤', color: 'bg-gray-600' };
};

export default function StaffListPage() {
    const router = useRouter();

    // Use centralized admin context for RBAC
    const { admin: currentAdmin, loading: adminLoading } = useAdmin();

    // RBAC computed values
    const isSuperAdmin = useMemo(() => {
        return currentAdmin?.adminType === 'super' || currentAdmin?.role === 'super_admin';
    }, [currentAdmin]);

    const currentBusinessId = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return currentAdmin?.butcherId || (currentAdmin as any)?.businessId || null;
    }, [currentAdmin]);

    const currentBusinessType = useMemo(() => {
        // Extract business type from adminType (e.g., 'kasap' from 'kasap' or 'kasap_staff')
        if (!currentAdmin?.adminType) return null;
        const type = currentAdmin.adminType.replace('_staff', '');
        return type !== 'super' ? type : null;
    }, [currentAdmin]);

    // Available roles for current admin (RBAC filtered)
    // Super Admin: tüm roller VEYA seçili işletmenin sektörleri
    // İşletme Admin: sadece kendi sektörünün personel rolleri
    const availableRoles = useMemo(() => {
        if (isSuperAdmin) {
            // Super admin can assign any role
            return getAllRoles();
        } else if (currentBusinessType) {
            // Business admin can only assign staff roles for their sector
            return getRolesForBusinessTypes([currentBusinessType]).filter(r => !r.isAdmin);
        }
        return [];
    }, [isSuperAdmin, currentBusinessType]);

    // Seçili işletmenin sektörlerine göre filtrelenmiş roller
    // Bu, personel eklerken işletme seçildikten sonra kullanılır
    const [selectedBusinessSectors, setSelectedBusinessSectors] = useState<string[]>([]);

    // İşletme seçildikten sonra gösterilecek roller
    // Super Admin için: seçili işletmenin sektörlerine göre (veya tümü)
    // İşletme Admin için: kendi sektörünün personel rolleri
    const filteredRolesForSelectedBusiness = useMemo(() => {
        if (isSuperAdmin) {
            // Super admin seçili işletmenin sektörlerine göre rolleri göster
            if (selectedBusinessSectors.length > 0) {
                return getRolesForBusinessTypes(selectedBusinessSectors);
            }
            // İşletme seçilmemişse tüm roller
            return getAllRoles();
        }
        // İşletme admini için zaten availableRoles kısıtlı
        return availableRoles;
    }, [isSuperAdmin, selectedBusinessSectors, availableRoles]);

    const [admin, setAdmin] = useState<Admin | null>(null);
    const [loading, setLoading] = useState(true);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);

    // Optimized: Manual Load State
    const [isLoadedAll, setIsLoadedAll] = useState(false);
    const [loadingAll, setLoadingAll] = useState(false);

    // Dropdown state
    const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);

    const [butchersList, setButchersList] = useState<Butcher[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Modal states
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Add/Edit form states
    const [newDisplayName, setNewDisplayName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editRole, setEditRole] = useState('kasap_staff');
    const [editButcherId, setEditButcherId] = useState('');
    const [editButcherSearch, setEditButcherSearch] = useState('');

    // Sorting & Pagination states
    const [sortField, setSortField] = useState<'createdAt' | 'displayName'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [pageSize, setPageSize] = useState(20);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Initial load (limited)
    const loadStaff = async (loadAll = false) => {
        try {
            setLoading(true);
            let q;
            if (loadAll) {
                q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
            } else {
                q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'), limit(50));
            }

            const adminsSnapshot = await getDocs(q);
            const staff = adminsSnapshot.docs.map(d => {
                const data = d.data();
                // ... mapping logic remains safely encapsulated in map
                return {
                    id: d.id,
                    displayName: data.displayName || 'İsimsiz',
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    adminType: data.adminType || 'default',
                    role: data.role || 'admin',
                    butcherId: data.butcherId,
                    butcherName: data.butcherName,
                    restaurantId: data.restaurantId,
                    restaurantName: data.restaurantName,
                    isActive: data.isActive !== false,
                    createdAt: data.createdAt?.toDate?.() || null,
                    workerId: data.workerId,
                } as StaffMember;
            });
            setStaffList(staff);
            if (loadAll) setIsLoadedAll(true);

            // Extract unique butcher IDs
            const butcherIds = Array.from(new Set(staff.map(s => s.butcherId).filter(Boolean))) as string[];
            if (butcherIds.length > 0) {
                // Fetch only referenced butchers in chunks of 10 (Firestore limit for 'in' queries is 30, staying safe)
                const chunks = [];
                for (let i = 0; i < butcherIds.length; i += 10) {
                    chunks.push(butcherIds.slice(i, i + 10));
                }

                const loadedButchers: Butcher[] = [];
                for (const chunk of chunks) {
                    // Check existing first to avoid re-fetching if we have a cache (optional but good)
                    // For now simple fetch
                    try {
                        const bQ = query(collection(db, 'businesses'), where('__name__', 'in', chunk));
                        const bSnap = await getDocs(bQ);
                        bSnap.docs.forEach(d => {
                            const data = d.data();
                            loadedButchers.push({
                                id: d.id,
                                companyName: data.companyName || 'İsimsiz İşletme',
                                city: data.city || data.address?.city || '',
                                postalCode: data.postalCode || data.address?.postalCode || '',
                                customerNumber: data.customerNumber || d.id.substring(0, 6).toUpperCase(),
                                brand: data.brand || 'independent',
                                state: data.state || data.address?.state || '',
                                country: data.country || 'DE',
                                streetAddress: data.streetAddress || data.address?.street || '',
                            });
                        });
                    } catch (e) {
                        console.error('Error fetching butcher chunk:', e);
                    }
                }
                setButchersList(prev => {
                    // Merge with existing to avoid dupes
                    const existingIds = new Set(prev.map(p => p.id));
                    const newButchers = loadedButchers.filter(b => !existingIds.has(b.id));
                    return [...prev, ...newButchers];
                });
            }

        } catch (error) {
            console.error('Load staff error:', error);
        }
        setLoading(false);
        setLoadingAll(false);
    };

    const handleLoadAll = () => {
        setLoadingAll(true);
        loadStaff(true);
    };

    // Server-side search for dropdown
    const searchButchers = async (searchTerm: string) => {
        if (!searchTerm || searchTerm.length < 2) return;
        try {
            // Simple name search - Firestore doesn't do full text, so we rely on finding by prefix or exact match if possible, 
            // OR since we can't do broad text search easily without Algolia, we can try searching by 'companyName' >= term
            // But 'companyName' is case sensitive usually. 
            // Better strategy for this hot-fix: Fetch a reasonable chunk of butchers or rely on what we have? 
            // User likely wants to search any butcher. 
            // Fallback: If "Add Staff" is clicked, we might need to load a 'starter' list or search by exact match?
            // Actually, let's implement a 'startAt' style search or just fetch recent 20 for list. 
            // For now, let's use a specialized query if possible.
            // If not feasible to implement complex search quickly, we will just fetch 50 butchers order by name?
            // Let's implement a 'name' prefix query.

            const q = query(
                collection(db, 'businesses'),
                orderBy('companyName'),
                startAt(searchTerm),
                endAt(searchTerm + '\uf8ff'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            const foundHelper = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as any[];

            // Map to interface
            const formatted = foundHelper.map(data => ({
                id: data.id,
                companyName: data.companyName || 'İsimsiz İşletme',
                city: data.city || data.address?.city || '',
                postalCode: data.postalCode || data.address?.postalCode || '',
                customerNumber: data.customerNumber || data.id.substring(0, 6).toUpperCase(),
                brand: data.brand || 'independent',
                state: data.state || data.address?.state || '',
                country: data.country || 'DE',
                streetAddress: data.streetAddress || data.address?.street || '',
            }));

            setButchersList(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const newButchers = formatted.filter(b => !existingIds.has(b.id));
                return [...prev, ...newButchers];
            });

        } catch (e) {
            console.error('Search butcher error:', e);
        }
    };

    // Auto-search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (editButcherSearch) searchButchers(editButcherSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [editButcherSearch]);

    // Old loadButchers - REMOVED


    const handleLogout = async () => {
        await auth.signOut();
        // Force hard refresh to clear all client states/cache
        window.location.href = '/login';
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            const { isSuperAdmin } = await import('@/lib/config');
            if (!isSuperAdmin(user.email)) {
                router.push('/dashboard');
                return;
            }

            setAdmin({
                id: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Super Admin',
                role: 'super_admin',
                adminType: 'super',
                permissions: [],
                isActive: true,
                createdAt: new Date(),
                createdBy: 'system',
            } as Admin);

            // Critical Optimization: Don't wait for butchers list (large dataset)
            // Load staff first (fast, limited to 50) -> The staff loading logic now automatically fetches referenced butchers!
            await loadStaff();
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    // Open add modal
    const openAddModal = () => {
        setNewDisplayName('');
        setEditEmail('');
        setEditPhone('');
        // Set default role based on available roles
        setEditRole(availableRoles[0]?.value || 'kasap_staff');
        // For non-super admins, auto-select their business
        if (!isSuperAdmin && currentBusinessId) {
            setEditButcherId(currentBusinessId);
        } else {
            setEditButcherId('');
        }
        setEditButcherSearch('');
        setShowAddModal(true);
    };

    // Add new staff
    const addNewStaff = async () => {
        if (!newDisplayName.trim()) {
            showToast('İsim gerekli', 'error');
            return;
        }

        // Business requirement validation (Super Admin hariç)
        const isAddingNonSuperRole = editRole !== 'super';
        if (isAddingNonSuperRole && !editButcherId) {
            showToast('İşletme seçimi zorunlu!', 'error');
            return;
        }

        setSaving(true);
        try {
            const selectedButcher = butchersList.find(b => b.id === editButcherId);
            const roleLabel = getAdminTypeInfo(editRole).label;

            // Generate temp password if phone number provided
            let tempPassword = '';
            if (editPhone) {
                tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
            }

            // Generate unique worker ID (MWxxxx format)
            const existingWorkerIds = staffList
                .map(s => s.workerId)
                .filter(id => id && id.startsWith('MW'))
                .map(id => parseInt(id!.replace('MW', ''), 10))
                .filter(num => !isNaN(num));
            const nextNumber = existingWorkerIds.length > 0
                ? Math.max(...existingWorkerIds) + 1
                : 1001;
            const workerId = `MW${nextNumber.toString().padStart(4, '0')}`;

            const { addDoc, collection: firestoreCollection } = await import('firebase/firestore');
            await addDoc(firestoreCollection(db, 'admins'), {
                displayName: newDisplayName.trim(),
                email: editEmail || null,
                phoneNumber: editPhone || null,
                adminType: editRole,
                role: 'admin',
                butcherId: editButcherId || null,
                butcherName: selectedButcher?.companyName || null,
                isActive: true,
                createdAt: new Date(),
                createdBy: admin?.email || 'system',
                // Worker ID
                workerId: workerId,
                // New fields for SMS login
                tempPassword: tempPassword || null,
                tempPasswordRequired: !!tempPassword,
            });

            // Send SMS if phone number provided
            if (editPhone && tempPassword) {
                try {
                    await fetch('/api/staff/invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            staffPhone: editPhone,
                            staffName: newDisplayName.trim(),
                            inviterName: admin?.displayName || admin?.email || 'Admin',
                            businessName: selectedButcher?.companyName || 'MIRA',
                            role: roleLabel,
                        }),
                    });
                    showToast('Personel eklendi ve SMS gönderildi ✅', 'success');
                } catch {
                    showToast('Personel eklendi ama SMS gönderilemedi', 'success');
                }
            } else {
                showToast('Yeni çalışan eklendi', 'success');
            }

            setShowAddModal(false);
            await loadStaff();
        } catch (error) {
            console.error('Add staff error:', error);
            showToast('Ekleme başarısız', 'error');
        }
        setSaving(false);
    };

    // Open edit modal
    const openEditModal = (staff: StaffMember) => {
        setEditingStaff(staff);
        setEditRole(staff.adminType);
        setEditButcherId(staff.butcherId || '');
        setEditEmail(staff.email || '');
        setEditPhone(staff.phoneNumber || '');
    };

    // Save edited staff
    const saveStaff = async () => {
        if (!editingStaff) return;

        // Business requirement validation (Super Admin hariç)
        const isEditingNonSuperRole = editRole !== 'super';
        if (isEditingNonSuperRole && !editButcherId) {
            showToast('İşletme seçimi zorunlu!', 'error');
            return;
        }

        setSaving(true);
        try {
            const selectedButcher = butchersList.find(b => b.id === editButcherId);
            const roleLabel = getAdminTypeInfo(editRole).label;

            // Check if phone number is new or changed
            const phoneChanged = editPhone && editPhone !== editingStaff.phoneNumber;
            let tempPassword = '';

            if (phoneChanged) {
                tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
            }

            await updateDoc(doc(db, 'admins', editingStaff.id), {
                displayName: editingStaff.displayName || null,
                adminType: editRole,
                butcherId: editButcherId || null,
                butcherName: selectedButcher?.companyName || null,
                email: editEmail || null,
                phoneNumber: editPhone || null,
                updatedAt: new Date(),
                // Update temp password if phone changed
                ...(phoneChanged && {
                    tempPassword: tempPassword,
                    tempPasswordRequired: true,
                }),
            });

            // Send SMS if phone changed
            if (phoneChanged && tempPassword) {
                try {
                    await fetch('/api/staff/invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            staffPhone: editPhone,
                            staffName: editingStaff.displayName,
                            inviterName: admin?.displayName || admin?.email || 'Admin',
                            businessName: selectedButcher?.companyName || 'MIRA',
                            role: roleLabel,
                        }),
                    });
                    showToast('Güncellendi ve davetiye SMS gönderildi ✅', 'success');
                } catch {
                    showToast('Güncellendi ama SMS gönderilemedi', 'success');
                }
            } else {
                showToast('Personel güncellendi', 'success');
            }

            setEditingStaff(null);
            await loadStaff();
        } catch (error) {
            console.error('Save staff error:', error);
            showToast('Güncelleme başarısız', 'error');
        }
        setSaving(false);
    };

    // Toggle staff status
    const toggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'admins', staffId), {
                isActive: !currentStatus,
                updatedAt: new Date(),
            });
            showToast(currentStatus ? 'Personel devre dışı bırakıldı' : 'Personel aktif edildi', 'success');
            await loadStaff();
        } catch (error) {
            console.error('Toggle status error:', error);
            showToast('İşlem başarısız', 'error');
        }
    };

    // Delete staff (with modal confirmation)
    const confirmDeleteStaff = async () => {
        if (!deletingStaff) return;

        setSaving(true);
        try {
            await deleteDoc(doc(db, 'admins', deletingStaff.id));
            showToast(`${deletingStaff.displayName} silindi`, 'success');
            setDeletingStaff(null);
            await loadStaff();
        } catch (error) {
            console.error('Delete staff error:', error);
            showToast('Silme işlemi başarısız', 'error');
        }
        setSaving(false);
    };

    // Filter staff with Turkish character normalization
    const normalizedQuery = normalizeTurkish(searchQuery);
    const filteredStaff = staffList.filter(staff => {
        const matchesFilter = filter === 'all' || staff.adminType === filter;
        const matchesSearch = searchQuery === '' ||
            normalizeTurkish(staff.displayName || '').includes(normalizedQuery) ||
            normalizeTurkish(staff.email || '').includes(normalizedQuery) ||
            (staff.phoneNumber || '').includes(searchQuery) ||
            normalizeTurkish(staff.butcherName || '').includes(normalizedQuery);
        return matchesFilter && matchesSearch;
    });

    const uniqueTypes = [...new Set(staffList.map(s => s.adminType))];

    // Apply sorting
    const sortedStaff = [...filteredStaff].sort((a, b) => {
        if (sortField === 'displayName') {
            const nameA = (a.displayName || '').toLowerCase();
            const nameB = (b.displayName || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else {
            const dateA = a.createdAt?.getTime() || 0;
            const dateB = b.createdAt?.getTime() || 0;
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in-right ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                    <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span className="font-medium">{toast.message}</span>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingStaff && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-4xl">🗑️</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Personelı Sil</h3>
                            <p className="text-gray-400 mb-6">
                                <span className="text-white font-semibold">{deletingStaff.displayName}</span> adlı çalışanı silmek istediğinize emin misiniz?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeletingStaff(null)}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={confirmDeleteStaff}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                                >
                                    {saving ? 'Siliniyor...' : '🗑️ Evet, Sil'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal - COMPREHENSIVE FORMAT */}
            {editingStaff && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-2xl max-w-2xl w-full my-8">
                        <div className="border-b border-gray-700 p-6 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">✏️ Personel Düzenle</h3>
                            <button onClick={() => setEditingStaff(null)} className="text-gray-400 hover:text-white text-2xl">✕</button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* 📝 Kişisel Bilgiler */}
                            <div>
                                <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                    📝 Kişisel Bilgiler
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Ad</label>
                                        <input
                                            type="text"
                                            value={editingStaff.displayName?.split(' ')[0] || ''}
                                            onChange={(e) => {
                                                const lastName = editingStaff.displayName?.split(' ').slice(1).join(' ') || '';
                                                setEditingStaff({
                                                    ...editingStaff,
                                                    displayName: `${e.target.value} ${lastName}`.trim()
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                            placeholder="Ad"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Soyad</label>
                                        <input
                                            type="text"
                                            value={editingStaff.displayName?.split(' ').slice(1).join(' ') || ''}
                                            onChange={(e) => {
                                                const firstName = editingStaff.displayName?.split(' ')[0] || '';
                                                setEditingStaff({
                                                    ...editingStaff,
                                                    displayName: `${firstName} ${e.target.value}`.trim()
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                            placeholder="Soyad"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 📞 İletişim Bilgileri */}
                            <div>
                                <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                    📞 İletişim Bilgileri
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">E-posta</label>
                                        <input
                                            type="email"
                                            value={editEmail}
                                            onChange={(e) => setEditEmail(e.target.value)}
                                            placeholder="ornek@email.com"
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Telefon</label>
                                        <input
                                            type="tel"
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                            placeholder="+49 178 444 3475"
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 🔐 Yetki Yönetimi */}
                            <div>
                                <h4 className="text-white font-semibold mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                                    🔐 Yetki Yönetimi
                                </h4>
                                <div className="space-y-4">
                                    {/* Role */}
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Rol</label>
                                        <select
                                            value={editRole}
                                            onChange={(e) => setEditRole(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            title="Rol seçimi"
                                        >
                                            {filteredRolesForSelectedBusiness.map((role) => (
                                                <option key={role.value} value={role.value}>
                                                    {role.icon} {role.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Business - Searchable */}
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">
                                            🏪 İşletme
                                            {!isSuperAdmin && <span className="text-orange-400 ml-2">(Değiştirilemez)</span>}
                                        </label>
                                        {/* Show selected business if any */}
                                        {editButcherId && (
                                            <div className="mb-2 px-4 py-2 bg-orange-600/20 border border-orange-500 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-orange-400">
                                                        ✅ {butchersList.find(b => b.id === editButcherId)?.companyName || 'Seçili'}
                                                    </span>
                                                    {isSuperAdmin && (
                                                        <button
                                                            onClick={() => { setEditButcherId(''); setSelectedBusinessSectors([]); }}
                                                            className="text-orange-400 hover:text-orange-300"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Sektör badge'leri */}
                                                {selectedBusinessSectors.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {selectedBusinessSectors.map(sector => (
                                                            <span key={sector} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                                                                {getBusinessTypeIcon(sector)} {getRoleLabel(sector)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Search input - only for Super Admin */}
                                        {isSuperAdmin && (
                                            <input
                                                type="text"
                                                placeholder="İşletme ara (isim, şehir, posta kodu)..."
                                                value={editButcherSearch}
                                                onChange={(e) => {
                                                    setEditButcherSearch(e.target.value);
                                                    setShowBusinessDropdown(true);
                                                }}
                                                onFocus={() => setShowBusinessDropdown(true)}
                                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                            />
                                        )}
                                        {!isSuperAdmin && !editButcherId && (
                                            <p className="text-yellow-500 text-sm">⚠️ İşletme ataması gerekli. Lütfen Super Admin ile iletişime geçin.</p>
                                        )}
                                        {/* Butcher search results */}
                                        {showBusinessDropdown && editButcherSearch && (
                                            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-700 rounded-lg border border-gray-600">
                                                {(() => {
                                                    const filtered = butchersList.filter(b => {
                                                        const search = editButcherSearch.toLowerCase();
                                                        return b.companyName?.toLowerCase().includes(search) ||
                                                            b.city?.toLowerCase().includes(search) ||
                                                            b.postalCode?.includes(search) ||
                                                            b.customerNumber?.toLowerCase().includes(search);
                                                    });

                                                    if (filtered.length === 0) {
                                                        return <p className="px-4 py-3 text-gray-400 text-sm">İşletme bulunamadı</p>;
                                                    }

                                                    return filtered.slice(0, 5).map(b => {
                                                        const brandLabel = b.brand === 'tuna' ? '🔴' : b.brand === 'akdeniz_toros' ? '🟢' : '⚪';
                                                        const flag = b.country === 'TR' ? '🇹🇷' : b.country === 'DE' ? '🇩🇪' : '🌍';
                                                        const fullAddress = `${b.streetAddress ? b.streetAddress + ', ' : ''}${b.postalCode} ${b.city}${b.state ? ', ' + b.state : ''}`;
                                                        return (
                                                            <div key={b.id} className={`w-full px-4 py-3 text-left hover:bg-gray-600 border-b border-gray-600 last:border-b-0 ${editButcherId === b.id ? 'bg-orange-600/20 text-orange-400' : 'text-white'}`}>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditButcherId(b.id);
                                                                        const sectors = b.types || (b.type ? [b.type] : []);
                                                                        setSelectedBusinessSectors(sectors);
                                                                        setEditButcherSearch('');
                                                                        setShowBusinessDropdown(false);
                                                                    }}
                                                                    className="w-full text-left"
                                                                >
                                                                    <p className="font-medium">{brandLabel} {b.companyName}</p>
                                                                </button>
                                                                <p className="text-xs text-gray-400">{flag} {fullAddress}</p>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-gray-700 p-6 flex gap-3">
                            <button
                                onClick={() => setEditingStaff(null)}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                İptal
                            </button>
                            <button
                                onClick={saveStaff}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Link href="/admin/dashboard" className="text-red-100 hover:text-white">← Geri</Link>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <span className="text-red-700 font-bold">👥</span>
                        </div>
                        <div>
                            <h1 className="font-bold">Tüm Personellar</h1>
                            <p className="text-xs text-red-200">{staffList.length} kayıtlı çalışan</p>
                        </div>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="px-4 py-2 bg-white text-red-700 rounded-lg font-bold hover:bg-red-100 flex items-center gap-2"
                    >
                        ➕ Yeni Personel
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="bg-gray-800 rounded-xl p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="İsim, e-posta, telefon veya işletme ara..."
                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500"
                            />
                        </div>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                            title="Rol filtresi"
                        >
                            <option value="all">Tüm Roller</option>
                            {uniqueTypes.map(type => (
                                <option key={type} value={type}>
                                    {getAdminTypeInfo(type).emoji} {getAdminTypeInfo(type).label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Staff Count */}
                <div className="text-gray-400 text-sm mb-4">
                    {filteredStaff.length} personel
                </div>

                {/* Staff Card-Row List */}
                <div className="space-y-2">
                    {filteredStaff.length === 0 ? (
                        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                            Personel bulunamadı
                        </div>
                    ) : (
                        sortedStaff.slice(0, pageSize).map((staff) => {
                            const typeInfo = getAdminTypeInfo(staff.adminType);
                            const butcher = staff.butcherId ? butchersList.find(b => b.id === staff.butcherId) : null;
                            return (
                                <div
                                    key={staff.id}
                                    className="group bg-gray-800 hover:bg-gray-750 rounded-xl p-4 transition-all cursor-pointer flex items-center gap-4"
                                    onClick={() => openEditModal(staff)}
                                >
                                    {/* Avatar */}
                                    <div className={`w-12 h-12 ${typeInfo.color} rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                                        {staff.displayName?.charAt(0) || '?'}
                                    </div>

                                    {/* Main Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-white font-semibold truncate">{staff.displayName}</h3>
                                            {staff.workerId && (
                                                <span className="px-2 py-0.5 bg-blue-600/30 text-blue-400 text-xs rounded font-mono">
                                                    {staff.workerId}
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${typeInfo.color} text-white`}>
                                                {typeInfo.emoji} {typeInfo.label}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${staff.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                                {staff.isActive ? '● Aktif' : '○ Pasif'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                            {staff.email && <span>📧 {staff.email}</span>}
                                            {staff.phoneNumber && <span>📱 {staff.phoneNumber}</span>}
                                            {!staff.email && !staff.phoneNumber && <span className="italic">İletişim bilgisi yok</span>}
                                        </div>
                                    </div>

                                    {/* Business Info */}
                                    <div className="hidden md:block text-right min-w-[180px]">
                                        {staff.butcherName || staff.restaurantName ? (
                                            <div>
                                                <p className="text-white text-sm font-medium">{staff.butcherName || staff.restaurantName}</p>
                                                {butcher && (
                                                    <p className="text-gray-500 text-xs">
                                                        {butcher.country === 'TR' ? '🇹🇷' : butcher.country === 'DE' ? '🇩🇪' : '🌍'} {butcher.postalCode} {butcher.city}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 text-sm italic">Atanmadı</span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => toggleStaffStatus(staff.id, staff.isActive)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${staff.isActive
                                                ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40'
                                                : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                                                }`}
                                        >
                                            {staff.isActive ? '⏸️' : '▶️'}
                                        </button>
                                        <button
                                            onClick={() => setDeletingStaff(staff)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/40"
                                        >
                                            🗑️
                                        </button>
                                    </div>

                                    {/* Arrow indicator on hover */}
                                    <span className="text-gray-500 group-hover:text-white transition-colors text-xl">→</span>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {
                    sortedStaff.length > pageSize && (
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <button
                                onClick={() => setPageSize(prev => Math.max(10, prev - 10))}
                                disabled={pageSize <= 10}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                            >
                                ← Önceki
                            </button>
                            <span className="text-gray-400 text-sm">
                                {Math.min(pageSize, sortedStaff.length)} / {sortedStaff.length} personel
                            </span>
                            <button
                                onClick={() => setPageSize(prev => prev + 10)}
                                disabled={pageSize >= sortedStaff.length}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                            >
                                Sonraki →
                            </button>
                        </div>
                    )
                }
            </main >

            {/* Add Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="border-b border-gray-700 p-6 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">➕ Yeni Personel Ekle</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white text-2xl">✕</button>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">👤 İsim Soyisim *</label>
                                    <input
                                        type="text"
                                        value={newDisplayName}
                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                        placeholder="Ahmet Yılmaz"
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">📧 E-posta</label>
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        placeholder="ornek@email.com"
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">📱 Telefon</label>
                                    <input
                                        type="tel"
                                        value={editPhone}
                                        onChange={(e) => setEditPhone(e.target.value)}
                                        placeholder="+49 178 444 3475"
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                    />
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">🎭 Rol</label>
                                    <select
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        title="Rol seçimi"
                                    >
                                        {filteredRolesForSelectedBusiness.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.icon} {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Business - Searchable (Super Admin only can change) */}
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        🏪 İşletme
                                        {!isSuperAdmin && <span className="text-orange-400 ml-2">(Değiştirilemez)</span>}
                                    </label>
                                    {editButcherId && (
                                        <div className="mb-2 px-4 py-2 bg-orange-600/20 border border-orange-500 rounded-lg flex items-center justify-between">
                                            <span className="text-orange-400">
                                                ✅ {butchersList.find(b => b.id === editButcherId)?.companyName}
                                            </span>
                                            {isSuperAdmin && (
                                                <button onClick={() => setEditButcherId('')} className="text-orange-400 hover:text-orange-300">✕</button>
                                            )}
                                        </div>
                                    )}
                                    {isSuperAdmin && (
                                        <input
                                            type="text"
                                            placeholder="İşletme ara..."
                                            value={editButcherSearch}
                                            onChange={(e) => {
                                                setEditButcherSearch(e.target.value);
                                                setShowBusinessDropdown(true);
                                            }}
                                            onFocus={() => setShowBusinessDropdown(true)}
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-orange-500"
                                        />
                                    )}
                                    {!isSuperAdmin && !editButcherId && (
                                        <p className="text-yellow-500 text-sm">⚠️ İşletme ataması gerekli. Lütfen Super Admin ile iletişime geçin.</p>
                                    )}
                                    {showBusinessDropdown && editButcherSearch && (
                                        <div className="mt-2 max-h-32 overflow-y-auto bg-gray-700 rounded-lg border border-gray-600">
                                            {(() => {
                                                const filtered = butchersList.filter(b => {
                                                    const s = editButcherSearch.toLowerCase();
                                                    return b.companyName?.toLowerCase().includes(s) || b.city?.toLowerCase().includes(s) || b.postalCode?.includes(s);
                                                });
                                                if (filtered.length === 0) return <p className="px-4 py-2 text-gray-400 text-sm">İşletme yok</p>;
                                                return filtered.slice(0, 5).map(b => (
                                                    <button
                                                        key={b.id}
                                                        onClick={() => {
                                                            setEditButcherId(b.id);
                                                            // Set sectors for this business
                                                            const sectors = b.types || (b.type ? [b.type] : []);
                                                            setSelectedBusinessSectors(sectors);
                                                            setEditButcherSearch('');
                                                            setShowBusinessDropdown(false);
                                                        }}
                                                        className={`w-full px-4 py-2 text-left hover:bg-gray-600 text-sm ${editButcherId === b.id ? 'bg-orange-600/20 text-orange-400' : 'text-white'}`}
                                                    >
                                                        {b.companyName} <span className="text-gray-400">• {b.postalCode} {b.city}</span>
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="border-t border-gray-700 p-6 flex gap-3">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={addNewStaff}
                                    disabled={saving || !newDisplayName.trim()}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                                >
                                    {saving ? 'Ekleniyor...' : '➕ Ekle'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
