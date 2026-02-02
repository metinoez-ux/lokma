'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface Product {
    id: string;
    sku: string;
    name: string;
    category: string;
    price: number;
    unit: string;
    isActive: boolean;
    offerPrice?: number;
}

interface SelectedProduct {
    id: string;
    sku: string;
    name: string;
    originalPrice: number;
    offerPrice: number;
}

export default function OffersPage() {
    // Wizard steps
    const [step, setStep] = useState(1);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [campaignTitle, setCampaignTitle] = useState('');
    const [campaignMessage, setCampaignMessage] = useState('');
    const [sendPush, setSendPush] = useState(true);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // Mock butcherId - in real app, get from auth context
    const butcherId = 'demo-butcher-1';

    useEffect(() => {
        loadProducts();
        // Set default dates
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        setStartDate(today.toISOString().split('T')[0]);
        setEndDate(nextWeek.toISOString().split('T')[0]);
    }, []);

    const loadProducts = async () => {
        try {
            const q = query(
                collection(db, 'products'),
                where('businessId', '==', butcherId),
                where('isActive', '==', true)
            );
            const snapshot = await getDocs(q);
            const productList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];
            setProducts(productList);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleProductSelection = (product: Product) => {
        const isSelected = selectedProducts.some(p => p.id === product.id);

        if (isSelected) {
            setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
        } else {
            if (selectedProducts.length >= 5) {
                alert('En fazla 5 ürün seçebilirsiniz!');
                return;
            }
            setSelectedProducts(prev => [...prev, {
                id: product.id,
                sku: product.sku,
                name: product.name,
                originalPrice: product.price,
                offerPrice: Math.round(product.price * 0.85 * 100) / 100, // Default 15% discount
            }]);
        }
    };

    const updateOfferPrice = (productId: string, price: number) => {
        setSelectedProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, offerPrice: price } : p
        ));
    };

    const generateAIMessage = async () => {
        setGenerating(true);

        // Simulate AI generation
        await new Promise(resolve => setTimeout(resolve, 1500));

        const productNames = selectedProducts.map(p => p.name).join(', ');
        const maxDiscount = Math.max(...selectedProducts.map(p =>
            Math.round((1 - p.offerPrice / p.originalPrice) * 100)
        ));

        setCampaignTitle(`🔥 ${maxDiscount}% İndirim Fırsatı!`);
        setCampaignMessage(
            `📣 Özel kampanya başladı!\n\n` +
            `${productNames} ürünlerimizde %${maxDiscount}'e varan indirimler sizi bekliyor!\n\n` +
            `⏰ Kampanya ${new Date(endDate).toLocaleDateString('tr-TR')} tarihine kadar geçerli.\n\n` +
            `📍 Hemen MIRA uygulamasından sipariş verin!`
        );

        setGenerating(false);
    };

    const publishCampaign = async () => {
        setPublishing(true);

        try {
            // Create offer document
            await addDoc(collection(db, 'offers'), {
                businessId: butcherId,
                products: selectedProducts.map(p => ({
                    productId: p.id,
                    sku: p.sku,
                    name: p.name,
                    originalPrice: p.originalPrice,
                    offerPrice: p.offerPrice,
                })),
                startDate: Timestamp.fromDate(new Date(startDate)),
                endDate: Timestamp.fromDate(new Date(endDate)),
                title: campaignTitle,
                message: campaignMessage,
                isActive: true,
                pushSent: sendPush,
                createdAt: Timestamp.now(),
            });

            if (sendPush) {
                // TODO: Send push notification via FCM
                console.log('Would send push notification:', campaignTitle);
            }

            // Reset wizard
            setStep(6); // Success step
        } catch (error) {
            console.error('Error publishing campaign:', error);
            alert('Kampanya yayınlanırken hata oluştu!');
        } finally {
            setPublishing(false);
        }
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
                        }`}>
                        {step > s ? '✓' : s}
                    </div>
                    {s < 5 && (
                        <div className={`w-12 h-1 ${step > s ? 'bg-orange-500' : 'bg-gray-700'}`} />
                    )}
                </div>
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">📦 Ürün Seçimi</h2>
            <p className="text-gray-400 mb-6">İndirime koyacağınız ürünleri seçin (maks 5 ürün)</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => {
                    const isSelected = selectedProducts.some(p => p.id === product.id);
                    return (
                        <button
                            key={product.id}
                            onClick={() => toggleProductSelection(product)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${isSelected
                                ? 'border-orange-500 bg-orange-500/10'
                                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono text-blue-400">{product.sku}</span>
                                {isSelected && <span className="text-orange-500">✓</span>}
                            </div>
                            <h3 className="font-bold text-white">{product.name}</h3>
                            <p className="text-sm text-gray-400">{product.price.toFixed(2)}€/{product.unit}</p>
                        </button>
                    );
                })}
            </div>

            {products.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-400">
                    <p>Henüz aktif ürününüz yok.</p>
                    <Link href="/vendor-panel/products" className="text-orange-400 hover:underline">
                        Ürün eklemek için tıklayın
                    </Link>
                </div>
            )}

            <div className="mt-6 flex justify-between items-center">
                <p className="text-sm text-gray-400">
                    {selectedProducts.length}/5 ürün seçildi
                </p>
                <button
                    onClick={() => setStep(2)}
                    disabled={selectedProducts.length === 0}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                    Devam →
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">💰 İndirim Fiyatları</h2>
            <p className="text-gray-400 mb-6">Her ürün için indirimli fiyat belirleyin</p>

            <div className="space-y-4">
                {selectedProducts.map(product => {
                    const discount = Math.round((1 - product.offerPrice / product.originalPrice) * 100);
                    return (
                        <div key={product.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-mono text-blue-400">{product.sku}</span>
                                    <h3 className="font-bold text-white">{product.name}</h3>
                                    <p className="text-sm text-gray-500 line-through">
                                        Eski: {product.originalPrice.toFixed(2)}€
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">İndirimli Fiyat</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={product.offerPrice}
                                            onChange={(e) => updateOfferPrice(product.id, parseFloat(e.target.value) || 0)}
                                            className="w-24 bg-gray-700 border-2 border-orange-500 rounded-lg px-3 py-2 text-white font-bold text-right"
                                            title="İndirimli Fiyat"
                                        />
                                    </div>
                                    <div className="bg-red-500 text-white px-3 py-2 rounded-lg font-bold text-lg">
                                        -{discount}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(1)} className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600">
                    ← Geri
                </button>
                <button onClick={() => setStep(3)} className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold">
                    Devam →
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">📅 Kampanya Tarihleri</h2>
            <p className="text-gray-400 mb-6">Kampanyanın başlangıç ve bitiş tarihlerini seçin</p>

            <div className="grid grid-cols-2 gap-6 max-w-md">
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Başlangıç</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                        title="Başlangıç Tarihi"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Bitiş</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                        title="Bitiş Tarihi"
                    />
                </div>
            </div>

            <div className="mt-4 p-4 bg-gray-800 rounded-xl border border-gray-700">
                <p className="text-gray-400 text-sm">
                    📌 Kampanya <span className="text-orange-400 font-bold">
                        {new Date(startDate).toLocaleDateString('tr-TR')}
                    </span> tarihinde başlayıp <span className="text-orange-400 font-bold">
                        {new Date(endDate).toLocaleDateString('tr-TR')}
                    </span> tarihinde otomatik sona erecek.
                </p>
            </div>

            <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600">
                    ← Geri
                </button>
                <button onClick={() => setStep(4)} className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold">
                    Devam →
                </button>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">🤖 AI İlan Metni</h2>
            <p className="text-gray-400 mb-6">Yapay zeka ile kampanya mesajı oluşturun veya kendiniz yazın</p>

            <button
                onClick={generateAIMessage}
                disabled={generating}
                className="w-full mb-6 p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {generating ? (
                    <>
                        <span className="animate-spin">⏳</span>
                        AI Oluşturuyor...
                    </>
                ) : (
                    <>
                        ✨ AI ile Metin Oluştur
                    </>
                )}
            </button>

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Başlık</label>
                    <input
                        type="text"
                        value={campaignTitle}
                        onChange={(e) => setCampaignTitle(e.target.value)}
                        placeholder="örn: 🔥 Hafta Sonu İndirimi!"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                        title="Kampanya Başlığı"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Mesaj</label>
                    <textarea
                        value={campaignMessage}
                        onChange={(e) => setCampaignMessage(e.target.value)}
                        placeholder="Kampanya detaylarını yazın..."
                        rows={5}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white resize-none"
                        title="Kampanya Mesajı"
                    />
                </div>
            </div>

            <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(3)} className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600">
                    ← Geri
                </button>
                <button
                    onClick={() => setStep(5)}
                    disabled={!campaignTitle || !campaignMessage}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold disabled:opacity-50"
                >
                    Devam →
                </button>
            </div>
        </div>
    );

    const renderStep5 = () => (
        <div>
            <h2 className="text-2xl font-bold text-white mb-2">👀 Önizleme & Yayınla</h2>
            <p className="text-gray-400 mb-6">Kampanyanızı kontrol edin ve yayınlayın</p>

            {/* Preview Card */}
            <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-2xl p-6 border border-orange-500/30 mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{campaignTitle}</h3>
                <p className="text-gray-300 whitespace-pre-line mb-4">{campaignMessage}</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedProducts.map(product => (
                        <div key={product.id} className="bg-black/30 rounded-xl p-3">
                            <p className="text-xs text-gray-400">{product.sku}</p>
                            <p className="font-bold text-white text-sm">{product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-gray-500 line-through text-xs">{product.originalPrice.toFixed(2)}€</span>
                                <span className="text-orange-400 font-bold">{product.offerPrice.toFixed(2)}€</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Push notification toggle */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
                <label className="flex items-center justify-between cursor-pointer">
                    <div>
                        <p className="font-bold text-white">📲 Push Bildirim Gönder</p>
                        <p className="text-sm text-gray-400">Favori müşterilerinize bildirim gönderilsin</p>
                    </div>
                    <button
                        onClick={() => setSendPush(!sendPush)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${sendPush ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                    >
                        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${sendPush ? 'translate-x-7' : 'translate-x-1'
                            }`} />
                    </button>
                </label>
            </div>

            <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(4)} className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600">
                    ← Geri
                </button>
                <button
                    onClick={publishCampaign}
                    disabled={publishing}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 font-bold flex items-center gap-2 disabled:opacity-50"
                >
                    {publishing ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            Yayınlanıyor...
                        </>
                    ) : (
                        <>
                            🚀 Kampanyayı Yayınla
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div className="text-center py-12">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-6xl">🎉</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Kampanya Yayınlandı!</h2>
            <p className="text-gray-400 mb-8">
                {sendPush
                    ? 'Müşterilerinize bildirim gönderildi.'
                    : 'Kampanya aktif, müşterileriniz uygulamada görebilir.'}
            </p>
            <div className="flex gap-4 justify-center">
                <Link
                    href="/vendor-panel"
                    className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600"
                >
                    Panel'e Dön
                </Link>
                <button
                    onClick={() => {
                        setStep(1);
                        setSelectedProducts([]);
                        setCampaignTitle('');
                        setCampaignMessage('');
                    }}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold"
                >
                    Yeni Kampanya
                </button>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/vendor-panel" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
                        ← Vendor Panel
                    </Link>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        📣 İndirim Kampanyası Oluştur
                    </h1>
                </div>

                {/* Step Indicator */}
                {step < 6 && renderStepIndicator()}

                {/* Step Content */}
                <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                    {step === 5 && renderStep5()}
                    {step === 6 && renderSuccess()}
                </div>
            </div>
        </div>
    );
}
