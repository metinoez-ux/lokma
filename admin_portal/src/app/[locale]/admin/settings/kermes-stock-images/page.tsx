'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface StockImage {
    id: string;
    url: string;
    title: string;
    category: string;
    tags: string[];
    createdAt: any;
    createdBy: string;
    usageCount: number;
}

const CATEGORIES = [
    { id: 'genel', label: 'Genel', emoji: '🎪' },
    { id: 'yemek', label: 'Yemek & Mutfak', emoji: '🍽️' },
    { id: 'topluluk', label: 'Topluluk', emoji: '👨‍👩‍👧‍👦' },
    { id: 'cami', label: 'Cami & İbadet', emoji: '🕌' },
    { id: 'bayram', label: 'Bayram & Kutlama', emoji: '🎉' },
    { id: 'doga', label: 'Doğa & Açık Hava', emoji: '🌳' },
    { id: 'soyut', label: 'Soyut & Modern', emoji: '🎨' },
];

export default function KermesStockImagesPage() {
    
  const t = useTranslations('AdminSettingsKermesstockimages');
const { admin, loading: adminLoading } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [images, setImages] = useState<StockImage[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [newImage, setNewImage] = useState({
        title: '',
        category: 'genel',
        tags: '',
        file: null as File | null,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load stock images
    const loadImages = async () => {
        setLoading(true);
        try {
            const imagesQuery = query(
                collection(db, 'kermes_stock_images'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(imagesQuery);
            const loadedImages = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            } as StockImage));
            setImages(loadedImages);
        } catch (error) {
            console.error('Error loading stock images:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!adminLoading && admin?.role === 'super_admin') {
            loadImages();
        }
    }, [adminLoading, admin]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewImage(prev => ({ ...prev, file }));
        }
    };

    const handleUpload = async () => {
        if (!newImage.file || !newImage.title || !admin) return;

        setUploading(true);
        try {
            // Upload to Firebase Storage
            const fileName = `kermes-stock/${Date.now()}_${newImage.file.name}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, newImage.file, {
                cacheControl: 'public, max-age=31536000',
            });
            const downloadUrl = await getDownloadURL(storageRef);

            // Save to Firestore
            await addDoc(collection(db, 'kermes_stock_images'), {
                url: downloadUrl,
                storagePath: fileName,
                title: newImage.title,
                category: newImage.category,
                tags: newImage.tags.split(',').map(t => t.trim()).filter(Boolean),
                createdAt: serverTimestamp(),
                createdBy: admin.id,
                usageCount: 0,
            });

            // Reset form
            setNewImage({ title: '', category: 'genel', tags: '', file: null });
            setShowUploadModal(false);
            loadImages();
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(t('gorsel_yuklenirken_hata_olustu'));
        } finally {
            setUploading(false);
        }
    };

    const [confirmDeleteImage, setConfirmDeleteImage] = useState<StockImage | null>(null);

    const handleDelete = (image: StockImage) => {
        setConfirmDeleteImage(image);
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDeleteImage) return;
        try {
            // Delete from Storage
            if ((confirmDeleteImage as any).storagePath) {
                const storageRef = ref(storage, (confirmDeleteImage as any).storagePath);
                await deleteObject(storageRef).catch(() => { });
            }

            // Delete from Firestore
            await deleteDoc(doc(db, 'kermes_stock_images', confirmDeleteImage.id));
            loadImages();
        } catch (error) {
            console.error('Error deleting image:', error);
            alert(t('gorsel_silinirken_hata_olustu'));
        }
        setConfirmDeleteImage(null);
    };

    const filteredImages = selectedCategory === 'all'
        ? images
        : images.filter(img => img.category === selectedCategory);

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!admin || admin.role !== 'super_admin') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">{t('bu_sayfaya_erisim_yetkiniz_yok')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <Link href="/admin/kermes" className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2">
                    {t('kermes_yonetimi')}
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            {t('stok_gorsel_yonetimi')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {t('kermes_baslik_resimleri_icin_stok_gorsel')} {images.length} {t('gorsel')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-xl font-medium hover:from-cyan-500 hover:to-teal-500 transition shadow-lg flex items-center gap-2"
                    >
                        <span>➕</span>
                        Yeni Görsel Yükle
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${selectedCategory === 'all'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        {t('tumu')}{images.length})
                    </button>
                    {CATEGORIES.map(cat => {
                        const count = images.filter(img => img.category === cat.id).length;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-2 rounded-lg font-medium transition ${selectedCategory === cat.id
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                    }`}
                            >
                                {cat.emoji} {cat.label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Images Grid */}
            <div className="max-w-7xl mx-auto">
                {filteredImages.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="text-6xl mb-4">🖼️</div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            {images.length === 0 ? t('henuz_stok_gorsel_yok') : t('bu_kategoride_gorsel_yok')}
                        </h2>
                        <p className="text-gray-400 mb-6">
                            {t('ai_ile_olusturdugunuz_baslik_gorsellerin')}
                        </p>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="inline-block bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-semibold"
                        >
                            {t('i_lk_gorseli_yukle')}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredImages.map((image) => {
                            const category = CATEGORIES.find(c => c.id === image.category);
                            return (
                                <div
                                    key={image.id}
                                    className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition group"
                                >
                                    {/* Image */}
                                    <div className="relative aspect-video bg-gray-900">
                                        <Image
                                            src={image.url}
                                            alt={image.title}
                                            fill
                                            className="object-contain"
                                            unoptimized={true}
                                        />
                                        {/* Overlay on hover */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleDelete(image)}
                                                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500"
                                            >
                                                {t('sil')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-3">
                                        <h3 className="text-white font-medium truncate">{image.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                                                {category?.emoji} {category?.label}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {image.usageCount} {t('kullanim')}
                                            </span>
                                        </div>
                                        {image.tags && image.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {image.tags.slice(0, 3).map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 rounded text-xs"
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">{t('yeni_gorsel_yukle')}</h2>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {/* File Input */}
                        <div className="mb-4">
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                {t('gorsel_dosyasi')}
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-32 border-2 border-dashed border-gray-600 rounded-xl hover:border-cyan-500 transition flex flex-col items-center justify-center gap-2"
                            >
                                {newImage.file ? (
                                    <div className="text-center">
                                        <span className="text-cyan-400 text-3xl">✅</span>
                                        <p className="text-white mt-1">{newImage.file.name}</p>
                                        <p className="text-gray-400 text-xs">
                                            {(newImage.file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-4xl">📁</span>
                                        <span className="text-gray-400">{t('gorsel_secmek_icin_tiklayin')}</span>
                                    </>
                                )}
                            </button>
                            {/* Boyut ve Format Kılavuzu */}
                            <div className="mt-3 p-3 bg-cyan-900/20 border border-cyan-700/50 rounded-lg">
                                <h4 className="text-cyan-400 text-sm font-medium mb-2">{t('gorsel_boyut_kilavuzu')}</h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-gray-400">{t('onerilen_boyut')}</span>
                                        <p className="text-white font-mono">1200 × 675 px</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">{t('en_boy_orani')}</span>
                                        <p className="text-white font-mono">16:9</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Desteklenen Formatlar:</span>
                                        <p className="text-white">JPG, PNG, WebP</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Maksimum Dosya:</span>
                                        <p className="text-white">5 MB</p>
                                    </div>
                                </div>
                                <p className="text-gray-500 text-xs mt-2">
                                    {t('kermes_kartlarinda_baslik_gorseli_olarak')}
                                </p>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="mb-4">
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                {t('baslik')}
                            </label>
                            <input
                                type="text"
                                value={newImage.title}
                                onChange={(e) => setNewImage(prev => ({ ...prev, title: e.target.value }))}
                                placeholder={t('orn_renkli_festival_afisi')}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>

                        {/* Category */}
                        <div className="mb-4">
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                {t('kategori')}
                            </label>
                            <select
                                value={newImage.category}
                                onChange={(e) => setNewImage(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.emoji} {cat.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Tags */}
                        <div className="mb-6">
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                {t('etiketler_virgulle_ayirin')}
                            </label>
                            <input
                                type="text"
                                value={newImage.tags}
                                onChange={(e) => setNewImage(prev => ({ ...prev, tags: e.target.value }))}
                                placeholder={t('orn_renkli_festival_yaz')}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading || !newImage.file || !newImage.title}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-500 hover:to-teal-500 transition"
                            >
                                {uploading ? t('yukleniyor') : t('yukle')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmDeleteImage}
                onClose={() => setConfirmDeleteImage(null)}
                onConfirm={handleDeleteConfirm}
                title={t('gorsel_sil')}
                message={t('bu_gorseli_silmek_istediginize_emin_misi')}
                itemName={confirmDeleteImage?.title}
                variant="danger"
                confirmText={t('evet_sil')}
                loadingText="Siliniyor..."
            />
        </div>
    );
}
