'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Admin {
  id: string;
  email: string;
  name: string;
  adminType: string;
  roles: string[];
  businessId?: string;
  kermesId?: string;
  assignedName?: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
}

interface Business {
  id: string;
  name: string;
  type: string;
}

const ROLE_COLORS: Record<string, string> = {
  super: 'bg-purple-100 text-purple-800',
  lokma_admin: 'bg-red-100 text-red-800',
  business_admin: 'bg-amber-100 text-amber-800',
  kermes_admin: 'bg-green-100 text-green-800',
  driver: 'bg-blue-100 text-blue-800',
};

export default function AdminManagementPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('AdminAdmins');

  const ROLE_LABELS: Record<string, string> = {
    super: `👑 ${t('super_admin') || 'Super Admin'}`,
    lokma_admin: `🥩 ${t('metzger_admin') || 'Lokma Admin'}`,
    business_admin: `🍽️ ${t('restoran_admin') || 'İşletme Admin'}`,
    kermes_admin: `🎪 ${t('kermes_admin') || 'Kermes Admin'}`,
    driver: `🚗 Driver`,
  };

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [kermesEvents, setKermesEvents] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    permissions: [] as string[],
    isActive: true,
  });

  // Filter
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Load businesses & kermes
  useEffect(() => {
    const loadEntities = async () => {
      const allBusinesses: Business[] = [];
      const allKermes: Business[] = [];

      try {
        const businessesSnap = await getDocs(collection(db, 'businesses'));
        businessesSnap.docs.forEach(doc => {
          allBusinesses.push({
            id: doc.id,
            name: doc.data().companyName || doc.data().name || t('metzger'),
            type: doc.data().businessType || 'business',
          });
        });

        const kermesSnap = await getDocs(collection(db, 'kermes_events'));
        kermesSnap.docs.forEach(doc => {
          allKermes.push({
            id: doc.id,
            name: doc.data().name || doc.data().dernekIsmi || t('kermes'),
            type: 'kermes',
          });
        });
      } catch (err) {
        console.error('Error loading entities:', err);
      }

      setBusinesses(allBusinesses);
      setKermesEvents(allKermes);
    };
    loadEntities();
  }, [t]);

  // Load admins
  useEffect(() => {
    const adminsRef = collection(db, 'admins');
    const unsubscribe = onSnapshot(adminsRef, (snapshot) => {
      const adminsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let assignedName = '-';
        if (data.businessId && data.businessId !== 'NONE') {
          const b = businesses.find(bz => bz.id === data.businessId);
          if (b) assignedName = b.name;
        } else if (data.kermesId && data.kermesId !== 'NONE') {
          const k = kermesEvents.find(ke => ke.id === data.kermesId);
          if (k) assignedName = k.name;
        } else if (data.assignments && data.assignments.length > 0) {
          // Process multiple assignments if available
          const assignmentNames = data.assignments.map((a: any) => {
             if (a.entityType === 'kermes') {
                 const k = kermesEvents.find(ke => ke.id === a.id);
                 return k ? k.name : '';
             } else {
                 const b = businesses.find(bz => bz.id === a.id);
                 return b ? b.name : '';
             }
          }).filter(Boolean);
          if (assignmentNames.length > 0) {
             assignedName = assignmentNames.join(', ');
          }
        }

        return {
          id: doc.id,
          ...data,
          name: data.displayName || data.name || data.firstName || 'Unknown',
          adminType: data.adminType || (data.roles && data.roles[0]) || 'staff',
          assignedName,
          permissions: data.permissions || [],
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      }) as Admin[];
      
      // Filter out raw users to keep focus on administrative accounts
      const filteredForAdmins = adminsData.filter(a => a.adminType !== 'customer' && a.adminType !== 'user');
      
      setAdmins(filteredForAdmins);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [businesses, kermesEvents]);

  // Save permissions
  const handleSave = async () => {
    if (!editingAdmin) return;
    try {
      await updateDoc(doc(db, 'admins', editingAdmin.id), {
        permissions: formData.permissions,
        isActive: formData.isActive,
        updatedAt: new Date(),
      });
      setShowEditModal(false);
      setEditingAdmin(null);
    } catch (error) {
      console.error('Error saving admin permissions:', error);
    }
  };

  const toggleAdminStatus = async (admin: Admin) => {
    try {
      await updateDoc(doc(db, 'admins', admin.id), {
        isActive: !admin.isActive,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error toggling admin status:', error);
    }
  };

  const openEditModal = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      permissions: admin.permissions || [],
      isActive: admin.isActive,
    });
    setShowEditModal(true);
  };

  // Filtered admins
  const filteredAdmins = admins.filter(admin => {
    if (roleFilter === 'all') return true;
    return admin.adminType === roleFilter;
  });

  const stats = {
    total: admins.length,
    super: admins.filter(a => a.adminType === 'super').length,
    business: admins.filter(a => a.adminType === 'business_admin' || a.adminType === 'lokma_admin').length,
    kermes: admins.filter(a => a.adminType === 'kermes_admin').length,
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
      {/* Centralized Management Notice */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h2 className="text-blue-800 dark:text-blue-300 font-semibold mb-1 text-lg">
            Kullanıcı ve Rol Yönetimi Taşındı
          </h2>
          <p className="text-blue-700 dark:text-blue-400 text-sm">
            Yeni admin ekleme, silme ve şifre sıfırlama işlemleri artık merkezi Kullanıcı Yönetimi (Benutzerverwaltung) sayfasından yapılmaktadır. Bu ekrandan sadece modül bazlı alt yetkileri (Sipariş, Ürün, Müşteri vb.) düzenleyebilirsiniz.
          </p>
        </div>
        <Link href="/admin/benutzerverwaltung" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors">
          Kullanıcı Yönetimi'ne Git
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('admin_yonetimi')}</h1>
        <p className="text-muted-foreground text-sm">{t('her_bolum_icin_admin_ekle_ve_yonet')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">{t('toplam_admin')}</div>
        </div>
        <div className="bg-purple-900/20 rounded-lg p-4 border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-800 dark:text-purple-400">{stats.super}</div>
          <div className="text-sm text-purple-300">👑 Super Admin</div>
        </div>
        <div className="bg-amber-900/20 rounded-lg p-4 border-l-4 border-amber-500">
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-400">{stats.business}</div>
          <div className="text-sm text-amber-300">🍽️ İşletme / Lokma</div>
        </div>
        <div className="bg-green-900/20 rounded-lg p-4 border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-800 dark:text-green-400">{stats.kermes}</div>
          <div className="text-sm text-green-300">🎪 Kermes</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {['all', 'super', 'lokma_admin', 'business_admin', 'kermes_admin', 'driver'].map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${roleFilter === role
              ? 'bg-purple-600 text-white font-medium shadow-md'
              : 'bg-card text-foreground/80 hover:bg-muted border border-border'
            }`}
          >
            {role === 'all' ? t('tumu') : (ROLE_LABELS[role] || role)}
          </button>
        ))}
      </div>

      {/* Admins Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('rol')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('atandigi_yer')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('yetkiler')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('durum')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('aksiyon')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    {t('henuz_admin_eklenmemis')}
                  </td>
                </tr>
              ) : (
                filteredAdmins.map(admin => (
                  <tr key={admin.id} className={`hover:bg-muted/30 transition-colors ${!admin.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{admin.name}</div>
                      <div className="text-sm text-muted-foreground">{admin.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${ROLE_COLORS[admin.adminType] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {ROLE_LABELS[admin.adminType] || admin.adminType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {admin.assignedName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {admin.permissions.length > 0 ? (
                           admin.permissions.map(p => (
                             <span key={p} className="text-[10px] uppercase tracking-wider bg-background border border-border px-2 py-0.5 rounded">
                               {p}
                             </span>
                           ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Yok</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleAdminStatus(admin)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${admin.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                      >
                        {admin.isActive ? t('aktif') : t('pasif')}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openEditModal(admin)}
                        className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Yetkileri Düzenle"
                      >
                        ⚙️ {t('yetkiler')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Permissions Modal */}
      {showEditModal && editingAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-xl font-bold text-foreground">
                Alt Yetkileri Düzenle
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editingAdmin.name} ({editingAdmin.email})
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">{t('yetkiler')} (Modül İzinleri)</label>
                <div className="grid grid-cols-2 gap-3">
                  {['orders', 'products', 'customers', 'reports'].map(perm => (
                    <label key={perm} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.permissions.includes(perm) ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'bg-background border-border hover:bg-muted/50'}`}>
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
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium capitalize">
                        {perm === 'orders' ? t('siparisler') : perm === 'products' ? t('urunler') : perm === 'customers' ? t('musteriler') : t('raporlar')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 border-t border-border">
                <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium">
                    Hesap Aktif (Giriş Yapabilir)
                  </span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
              <button
                onClick={() => { setShowEditModal(false); setEditingAdmin(null); }}
                className="flex-1 px-4 py-2.5 bg-background border border-border text-foreground rounded-lg hover:bg-muted font-medium transition-colors"
              >
                {t('iptal')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm transition-colors"
              >
                {t('guncelle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
