'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface Business {
  id: string;
  name: string;
  city?: string;
  plz?: string;
}

interface Category {
  id: string;
  name: string;
  _originalName?: any;
  icon: string;
  order: number;
  isActive: boolean;
  productCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const DEFAULT_ICONS = ['🥩', '🐑', '🐄', '🐔', '🥓', '📦', '🍖', '🌿', '🧈', '🥚', '🍔', '🍕'];

function CategoriesPageContent() {
  const { admin, loading: adminLoading } = useAdmin();
  const searchParams = useSearchParams();
  const urlBusinessId = searchParams.get('businessId');

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  // Business selector state for Super Admin
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(urlBusinessId);
  const [businessSearch, setBusinessSearch] = useState('');
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    isActive: true,
  });

  // Determine the active business ID
  const isSuperAdmin = admin?.adminType === 'super';
  const butcherId = isSuperAdmin ? selectedBusinessId : admin?.butcherId;

  // Load businesses for Super Admin
  useEffect(() => {
    if (!isSuperAdmin || adminLoading) return;

    const loadBusinesses = async () => {
      setLoadingBusinesses(true);
      try {
        const snapshot = await getDocs(collection(db, 'businesses'));
        const biz = snapshot.docs.map(doc => {
          const d = doc.data();
          // Defansif olarak şirket ismini çek (LOKMA DB'de genellikle companyName kullanılır)
          const bizName = d.companyName || d.brand || d.businessName || d.name || 'İsimsiz';
          // Şehir bilgisini güvenli ayıkla
          const cityStr = typeof d.city === 'string' ? d.city : (d.city?.name || d.address?.city || '');
          const plzStr = d.plz || d.zipCode || d.address?.zipCode || d.address?.plz || '';
          
          return {
            id: doc.id,
            name: typeof bizName === 'string' ? bizName : String(bizName),
            city: typeof cityStr === 'string' ? cityStr : '',
            plz: typeof plzStr === 'string' ? plzStr : '',
          };
        }) as Business[];
        setBusinesses(biz.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error('Error loading businesses:', error);
      }
      setLoadingBusinesses(false);
    };

    loadBusinesses();
  }, [isSuperAdmin, adminLoading]);

  // Load categories
  useEffect(() => {
    if (adminLoading) return;
    
    if (!butcherId) {
      setLoading(false);
      return;
    }

    const loadCategories = async () => {
      setLoading(true);
      try {
        const categoriesRef = collection(db, `businesses/${butcherId}/categories`);
        const q = query(categoriesRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        const cats = snapshot.docs.map(doc => {
          const data = doc.data();
          const nObj = data.name;
          let displayStr = '';
          if (nObj) {
            if (typeof nObj === 'string') displayStr = nObj;
            else if (typeof nObj === 'object') displayStr = nObj.tr || nObj.de || nObj.en || Object.values(nObj)[0] || '';
            else displayStr = String(nObj);
          }

          // Güvenli string çevrimi - tüm render edilecek proplar için!
          return {
            id: doc.id,
            ...data,
            name: (typeof displayStr === 'string' ? displayStr : String(displayStr)) || 'İsimsiz',
            icon: typeof data.icon === 'string' ? data.icon : '📦',
            _originalName: nObj,
          };
        }) as Category[];

        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [butcherId, adminLoading]);

  const handleSave = async () => {
    if (!butcherId || !formData.name.trim()) return;

    setSaving(true);
    try {
      const categoriesRef = collection(db, `businesses/${butcherId}/categories`);
      
      const newNameObj = editingCategory?._originalName && typeof editingCategory._originalName === 'object'
        ? { ...editingCategory._originalName, tr: formData.name, de: formData.name }
        : { tr: formData.name, de: formData.name, en: formData.name };

      if (editingCategory) {
        // Update existing
        await updateDoc(doc(db, `businesses/${butcherId}/categories`, editingCategory.id), {
          name: newNameObj,
          icon: formData.icon,
          isActive: formData.isActive,
          updatedAt: new Date(),
        });
      } else {
        // Add new
        await addDoc(categoriesRef, {
          name: newNameObj,
          icon: formData.icon,
          isActive: formData.isActive,
          order: categories.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Reload categories
      const q = query(categoriesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const cats = snapshot.docs.map(doc => {
        const data = doc.data();
        const nObj = data.name;
        let displayStr = '';
        if (nObj) {
          if (typeof nObj === 'string') displayStr = nObj;
          else if (typeof nObj === 'object') displayStr = nObj.tr || nObj.de || nObj.en || Object.values(nObj)[0] || '';
          else displayStr = String(nObj);
        }
        return { 
          id: doc.id, 
          ...data, 
          name: (typeof displayStr === 'string' ? displayStr : String(displayStr)) || 'İsimsiz', 
          icon: typeof data.icon === 'string' ? data.icon : '📦',
          _originalName: nObj 
        };
      }) as Category[];
      setCategories(cats);

      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: '📦', isActive: true });
    } catch (error) {
      console.error('Error saving category:', error);
    }
    setSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!butcherId || !confirmDelete) return;

    try {
      await deleteDoc(doc(db, `businesses/${butcherId}/categories`, confirmDelete.id));
      setCategories(categories.filter(c => c.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon,
      isActive: category.isActive,
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', icon: '📦', isActive: true });
    setShowModal(true);
  };

  // Move category up or down
  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    if (!butcherId) return;

    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newCategories.length) return;

    // Swap
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];

    // Update order in Firestore
    try {
      for (let i = 0; i < newCategories.length; i++) {
        const catRef = doc(db, `businesses/${butcherId}/categories`, newCategories[i].id);
        await updateDoc(catRef, { order: i });
      }
      setCategories(newCategories.map((c, i) => ({ ...c, order: i })));
    } catch (error) {
      console.error('Error reordering:', error);
    }
  };

  // Check if admin has access
  if (!adminLoading && !butcherId && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card rounded-xl p-8 text-center max-w-md border border-border shadow-2xl">
          <span className="text-5xl block mb-4">🔒</span>
          <h2 className="text-xl font-bold text-foreground mt-4">Erişim Reddedildi</h2>
          <p className="text-muted-foreground mt-2">
            Bu sayfayı görüntüleme yetkiniz yok.
          </p>
          <Link href="/admin/dashboard" className="mt-6 inline-block px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition">
            Dashboard&apos;a Dön
          </Link>
        </div>
      </div>
    );
  }

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  // Super Admin view to select a business before showing categories
  if (isSuperAdmin && !butcherId) {
    const filteredBusinesses = businesses.filter(b =>
      b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
      (b.city && b.city.toLowerCase().includes(businessSearch.toLowerCase())) ||
      (b.plz && b.plz.includes(businessSearch))
    );

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-gradient-to-r from-violet-800 to-violet-700 text-white shadow-lg p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold flex items-center gap-2"><span className="text-3xl">🗂️</span> Kategori Yönetimi</h1>
            <p className="text-violet-200 mt-1">Kategorileri düzenlemek istediğiniz işletmeyi seçin.</p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 max-w-xl">
            <input
              type="text"
              placeholder="İşletme Ara..."
              value={businessSearch}
              onChange={(e) => setBusinessSearch(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
            />
          </div>

          {loadingBusinesses ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBusinesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBusinessId(b.id)}
                  className="bg-card p-5 rounded-xl border border-border text-left hover:border-violet-500 shadow-sm transition-all hover:shadow-md group"
                >
                  <h3 className="font-bold text-foreground text-lg group-hover:text-violet-400 transition-colors line-clamp-1">{b.name}</h3>
                  <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <span className="text-xs mr-2 opacity-70">📍</span> 
                    {b.city ? `${b.plz || ''} ${b.city}` : 'Konum bilgisi yok'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Active Category Management View
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-800 to-violet-700 text-white shadow-lg border-b border-violet-900">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                <span className="text-3xl block leading-none">🗂️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide">Kategori Yönetimi</h1>
                <div className="flex items-center gap-2 text-violet-200 text-sm mt-1">
                  <span>{categories.length} adet kategori</span>
                  {isSuperAdmin && (
                    <>
                      <span className="px-1.5 opacity-50">•</span>
                      <button 
                        onClick={() => setSelectedBusinessId(null)}
                        className="hover:text-white underline decoration-violet-400/50 underline-offset-2 transition-colors"
                      >
                        İşletme Değiştir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={openAdd}
              className="px-5 py-2.5 bg-white text-violet-900 font-bold rounded-lg hover:bg-violet-50 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <span>+</span> Yeni Kategori
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {categories.length === 0 ? (
          <div className="bg-card rounded-2xl p-16 text-center border border-border shadow-sm max-w-2xl mx-auto">
            <div className="bg-muted w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🗂️</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Henüz kategori yok</h3>
            <p className="text-muted-foreground/80 mb-8 max-w-md mx-auto">Müşterilerinizin ürünleri kolayca bulabilmesi için menünüzü düzenlemeye ilk kategorinizi ekleyerek başlayın.</p>
            <button
              onClick={openAdd}
              className="px-8 py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 transition shadow-lg active:scale-95"
            >
              + İlk Kategoriyi Ekle
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className={`bg-card rounded-xl p-4 border shadow-sm transition-all hover:border-violet-500/30 ${
                  category.isActive ? 'border-border' : 'border-red-900/40 bg-card/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Move Up/Down Controls */}
                  <div className="flex flex-col items-center gap-1 bg-muted/30 p-1 rounded-lg">
                    <button
                      onClick={() => moveCategory(index, 'up')}
                      disabled={index === 0}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Yukarı Taşı"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveCategory(index, 'down')}
                      disabled={index === categories.length - 1}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Aşağı Taşı"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Icon */}
                  <div className="w-14 h-14 bg-muted/50 rounded-xl flex items-center justify-center text-3xl">
                    {category.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`font-bold text-lg truncate ${category.isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {category.name}
                      </h3>
                      {!category.isActive && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-900/30 text-red-500 rounded-full border border-red-500/20 shrink-0">
                          PASİF
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <p className="text-muted-foreground/80 flex items-center gap-1.5">
                        <span className="opacity-50">📱</span> Opsiyonel
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(category)}
                      className="w-10 h-10 flex items-center justify-center bg-muted/50 hover:bg-violet-600/20 text-muted-foreground hover:text-violet-400 rounded-lg transition"
                      title="Düzenle"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDelete(category)}
                      className="w-10 h-10 flex items-center justify-center bg-muted/50 hover:bg-red-600/20 text-muted-foreground hover:text-red-400 rounded-lg transition"
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border scale-in-95 duration-200">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              {editingCategory ? '✏️ Kategoriyi Düzenle' : '✨ Yeni Kategori'}
            </h2>

            {/* Icon Selection */}
            <div className="mb-5">
              <label className="text-sm font-medium text-foreground/80 mb-3 block">Kategori İkonu</label>
              <div className="grid grid-cols-6 gap-2">
                {DEFAULT_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all ${
                      formData.icon === icon
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20 ring-2 ring-violet-500 ring-offset-2 ring-offset-card scale-110 z-10'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-5">
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Kategori Adı</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn. Soğuk İçecekler..."
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all"
                autoFocus
              />
            </div>

            {/* Active Toggle */}
            <div className="mb-8 p-4 bg-muted/50 rounded-xl border border-border">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="font-medium text-foreground">Uygulamada Görünür</div>
                  <div className="text-sm text-muted-foreground mt-0.5">Bu kategoriyi ve içindeki ürünleri müşterilere göster The category and its contents.</div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                </div>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2 border-t border-border mt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 bg-transparent text-muted-foreground font-medium rounded-xl hover:bg-muted transition"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="flex-1 px-4 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-900/20 active:scale-95 transition disabled:opacity-50 disabled:active:scale-100"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Kategoriyi Sil"
        message={`"${confirmDelete?.name}" kategorisini ve içindeki ürün uyarlamalarını kaldırmak istediğinize emin misiniz? (Ürünler ana menüden silinmez)`}
        itemName={confirmDelete?.name}
        variant="danger"
        confirmText="Evet, Kalıcı Olarak Sil"
        loadingText="Siliniyor..."
      />
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function CategoriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
        <div className="text-muted-foreground font-medium">Yükleniyor...</div>
      </div>
    }>
      <CategoriesPageContent />
    </Suspense>
  );
}
