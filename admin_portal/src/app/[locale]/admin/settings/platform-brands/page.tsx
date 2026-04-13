'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface PlatformBrand {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  storagePath: string;
  colorHex: string;
  textColorHex: string;
  isActive: boolean;
  createdAt: any;
  createdBy: string;
}

export default function PlatformBrandsPage() {
  const { admin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<PlatformBrand[]>([]);

  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newBadge, setNewBadge] = useState({
    name: '',
    description: '',
    colorHex: '#EEEEEE',
    textColorHex: '#000000',
    isActive: true,
    file: null as File | null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [migrating, setMigrating] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openNewForm = () => {
    setIsEditMode(false);
    setEditingId(null);
    setNewBadge({ name: '', description: '', colorHex: '#EEEEEE', textColorHex: '#000000', isActive: true, file: null });
    setShowUploadModal(true);
  };

  const openEditForm = (badge: PlatformBrand) => {
    setIsEditMode(true);
    setEditingId(badge.id);
    setNewBadge({ 
      name: badge.name, 
      description: badge.description || '', 
      colorHex: badge.colorHex || '#EEEEEE', 
      textColorHex: badge.textColorHex || '#000000', 
      isActive: badge.isActive, 
      file: null 
    });
    setShowUploadModal(true);
  };

  const loadBadges = async () => {
    setLoading(true);
    try {
      const badgesQuery = query(collection(db, 'platform_brands'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(badgesQuery);
      const loadedBadges = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlatformBrand));
      setBadges(loadedBadges);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminLoading && admin?.role === 'super_admin') {
      loadBadges();
    }
  }, [adminLoading, admin]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewBadge(prev => ({ ...prev, file }));
    }
  };

  const handleSave = async () => {
    if (!newBadge.name || !admin) return;
    if (!isEditMode && !newBadge.file) return;

    setUploading(true);
    try {
      let downloadUrl = '';
      let storagePath = '';
      
      // Resim degisti ise yukle
      if (newBadge.file) {
        const fileName = `platform-brands/${Date.now()}_${newBadge.file.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, newBadge.file, { cacheControl: 'public, max-age=31536000' });
        downloadUrl = await getDownloadURL(storageRef);
        storagePath = fileName;
      }

      if (isEditMode && editingId) {
        const updateData: any = {
          name: newBadge.name,
          label: newBadge.name,
          description: newBadge.description,
          colorHex: newBadge.colorHex,
          textColorHex: newBadge.textColorHex,
        };
        if (downloadUrl) {
          updateData.iconUrl = downloadUrl;
          updateData.storagePath = storagePath;
        }
        await updateDoc(doc(db, 'platform_brands', editingId), updateData);
      } else {
        await addDoc(collection(db, 'platform_brands'), {
          name: newBadge.name,
          label: newBadge.name, // compatibility
          description: newBadge.description,
          iconUrl: downloadUrl,
          storagePath: storagePath,
          colorHex: newBadge.colorHex,
          textColorHex: newBadge.textColorHex,
          isActive: newBadge.isActive,
          createdAt: serverTimestamp(),
          createdBy: admin.id,
        });
      }

      setNewBadge({ name: '', description: '', colorHex: '#EEEEEE', textColorHex: '#000000', isActive: true, file: null });
      setShowUploadModal(false);
      loadBadges();
    } catch (error) {
      console.error('Error saving brand/badge:', error);
      alert('Kaydedilirken hata oluştu.');
    } finally {
      setUploading(false);
    }
  };

  const toggleBadgeStatus = async (badge: PlatformBrand) => {
    try {
      await updateDoc(doc(db, 'platform_brands', badge.id), {
        isActive: !badge.isActive
      });
      loadBadges();
    } catch (error) {
      console.error('Error toggling brand:', error);
    }
  };

  const [confirmDeleteBadge, setConfirmDeleteBadge] = useState<PlatformBrand | null>(null);

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteBadge) return;
    try {
      if (confirmDeleteBadge.storagePath) {
        const storageRef = ref(storage, confirmDeleteBadge.storagePath);
        await deleteObject(storageRef).catch(() => { });
      }
      await deleteDoc(doc(db, 'platform_brands', confirmDeleteBadge.id));
      loadBadges();
    } catch (error) {
      console.error('Error deleting brand:', error);
      alert('Silinirken hata oluştu.');
    }
    setConfirmDeleteBadge(null);
  };

  // One-off migration functionality
  const migrateFromKermesBadges = async () => {
    if (!confirm('Eski kermes_badges içindeki verileri platform_brands içine kopyalamak istediğinize emin misiniz?')) return;
    setMigrating(true);
    try {
      const oldQuery = query(collection(db, 'kermes_badges'));
      const snapshot = await getDocs(oldQuery);
      let count = 0;
      for (const d of snapshot.docs) {
        const existingData = d.data();
        await setDoc(doc(db, 'platform_brands', d.id), {
          ...existingData,
          migratedAt: serverTimestamp()
        });
        count++;
      }
      alert(`${count} eski rozet başarıyla platforma aktarıldı!`);
      loadBadges();
    } catch (error) {
      console.error('Migration error:', error);
      alert('Taşıma sırasında hata oluştu.');
    } finally {
      setMigrating(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!admin || admin.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Yetkiniz yok.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">🏅 LOKMA Ekosistemi Marka & Rozet Yönetimi</h1>
            <p className="text-muted-foreground text-sm mt-1">Tüm LOKMA (Kermes, Market, Yemek) platformlarında gösterilecek kurumsal sertifikaları ve sponsor logolarını yönetin.</p>
          </div>
          <div className="flex items-center gap-3">
            {badges.length === 0 && (
              <button 
                onClick={migrateFromKermesBadges}
                disabled={migrating}
                className="px-4 py-3 bg-amber-600/20 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl transition font-medium text-sm"
              >
                {migrating ? '...' : 'Eski Kermes Rozetlerini İçe Aktar'}
              </button>
            )}
            <button
              onClick={openNewForm}
              className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
            >
              <span>➕</span>
              Yeni Marka/Rozet Yükle
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {badges.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center border border-border">
            <div className="text-6xl mb-4">🌍</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Henüz marka veya sertifika eklenmemiş</h2>
            <button onClick={openNewForm} className="mt-4 px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg">İlk Markayı Ekle</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {badges.map((badge) => (
              <div key={badge.id} className="bg-card rounded-xl overflow-hidden border border-border hover:border-pink-500 transition group p-4 flex flex-col relative">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 bg-background rounded-lg border border-border overflow-hidden shrink-0 p-1 flex items-center justify-center" style={{ backgroundColor: badge.colorHex || '#EEEEEE' }}>
                    <Image src={badge.iconUrl} alt={badge.name} width={50} height={50} className="object-contain max-h-full max-w-full" unoptimized />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-foreground font-bold">{badge.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${badge.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                      {badge.isActive ? 'Aktif' : 'Gizli'}
                    </span>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-6 flex-1">{badge.description || 'Açıklama yok'}</p>
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => toggleBadgeStatus(badge)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${badge.isActive ? 'bg-gray-700 text-white' : 'bg-green-600 text-white'}`}>
                    {badge.isActive ? 'Gizle' : 'Göster'}
                  </button>
                  <button onClick={() => openEditForm(badge)} className="px-3 py-2 bg-blue-600/20 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-medium flex items-center gap-1">
                    ✏️ Edit
                  </button>
                  <button onClick={() => setConfirmDeleteBadge(badge)} className="px-3 py-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg text-sm">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload/Edit Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">{isEditMode ? 'Markayı Düzenle' : 'Yeni Sistem Markası / Sertifika'}</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">×</button>
            </div>

            <div className="mb-4">
              <label className="block text-foreground text-sm font-medium mb-2">Marka İkonu (Şeffaf yüksek çözünürlüklü PNG önerilir)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`w-full h-32 border-2 border-dashed border-gray-600 rounded-xl hover:border-pink-500 transition flex flex-col items-center justify-center gap-2 ${isEditMode && !newBadge.file ? 'bg-gray-800' : ''}`}>
                {newBadge.file ? (
                  <div className="text-center">
                    <span className="text-pink-400 text-3xl">✅</span>
                    <p className="text-foreground mt-1">{newBadge.file.name}</p>
                  </div>
                ) : isEditMode ? (
                  <>
                    <span className="text-3xl">🖼️</span>
                    <span className="text-muted-foreground text-sm">Mevcut görseli değiştirmek için tıklayın</span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl">🌍</span>
                    <span className="text-muted-foreground">İkon Seçmek İçin Tıklayın</span>
                  </>
                )}
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-foreground text-sm font-medium mb-2">Marka / Rozet Adı</label>
              <input type="text" value={newBadge.name} onChange={(e) => setNewBadge(prev => ({ ...prev, name: e.target.value }))} placeholder="örn: Tuna Helal Kesim %100" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
            </div>
            
            <div className="mb-4">
              <label className="block text-foreground text-sm font-medium mb-1">Açıklama / Alt Bilgi (Bottom Sheet / Popup Bilgisi)</label>
              <p className="text-muted-foreground text-[11px] mb-2">Uygulamada karta tıklandığında gösterilecek ek detay.</p>
              <textarea value={newBadge.description} onChange={(e) => setNewBadge(prev => ({ ...prev, description: e.target.value }))} placeholder="Bu markanın detayları..." className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none" rows={3}></textarea>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-foreground text-sm font-medium mb-2">Zemin Rengi (#HEX)</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newBadge.colorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, colorHex: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                  <input type="text" value={newBadge.colorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, colorHex: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-foreground text-sm font-medium mb-2">Yazı Rengi</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newBadge.textColorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, textColorHex: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                  <input type="text" value={newBadge.textColorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, textColorHex: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono uppercase" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowUploadModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg">İptal</button>
              <button onClick={handleSave} disabled={uploading || !newBadge.name || (!isEditMode && !newBadge.file)} className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg disabled:opacity-50 font-medium shadow">
                {uploading ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Sisteme Ekle')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteBadge}
        onClose={() => setConfirmDeleteBadge(null)}
        onConfirm={handleDeleteConfirm}
        title="Markayı Sil"
        message="Bu markayı sistemden silmek istediğinize emin misiniz? Seçilen işletme/kermeslerde eksik gösterime sebep olabilir."
        itemName={confirmDeleteBadge?.name}
        variant="danger"
        confirmText="Evet, Kalıcı Olarak Sil"
        loadingText="Siliniyor..."
      />
    </div>
  );
}
