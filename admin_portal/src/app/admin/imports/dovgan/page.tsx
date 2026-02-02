'use client';

import { useState, useEffect } from 'react';
import {
    collection,
    doc,
    setDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Product interface based on scraped data
interface DovganProduct {
    url: string;
    name: string;
    title?: string;
    priceText: string;
    image: string;
    sourceCategory: string;
    lokmaCategory: string;
    articleNumber?: string;
    ean?: string;
    price?: number;
    description?: string;
    ingredients?: string;
    nutrition?: {
        raw?: string;
        parsed?: {
            energyKJ?: number;
            energyKcal?: number;
            fat?: number;
            carbohydrates?: number;
            protein?: number;
            salt?: number;
            sugar?: number;
        };
    };
    weight?: {
        value: number;
        unit: string;
    };
    allergens?: string[];
    images?: string[];
    scrapedAt: string;
}

// Category stats type
interface CategoryStats {
    [key: string]: number;
}

export default function DovganImportPage() {
    const [products, setProducts] = useState<DovganProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<{
        success: number;
        errors: number;
        skipped: number;
    }>({ success: 0, errors: 0, skipped: 0 });
    const [categoryStats, setCategoryStats] = useState<CategoryStats>({});
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

    // Load products from JSON
    useEffect(() => {
        fetch('/data/dovgan_products.json')
            .then(res => res.json())
            .then((data: DovganProduct[]) => {
                setProducts(data);
                setLoadingProducts(false);

                // Calculate category stats
                const stats: CategoryStats = {};
                data.forEach(p => {
                    const cat = p.lokmaCategory || 'Diğer';
                    stats[cat] = (stats[cat] || 0) + 1;
                });
                setCategoryStats(stats);

                // Select all categories by default
                setSelectedCategories(new Set(Object.keys(stats)));
            })
            .catch(err => {
                console.error('Failed to load products:', err);
                setLoadingProducts(false);
                addLog(`❌ Ürünler yüklenemedi: ${err.message}`);
            });
    }, []);

    const addLog = (message: string) => {
        setLogs(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const generateSKU = (product: DovganProduct, index: number): string => {
        if (product.articleNumber) {
            return `DVG-${product.articleNumber}`;
        }
        if (product.ean) {
            return `DVG-${product.ean.slice(-6)}`;
        }
        return `DVG-${String(index + 1).padStart(5, '0')}`;
    };

    const getTaxRate = (category: string): number => {
        const cat = category.toLowerCase();
        if (cat.includes('getränke') || cat.includes('içecek')) return 19;
        if (cat.includes('kozmetik') || cat.includes('cosmetic')) return 19;
        return 7; // Reduced VAT for food
    };

    const parseUnit = (product: DovganProduct): { value: number; unit: string; display: string } => {
        if (product.weight) {
            return {
                value: product.weight.value,
                unit: product.weight.unit,
                display: `${product.weight.value} ${product.weight.unit}`
            };
        }

        const title = product.title || product.name || '';
        const match = title.match(/(\d+(?:[,.]?\d*)?)\s*(g|kg|ml|l|L|Stück|St\.?)\b/i);
        if (match) {
            return {
                value: parseFloat(match[1].replace(',', '.')),
                unit: match[2].toLowerCase(),
                display: `${match[1]} ${match[2]}`
            };
        }

        return { value: 1, unit: 'stück', display: '1 Stück' };
    };

    const mapToFirestoreDoc = (product: DovganProduct, index: number) => {
        const unit = parseUnit(product);
        const sku = generateSKU(product, index);
        const category = product.lokmaCategory || 'Diğer';

        return {
            masterProductId: sku,
            sku,
            ean: product.ean || null,
            articleNumber: product.articleNumber || null,

            name: product.title || product.name,
            nameDE: product.title || product.name,
            description: product.description || null,
            descriptionDE: product.description || null,

            category,
            sourceCategory: product.sourceCategory,

            unit: unit.display,
            unitValue: unit.value,
            unitType: unit.unit,

            price: product.price || 0,
            priceOriginal: product.priceText || null,
            currency: 'EUR',
            taxRate: getTaxRate(category),

            isActive: true,
            availableForDelivery: true,
            availableForPickup: true,

            imageUrl: product.images?.[0] || product.image || null,
            images: product.images || (product.image ? [product.image] : []),

            ingredients: product.ingredients || null,
            allergens: product.allergens || [],
            allergenInfo: product.allergens?.length ? product.allergens.join(', ') : null,

            nutrition: product.nutrition?.parsed || null,
            nutritionRaw: product.nutrition?.raw || null,
            nutritionPer100g: product.nutrition?.parsed || null,

            source: 'dovgan',
            sourceUrl: product.url,
            manufacturer: 'DOVGAN GmbH',
            brand: 'DOVGAN',
            origin: 'DE',

            visibility: 'super_admin_only',

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            scrapedAt: product.scrapedAt ? new Date(product.scrapedAt) : new Date(),
            importedAt: serverTimestamp()
        };
    };

    const handleImport = async () => {
        if (importing) return;

        setImporting(true);
        setProgress(0);
        setResults({ success: 0, errors: 0, skipped: 0 });
        setLogs([]);

        addLog('🚀 Dovgan import başlatılıyor...');
        addLog(`📦 ${products.length} ürün yüklenecek`);

        const filteredProducts = products.filter(p =>
            selectedCategories.has(p.lokmaCategory || 'Diğer')
        );

        addLog(`🔍 Seçilen kategoriler: ${filteredProducts.length} ürün`);

        let success = 0;
        let errors = 0;
        let skipped = 0;

        for (let i = 0; i < filteredProducts.length; i++) {
            const product = filteredProducts[i];
            const sku = generateSKU(product, i);

            try {
                const docRef = doc(collection(db, 'master_products'), sku);
                const docData = mapToFirestoreDoc(product, i);

                await setDoc(docRef, docData, { merge: true });
                success++;

                if ((i + 1) % 20 === 0) {
                    addLog(`✅ ${i + 1}/${filteredProducts.length} - ${product.title || product.name}`);
                }
            } catch (error: unknown) {
                errors++;
                const errMessage = error instanceof Error ? error.message : String(error);
                addLog(`❌ Hata: ${product.name} - ${errMessage}`);
            }

            setProgress(Math.round(((i + 1) / filteredProducts.length) * 100));
            setResults({ success, errors, skipped });
        }

        addLog(`\n✅ Import tamamlandı!`);
        addLog(`📊 Başarılı: ${success}, Hata: ${errors}, Atlanan: ${skipped}`);

        setImporting(false);
    };

    const toggleCategory = (category: string) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(category)) {
            newSet.delete(category);
        } else {
            newSet.add(category);
        }
        setSelectedCategories(newSet);
    };

    const selectAllCategories = () => {
        setSelectedCategories(new Set(Object.keys(categoryStats)));
    };

    const deselectAllCategories = () => {
        setSelectedCategories(new Set());
    };

    const getSelectedProductCount = () => {
        return Object.entries(categoryStats)
            .filter(([cat]) => selectedCategories.has(cat))
            .reduce((sum, [, count]) => sum + count, 0);
    };

    if (loadingProducts) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Ürünler yükleniyor...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <span className="text-4xl">🇷🇺</span>
                    DOVGAN Ürün Import
                </h1>
                <p className="text-gray-600 mt-2">
                    Dovgan ürünlerini Master Katalog&apos;a aktarın
                </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-blue-700">{products.length}</div>
                    <div className="text-sm text-blue-600">Toplam Ürün</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-700">
                        {products.filter(p => p.ean).length}
                    </div>
                    <div className="text-sm text-green-600">EAN Mevcut</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-purple-700">
                        {products.filter(p => p.nutrition?.raw).length}
                    </div>
                    <div className="text-sm text-purple-600">Besin Değeri</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-amber-700">
                        {products.filter(p => p.ingredients).length}
                    </div>
                    <div className="text-sm text-amber-600">İçerik Bilgisi</div>
                </div>
            </div>

            {/* Category Selection */}
            <div className="bg-white rounded-lg border p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Kategoriler</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={selectAllCategories}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                        >
                            Tümünü Seç
                        </button>
                        <button
                            onClick={deselectAllCategories}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                        >
                            Tümünü Kaldır
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries(categoryStats)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, count]) => (
                            <label
                                key={category}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedCategories.has(category)
                                        ? 'bg-blue-50 border-blue-300'
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.has(category)}
                                        onChange={() => toggleCategory(category)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="font-medium text-sm">{category}</span>
                                </div>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
                                    {count}
                                </span>
                            </label>
                        ))
                    }
                </div>
                <div className="mt-4 text-sm text-gray-600">
                    Seçili: <strong>{getSelectedProductCount()}</strong> ürün
                </div>
            </div>

            {/* Import Button */}
            <div className="mb-8">
                <button
                    onClick={handleImport}
                    disabled={importing || getSelectedProductCount() === 0}
                    className={`w-full py-4 rounded-lg text-white font-semibold text-lg transition-colors ${importing || getSelectedProductCount() === 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {importing ? (
                        <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            İmport Ediliyor... {progress}%
                        </span>
                    ) : (
                        `🚀 ${getSelectedProductCount()} Ürünü Import Et`
                    )}
                </button>
            </div>

            {/* Progress */}
            {importing && (
                <div className="mb-8">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-600">
                        <span>İlerleme: {progress}%</span>
                        <span>
                            ✅ {results.success} | ❌ {results.errors}
                        </span>
                    </div>
                </div>
            )}

            {/* Results */}
            {(results.success > 0 || results.errors > 0) && !importing && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-green-700">{results.success}</div>
                        <div className="text-sm text-green-600">Başarılı</div>
                    </div>
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-red-700">{results.errors}</div>
                        <div className="text-sm text-red-600">Hata</div>
                    </div>
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-gray-700">{results.skipped}</div>
                        <div className="text-sm text-gray-600">Atlanan</div>
                    </div>
                </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <h3 className="text-white font-semibold mb-2">Import Log</h3>
                    <div className="font-mono text-sm text-green-400 space-y-1">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
