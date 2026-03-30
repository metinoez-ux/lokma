'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface Admin {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'butcher_admin' | 'restaurant_admin' | 'kermes_admin';
    assignedTo?: string; // butcherId, restaurantId, etc.
    assignedName?: string; // Business name
    permissions: string[];
    isActive: boolean;
    createdAt: Date;
    fcmTokens?: string[];
}

interface Business {
    id: string;
    name: string;
    type: 'butcher' | 'restaurant' | 'kermes';
}

const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    butcher_admin: 'bg-red-100 text-red-800',
    restaurant_admin: 'bg-amber-100 text-amber-800',
    kermes_admin: 'bg-green-100 text-green-800',
};

export default function AdminManagementPage() {
    const searchParams = useSearchParams();
  const t = useTranslations('AdminAdmins');

    const ROLE_LABELS: Record<string, string> = {
        super_admin: `👑 ${t('super_admin')}`,
        butcher_admin: `🥩 ${t('metzger_admin')}`,
        restaurant_admin: `🍽️ ${t('restoran_admin')}`,
        kermes_admin: `🎪 ${t('kermes_admin')}`,
    };
const [admins, setAdmins] = useState<Admin[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState<Admin | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        role: 'butcher_admin' as Admin['role'],
        assignedTo: '',
        permissions: ['orders', 'products'] as string[],
    });

    // Filter
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // Load admins
    useEffect(() => {
        const adminsRef = collection(db, 'platform_admins');
        const unsubscribe = onSnapshot(adminsRef, (snapshot) => {
            const adminsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as Admin[];
            setAdmins(adminsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load businesses (butchers, restaurants)
    useEffect(() => {
        const loadBusinesses = async () => {
            const allBusinesses: Business[] = [];

            // Load butchers
            const butchersSnap = await getDocs(collection(db, 'businesses'));
            butchersSnap.docs.forEach(doc => {
                allBusinesses.push({
                    id: doc.id,
                    name: doc.data().companyName || t('metzger'),
                    type: 'butcher',
                });
            });

            // Load restaurants
            const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
            restaurantsSnap.docs.forEach(doc => {
                allBusinesses.push({
                    id: doc.id,
                    name: doc.data().name || t('restoran'),
                    type: 'restaurant',
                });
            });

            setBusinesses(allBusinesses);
        };
        loadBusinesses();
    }, []);

    // Get businesses for selected role
    const getBusinessesForRole = (role: string) => {
        switch (role) {
            case 'butcher_admin':
                return businesses.filter(b => b.type === 'butcher');
            case 'restaurant_admin':
                return businesses.filter(b => b.type === 'restaurant');
            default:
                return [];
        }
    };

    // Save admin
    const handleSave = async () => {
        try {
            const businessName = businesses.find(b => b.id === formData.assignedTo)?.name || '';

            const adminData = {
                email: formData.email,
                name: formData.name,
                role: formData.role,
                assignedTo: formData.assignedTo || null,
                assignedName: businessName,
                permissions: formData.permissions,
                isActive: true,
                updatedAt: new Date(),
            };

            if (editingAdmin) {
                await updateDoc(doc(db, 'platform_admins', editingAdmin.id), adminData);
            } else {
                await addDoc(collection(db, 'platform_admins'), {
                    ...adminData,
                    createdAt: new Date(),
                    fcmTokens: [],
                });

                // Also create entry in butcher_admins for FCM tokens
                if (formData.role === 'butcher_admin' && formData.assignedTo) {
                    const butcherAdminRef = doc(db, 'butcher_admins', formData.assignedTo);
                    await updateDoc(butcherAdminRef, {
                        adminEmail: formData.email,
                        fcmTokens: [],
                    }).catch(() => {
                        // Document might not exist, create it
                        addDoc(collection(db, 'butcher_admins'), {
                            butcherId: formData.assignedTo,
                            adminEmail: formData.email,
                            fcmTokens: [],
                        });
                    });
                }
            }

            setShowAddModal(false);
            setEditingAdmin(null);
            resetForm();
        } catch (error) {
            console.error('Error saving admin:', error);
        }
    };

    // Toggle admin active status
    const toggleAdminStatus = async (admin: Admin) => {
        try {
            await updateDoc(doc(db, 'platform_admins', admin.id), {
                isActive: !admin.isActive,
                updatedAt: new Date(),
            });
        } catch (error) {
            console.error('Error toggling admin status:', error);
        }
    };

    // Delete admin
    const handleDeleteAdminConfirm = async () => {
        if (!confirmDeleteAdmin) return;
        try {
            await deleteDoc(doc(db, 'platform_admins', confirmDeleteAdmin.id));
            setConfirmDeleteAdmin(null);
        } catch (error) {
            console.error('Error deleting admin:', error);
        }
    };

    // Open edit modal
    const openEditModal = (admin: Admin) => {
        setEditingAdmin(admin);
        setFormData({
            email: admin.email,
            name: admin.name,
            role: admin.role,
            assignedTo: admin.assignedTo || '',
            permissions: admin.permissions || [],
        });
        setShowAddModal(true);
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            email: '',
            name: '',
            role: 'butcher_admin',
            assignedTo: '',
            permissions: ['orders', 'products'],
        });
    };

    // Deep-link edit modal
    useEffect(() => {
        if (!loading && admins.length > 0 && searchParams) {
            const editId = searchParams.get('edit');
            if (editId) {
                const targetAdmin = admins.find(a => a.id === editId);
                if (targetAdmin) {
                    openEditModal(targetAdmin);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('edit');
                    window.history.replaceState(null, '', url.pathname + url.search);
                }
            }
        }
    }, [loading, admins, searchParams]);

    // Filtered admins
    const filteredAdmins = admins.filter(admin => {
        if (roleFilter === 'all') return true;
        return admin.role === roleFilter;
    });

    // Stats
    const stats = {
        total: admins.length,
        butcher: admins.filter(a => a.role === 'butcher_admin').length,
        restaurant: admins.filter(a => a.role === 'restaurant_admin').length,
        kermes: admins.filter(a => a.role === 'kermes_admin').length,
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold">{t('admin_yonetimi')}</h1>
                <p className="text-muted-foreground text-sm">{t('her_bolum_icin_admin_ekle_ve_yonet')}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-card rounded-lg p-4">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">{t('toplam_admin')}</div>
                </div>
                <div className="bg-red-900/30 rounded-lg p-4 border-l-4 border-red-500">
                    <div className="text-2xl font-bold text-red-800 dark:text-red-400">{stats.butcher}</div>
                    <div className="text-sm text-red-300">🥩 {t('metzger')}</div>
                </div>
                <div className="bg-amber-900/30 rounded-lg p-4 border-l-4 border-amber-500">
                    <div className="text-2xl font-bold text-amber-800 dark:text-amber-400">{stats.restaurant}</div>
                    <div className="text-sm text-amber-300">{t('restoran')}</div>
                </div>
                <div className="bg-green-900/30 rounded-lg p-4 border-l-4 border-green-500">
                    <div className="text-2xl font-bold text-green-800 dark:text-green-400">{stats.kermes}</div>
                    <div className="text-sm text-green-300">🎪 {t('kermes')}</div>
                </div>
            </div>

            {/* Filter & Add */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                    {['all', 'butcher_admin', 'restaurant_admin', 'kermes_admin'].map(role => (
                        <button
                            key={role}
                            onClick={() => setRoleFilter(role)}
                            className={`px-3 py-1 rounded-full text-sm ${roleFilter === role
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                                }`}
                        >
                            {role === 'all' ? t('tumu') : ROLE_LABELS[role]}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                    {t('yeni_admin_ekle')}
                </button>
            </div>

            {/* Admins Table */}
            <div className="bg-card rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase">{t('admin')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase">{t('rol')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase">{t('atandigi_yer')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase">{t('durum')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase">{t('aksiyon')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredAdmins.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    {t('henuz_admin_eklenmemis')}
                                </td>
                            </tr>
                        ) : (
                            filteredAdmins.map(admin => (
                                <tr key={admin.id} className={`hover:bg-gray-700/50 ${!admin.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{admin.name}</div>
                                        <div className="text-sm text-muted-foreground">{admin.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[admin.role]}`}>
                                            {ROLE_LABELS[admin.role]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {admin.assignedName || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleAdminStatus(admin)}
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${admin.isActive
                                                ? 'bg-green-900/50 text-green-800 dark:text-green-400'
                                                : 'bg-gray-700 text-muted-foreground'
                                                }`}
                                        >
                                            {admin.isActive ? t('aktif') : t('pasif')}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEditModal(admin)}
                                                className="text-blue-800 dark:text-blue-400 hover:text-blue-300"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteAdmin(admin)}
                                                className="text-red-800 dark:text-red-400 hover:text-red-300"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-lg shadow-xl max-w-md w-full m-4">
                        <div className="p-6">
                            <h2 className="text-lg font-bold mb-4">
                                {editingAdmin ? t('admin_duzenle') : t('yeni_admin_ekle')}
                            </h2>

                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('ad_soyad')}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                                        placeholder={t('ahmet_yilmaz')}
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('eposta')}</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                                        placeholder="admin@kasap.com"
                                    />
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('rol')}</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as Admin['role'], assignedTo: '' })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="butcher_admin">🥩 {t('metzger_admin')}</option>
                                        <option value="restaurant_admin">{t('restoran_admin')}</option>
                                        <option value="kermes_admin">🎪 {t('kermes_admin')}</option>
                                    </select>
                                </div>

                                {/* Assigned Business */}
                                {(formData.role === 'butcher_admin' || formData.role === 'restaurant_admin') && (
                                    <div>
                                        <label className="block text-sm text-muted-foreground mb-1">{t('atanan_isletme')}</label>
                                        <select
                                            value={formData.assignedTo}
                                            onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="">{t('seciniz')}</option>
                                            {getBusinessesForRole(formData.role).map(business => (
                                                <option key={business.id} value={business.id}>
                                                    {business.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Permissions */}
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-2">{t('yetkiler')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['orders', 'products', 'customers', 'reports'].map(perm => (
                                            <label key={perm} className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-lg cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.permissions.includes(perm)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, permissions: [...formData.permissions, perm] });
                                                        } else {
                                                            setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm) });
                                                        }
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm capitalize">{perm === 'orders' ? t('siparisler') : perm === 'products' ? t('urunler') : perm === 'customers' ? t('musteriler') : t('raporlar')}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => { setShowAddModal(false); setEditingAdmin(null); }}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                >
                                    {t('iptal')}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formData.name || !formData.email}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {editingAdmin ? t('guncelle') : t('ekle')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmDeleteAdmin}
                onClose={() => setConfirmDeleteAdmin(null)}
                onConfirm={handleDeleteAdminConfirm}
                title={t('admin_i_sil')}
                message={t('bu_admin_i_kalici_olarak_silmek_istedigi')}
                itemName={confirmDeleteAdmin?.name}
                variant="danger"
                confirmText={t('evet_sil')}
                loadingText={t('siliniyor')}
            />
        </div>
    );
}
