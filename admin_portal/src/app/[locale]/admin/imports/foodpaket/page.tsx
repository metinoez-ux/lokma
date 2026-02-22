'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

// Category mapping from Foodpaket German to LOKMA categories
const CATEGORY_MAPPING: Record<string, string> = {
    // Dairy
    'joghurt': 'Milchprodukte',
    'kase': 'Milchprodukte',
    'käse': 'Milchprodukte',
    'milch': 'Milchprodukte',
    'ayran': 'Milchprodukte',
    'sahne': 'Milchprodukte',
    'labne': 'Milchprodukte',
    'kaymak': 'Milchprodukte',

    // Meat Products
    'sucuk': 'Et Ürünleri',
    'wurst': 'Et Ürünleri',
    'wurstchen': 'Et Ürünleri',
    'aufschnitt': 'Et Ürünleri',
    'fleisch': 'Et Ürünleri',
    'salami': 'Et Ürünleri',
    'pastirma': 'Et Ürünleri',
    'sosis': 'Et Ürünleri',

    // Deli & Spreads
    'aufstrich': 'Şarküteri',
    'schmelz': 'Şarküteri',

    // Pantry & Staples
    'reis': 'Temel Gıda',
    'bulgur': 'Temel Gıda',
    'linsen': 'Temel Gıda',
    'bohnen': 'Temel Gıda',
    'kichererbsen': 'Temel Gıda',
    'nudeln': 'Temel Gıda',
    'hulsenfruchte': 'Temel Gıda',
    'konserven': 'Temel Gıda',

    // Bakery & Dough
    'teig': 'Unlu Mamüller',
    'blatterteig': 'Unlu Mamüller',
    'börek': 'Unlu Mamüller',
    'borek': 'Unlu Mamüller',
    'backmischungen': 'Unlu Mamüller',

    // Olives & Pickles
    'olive': 'Zeytin & Turşu',
    'oliven': 'Zeytin & Turşu',

    // Beverages
    'getranke': 'İçecekler',
    'softdrinks': 'İçecekler',
    'safte': 'İçecekler',
    'wasser': 'İçecekler',

    // Snacks
    'snacks': 'Atıştırmalık',
    'chips': 'Atıştırmalık',
    'sussigkeiten': 'Atıştırmalık',
    'schokolade': 'Atıştırmalık',
    'kekse': 'Atıştırmalık',

    // Spices
    'gewurz': 'Baharat',

    // Vegan
    'vegan': 'Vejeteryan & Vegan',
    'vegetarisch': 'Vejeteryan & Vegan',
};

// Generate SKU
function generateSKU(name: string, brand: string | null): string {
    const brandCode = (brand || 'GEN').substring(0, 3).toUpperCase();
    const nameCode = name
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 6)
        .toUpperCase();
    const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `FP-${brandCode}-${nameCode}-${hash}`;
}

// Map category
function mapCategory(slug: string, name: string): string {
    const combined = (slug + ' ' + name).toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
        if (combined.includes(key)) {
            return value;
        }
    }
    return 'Diğer';
}

// Parse weight
function parseWeight(name: string): { value: number; unit: string } | null {
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|L)\b/i);
    if (match) {
        return {
            value: parseFloat(match[1].replace(',', '.')),
            unit: match[2].toLowerCase()
        };
    }
    return null;
}

// Get default unit
function getDefaultUnit(name: string): string {
    const weight = parseWeight(name);
    if (weight) {
        if (['g', 'kg'].includes(weight.unit)) return 'kg';
        if (['ml', 'l'].includes(weight.unit)) return 'Liter';
    }
    return 'Adet';
}

interface FoodpaketProduct {
    url: string;
    slug: string;
    name: string;
    brand: string | null;
    imageUrl: string | null;
    lastmod: string | null;
}

export default function FoodpaketImportPage() {

    const t = useTranslations('AdminImportsFoodpaket');
    const { admin, loading: adminLoading } = useAdmin();
    const [products, setProducts] = useState<FoodpaketProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, skipped: 0 });
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [categoryStats, setCategoryStats] = useState<Record<string, number>>({});

    // Load products from public folder
    useEffect(() => {
        fetch('/data/foodpaket_products.json')
            .then(res => res.json())
            .then(data => {
                setProducts(data);
                setLoadingProducts(false);
            })
            .catch(err => {
                console.error('Failed to load products:', err);
                setLoadingProducts(false);
            });
    }, []);

    // Calculate category stats
    const calculateStats = () => {
        const stats: Record<string, number> = {};
        products.forEach(p => {
            const cat = mapCategory(p.slug, p.name);
            stats[cat] = (stats[cat] || 0) + 1;
        });
        setCategoryStats(stats);
    };

    // Import products
    const handleImport = async () => {
        if (admin?.role !== 'super_admin' && admin?.adminType !== 'super') return;

        setImporting(true);
        setProgress({ current: 0, total: products.length, skipped: 0 });
        setResult(null);

        try {
            // Check existing products
            const masterRef = collection(db, 'master_products');
            const existingQuery = query(masterRef, where('sourcePlatform', '==', 'foodpaket'));
            const existingSnap = await getDocs(existingQuery);
            const existingSlugs = new Set(existingSnap.docs.map(d => d.data().sourceSlug));

            let imported = 0;
            let skipped = 0;
            const BATCH_SIZE = 500;
            let batch = writeBatch(db);
            let batchCount = 0;

            for (let i = 0; i < products.length; i++) {
                const product = products[i];

                // Skip existing
                if (existingSlugs.has(product.slug)) {
                    skipped++;
                    setProgress({ current: i + 1, total: products.length, skipped });
                    continue;
                }

                const category = mapCategory(product.slug, product.name);
                const sku = generateSKU(product.name, product.brand);
                const weight = parseWeight(product.name);

                const docRef = doc(masterRef);
                batch.set(docRef, {
                    sku,
                    sourceSlug: product.slug,
                    sourceUrl: product.url,
                    sourcePlatform: 'foodpaket',
                    name: product.name,
                    nameDe: product.name,
                    brand: product.brand || null,
                    category,
                    categorySlug: product.slug.split('-')[0],
                    imageUrl: product.imageUrl || null,
                    images: product.imageUrl ? [product.imageUrl] : [],
                    defaultUnit: getDefaultUnit(product.name),
                    defaultPrice: null,
                    netWeight: weight ? `${weight.value}${weight.unit}` : null,
                    weightValue: weight?.value || null,
                    weightUnit: weight?.unit || null,
                    description: null,
                    ingredients: null,
                    allergens: [],
                    nutrition: {
                        energy: null, fat: null, saturatedFat: null,
                        carbohydrates: null, sugar: null, protein: null,
                        salt: null, fiber: null
                    },
                    manufacturer: null,
                    countryOfOrigin: null,
                    isActive: true,
                    visibility: 'super_admin_only',
                    allowedBusinessTypes: ['market', 'supermarket', 'bakery', 'restaurant'],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    importedAt: serverTimestamp(),
                    lastmod: product.lastmod || null
                });

                batchCount++;
                imported++;

                // Commit batch
                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }

                setProgress({ current: i + 1, total: products.length, skipped });
            }

            // Commit remaining
            if (batchCount > 0) {
                await batch.commit();
            }

            setResult({
                success: true,
                message: `✅ Import tamamlandı! ${imported} ürün eklendi, ${skipped} ürün atlandı (zaten mevcut).`
            });

        } catch (error) {
            console.error(t('import_error'), error);
            setResult({
                success: false,
                message: `❌ Hata: ${error instanceof Error ? error.message : t('bilinmeyen_hata')}`
            });
        }

        setImporting(false);
    };

    // Loading state
    if (adminLoading || loadingProducts) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    // Access check - allow super admin (role field, not isSuperAdmin property)
    const isSuper = admin?.role === 'super_admin' || admin?.adminType === 'super';
    if (!isSuper) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md border border-gray-700">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">{t('erisim_yok')}</h2>
                    <p className="text-gray-400 mt-2">{t('bu_sayfa_sadece_super_admin_ler_icin')}</p>
                    <p className="text-gray-500 text-xs mt-2">Admin: {admin?.email || t('yok')}</p>
                    <Link href="/admin/dashboard" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Dashboard'a Git
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-3xl">📦</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{t('foodpaket_import')}</h1>
                            <p className="text-emerald-200">{t('1019_urunu_master_katalog_a_aktar')}</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-white">{t('kategori_dagilimi')}</h2>
                        <button
                            onClick={calculateStats}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                        >
                            Hesapla
                        </button>
                    </div>
                    {Object.keys(categoryStats).length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(categoryStats)
                                .sort((a, b) => b[1] - a[1])
                                .map(([cat, count]) => (
                                    <div key={cat} className="bg-gray-700/50 rounded-lg p-3">
                                        <p className="text-white font-medium">{cat}</p>
                                        <p className="text-emerald-400 text-lg font-bold">{count}</p>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Import */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-medium text-white mb-4">{t('import')}</h2>

                    {/* Progress */}
                    {importing && (
                        <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span>{progress.current} / {progress.total}</span>
                                <span>{progress.skipped} {t('atlandi')}</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3">
                                <div
                                    className="bg-emerald-500 h-3 rounded-full transition-all"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className={`p-4 rounded-lg mb-4 ${result.success ? 'bg-emerald-900/50 border border-emerald-600' : 'bg-red-900/50 border border-red-600'}`}>
                            <p className={result.success ? 'text-emerald-300' : 'text-red-300'}>
                                {result.message}
                            </p>
                        </div>
                    )}

                    {/* Button */}
                    <button
                        onClick={handleImport}
                        disabled={importing}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-lg"
                    >
                        {importing ? t('import_ediliyor') : t('1019_urunu_import_et')}
                    </button>

                    <p className="text-gray-500 text-sm mt-4 text-center">
                        {t('urunler_super_admin_only_gorunurlugu_ile')}
                    </p>
                </div>

                {/* Back Link */}
                <div className="mt-6 text-center">
                    <Link href="/admin/products" className="text-emerald-400 hover:text-emerald-300">
                        {t('urun_yonetimine_don')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
