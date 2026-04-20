'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface KermesMenuItem {
 id: string;
 sku: string;
 name: string;
 name_de?: string;
 description?: string;
 description_de?: string;
 category: string;
 defaultPrice: number;
 unit: 'adet' | 'porsiyon' | 'bardak' | 'kase';
 tags?: string[];
 isActive: boolean;
 sortOrder: number;
 createdAt?: Date;
 updatedAt?: Date;
}

const UNIT_OPTIONS = [
 { value: 'adet', label: 'Adet' },
 { value: 'porsiyon', label: 'Porsiyon' },
 { value: 'bardak', label: 'Bardak' },
 { value: 'kase', label: 'Kase' },
];

export default function KermesMenusPage() {

 const t = useTranslations('AdminSettingsKermesmenus');
 const { admin, loading: adminLoading } = useAdmin();
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [menuItems, setMenuItems] = useState<KermesMenuItem[]>([]);
 const [categories, setCategories] = useState<string[]>([]);
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [showAddModal, setShowAddModal] = useState(false);
 const [editingItem, setEditingItem] = useState<KermesMenuItem | null>(null);

 // Global Menu Image State
 const [menuImageUrl, setMenuImageUrl] = useState<string | null>(null);
 const [uploadingImage, setUploadingImage] = useState(false);

 // Form state
 const [formData, setFormData] = useState<{
 sku: string;
 name: string;
 name_de: string;
 description: string;
 description_de: string;
 category: string;
 defaultPrice: number;
 unit: 'adet' | 'porsiyon' | 'bardak' | 'kase';
 tags: string;
 }>({
 sku: '',
 name: '',
 name_de: '',
 description: '',
 description_de: '',
 category: '',
 defaultPrice: 0,
 unit: 'adet',
 tags: '',
 });

 // Check admin access
 useEffect(() => {
 if (!adminLoading && admin && admin.role !== 'super_admin') {
 router.push('/admin/kermes');
 }
 }, [admin, adminLoading, router]);

 // Load menu items and categories
 const loadData = async () => {
 setLoading(true);
 try {
 // Load categories
 const categoriesDoc = await getDocs(collection(db, 'kermes_settings'));
 const catDoc = categoriesDoc.docs.find(d => d.id === 'menu_categories');
 if (catDoc) {
 setCategories(catDoc.data().categories || []);
 } else {
 // Default categories
 setCategories(['Ana Yemek', t('corba'), t('tatli'), t('i_cecek'), t('atistirmalik')]);
 }

 // Load global menu image
 const sysDoc = await getDoc(doc(db, 'settings', 'kermes_system'));
 if (sysDoc.exists()) {
   setMenuImageUrl(sysDoc.data()?.menuImageUrl || null);
 }

 // Load menu items
 const menuQuery = query(collection(db, 'kermes_menu_catalog'), orderBy('sortOrder', 'asc'));
 const menuSnapshot = await getDocs(menuQuery);
 const items = menuSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesMenuItem));
 setMenuItems(items);
 } catch (error) {
 console.error('Error loading data:', error);
 } finally {
 setLoading(false);
 }
 };

  const handleGlobalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // Client-side Resize & WebP compression
      const compressToWebP = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const MAX_SIZE = 1200;
            
            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas conversion failed'));
            }, 'image/webp', 0.85);
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });
      };

      const compressedBlob = await compressToWebP(file);
      const fileName = `kermes_system/menu_bg_${Date.now()}.webp`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, compressedBlob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' });
      const downloadUrl = await getDownloadURL(storageRef);

      await setDoc(doc(db, 'settings', 'kermes_system'), { 
        menuImageUrl: downloadUrl 
      }, { merge: true });

      setMenuImageUrl(downloadUrl);
    } catch(err) {
      console.error('Resim yükleme hatası:', err);
      alert('Resim yükleme başarısız. Lütfen tekrar deneyin.');
    } finally {
      setUploadingImage(false);
    }
  };

 useEffect(() => {
 if (!adminLoading && admin?.role === 'super_admin') {
 loadData();
 }
 }, [admin, adminLoading]);

 const handleSaveItem = async () => {
 if (!formData.name || !formData.category || !formData.sku) {
 alert(t('lutfen_zorunlu_alanlari_doldurun'));
 return;
 }

 setSaving(true);
 try {
 const itemId = editingItem?.id || `KERMES-${Date.now()}`;
 const itemData: Omit<KermesMenuItem, 'id'> = {
 sku: formData.sku,
 name: formData.name,
 name_de: formData.name_de || undefined,
 description: formData.description || undefined,
 description_de: formData.description_de || undefined,
 category: formData.category,
 defaultPrice: formData.defaultPrice,
 unit: formData.unit,
 tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : undefined,
 isActive: editingItem?.isActive ?? true,
 sortOrder: editingItem?.sortOrder ?? menuItems.length,
 updatedAt: new Date(),
 createdAt: editingItem?.createdAt || new Date(),
 };

 await setDoc(doc(db, 'kermes_menu_catalog', itemId), itemData);
 await loadData();
 setShowAddModal(false);
 setEditingItem(null);
 resetForm();
 } catch (error) {
 console.error('Error saving item:', error);
 alert(t('kaydetme_hatasi'));
 } finally {
 setSaving(false);
 }
 };

 const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

 const handleDeleteItem = (id: string) => {
 setConfirmDeleteItemId(id);
 };

 const handleDeleteItemConfirm = async () => {
 if (!confirmDeleteItemId) return;
 try {
 await deleteDoc(doc(db, 'kermes_menu_catalog', confirmDeleteItemId));
 await loadData();
 } catch (error) {
 console.error('Error deleting item:', error);
 }
 setConfirmDeleteItemId(null);
 };

 const handleToggleActive = async (item: KermesMenuItem) => {
 try {
 await setDoc(doc(db, 'kermes_menu_catalog', item.id), {
 ...item,
 isActive: !item.isActive,
 updatedAt: new Date(),
 });
 await loadData();
 } catch (error) {
 console.error('Error toggling item:', error);
 }
 };

 const resetForm = () => {
 setFormData({
 sku: '',
 name: '',
 name_de: '',
 description: '',
 description_de: '',
 category: categories[0] || '',
 defaultPrice: 0,
 unit: 'adet',
 tags: '',
 });
 };

 const openEditModal = (item: KermesMenuItem) => {
 setEditingItem(item);
 setFormData({
 sku: item.sku,
 name: item.name,
 name_de: item.name_de || '',
 description: item.description || '',
 description_de: item.description_de || '',
 category: item.category,
 defaultPrice: item.defaultPrice,
 unit: item.unit,
 tags: item.tags?.join(', ') || '',
 });
 setShowAddModal(true);
 };

 // Filter items
 const filteredItems = menuItems.filter(item => {
 const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
 const matchesSearch = !searchQuery ||
 item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 item.sku.toLowerCase().includes(searchQuery.toLowerCase());
 return matchesCategory && matchesSearch;
 });

 if (adminLoading || loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
 </div>
 );
 }

 if (!admin || admin.role !== 'super_admin') {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="text-foreground">{t('erisim_reddedildi_sadece_super_admin')}</div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background p-6">
 <div className="max-w-6xl mx-auto">
 {/* Header */}
 <Link href="/admin/kermes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
 {t('kermes_yonetimi')}
 </Link>

 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-6">
 <div>
 <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
 {t('kermes_menuleri')}
 </h1>
 <p className="text-muted-foreground text-sm mt-1">
 {t('tum_kermes_menu_ogelerini_yonetin')} {menuItems.length} {t('urun')}
 </p>
 </div>
 <button
 onClick={() => { resetForm(); setEditingItem(null); setShowAddModal(true); }}
 className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
 >
 {t('yeni_menu_ekle')}
 </button>
 </div>

 {/* Global Menu Background Image */}
  <div className="bg-card rounded-xl p-6 border border-gray-700/50 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
    <div className="flex-1">
      <h2 className="text-lg font-bold text-foreground mb-1">Meniu Kartı Arka Plan Resmi</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Bu görsel, tüm kermes detay sayfalarında "Menü & Sipariş" kartının arka planı olarak kullanılacaktır.
      </p>
      {menuImageUrl ? (
        <div className="relative w-full max-w-[320px] aspect-[21/9] rounded-lg overflow-hidden border border-gray-600">
          <img src={menuImageUrl} alt="Menü Arka Plan" className="w-full h-full object-cover" />
          <button 
           onClick={async () => {
             if (confirm('Emin misiniz?')) {
               await setDoc(doc(db, 'settings', 'kermes_system'), { menuImageUrl: null }, { merge: true });
               setMenuImageUrl(null);
             }
           }}
           className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 shadow"
          >
           ×
          </button>
        </div>
      ) : (
        <div className="h-20 max-w-[320px] border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-muted-foreground text-sm flex-col">
           <span>Görsel Yüklü Değil</span>
           <span className="text-xs opacity-70">Varsayılan siyah/kahverengi gradyan kullanılır.</span>
        </div>
      )}
    </div>
    
    <div className="shrink-0 flex items-center gap-4">
      <label className="cursor-pointer px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition flex items-center gap-2">
        <span>{uploadingImage ? 'Yükleniyor...' : (menuImageUrl ? 'Resmi Değiştir' : 'Resim Yükle')}</span>
        <input 
          type="file" 
          accept="image/*"
          className="hidden" 
          onChange={handleGlobalImageUpload}
          disabled={uploadingImage}
        />
      </label>
    </div>
  </div>

  {/* Filters */}
 <div className="flex flex-col md:flex-row gap-4 mb-6">
 <div className="flex-1 relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
 <input
 type="text"
 placeholder={t('urun_adi_veya_sku_ara')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
 />
 </div>
 <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value)}
 className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
 >
 <option value="all">{t('tum_kategoriler')}</option>
 {categories.map(cat => (
 <option key={cat} value={cat}>{cat}</option>
 ))}
 </select>
 </div>

 {/* Menu Items Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredItems.map(item => (
 <div
 key={item.id}
 className={`bg-card rounded-xl p-4 border ${item.isActive ? 'border-gray-600' : 'border-red-500/50 opacity-60'}`}
 >
 <div className="flex justify-between items-start mb-2">
 <div>
 <h3 className="font-bold text-foreground">{item.name}</h3>
 <p className="text-xs text-muted-foreground/80">{item.sku}</p>
 </div>
 <span className="text-lg font-bold text-pink-800 dark:text-pink-400">€{item.defaultPrice.toFixed(2)}</span>
 </div>
 {item.description && (
 <p className="text-muted-foreground text-sm mb-2">{item.description}</p>
 )}
 <div className="flex items-center gap-2 mb-3">
 <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
 {item.category}
 </span>
 <span className="px-2 py-1 bg-muted/50 text-foreground/90 dark:bg-gray-700 dark:text-gray-100 rounded text-xs">
 {item.unit}
 </span>
 {item.tags?.map(tag => (
 <span key={tag} className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded text-xs">
 {tag}
 </span>
 ))}
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => openEditModal(item)}
 className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition"
 >
 {t('duzenle')}
 </button>
 <button
 onClick={() => handleToggleActive(item)}
 className={`px-3 py-2 rounded-lg text-sm transition ${item.isActive ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'}`}
 >
 {item.isActive ? '✓' : '✕'}
 </button>
 <button
 onClick={() => handleDeleteItem(item.id)}
 className="px-3 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg text-sm transition"
 >
 🗑️
 </button>
 </div>
 </div>
 ))}
 </div>

 {filteredItems.length === 0 && (
 <div className="text-center py-12 text-muted-foreground">
 <p className="text-4xl mb-4">🍽️</p>
 <p>{t('henuz_menu_ogesi_yok')}</p>
 <p className="text-sm mt-2">{t('yeni_bir_menu_ogesi_ekleyerek_baslayin')}</p>
 </div>
 )}
 </div>

 {/* Add/Edit Modal */}
 {showAddModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
 <div className="bg-card rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
 <h2 className="text-xl font-bold text-foreground mb-4">
 {editingItem ? t('menu_duzenle') : t('yeni_menu_ekle')}
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">SKU *</label>
 <input
 type="text"
 value={formData.sku}
 onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 placeholder="KERMES-YEMEK-001"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">{t('kategori')}</label>
 <select
 value={formData.category}
 onChange={(e) => setFormData({ ...formData, category: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 >
 <option value="">{t('kategori_sec')}</option>
 {categories.map(cat => (
 <option key={cat} value={cat}>{cat}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Ad (TR) *</label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 placeholder="Lahmacun"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Ad (DE)</label>
 <input
 type="text"
 value={formData.name_de}
 onChange={(e) => setFormData({ ...formData, name_de: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 placeholder="Lahmacun"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-foreground mb-1">{t('aciklama_tr')}</label>
 <textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 rows={2}
 placeholder={t('urun_aciklamasi')}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">{t('varsayilan_fiyat')}</label>
 <input
 type="number"
 step="0.50"
 value={formData.defaultPrice}
 onChange={(e) => setFormData({ ...formData, defaultPrice: parseFloat(e.target.value) || 0 })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Birim</label>
 <select
 value={formData.unit}
 onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 >
 {UNIT_OPTIONS.map(opt => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-foreground mb-1">{t('etiketler_virgulle_ayirin')}</label>
 <input
 type="text"
 value={formData.tags}
 onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg"
 placeholder={t('populer_vejetaryen')}
 />
 </div>
 </div>

 <div className="flex gap-4 mt-6">
 <button
 onClick={() => { setShowAddModal(false); setEditingItem(null); }}
 className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
 >
 İptal
 </button>
 <button
 onClick={handleSaveItem}
 disabled={saving}
 className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-500 hover:to-purple-500 transition disabled:opacity-50"
 >
 {saving ? 'Kaydediliyor...' : t('kaydet')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Delete Confirmation Modal */}
 <ConfirmModal
 isOpen={!!confirmDeleteItemId}
 onClose={() => setConfirmDeleteItemId(null)}
 onConfirm={handleDeleteItemConfirm}
 title={t('menu_ogesi_sil')}
 message={t('bu_menu_ogesini_silmek_istediginize_emin')}
 itemName={menuItems.find(i => i.id === confirmDeleteItemId)?.name}
 variant="danger"
 confirmText={t('evet_sil')}
 loadingText="Siliniyor..."
 />
 </div>
 );
}
