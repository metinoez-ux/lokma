'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { db } from '@/lib/firebase';
import {
    doc, getDoc, setDoc, serverTimestamp,
    collection, getDocs, query, where,
} from 'firebase/firestore';
import { useTranslations } from 'next-intl';

interface Product {
    id: string;
    name: string;
    imageUrl?: string;
    price?: number;
    category?: string;
}

const MAX_DRINKS = 5;

export default function FreeDrinkSettingsPage() {
    const t = useTranslations('AdminSettings');
    const { admin } = useAdmin();

    // Resolve business ID via shared hook
    const businessId = useAdminBusinessId();

    // Form State
    const [freeDrinkEnabled, setFreeDrinkEnabled] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [success, setSuccess] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    // ------------------------------------------------------------------
    // Load existing settings from businesses/{businessId}
    // ------------------------------------------------------------------
    const loadSettings = useCallback(async () => {
        if (!businessId) return;
        try {
            const bizDoc = await getDoc(doc(db, 'businesses', businessId));
            if (bizDoc.exists()) {
                const data = bizDoc.data();
                setFreeDrinkEnabled(data.freeDrinkEnabled ?? false);
                setSelectedProductIds(data.freeDrinkProducts ?? []);
            }
        } catch (err) {
            console.error('Error loading free drink settings:', err);
        } finally {
            setDataLoaded(true);
        }
    }, [businessId]);

    // ------------------------------------------------------------------
    // Load drink products from businesses/{businessId}/products
    // ------------------------------------------------------------------
    const loadProducts = useCallback(async () => {
        if (!businessId) return;
        setLoadingProducts(true);
        try {
            // Try subcollection first
            const subRef = collection(db, 'businesses', businessId, 'products');
            const subSnap = await getDocs(subRef);

            let prods: Product[] = [];

            if (!subSnap.empty) {
                prods = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
            } else {
                // Fallback: top-level products collection filtered by business
                const topRef = query(
                    collection(db, 'products'),
                    where('businessId', '==', businessId),
                );
                const topSnap = await getDocs(topRef);
                prods = topSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
            }

            // Filter: keep only drink-category products (category includes "icecek" / "getränk" / "drink" etc.)
            const drinks = prods.filter(p => {
                const cat = (p.category || '').toLowerCase();
                return (
                    cat.includes('içecek') ||
                    cat.includes('icecek') ||
                    cat.includes('drink') ||
                    cat.includes('getränk') ||
                    cat.includes('beverage') ||
                    cat.includes('boire')
                );
            });

            // If no category match, show all products so admin can still pick
            setProducts(drinks.length > 0 ? drinks : prods);
        } catch (err) {
            console.error('Error loading products:', err);
        } finally {
            setLoadingProducts(false);
        }
    }, [businessId]);

    useEffect(() => {
        loadSettings();
        loadProducts();
    }, [loadSettings, loadProducts]);

    // ------------------------------------------------------------------
    // Toggle a product selection (max MAX_DRINKS)
    // ------------------------------------------------------------------
    const toggleProduct = (id: string) => {
        setSelectedProductIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= MAX_DRINKS) return prev; // max reached
            return [...prev, id];
        });
    };

    // ------------------------------------------------------------------
    // Save
    // ------------------------------------------------------------------
    const handleSave = async () => {
        if (!admin?.id || !businessId) return;
        setLoading(true);
        try {
            await setDoc(
                doc(db, 'businesses', businessId),
                {
                    freeDrinkEnabled,
                    freeDrinkProducts: selectedProductIds,
                    freeDrinkUpdatedAt: serverTimestamp(),
                    freeDrinkUpdatedBy: admin.id,
                },
                { merge: true },
            );
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving free drink settings:', err);
            alert(t('hata_olustu') || 'Hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------------------------------------------
    // UI helpers
    // ------------------------------------------------------------------
    if (!businessId) {
        return (
            <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground flex items-center justify-center">
                <div className="text-center">
                    <p className="text-2xl mb-2">⚠️</p>
                    <p className="text-muted-foreground">Bu ayar yalnızca işletmeye bağlı admin hesapları için geçerlidir.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
            <div className="max-w-3xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Link href="/admin/settings" className="hover:text-white transition">⚙️ {t('settings') || 'Ayarlar'}</Link>
                    <span>›</span>
                    <span className="text-foreground">🥤 {t('gratis_icecek') || 'Gratis İçecek'}</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🥤</span>
                        <div>
                            <h2 className="text-xl font-bold">{t('gratis_icecek') || 'Gratis İçecek'}</h2>
                            <p className="text-muted-foreground text-sm">
                                {t('gratis_icecek_desc') || 'Müşterilerinize siparişlerinde bedava içecek sunun — sizin seçiminizle.'}
                            </p>
                        </div>
                    </div>

                    {/* ── Toggle ── */}
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                        <div>
                            <h3 className="font-bold">{t('ozelligi_aktif_et') || 'Özelliği Aktif Et'}</h3>
                            <p className="text-xs text-gray-500">
                                {t('gratis_icecek_toggle_desc') || 'Müşteriler sepette bedava içecek seçim bölümünü görür'}
                            </p>
                        </div>
                        {/* Larger toggle switch */}
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={freeDrinkEnabled}
                                onChange={e => setFreeDrinkEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-16 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer
                peer-checked:after:translate-x-8
                peer-checked:after:border-white
                after:content-['']
                after:absolute
                after:top-[4px]
                after:left-[4px]
                after:bg-white
                after:border-gray-300
                after:border
                after:rounded-full
                after:h-6
                after:w-6
                after:transition-all
                peer-checked:bg-emerald-600" />
                        </label>
                    </div>

                    {/* ── Product Selection ── (only when enabled) */}
                    <div className={!freeDrinkEnabled ? 'opacity-40 pointer-events-none' : ''}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-sm">
                                    🧃 {t('icecek_sec') || 'Bedava Sunulacak İçecekler'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {t('icecek_sec_desc') || `En fazla ${MAX_DRINKS} ürün seçebilirsiniz`}
                                </p>
                            </div>
                            <span className="text-xs font-mono bg-gray-700 px-2 py-1 rounded-lg">
                                {selectedProductIds.length} / {MAX_DRINKS}
                            </span>
                        </div>

                        {loadingProducts ? (
                            <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
                                <span className="animate-spin mr-2">⏳</span> Ürünler yükleniyor…
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-border rounded-xl">
                                <p className="text-2xl mb-2">🧃</p>
                                <p>Menünüzde henüz içecek ürünü yok.</p>
                                <p className="text-xs mt-1 text-gray-600">Menü &gt; Ürünler bölümünden içecek ekleyin.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {products.map(product => {
                                    const isSelected = selectedProductIds.includes(product.id);
                                    const isMaxed = !isSelected && selectedProductIds.length >= MAX_DRINKS;
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => toggleProduct(product.id)}
                                            disabled={isMaxed}
                                            className={`
                        relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-left
                        ${isSelected
                                                    ? 'border-emerald-500 bg-emerald-950/40 shadow-lg shadow-emerald-900/20'
                                                    : isMaxed
                                                        ? 'border-border bg-background/40 opacity-40 cursor-not-allowed'
                                                        : 'border-border bg-background/40 hover:border-gray-500 cursor-pointer'
                                                }
                      `}
                                        >
                                            {/* Checkmark */}
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-xs">
                                                    ✓
                                                </div>
                                            )}

                                            {/* Product image / emoji fallback */}
                                            {product.imageUrl ? (
                                                <img
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    className="w-14 h-14 object-cover rounded-lg"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center text-2xl">
                                                    🧃
                                                </div>
                                            )}

                                            <p className="text-xs font-semibold text-center leading-tight line-clamp-2 text-white">
                                                {product.name}
                                            </p>
                                            {product.price != null && (
                                                <p className="text-xs text-muted-foreground">€{product.price.toFixed(2)}</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Preview ── */}
                    {freeDrinkEnabled && selectedProductIds.length > 0 && (
                        <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
                            <p className="text-emerald-300 text-sm font-medium">✅ {t('onizleme') || 'Önizleme'}</p>
                            <p className="text-emerald-200/70 text-xs mt-1">
                                Müşteriler sepetlerinde <strong>{selectedProductIds.length}</strong> adet içecekten seçim yapabilir.
                                Seçilen içecek <strong>0,00 €</strong> ile sepete eklenir.
                            </p>
                        </div>
                    )}

                    {/* ── Info box ── */}
                    <div className="p-4 bg-blue-950/30 border border-blue-800/40 rounded-xl">
                        <p className="text-blue-300 text-sm font-bold mb-2">ℹ️ {t('nasil_calisir') || 'Nasıl çalışır?'}</p>
                        <ul className="text-blue-200/70 text-xs space-y-1 list-disc list-inside">
                            <li>{t('gratis_icecek_info_1') || 'Müşteri seçtiğiniz içeceklerden birini bedavaya sepete ekler'}</li>
                            <li>{t('gratis_icecek_info_2') || 'Seçilen içecek 0,00 € ile görünür, orijinal fiyat üstü çizili'}</li>
                            <li>{t('gratis_icecek_info_3') || 'Sipariş "Gratis İçecek" etiketiyle işaretlenir'}</li>
                            <li>{t('gratis_icecek_info_4') || 'Bu özellik sadece sizin işletmenize özel geçerlidir'}</li>
                        </ul>
                    </div>

                    {/* ── Save button ── */}
                    <button
                        onClick={handleSave}
                        disabled={loading || !dataLoaded}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-foreground font-bold py-4 rounded-xl transition shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                    >
                        {loading
                            ? (t('kaydediliyor') || 'Kaydediliyor...')
                            : success
                                ? '✅ Kaydedildi!'
                                : (t('gratis_icecek_kaydet') || 'Gratis İçecek Ayarlarını Kaydet')}
                    </button>
                </div>
            </div>
        </div>
    );
}
