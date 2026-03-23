'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { useTranslations, useLocale } from 'next-intl';

/* ═══════════════════════════════════════════════════════════════════════════
   LOKMA AI BILDGENERATOR — Imagen 4 powered image generation
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

/* categories and outputFormats are now defined inside the component for i18n */

interface OutputFormat {
    id: string;
    name: string;
    label: string;
    aspectRatio: string;
    icon: string;
}

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

    const t = useTranslations('AdminImagegenerator');
    const locale = useLocale();
    const { admin } = useAdmin();
    const isSuperAdmin = admin?.adminType === 'super';

    const categories: Category[] = [
        { id: 'kasap', name: t('metzger'), icon: '', basePrompt: 'Professional food photography, Turkish butcher shop, fresh quality meat, warm atmospheric lighting, high-end culinary presentation, 8k resolution' },
        { id: 'market', name: t('market'), icon: '', basePrompt: 'Modern supermarket, fresh organic products, vibrant colors, clean professional shelves, commercial photography, 8k resolution' },
        { id: 'pizzaci', name: t('pizzeria'), icon: '', basePrompt: 'Gourmet Italian pizza, wood fired oven, melted cheese, fresh ingredients, rustic restaurant setting, food advertisement photography, 8k resolution' },
        { id: 'donerci', name: t('doner'), icon: '', basePrompt: 'Traditional Turkish doner kebab, juicy sliced meat, authentic restaurant interior, warm golden lighting, professional food photography, 8k resolution' },
        { id: 'restoran', name: t('restoran'), icon: '', basePrompt: 'Upscale modern restaurant, elegant plating, soft ambient lighting, luxury dining experience, Michelin-style food photography, 8k resolution' },
        { id: 'hamburger', name: t('hamburger'), icon: '', basePrompt: 'Gourmet craft burger, melting cheese, crispy bacon, dark moody background, high contrast food advertisement photography, 8k resolution' },
        { id: 'tatli', name: t('dessert'), icon: '', basePrompt: 'Elegant Turkish dessert, baklava kunefe, golden syrup, beautiful plating, pastry shop display, warm bakery lighting, 8k resolution' },
        { id: 'icecek', name: t('getraenke'), icon: '', basePrompt: 'Refreshing beverage, professional drink photography, ice droplets, colorful garnish, studio lighting, commercial advertising, 8k resolution' },
    ];

    const outputFormats: OutputFormat[] = [
        { id: '1:1', name: t('quadrat'), label: '1:1', aspectRatio: '1:1', icon: '' },
        { id: '3:4', name: t('portraet'), label: '3:4', aspectRatio: '3:4', icon: '' },
        { id: '4:3', name: t('klassisch'), label: '4:3', aspectRatio: '4:3', icon: '' },
        { id: '16:9', name: t('breitbild'), label: '16:9', aspectRatio: '16:9', icon: '' },
        { id: '9:16', name: t('story'), label: '9:16', aspectRatio: '9:16', icon: '' },
    ];

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
    const [backgroundPrompt, setBackgroundPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            showToast(t('lutfen_bir_anahtar_kelime_girin_or_kusba'), 'error');
            return;
        }
        if (!admin) return;

        setIsGenerating(true);

        const categoryInfo = categories.find((c) => c.id === activeCategory);
        if (!categoryInfo) {
            setIsGenerating(false);
            return;
        }

        // Build optimized prompt: keyword + base context + background + negative
        let fullPrompt = `${keyword.trim()}, ${categoryInfo.basePrompt}`;
        if (backgroundPrompt.trim()) {
            fullPrompt += `, ${backgroundPrompt.trim()}`;
        }
        if (negativePrompt.trim()) {
            fullPrompt += `. Absolutely avoid and do NOT include: ${negativePrompt.trim()}`;
        }

        try {
            // Use secure server-side proxy (API key stored encrypted in Firestore vault)
            const { auth: firebaseAuth } = await import('@/lib/firebase');
            const token = await firebaseAuth.currentUser?.getIdToken();
            if (!token) throw new Error(t('nicht_authentifiziert'));

            const formatInfo = outputFormats.find((f) => f.id === activeFormat);

            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    aspectRatio: formatInfo?.aspectRatio || '1:1',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error || `API error: ${response.status}`);
            }

            const result = await response.json();

            const imageData = result.imageBase64;
            if (!imageData) {
                throw new Error(t('api_yanitinda_gorsel_bulunamadi'));
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

            showToast(`✨ ${t('bild_erstellt', { keyword })}`);
            setKeyword('');
        } catch (error: any) {
            console.error('Generation error:', error);
            showToast(error.message || t('gorsel_uretilirken_hata_olustu'), 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Delete image ─────────────────────────────────────────────────────
    const deleteImage = async (image: GalleryImage) => {
        if (!isSuperAdmin) {
            showToast(t('sadece_super_admin_gorselleri_silebilir'), 'error');
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
            showToast(t('gorsel_silindi'));
        } catch (error) {
            console.error('Delete error:', error);
            showToast(t('silme_hatasi'), 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // ── Copy URL to clipboard ────────────────────────────────────────────
    const copyUrl = async (image: GalleryImage) => {
        try {
            await navigator.clipboard.writeText(image.imageUrl);
            setCopiedId(image.id);
            showToast(t('url_kopyalandi_baska_sayfalarda_kullanab'));
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            showToast(t('url_kopyalanamadi'), 'error');
        }
    };

    // ── Upload external image ────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !admin) return;

        setIsUploading(true);
        let uploadedCount = 0;

        try {
            for (const file of Array.from(files)) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showToast(`${t('kein_bild', { name: file.name })}`, 'error');
                    continue;
                }

                // Max 10MB per file
                if (file.size > 10 * 1024 * 1024) {
                    showToast(`${t('zu_gross', { name: file.name })}`, 'error');
                    continue;
                }

                const timestamp = Date.now();
                const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
                const sanitizedName = file.name
                    .replace(/\.[^.]+$/, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ_-]/gi, '_')
                    .substring(0, 30);
                const storagePath = `lokma-images/${activeCategory}/${sanitizedName}_${timestamp}.${ext}`;
                const storageRef = ref(storage, storagePath);

                await uploadBytes(storageRef, file);
                const downloadUrl = await getDownloadURL(storageRef);

                // Save metadata to Firestore (same structure as AI-generated)
                await addDoc(collection(db, GALLERY_COLLECTION), {
                    category: activeCategory,
                    prompt: t('manuell_hochgeladen'),
                    keyword: file.name.replace(/\.[^.]+$/, ''),
                    imageUrl: downloadUrl,
                    storagePath,
                    aspectRatio: 'custom',
                    createdAt: Timestamp.now(),
                    createdBy: admin.id || admin.email || 'unknown',
                    createdByName: admin.displayName || admin.email || 'Admin',
                    source: 'upload',
                });

                uploadedCount++;
            }

            if (uploadedCount > 0) {
                showToast(`📸 ${t('bilder_hochgeladen', { count: uploadedCount })}`);
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            showToast(error.message || t('upload_fehlgeschlagen'), 'error');
        } finally {
            setIsUploading(false);
            // Reset input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
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
                        <h1 className="text-3xl font-black">
                            {t('ai_gorsel_uretici')}
                        </h1>
                        <p className="text-gray-400 mt-2 text-sm">
                            {t('yapay_zeka_ile_profesyonel_yemek_ve_isle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 border border-emerald-700/50 rounded-full text-emerald-400 font-bold">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            {gallery.length} {t('gorsel_kayitli')}
                        </span>
                    </div>
                </div>

                {/* ═══ Generator Panel (Super Admin only can generate, all can browse) ═══ */}
                {isSuperAdmin && (
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 mb-8">
                        <h2 className="text-lg font-bold mb-4">
                            {t('yeni_gorsel_uret')}
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
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Output Format / Aspect Ratio */}
                        <div className="flex flex-wrap items-center gap-2 mb-5">
                            <span className="text-xs text-gray-500 font-bold mr-1">Format:</span>
                            {outputFormats.map((fmt) => (
                                <button
                                    key={fmt.id}
                                    onClick={() => setActiveFormat(fmt.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${activeFormat === fmt.id
                                        ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/30 scale-105'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    {fmt.name}
                                    <span className="text-[10px] opacity-70">({fmt.label})</span>
                                </button>
                            ))}
                        </div>

                        {/* ── Gelişmiş Ayarlar (Background + Negative Prompt) ── */}
                        <div className="mb-5">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-xs text-gray-400 hover:text-violet-400 font-bold transition-colors"
                            >
                                <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>&#8250;</span>
                                {t('gelismis_ayarlar')}
                                {(backgroundPrompt.trim() || negativePrompt.trim()) && (
                                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                                )}
                            </button>

                            {showAdvanced && (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Background Prompt */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                                            {t('arka_plan_promptlari')}
                                            <span className="text-[10px] text-gray-600 font-normal">{t('her_uretimde_eklenir')}</span>
                                        </label>
                                        <textarea
                                            value={backgroundPrompt}
                                            onChange={(e) => setBackgroundPrompt(e.target.value)}
                                            placeholder={t('or_beyaz_arka_plan_studyo_isigi_profesyo')}
                                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm h-20 resize-none"
                                            disabled={isGenerating}
                                        />
                                    </div>

                                    {/* Negative Prompt */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                                            {t('negative_prompts')}
                                            <span className="text-[10px] text-gray-600 font-normal">{t('uretilmemesi_gerekenler')}</span>
                                        </label>
                                        <textarea
                                            value={negativePrompt}
                                            onChange={(e) => setNegativePrompt(e.target.value)}
                                            placeholder={t('or_tahta_yuzey_plastik_tabak_bulanik_dus')}
                                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 text-sm h-20 resize-none"
                                            disabled={isGenerating}
                                        />
                                    </div>
                                </div>
                            )}
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
                                            ? t('or_kusbasi_tavuk_but_kiyma_dana_pirzola')
                                            : activeCategory === t('restoran')
                                                ? t('or_nohut_yemegi_mercimek_corbasi_lahmacu')
                                                : activeCategory === 'pizzaci'
                                                    ? t('or_margarita_karisik_pizza_sucuklu_pizza')
                                                    : activeCategory === 'donerci'
                                                        ? t('or_tavuk_doner_iskender_durum')
                                                        : activeCategory === 'market'
                                                            ? t('or_sebze_reyonu_meyve_standi_sut_urunler')
                                                            : activeCategory === 'hamburger'
                                                                ? t('or_cift_katli_burger_cheese_burger_tavuk')
                                                                : activeCategory === 'tatli'
                                                                    ? t('or_baklava_kunefe_sutlac_trilece')
                                                                    : t('or_ayran_limonata_turk_kahvesi')
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
                                        {t('uretiliyor')}
                                    </>
                                ) : (
                                    <>{t('gorsel_uret')}</>
                                )}
                            </button>
                        </div>

                        {/* Active prompt preview */}
                        {keyword.trim() && (
                            <div className="mt-3 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
                                <p className="text-xs text-gray-500">
                                    <span className="text-violet-400 font-bold">Prompt:</span>{' '}
                                    {keyword.trim()}, {categories.find((c) => c.id === activeCategory)?.basePrompt?.substring(0, 80)}...
                                </p>
                                {backgroundPrompt.trim() && (
                                    <p className="text-xs text-gray-500">
                                        <span className="text-emerald-400 font-bold">+ {t('hintergrund')}:</span>{' '}
                                        {backgroundPrompt.trim().substring(0, 100)}{backgroundPrompt.trim().length > 100 ? '...' : ''}
                                    </p>
                                )}
                                {negativePrompt.trim() && (
                                    <p className="text-xs text-gray-500">
                                        <span className="text-red-400 font-bold">{t('negativ')}:</span>{' '}
                                        {negativePrompt.trim().substring(0, 100)}{negativePrompt.trim().length > 100 ? '...' : ''}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Gallery ═══ */}
                <div>
                    {/* Gallery Header + Filter + Upload */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold">
                                {t('gorsel_kutuphanesi')}
                                {!isSuperAdmin && (
                                    <span className="text-xs bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full border border-blue-700/50 ml-2">
                                        {t('gorselleri_isletmenizde_kullanabilirsini')}
                                    </span>
                                )}
                            </h2>

                            {/* Upload Button */}
                            {isSuperAdmin && (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-xl hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all shadow-lg shadow-emerald-900/30"
                                    >
                                        {isUploading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                {t('hochladen')}...
                                            </>
                                        ) : (
                                            <>{t('bild_hochladen')}</>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Category filter pills */}
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => setFilterCategory('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCategory === 'all'
                                    ? 'bg-white text-gray-900'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                {t('alle')} ({gallery.length})
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
                                <p className="text-sm font-bold text-white">{t('fircalar_hazirlaniyor')}</p>
                                <p className="text-xs text-gray-500 mt-2">"{keyword}{t('uretiliyor')}</p>
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
                                            {copiedId === image.id ? t('kopyalandi') : t('url_kopieren')}
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
                                                ? image.createdAt.toDate().toLocaleDateString(locale, {
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
                                    <span className="text-4xl text-gray-600">{t('kutuphane_bos')}</span>
                                </div>
                                <h3 className="text-xl font-black text-white">{t('kutuphane_bos')}</h3>
                                <p className="text-gray-500 mt-2 text-sm max-w-xs">
                                    {isSuperAdmin
                                        ? t('yukaridan_bir_kategori_sec_ve_anahtar_ke')
                                        : t('henuz_uretilmis_bir_gorsel_bulunmuyor_su')}
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
                                    {categories.find((c) => c.id === previewImage.category)?.name} •{' '}
                                    {previewImage.createdAt?.toDate?.().toLocaleDateString(locale)} •{' '}
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
                                    {copiedId === previewImage.id ? t('kopyalandi') : t('url_kopieren')}
                                </button>
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm font-bold hover:bg-gray-700 transition-all"
                                >
                                    {t('kapat')}
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
