'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface ProductToEnrich {
    id: string;
    sourceUrl: string;
    name: string;
    ean?: string;
}

export default function EANEnrichmentPage() {
    
  const t = useTranslations('AdminImportsEanenrichment');
const { admin, loading: adminLoading } = useAdmin();
    const [products, setProducts] = useState<ProductToEnrich[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [enriching, setEnriching] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, found: 0 });
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [currentProduct, setCurrentProduct] = useState<string | null>(null);

    // Load products needing EAN enrichment
    useEffect(() => {
        const loadProducts = async () => {
            try {
                // Query all foodpaket products and filter client-side for missing EAN
                // (Firestore can't query for non-existent fields)
                const masterRef = collection(db, 'master_products');
                const q = query(masterRef, where('sourcePlatform', '==', 'foodpaket'));
                const snapshot = await getDocs(q);

                console.log(`Found ${snapshot.size} foodpaket products total`);

                const prods = snapshot.docs
                    .filter(d => !d.data().ean) // Filter out products that already have EAN
                    .map(d => ({
                        id: d.id,
                        sourceUrl: d.data().sourceUrl,
                        name: d.data().name,
                        ean: d.data().ean
                    }));

                console.log(`${prods.length} products need EAN enrichment`);
                setProducts(prods);
            } catch (error) {
                console.error('Error loading products:', error);
            }
            setLoadingProducts(false);
        };

        loadProducts();
    }, []);

    // Fetch EAN from product page using proxy
    const fetchEAN = async (url: string): Promise<string | null> => {
        try {
            // Use a CORS proxy or server-side API
            const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
            const html = await response.text();

            // Try to find barcode/EAN in the HTML
            const patterns = [
                /\"barcode\":\s*\"(\d{8,14})\"/,
                /data-barcode=\"(\d{8,14})\"/,
                /EAN[:\s]*(\d{8,14})/i,
                /GTIN[:\s]*(\d{8,14})/i,
                /Barcode[:\s]*(\d{8,14})/i,
                /"gtin13":\s*"(\d{13})"/,
                /"gtin":\s*"(\d{8,14})"/,
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }

            return null;
        } catch (error) {
            console.error('Error fetching EAN:', error);
            return null;
        }
    };

    // Start enrichment process
    const handleEnrich = async () => {
        const isSuper = admin?.role === 'super_admin' || admin?.adminType === 'super';
        if (!isSuper) return;

        setEnriching(true);
        setProgress({ current: 0, total: products.length, found: 0 });
        setResult(null);

        let found = 0;

        for (let i = 0; i < products.length; i++) { // Process ALL products
            const product = products[i];
            setCurrentProduct(product.name);

            const ean = await fetchEAN(product.sourceUrl);

            if (ean) {
                await updateDoc(doc(db, 'master_products', product.id), {
                    ean: ean,
                    eanSource: 'foodpaket',
                    eanEnrichedAt: serverTimestamp()
                });
                found++;
            }

            setProgress({ current: i + 1, total: products.length, found });

            // Small delay to be nice to the server (300ms for faster processing)
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        setResult({
            success: true,
            message: `✅ EAN Enrichment tamamlandı! ${found} ürüne EAN eklendi.`
        });

        setEnriching(false);
        setCurrentProduct(null);
    };

    // Loading state
    if (adminLoading || loadingProducts) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    // Access check
    const isSuper = admin?.role === 'super_admin' || admin?.adminType === 'super';
    if (!isSuper) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md border border-gray-700">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">{t('erisim_yok')}</h2>
                    <p className="text-gray-400 mt-2">{t('bu_sayfa_sadece_super_admin_ler_icin')}</p>
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
                <div className="bg-gradient-to-r from-purple-800 to-purple-700 rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-3xl">🏷️</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">EAN Enrichment</h1>
                            <p className="text-purple-200">{products.length} {t('urun_ean_bekliyor')}</p>
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-lg font-medium text-white mb-4">{t('bilgi')}</h2>
                    <p className="text-gray-400 text-sm">
                        {t('bu_islem_foodpaket_urun_sayfalarini_ziya')}
                    </p>
                </div>

                {/* Progress */}
                {enriching && (
                    <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-purple-600">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>{progress.current} / {progress.total}</span>
                            <span className="text-emerald-400">{progress.found} EAN bulundu</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
                            <div
                                className="bg-purple-500 h-3 rounded-full transition-all"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                        {currentProduct && (
                            <p className="text-gray-500 text-xs truncate">
                                🔍 {currentProduct}
                            </p>
                        )}
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className={`p-4 rounded-lg mb-6 ${result.success ? 'bg-emerald-900/50 border border-emerald-600' : 'bg-red-900/50 border border-red-600'}`}>
                        <p className={result.success ? 'text-emerald-300' : 'text-red-300'}>
                            {result.message}
                        </p>
                    </div>
                )}

                {/* Button */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <button
                        onClick={handleEnrich}
                        disabled={enriching || products.length === 0}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-lg"
                    >
                        {enriching ? t('ean_cekiliyor') : `🏷️ ${products.length} Ürüne EAN Ekle`}
                    </button>

                    <p className="text-gray-500 text-sm mt-4 text-center">
                        {t('bu_islem_her_urun_sayfasini_ziyaret_eder')} {Math.ceil(products.length * 0.3 / 60)} dakika
                    </p>
                </div>

                {/* Back Link */}
                <div className="mt-6 text-center">
                    <Link href="/admin/imports/foodpaket" className="text-purple-400 hover:text-purple-300">
                        {t('foodpaket_import_a_don')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
