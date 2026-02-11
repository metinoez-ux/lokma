'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { db, storage } from '@/lib/firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    deleteDoc,
    query,
    orderBy,
    where,
    Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/* ═══════════════════════════════════════════════════════════════════════════
   LOKMA AI GÖRSEL ÜRETİCİ — Imagen 4 powered image generation
   Generates professional food / business images via Google Imagen 4 API.
   Images are saved to Firebase Storage and cataloged in Firestore so
   ALL admins (Super + Business) can browse and reuse them.
═══════════════════════════════════════════════════════════════════════════ */

// ── Category definitions with smart base prompts ────────────────────────
interface Category {
    id: string;
    name: string;
    icon: string;
    basePrompt: string;
}

const categories: Category[] = [
    {
        id: 'kasap',
        name: 'Kasap',
        icon: '🥩',
        basePrompt: 'Professional food photography, Turkish butcher shop, fresh quality meat, warm atmospheric lighting, high-end culinary presentation, 8k resolution',
    },
    {
        id: 'market',
        name: 'Market',
        icon: '🛒',
        basePrompt: 'Modern supermarket, fresh organic products, vibrant colors, clean professional shelves, commercial photography, 8k resolution',
    },
    {
        id: 'pizzaci',
        name: 'Pizzacı',
        icon: '🍕',
        basePrompt: 'Gourmet Italian pizza, wood fired oven, melted cheese, fresh ingredients, rustic restaurant setting, food advertisement photography, 8k resolution',
    },
    {
        id: 'donerci',
        name: 'Dönerci',
        icon: '🥙',
        basePrompt: 'Traditional Turkish doner kebab, juicy sliced meat, authentic restaurant interior, warm golden lighting, professional food photography, 8k resolution',
    },
    {
        id: 'restoran',
        name: 'Restoran',
        icon: '🍽️',
        basePrompt: 'Upscale modern restaurant, elegant plating, soft ambient lighting, luxury dining experience, Michelin-style food photography, 8k resolution',
    },
    {
        id: 'hamburger',
        name: 'Hamburger',
        icon: '🍔',
        basePrompt: 'Gourmet craft burger, melting cheese, crispy bacon, dark moody background, high contrast food advertisement photography, 8k resolution',
    },
    {
        id: 'tatli',
        name: 'Tatlı',
        icon: '🍰',
        basePrompt: 'Elegant Turkish dessert, baklava kunefe, golden syrup, beautiful plating, pastry shop display, warm bakery lighting, 8k resolution',
    },
    {
        id: 'icecek',
        name: 'İçecek',
        icon: '🥤',
        basePrompt: 'Refreshing beverage, professional drink photography, ice droplets, colorful garnish, studio lighting, commercial advertising, 8k resolution',
    },
];

// ── Output format (aspect ratio) definitions ────────────────────────────
interface OutputFormat {
    id: string;
    name: string;
    label: string;
    aspectRatio: string;
    icon: string;
}

const outputFormats: OutputFormat[] = [
    { id: '1:1', name: 'Kare', label: '1:1', aspectRatio: '1:1', icon: '⬜' },
    { id: '3:4', name: 'Portre', label: '3:4', aspectRatio: '3:4', icon: '📱' },
    { id: '4:3', name: 'Klasik', label: '4:3', aspectRatio: '4:3', icon: '🖼️' },
    { id: '16:9', name: 'Geniş Ekran', label: '16:9', aspectRatio: '16:9', icon: '🖥️' },
    { id: '9:16', name: 'Hikaye', label: '9:16', aspectRatio: '9:16', icon: '📲' },
];

// ── Firestore collection path ───────────────────────────────────────────
const GALLERY_COLLECTION = 'generated_images';

// ── Image item interface ────────────────────────────────────────────────
interface GalleryImage {
    id: string;
    category: string;
    prompt: string;
    keyword: string;
    imageUrl: string;
    storagePath: string;
    aspectRatio?: string;
    createdAt: Timestamp;
    createdBy: string;
    createdByName: string;
}

export default function ImageGeneratorPage() {
    const { admin } = useAdmin();
    const isSuperAdmin = admin?.adminType === 'super';

    // ── State ────────────────────────────────────────────────────────────
    const [activeCategory, setActiveCategory] = useState<string>('kasap');
    const [activeFormat, setActiveFormat] = useState<string>('1:1');
    const [keyword, setKeyword] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);

    // ── Toast helper ─────────────────────────────────────────────────────
    const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Real-time gallery listener ───────────────────────────────────────
    useEffect(() => {
        if (!admin) return;

        const q = query(collection(db, GALLERY_COLLECTION), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items: GalleryImage[] = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as GalleryImage[];
                setGallery(items);
            },
            (error) => {
                console.error('Gallery listener error:', error);
                // Fallback: no ordering (avoids index requirement)
                const fallbackQ = collection(db, GALLERY_COLLECTION);
                onSnapshot(fallbackQ, (snap) => {
                    const items: GalleryImage[] = snap.docs
                        .map((d) => ({ id: d.id, ...d.data() } as GalleryImage))
                        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setGallery(items);
                });
            }
        );

        return () => unsubscribe();
    }, [admin]);

    // ── Generate image via Imagen 4 API ──────────────────────────────────
    const generateImage = async () => {
        if (!keyword.trim()) {
            showToast('Lütfen bir anahtar kelime girin (ör. "kuşbaşı", "nohut")', 'error');
            return;
        }
        if (!admin) return;

        setIsGenerating(true);

        const categoryInfo = categories.find((c) => c.id === activeCategory);
        if (!categoryInfo) {
            setIsGenerating(false);
            return;
        }

        // Build optimized prompt: base context + user keyword
        const fullPrompt = `${keyword.trim()}, ${categoryInfo.basePrompt}`;

        try {
            const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
            if (!apiKey) throw new Error('API key not configured');

            const formatInfo = outputFormats.find((f) => f.id === activeFormat);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateImages?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: fullPrompt,
                        config: {
                            numberOfImages: 1,
                            aspectRatio: formatInfo?.aspectRatio || '1:1',
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error?.message || `API error: ${response.status}`);
            }

            const result = await response.json();

            // Imagen 4 generateImages response format
            const imageData = result.generatedImages?.[0]?.image?.imageBytes;
            if (!imageData) {
                throw new Error('API yanıtında görsel bulunamadı');
            }

            // Convert base64 → blob
            const base64 = imageData;
            const byteChars = atob(base64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // Upload to Firebase Storage
            const timestamp = Date.now();
            const sanitizedKeyword = keyword
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ]/gi, '_')
                .substring(0, 30);
            const storagePath = `lokma-images/${activeCategory}/${sanitizedKeyword}_${timestamp}.png`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(storageRef);

            // Save metadata to Firestore
            await addDoc(collection(db, GALLERY_COLLECTION), {
                category: activeCategory,
                prompt: fullPrompt,
                keyword: keyword.trim(),
                imageUrl: downloadUrl,
                storagePath,
                aspectRatio: activeFormat,
                createdAt: Timestamp.now(),
                createdBy: admin.id || admin.email || 'unknown',
                createdByName: admin.displayName || admin.email || 'Admin',
            });

            showToast(`✨ "${keyword}" görseli üretildi ve kaydedildi!`);
            setKeyword('');
        } catch (error: any) {
            console.error('Generation error:', error);
            showToast(error.message || 'Görsel üretilirken hata oluştu', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Delete image ─────────────────────────────────────────────────────
    const deleteImage = async (image: GalleryImage) => {
        if (!isSuperAdmin) {
            showToast('Sadece Super Admin görselleri silebilir', 'error');
            return;
        }

        setDeletingId(image.id);
        try {
            // Delete from Storage
            if (image.storagePath) {
                try {
                    await deleteObject(ref(storage, image.storagePath));
                } catch (e) {
                    console.warn('Storage delete failed (may already be deleted):', e);
                }
            }
            // Delete from Firestore
            await deleteDoc(doc(db, GALLERY_COLLECTION, image.id));
            showToast('Görsel silindi');
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Silme hatası', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // ── Copy URL to clipboard ────────────────────────────────────────────
    const copyUrl = async (image: GalleryImage) => {
        try {
            await navigator.clipboard.writeText(image.imageUrl);
            setCopiedId(image.id);
            showToast('URL kopyalandı — başka sayfalarda kullanabilirsiniz');
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            showToast('URL kopyalanamadı', 'error');
        }
    };

    // ── Filtered gallery ─────────────────────────────────────────────────
    const filteredGallery = filterCategory === 'all' ? gallery : gallery.filter((i) => i.category === filterCategory);

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* ═══ Header ═══ */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black flex items-center gap-3">
                            <span className="bg-gradient-to-br from-violet-600 to-pink-500 p-3 rounded-2xl text-white shadow-lg shadow-violet-500/30">
                                🎨
                            </span>
                            AI Görsel Üretici
                        </h1>
                        <p className="text-gray-400 mt-2 text-sm">
                            Yapay zeka ile profesyonel yemek ve işletme görselleri üretin • Imagen 4 destekli
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 border border-emerald-700/50 rounded-full text-emerald-400 font-bold">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            {gallery.length} görsel kayıtlı
                        </span>
                    </div>
                </div>

                {/* ═══ Generator Panel (Super Admin only can generate, all can browse) ═══ */}
                {isSuperAdmin && (
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 mb-8">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="text-violet-400">✦</span> Yeni Görsel Üret
                        </h2>

                        {/* Category Pills */}
                        <div className="flex flex-wrap gap-2 mb-5">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeCategory === cat.id
                                        ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/30 scale-105'
                                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <span className="text-lg">{cat.icon}</span>
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Output Format / Aspect Ratio */}
                        <div className="flex flex-wrap items-center gap-2 mb-5">
                            <span className="text-xs text-gray-500 font-bold mr-1">📐 Format:</span>
                            {outputFormats.map((fmt) => (
                                <button
                                    key={fmt.id}
                                    onClick={() => setActiveFormat(fmt.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${activeFormat === fmt.id
                                            ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/30 scale-105'
                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <span>{fmt.icon}</span>
                                    {fmt.name}
                                    <span className="text-[10px] opacity-70">({fmt.label})</span>
                                </button>
                            ))}
                        </div>

                        {/* Prompt Input + Generate Button */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !isGenerating && generateImage()}
                                    placeholder={
                                        activeCategory === 'kasap'
                                            ? 'ör. kuşbaşı, tavuk but, kıyma, dana pirzola...'
                                            : activeCategory === 'restoran'
                                                ? 'ör. nohut yemeği, mercimek çorbası, lahmacun...'
                                                : activeCategory === 'pizzaci'
                                                    ? 'ör. margarita, karışık pizza, sucuklu pizza...'
                                                    : activeCategory === 'donerci'
                                                        ? 'ör. tavuk döner, iskender, dürüm...'
                                                        : activeCategory === 'market'
                                                            ? 'ör. sebze reyonu, meyve standı, süt ürünleri...'
                                                            : activeCategory === 'hamburger'
                                                                ? 'ör. çift katlı burger, cheese burger, tavuk burger...'
                                                                : activeCategory === 'tatli'
                                                                    ? 'ör. baklava, künefe, sütlaç, trilece...'
                                                                    : 'ör. ayran, limonata, türk kahvesi...'
                                    }
                                    className="w-full px-5 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-base"
                                    disabled={isGenerating}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs">
                                    Enter ↵
                                </span>
                            </div>

                            <button
                                onClick={generateImage}
                                disabled={isGenerating || !keyword.trim()}
                                className="group relative flex items-center justify-center gap-3 bg-gradient-to-r from-violet-600 to-pink-500 text-white px-8 py-4 rounded-2xl font-bold text-sm hover:from-violet-500 hover:to-pink-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20 min-w-[180px]"
                            >
                                {isGenerating ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Üretiliyor...
                                    </>
                                ) : (
                                    <>✨ Görsel Üret</>
                                )}
                            </button>
                        </div>

                        {/* Active prompt preview */}
                        {keyword.trim() && (
                            <div className="mt-3 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                <p className="text-xs text-gray-500">
                                    <span className="text-violet-400 font-bold">Prompt:</span>{' '}
                                    {keyword.trim()}, {categories.find((c) => c.id === activeCategory)?.basePrompt?.substring(0, 80)}...
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Gallery ═══ */}
                <div>
                    {/* Gallery Header + Filter */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-pink-400">◈</span> Görsel Kütüphanesi
                            {!isSuperAdmin && (
                                <span className="text-xs bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full border border-blue-700/50 ml-2">
                                    Görselleri işletmenizde kullanabilirsiniz
                                </span>
                            )}
                        </h2>

                        {/* Category filter pills */}
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => setFilterCategory('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCategory === 'all'
                                    ? 'bg-white text-gray-900'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                Hepsi ({gallery.length})
                            </button>
                            {categories.map((cat) => {
                                const count = gallery.filter((i) => i.category === cat.id).length;
                                if (count === 0) return null;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setFilterCategory(cat.id)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCategory === cat.id
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {cat.icon} {cat.name} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Gallery Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {/* Generating placeholder */}
                        {isGenerating && (
                            <div className="aspect-square bg-gray-900 rounded-2xl border-2 border-dashed border-violet-500/40 flex flex-col items-center justify-center p-8 text-center animate-pulse">
                                <div className="bg-gradient-to-br from-violet-600 to-pink-500 text-white p-4 rounded-2xl mb-4 shadow-xl shadow-violet-600/20">
                                    <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                </div>
                                <p className="text-sm font-bold text-white">Fırçalar hazırlanıyor...</p>
                                <p className="text-xs text-gray-500 mt-2">"{keyword}" üretiliyor</p>
                            </div>
                        )}

                        {/* Gallery items */}
                        {filteredGallery.map((image) => (
                            <div
                                key={image.id}
                                className="group relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/10"
                            >
                                {/* Image */}
                                <div
                                    className="aspect-square overflow-hidden bg-gray-800 cursor-pointer"
                                    onClick={() => setPreviewImage(image)}
                                >
                                    <img
                                        src={image.imageUrl}
                                        alt={image.keyword}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                </div>

                                {/* Overlay actions on hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        {/* Copy URL */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyUrl(image);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${copiedId === image.id
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-white/10 backdrop-blur-xl text-white hover:bg-white/20'
                                                }`}
                                        >
                                            {copiedId === image.id ? '✓ Kopyalandı' : '📋 URL Kopyala'}
                                        </button>

                                        {/* Delete (Super Admin only) */}
                                        {isSuperAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteImage(image);
                                                }}
                                                disabled={deletingId === image.id}
                                                className="flex items-center justify-center p-2.5 rounded-xl bg-white/10 backdrop-blur-xl text-white hover:bg-red-600 transition-all"
                                            >
                                                {deletingId === image.id ? (
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                ) : (
                                                    '🗑'
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Category badge */}
                                <div className="absolute top-3 left-3">
                                    <span className="px-2.5 py-1 bg-black/60 backdrop-blur-xl rounded-lg text-xs font-bold text-white border border-white/10">
                                        {categories.find((c) => c.id === image.category)?.icon}{' '}
                                        {categories.find((c) => c.id === image.category)?.name}
                                    </span>
                                </div>

                                {/* Info bar */}
                                <div className="p-4 border-t border-gray-800">
                                    <p className="text-sm font-bold text-white truncate" title={image.keyword}>
                                        {image.keyword}
                                    </p>
                                    <div className="flex items-center justify-between mt-1.5">
                                        <p className="text-xs text-gray-500">
                                            {image.createdAt?.toDate
                                                ? image.createdAt.toDate().toLocaleDateString('tr-TR', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })
                                                : '—'}
                                        </p>
                                        <p className="text-xs text-gray-600 truncate max-w-[100px]">
                                            {image.createdByName}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Empty state */}
                        {filteredGallery.length === 0 && !isGenerating && (
                            <div className="col-span-full py-24 flex flex-col items-center text-center">
                                <div className="bg-gray-900 p-8 rounded-3xl mb-6 text-gray-700 border border-gray-800">
                                    <span className="text-6xl">🖼️</span>
                                </div>
                                <h3 className="text-xl font-black text-white">Kütüphane Boş</h3>
                                <p className="text-gray-500 mt-2 text-sm max-w-xs">
                                    {isSuperAdmin
                                        ? 'Yukarıdan bir kategori seç ve anahtar kelime yazarak ilk görselini üret!'
                                        : 'Henüz üretilmiş bir görsel bulunmuyor. Super Admin görselleri ürettiğinde burada görünecek.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Full-screen Preview Modal ═══ */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-w-4xl w-full bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={previewImage.imageUrl}
                            alt={previewImage.keyword}
                            className="w-full max-h-[75vh] object-contain bg-black"
                        />
                        <div className="p-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">{previewImage.keyword}</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {categories.find((c) => c.id === previewImage.category)?.icon}{' '}
                                    {categories.find((c) => c.id === previewImage.category)?.name} •{' '}
                                    {previewImage.createdAt?.toDate?.().toLocaleDateString('tr-TR')} •{' '}
                                    {previewImage.createdByName}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => copyUrl(previewImage)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${copiedId === previewImage.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-violet-600 text-white hover:bg-violet-500'
                                        }`}
                                >
                                    {copiedId === previewImage.id ? '✓ Kopyalandı' : '📋 URL Kopyala'}
                                </button>
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm font-bold hover:bg-gray-700 transition-all"
                                >
                                    ✕ Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Toast Notification ═══ */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <div
                        className={`${toast.type === 'error'
                            ? 'bg-red-600 border-red-500/50'
                            : 'bg-gray-800 border-gray-700/50'
                            } text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border`}
                    >
                        <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
                        <span className="font-bold text-sm">{toast.text}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
