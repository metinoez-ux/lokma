'use client';

import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Asia Express Food Categories with counts
const CATEGORIES = [
    { id: 'tiefkuhlprodukte', name: 'Tiefkühlprodukte', slug: 'tiefkuhlprodukte', count: 954, lokmaCategory: 'Dondurulmuş Ürünler' },
    { id: 'krauter-gewurze', name: 'Kräuter & Gewürze', slug: 'krauter-gewurze', count: 548, lokmaCategory: 'Baharatlar' },
    { id: 'getranke', name: 'Getränke', slug: 'getranke', count: 546, lokmaCategory: 'İçecekler' },
    { id: 'nudeln-instantprodukte', name: 'Nudeln & Instantprodukte', slug: 'nudeln-instantprodukte', count: 447, lokmaCategory: 'Makarna & Hazır Ürünler' },
    { id: 'sussigkeiten-snacks', name: 'Süßigkeiten & Snacks', slug: 'sussigkeiten-snacks', count: 434, lokmaCategory: 'Atıştırmalıklar' },
    { id: 'saucen', name: 'Saucen', slug: 'saucen', count: 376, lokmaCategory: 'Soslar' },
    { id: 'konservierte-produkte', name: 'Konservierte Produkte', slug: 'konservierte-produkte', count: 190, lokmaCategory: 'Konserve Ürünler' },
    { id: 'mehl-starke-panko', name: 'Mehl, Stärke & Panko', slug: 'mehl-starke-panko', count: 176, lokmaCategory: 'Un & Nişasta' },
    { id: 'frische-produkte', name: 'Frische Produkte', slug: 'frische-produkte', count: 167, lokmaCategory: 'Taze Ürünler' },
    { id: 'kosmetik-haare', name: 'Kosmetik & Haare', slug: 'kosmetik-haare', count: 154, lokmaCategory: 'Kozmetik' },
    { id: 'getrocknete-produkte', name: 'Getrocknete Produkte', slug: 'getrocknete-produkte', count: 143, lokmaCategory: 'Kurutulmuş Ürünler' },
    { id: 'reis', name: 'Reis', slug: 'reis', count: 140, lokmaCategory: 'Pirinç & Tahıllar' },
    { id: 'halb-frisch', name: 'Halb Frisch', slug: 'halb-frisch', count: 118, lokmaCategory: 'Yarı Taze Ürünler' },
    { id: 'non-food', name: 'Non-Food', slug: 'non-food', count: 67, lokmaCategory: 'Diğer' },
    { id: 'kokosmilch-sahne-pulver', name: 'Kokosmilch, Sahne & Pulver', slug: 'kokosmilch-sahne-pulver', count: 36, lokmaCategory: 'Hindistan Cevizi Ürünleri' },
    { id: 'ole-butter', name: 'Öle & Butter', slug: 'ole-butter', count: 23, lokmaCategory: 'Yağlar' },
    { id: 'milch-milchpulver', name: 'Milch & Milchpulver', slug: 'milch-milchpulver', count: 21, lokmaCategory: 'Süt & Süt Ürünleri' }
];

const BASE_URL = 'https://order.asiaexpressfood.nl/de/assortiment';
const PRODUCTS_PER_PAGE = 48;

interface ScrapedProduct {
    name: string;
    brand: string | null;
    content: string | null;
    articleNumber: string | null;
    imageUrl: string | null;
    url: string | null;
    category: string;
    lokmaCategory: string;
}

interface ImportStats {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
}

export default function AsiaExpressImportPage() {
    const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
    const [isImporting, setIsImporting] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentCategory, setCurrentCategory] = useState('');
    const [scrapedProducts, setScrapedProducts] = useState<ScrapedProduct[]>([]);
    const [stats, setStats] = useState<ImportStats>({ total: 0, imported: 0, skipped: 0, errors: 0 });
    const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'error' | 'warning'; message: string }[]>([]);
    const [scrapingInstructions, setScrapingInstructions] = useState(false);

    const addLog = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string) => {
        setLogs(prev => [...prev.slice(-100), { type, message }]);
    }, []);

    const getTotalSelected = () => {
        return CATEGORIES.filter(c => selectedCategories.includes(c.id)).reduce((sum, c) => sum + c.count, 0);
    };

    const toggleCategory = (id: string) => {
        setSelectedCategories(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const selectAll = () => setSelectedCategories(CATEGORIES.map(c => c.id));
    const selectNone = () => setSelectedCategories([]);

    // Generate SKU from article number
    const generateSKU = (articleNumber: string | null, index: number): string => {
        if (articleNumber) {
            return `AEF-${articleNumber}`;
        }
        return `AEF-AUTO-${index.toString().padStart(5, '0')}`;
    };

    // Show scraping instructions
    const showScrapingInstructions = () => {
        setScrapingInstructions(true);
    };

    // Import products to Firestore
    const importToFirestore = async () => {
        if (scrapedProducts.length === 0) {
            addLog('error', 'Önce ürünleri scrape etmeniz gerekiyor!');
            return;
        }

        setIsImporting(true);
        const newStats = { total: scrapedProducts.length, imported: 0, skipped: 0, errors: 0 };

        for (let i = 0; i < scrapedProducts.length; i++) {
            const product = scrapedProducts[i];
            setProgress(Math.round((i / scrapedProducts.length) * 100));
            setCurrentCategory(`${i + 1}/${scrapedProducts.length}: ${product.name?.substring(0, 30)}...`);

            try {
                // Check if product already exists
                const sku = generateSKU(product.articleNumber, i);
                const existingQuery = query(
                    collection(db, 'master_products'),
                    where('sku', '==', sku)
                );
                const existing = await getDocs(existingQuery);

                if (!existing.empty) {
                    newStats.skipped++;
                    addLog('warning', `⏭️ Atlandı (mevcut): ${product.name}`);
                    continue;
                }

                // Create product document
                const productDoc = {
                    masterProductId: `aef_${product.articleNumber || `auto_${i}`}`,
                    sku: sku,
                    name: product.name || 'Bilinmeyen Ürün',
                    description: product.content || '',
                    category: product.lokmaCategory,
                    originalCategory: product.category,
                    brand: product.brand || '',
                    unit: 'Adet',
                    price: 0,
                    isActive: true,
                    taxRate: 7,
                    availableForDelivery: true,
                    availableForPickup: true,
                    imageUrl: product.imageUrl || '',
                    sourceUrl: product.url || '',
                    source: 'asia_express_food',
                    visibility: 'super_admin_only',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                await addDoc(collection(db, 'master_products'), productDoc);
                newStats.imported++;
                addLog('success', `✅ Eklendi: ${product.name}`);
            } catch (error) {
                newStats.errors++;
                addLog('error', `❌ Hata: ${product.name} - ${error}`);
            }
        }

        setStats(newStats);
        setIsImporting(false);
        setProgress(100);
        addLog('info', `🎉 Import tamamlandı! ${newStats.imported} eklendi, ${newStats.skipped} atlandı, ${newStats.errors} hata`);
    };

    // Handle file upload for scraped data
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                setScrapedProducts(data);
                addLog('success', `✅ ${data.length} ürün yüklendi`);
            } catch (error) {
                addLog('error', `❌ Dosya parse hatası: ${error}`);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600 to-red-600 rounded-2xl p-6 mb-6 shadow-xl">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">🌏</span>
                        <div>
                            <h1 className="text-3xl font-bold text-white">ASIA EXPRESS FOOD Import</h1>
                            <p className="text-amber-100">Asya ürünleri Master Kataloğa aktarılıyor</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{CATEGORIES.reduce((sum, c) => sum + c.count, 0)}</div>
                        <div className="text-sm text-gray-300">Toplam Ürün</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-purple-400">{CATEGORIES.length}</div>
                        <div className="text-sm text-gray-300">Kategori</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{scrapedProducts.length}</div>
                        <div className="text-sm text-gray-300">Scraped</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-amber-400">{stats.imported}</div>
                        <div className="text-sm text-gray-300">İmported</div>
                    </div>
                </div>

                {/* Categories */}
                <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">📦 Kategoriler</h2>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm">
                                Tümünü Seç
                            </button>
                            <button onClick={selectNone} className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm">
                                Temizle
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {CATEGORIES.map(cat => (
                            <label key={cat.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(cat.id)}
                                    onChange={() => toggleCategory(cat.id)}
                                    className="w-4 h-4"
                                />
                                <span className="text-white text-sm">{cat.name}</span>
                                <span className="text-amber-400 text-xs ml-auto">({cat.count})</span>
                            </label>
                        ))}
                    </div>
                    <div className="mt-4 text-center text-gray-300">
                        Seçili: <span className="text-amber-400 font-bold">{getTotalSelected()}</span> ürün
                    </div>
                </div>

                {/* Instructions Modal */}
                {scrapingInstructions && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-2xl p-6 max-w-3xl max-h-[80vh] overflow-y-auto">
                            <h3 className="text-2xl font-bold text-white mb-4">🔧 Manuel Scraping Talimatları</h3>
                            <div className="text-gray-300 space-y-4">
                                <p>Asia Express Food sitesi login gerektirdiğinden, ürünleri manuel olarak scrape etmeniz gerekiyor:</p>

                                <div className="bg-slate-900 p-4 rounded-lg">
                                    <p className="text-amber-400 font-bold mb-2">1. Browser DevTools'u açın (F12)</p>
                                    <p className="text-amber-400 font-bold mb-2">2. Console'a bu kodu yapıştırın:</p>
                                    <pre className="bg-black p-4 rounded text-green-400 text-xs overflow-x-auto">
                                        {`// Asia Express Food Scraper
const products = [];
document.querySelectorAll('.product-item').forEach((card) => {
    products.push({
        name: card.querySelector('.product-item-link')?.textContent?.trim(),
        brand: card.querySelector('.product-item-brand span')?.textContent?.trim(),
        content: card.querySelector('.product-item-unit')?.textContent?.trim(),
        articleNumber: card.querySelector('.product-item-sku .value')?.textContent?.trim(),
        imageUrl: card.querySelector('img.product-image-photo')?.src,
        url: card.querySelector('a.product-item-link')?.href,
        category: document.title.split(' - ')[0],
        lokmaCategory: 'Diğer'
    });
});
console.log(JSON.stringify(products, null, 2));
// Clipboard'a kopyala
copy(products);
console.log('✅ ' + products.length + ' ürün kopyalandı!');`}
                                    </pre>
                                </div>

                                <p>3. Her kategori sayfasında bu kodu çalıştırın</p>
                                <p>4. Tüm ürünleri bir JSON dosyasına kaydedin</p>
                                <p>5. Dosyayı buraya yükleyin</p>
                            </div>
                            <button
                                onClick={() => setScrapingInstructions(false)}
                                className="mt-6 w-full py-3 bg-amber-600 text-white rounded-lg font-bold"
                            >
                                Anladım
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                        <h3 className="text-lg font-bold text-white mb-3">📥 Scraped Data Yükle</h3>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="w-full p-2 bg-white/10 rounded-lg text-white"
                        />
                        <button
                            onClick={showScrapingInstructions}
                            className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm"
                        >
                            🔧 Nasıl Scrape Edilir?
                        </button>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                        <h3 className="text-lg font-bold text-white mb-3">🚀 Firestore'a Aktar</h3>
                        <button
                            onClick={importToFirestore}
                            disabled={isImporting || scrapedProducts.length === 0}
                            className={`w-full py-3 rounded-lg font-bold ${isImporting || scrapedProducts.length === 0
                                    ? 'bg-gray-600 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-700 hover:to-red-700'
                                } text-white`}
                        >
                            {isImporting ? '⏳ İmport ediliyor...' : `🚀 ${scrapedProducts.length} Ürünü İmport Et`}
                        </button>
                    </div>
                </div>

                {/* Progress */}
                {(isImporting || progress > 0) && (
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-6">
                        <div className="flex justify-between text-white mb-2">
                            <span>{currentCategory}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-4">
                            <div
                                className="bg-gradient-to-r from-amber-500 to-red-500 h-4 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {(stats.imported > 0 || stats.skipped > 0 || stats.errors > 0) && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-600/20 border border-green-500 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-green-400">{stats.imported}</div>
                            <div className="text-sm text-green-300">Başarılı</div>
                        </div>
                        <div className="bg-yellow-600/20 border border-yellow-500 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-yellow-400">{stats.skipped}</div>
                            <div className="text-sm text-yellow-300">Atlandı</div>
                        </div>
                        <div className="bg-red-600/20 border border-red-500 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-red-400">{stats.errors}</div>
                            <div className="text-sm text-red-300">Hata</div>
                        </div>
                    </div>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                    <div className="bg-black/50 rounded-xl p-4 max-h-96 overflow-y-auto">
                        <h3 className="text-lg font-bold text-white mb-3">📋 Import Log</h3>
                        <div className="space-y-1 font-mono text-sm">
                            {logs.map((log, i) => (
                                <div key={i} className={`
                                    ${log.type === 'success' ? 'text-green-400' : ''}
                                    ${log.type === 'error' ? 'text-red-400' : ''}
                                    ${log.type === 'warning' ? 'text-yellow-400' : ''}
                                    ${log.type === 'info' ? 'text-blue-400' : ''}
                                `}>
                                    {log.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
