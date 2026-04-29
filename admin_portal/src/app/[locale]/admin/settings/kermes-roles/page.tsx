'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';

export const KERMES_PERMISSIONS = [
  { id: 'view_dashboard', label: 'Dashboard Görüntüleme', category: 'Genel' },
  { id: 'manage_orders', label: 'Sipariş Yönetimi (İptal, Onay, İade)', category: 'Siparişler' },
  { id: 'take_orders', label: 'Sipariş Alma (Kasa/POS)', category: 'Siparişler' },
  { id: 'discount_management', label: 'İndirim & İkram Uygulama', category: 'Siparişler' },
  { id: 'kds_screen', label: 'Ocakbaşı Ekranı (KDS) Erişimi', category: 'Siparişler' },
  { id: 'delivery_screen', label: 'Kurye / Teslimat Ekranı Erişimi', category: 'Siparişler' },
  { id: 'manage_products', label: 'Menü ve Ürün Yönetimi', category: 'Katalog' },
  { id: 'manage_staff', label: 'Personel Yönetimi', category: 'Yönetim' },
  { id: 'manage_tables', label: 'Masa ve Bölüm Oluşturma', category: 'Yönetim' },
  { id: 'manage_prepzones', label: 'Ocakbaşı İstasyonu Yönetimi', category: 'Yönetim' },
  { id: 'manage_settings', label: 'Kermes Genel Ayarları', category: 'Yönetim' },
  { id: 'view_reports', label: 'Finans ve Raporları Görme', category: 'Finans' },
  { id: 'refund_orders', label: 'Sipariş İptal ve İade Yetkisi', category: 'Finans' },
  { id: 'send_notifications', label: 'Bildirim (PUSH) Gönderme', category: 'İletişim' },
];

export interface GlobalSystemRole {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  isCore?: boolean;
  permissions?: string[];
}

export const DEFAULT_GLOBAL_SYSTEM_ROLES: GlobalSystemRole[] = [
  { id: 'role_staff', name: 'Genel Personel', icon: '👥', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-300', description: 'Temel giriş yetkisi ve kermes listesini görme', isCore: true, permissions: ['view_dashboard', 'take_orders'] },
  { id: 'role_driver', name: 'Sürücü / Kurye', icon: '🚗', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300', description: 'Siparişleri teslim etme yetkisi', isCore: true, permissions: ['view_dashboard', 'delivery_screen'] },
  { id: 'role_waiter', name: 'Garson', icon: '🍽️', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', description: 'Masalara servis yapma yetkisi', isCore: true, permissions: ['view_dashboard', 'take_orders'] },
  { id: 'role_admin', name: 'Kermes Admin', icon: '👑', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300', description: 'Kermesi yönetme tam yetkisi', isCore: true, permissions: KERMES_PERMISSIONS.map(p => p.id) },
  { id: 'role_temizlik_system', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', description: 'Etkinlik alanı temizliği ve düzeni', permissions: ['view_dashboard'] },
  { id: 'role_park_system', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', description: 'Araç park yönlendirme ve düzeni', permissions: ['view_dashboard'] },
  { id: 'role_cocuk_system', name: 'Çocuk Görevlisi', icon: '👶', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300', description: 'Çocuk oyun alanı gözetimi', permissions: ['view_dashboard'] },
  { id: 'role_vip_system', name: 'Özel Misafir (VIP)', icon: '⭐', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', description: 'Protokol ve özel misafir ağırlama', permissions: [] },
  { id: 'role_tedarik_system', name: 'Malzeme Tedarikçisi', icon: '📦', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', description: 'Malzeme ve lojistik tedariği', permissions: ['view_dashboard'] }
];

export default function KermesGlobalRolesPage() {
  const { admin, loading: adminLoading } = useAdmin();
  const router = useRouter();
  
  const [roles, setRoles] = useState<GlobalSystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<GlobalSystemRole | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [toasts, setToasts] = useState<{id: number, message: string, type: 'success'|'error'}[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    if (!adminLoading && admin && admin.role !== 'super_admin') {
      router.push('/admin/kermes');
    }
  }, [admin, adminLoading, router]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'settings', 'kermes_roles'));
      if (snap.exists() && snap.data().systemRoles) {
        setRoles(snap.data().systemRoles);
      } else {
        setRoles(DEFAULT_GLOBAL_SYSTEM_ROLES);
        await setDoc(doc(db, 'settings', 'kermes_roles'), { systemRoles: DEFAULT_GLOBAL_SYSTEM_ROLES });
      }
    } catch (error) {
      console.error(error);
      showToast('Roller yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminLoading && admin?.role === 'super_admin') {
      loadRoles();
    }
  }, [admin, adminLoading]);

  const saveRoles = async (newRoles: GlobalSystemRole[]) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'kermes_roles'), { systemRoles: newRoles }, { merge: true });
      setRoles(newRoles);
      return true;
    } catch (e) {
      console.error(e);
      showToast('Hata oluştu', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!editingRole || !editingRole.name.trim()) return showToast('İsim zorunludur', 'error');

    let currentRoles = roles.length > 0 ? roles : DEFAULT_GLOBAL_SYSTEM_ROLES;
    const exists = currentRoles.find(r => r.id === editingRole.id);
    let newRoles;
    
    if (exists) {
      newRoles = currentRoles.map(r => r.id === editingRole.id ? editingRole : r);
    } else {
      newRoles = [...currentRoles, editingRole];
    }

    if (await saveRoles(newRoles)) {
      showToast('Görev başarıyla güncellendi', 'success');
      setShowAddModal(false);
      setEditingRole(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const newRoles = roles.filter(r => r.id !== confirmDelete.id);
    if (await saveRoles(newRoles)) {
      showToast('Görev silindi', 'success');
    }
    setConfirmDelete(null);
  };

  const togglePermission = (permId: string) => {
    if (!editingRole) return;
    const currentPerms = editingRole.permissions || [];
    if (currentPerms.includes(permId)) {
      setEditingRole({ ...editingRole, permissions: currentPerms.filter(p => p !== permId) });
    } else {
      setEditingRole({ ...editingRole, permissions: [...currentPerms, permId] });
    }
  };

  if (adminLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
    </div>;
  }

  // Grup izinleri
  const permCategories = Array.from(new Set(KERMES_PERMISSIONS.map(p => p.category)));

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Toasts */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`px-6 py-4 rounded-xl shadow-2xl text-white font-medium text-center animate-fade-in pointer-events-auto ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        <Link href="/admin/kermes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2 text-sm font-medium">
          ← Kermes Yönetimi
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sistem Görevleri & Roller</h1>
            <p className="text-muted-foreground text-sm mt-1">LOKMA Platformundaki tüm Kermeslerde kullanılabilecek varsayılan yetkileri ve rolleri yönetin.</p>
          </div>
          <button
            onClick={() => {
              setEditingRole({
                id: `role_custom_${Date.now()}`,
                name: '',
                icon: '📋',
                color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
                description: '',
                permissions: []
              });
              setShowAddModal(true);
            }}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition shadow-lg flex items-center gap-2"
          >
            <span>➕</span> Yeni Görev Ekle
          </button>
        </div>

        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="bg-card rounded-xl p-4 border border-border flex items-start gap-4 hover:border-blue-500/30 transition-colors">
              <div className="w-12 h-12 rounded-xl border border-dashed border-border bg-background flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                {role.icon.startsWith('http') ? (
                  <img src={role.icon} alt="icon" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{role.icon}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">{role.name}</h3>
                  {role.isCore && <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">CORE</span>}
                </div>
                <p className="text-muted-foreground text-sm mt-1">{role.description || 'Açıklama yok'}</p>
                
                {/* İzinleri göster */}
                {role.permissions && role.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {role.permissions.map(permId => {
                      const perm = KERMES_PERMISSIONS.find(p => p.id === permId);
                      if (!perm) return null;
                      return (
                        <span key={permId} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 rounded text-[10px] font-medium border border-indigo-200 dark:border-indigo-800/30">
                          {perm.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                {(!role.permissions || role.permissions.length === 0) && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded text-[10px] font-medium border border-amber-200 dark:border-amber-800/30">
                    <span>⚠️</span> Hiçbir yetki atanmamış
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { 
                    setEditingRole({
                      ...role,
                      permissions: role.permissions || []
                    }); 
                    setShowAddModal(true); 
                  }}
                  className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                {!role.isCore && (
                  <button
                    onClick={() => { setConfirmDelete({ id: role.id, name: role.name }); }}
                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && editingRole && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border p-6 my-8">
            <h2 className="text-xl font-bold text-foreground mb-4">
              {editingRole.id.includes('custom') ? 'Yeni Görev Oluştur' : 'Görevi Düzenle'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sol Sütun: Temel Bilgiler */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b border-border pb-2 text-foreground">Temel Bilgiler</h3>
                
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Görev Adı</label>
                  <input 
                    type="text" 
                    value={editingRole.name}
                    onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Açıklama</label>
                  <input 
                    type="text" 
                    value={editingRole.description}
                    onChange={e => setEditingRole({...editingRole, description: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">İkon veya Resim</label>
                  <div className="flex items-center gap-4 border border-border p-3 rounded-lg bg-muted/10">
                    <div className="w-12 h-12 rounded-xl border border-dashed border-border bg-background flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                      {editingRole.icon.startsWith('http') ? (
                        <img src={editingRole.icon} alt="icon" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{editingRole.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input 
                        type="text" 
                        value={editingRole.icon.startsWith('http') ? '' : editingRole.icon}
                        onChange={e => setEditingRole({...editingRole, icon: e.target.value})}
                        className="w-full bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                        placeholder="Emoji yazın (Örn: 🧹)"
                        disabled={editingRole.icon.startsWith('http')}
                      />
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          id="role-icon-upload"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setIsUploading(true);
                              const fileExt = file.name.split('.').pop();
                              const fileName = `role_${Date.now()}.${fileExt}`;
                              const storageRef = ref(storage, `kermes_roles/${fileName}`);
                              await uploadBytes(storageRef, file);
                              const url = await getDownloadURL(storageRef);
                              setEditingRole({...editingRole, icon: url});
                            } catch (error) {
                              console.error(error);
                              showToast('Yükleme hatası', 'error');
                            } finally {
                              setIsUploading(false);
                            }
                          }}
                        />
                        <label 
                          htmlFor="role-icon-upload"
                          className="flex w-full items-center justify-center gap-2 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 border border-blue-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-100 transition whitespace-nowrap"
                        >
                          {isUploading ? 'Yükleniyor...' : 'Yeni Resim Yükle'}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Renk Sınıfı (Tailwind)</label>
                  <input 
                    type="text" 
                    value={editingRole.color}
                    onChange={e => setEditingRole({...editingRole, color: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Sağ Sütun: Yetkiler (RBAC) */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b border-border pb-2 text-foreground flex justify-between items-center">
                  <span>RBAC Yetkileri</span>
                  <span className="text-[10px] font-normal bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                    {editingRole.permissions?.length || 0} seçili
                  </span>
                </h3>
                
                <div className="bg-muted/30 border border-border rounded-xl p-3 max-h-[350px] overflow-y-auto space-y-4">
                  {permCategories.map(category => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">{category}</h4>
                      <div className="space-y-1">
                        {KERMES_PERMISSIONS.filter(p => p.category === category).map(perm => {
                          const isChecked = editingRole.permissions?.includes(perm.id);
                          return (
                            <label key={perm.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition border ${isChecked ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/30' : 'border-transparent hover:bg-muted'}`}>
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(perm.id)}
                                  className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500 bg-background"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium ${isChecked ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>
                                  {perm.label}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
              <button 
                onClick={() => { setShowAddModal(false); setEditingRole(null); }}
                className="flex-1 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition"
              >
                İptal
              </button>
              <button 
                onClick={handleSaveRole}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Görevi Sil"
        message="Bu sistemi görevini tamamen silmek istediğinize emin misiniz? Atanmış kişiler etkilenebilir."
        itemName={confirmDelete?.name}
        variant="danger"
        confirmText="Evet, Sil"
      />
    </div>
  );
}
