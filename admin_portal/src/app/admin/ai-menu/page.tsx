'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, addDoc, setDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
// Gemini is called via server-side API route (/api/ai-menu/parse)

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface Business {
    id: string;
    name: string;
    city?: string;
    plz?: string;
}

interface ParsedOption {
    id: string;
    name: string;
    priceModifier: number;
    defaultSelected: boolean;
}

interface ParsedOptionGroup {
    id: string;
    name: string;
    type: 'radio' | 'checkbox';
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: ParsedOption[];
}

interface ParsedProduct {
    name: string;
    category: string;
    price: number;
    description: string;
    unit: string;
    optionGroups: ParsedOptionGroup[];
    _selected: boolean; // UI toggle
}

interface ParsedCategory {
    name: string;
    icon: string;
    _selected: boolean;
}

interface ParsedMenu {
    categories: ParsedCategory[];
    products: ParsedProduct[];
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const ACCEPTED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const CATEGORY_ICONS: Record<string, string> = {
    'Döner': '🥙', 'Kebap': '🍖', 'Pide': '🫓', 'Lahmacun': '🫓', 'Pizza': '🍕',
    'Salat': '🥗', 'Suppe': '🍲', 'Nachspeise': '🍰', 'Dessert': '🍰',
    'Getränke': '🥤', 'İçecek': '🥤', 'Vorspeise': '🥗', 'Başlangıç': '🥗',
    'Grill': '🔥', 'Burger': '🍔', 'Wrap': '🌯', 'Falafel': '🧆',
    'Pasta': '🍝', 'Reis': '🍚', 'Çorba': '🍲', 'Tatlı': '🍮',
    'Kahvaltı': '🍳', 'Frühstück': '🍳', 'Beilage': '🥗',
    'Et': '🥩', 'Tavuk': '🍗', 'Balık': '🐟', 'Fisch': '🐟',
    'Sebze': '🥬', 'Meze': '🫙', 'Börek': '🥟',
};

// AI prompt is now server-side only (see /api/ai-menu/parse/route.ts)

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function AIMenuPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const searchParams = useSearchParams();
    const urlBusinessId = searchParams.get('businessId');

    // ── State ────────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [files, setFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedMenu, setParsedMenu] = useState<ParsedMenu | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
    const [saveComplete, setSaveComplete] = useState(false);

    // AI Model selection
    const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
    const AI_MODELS = [
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'claude', group: 'Anthropic Claude' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude', group: 'Anthropic Claude' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude', group: 'Anthropic Claude' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'claude', group: 'Anthropic Claude' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', group: 'Google Gemini' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', group: 'Google Gemini' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', group: 'Google Gemini' },
    ];

    // Business selector
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [businessesLoading, setBusinessesLoading] = useState(false);
    const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(urlBusinessId);
    const [businessSearch, setBusinessSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // API Key is handled server-side — not exposed to client

    const isSuperAdmin = admin?.adminType === 'super';
    const butcherId = isSuperAdmin ? selectedBusinessId : admin?.butcherId;

    // ── Load Businesses ──────────────────────────────────────────
    useEffect(() => {
        if (!isSuperAdmin || adminLoading) return;
        setBusinessesLoading(true);
        const loadBusinesses = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'businesses'));
                console.log('[AI Menu] Loaded businesses:', snapshot.docs.length);
                const biz = snapshot.docs.map(d => {
                    const data = d.data();
                    const name = data.companyName || data.businessName || data.name || d.id;
                    return {
                        id: d.id,
                        name: String(name).trim() || d.id,
                        city: data.city || data.stadt || '',
                        plz: data.plz || data.zipCode || '',
                    };
                }) as Business[];
                setBusinesses(biz.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error('Error loading businesses:', err);
            } finally {
                setBusinessesLoading(false);
            }
        };
        loadBusinesses();
    }, [isSuperAdmin, adminLoading]);

    // ── File Handler ─────────────────────────────────────────────
    const handleFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
        const newFiles: File[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            const f = selectedFiles[i];
            if (!ACCEPTED_FILE_TYPES.includes(f.type)) {
                setError(`Desteklenmeyen dosya: ${f.name}`);
                continue;
            }
            newFiles.push(f);
        }
        if (newFiles.length === 0) return;
        setFiles(prev => [...prev, ...newFiles]);
        setError(null);

        // Generate previews for images
        newFiles.forEach(f => {
            if (f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setFilePreviews(prev => ({ ...prev, [f.name + f.size]: e.target?.result as string }));
                reader.readAsDataURL(f);
            }
        });
    }, []);

    const removeFile = useCallback((index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) handleFilesSelect(e.dataTransfer.files);
    }, [handleFilesSelect]);

    // ── AI Processing (via server-side API route) ─────────────────
    const processWithAI = async () => {
        if (files.length === 0) {
            setError('Lütfen en az bir dosya seçin.');
            return;
        }

        setProcessing(true);
        setError(null);
        setStep(2);

        try {
            const fileDataList: { data: string; mimeType: string }[] = [];
            let textContent = '';

            for (const file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    // Image or PDF → send as base64
                    const buffer = await file.arrayBuffer();
                    const base64 = btoa(
                        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    fileDataList.push({ data: base64, mimeType: file.type });
                } else {
                    // CSV / Excel → parse text first on client, send as text
                    if (file.type === 'text/csv') {
                        const Papa = (await import('papaparse')).default;
                        const text = await file.text();
                        const parsed = Papa.parse(text, { header: true });
                        textContent += JSON.stringify(parsed.data, null, 2) + '\n';
                    } else {
                        // Excel
                        const XLSX = await import('xlsx');
                        const buffer = await file.arrayBuffer();
                        const workbook = XLSX.read(buffer, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];
                        const data = XLSX.utils.sheet_to_json(sheet);
                        textContent += JSON.stringify(data, null, 2) + '\n';
                    }
                }
            }

            const requestBody: any = { model: selectedModel };
            if (fileDataList.length > 0) requestBody.files = fileDataList;
            if (textContent) requestBody.textContent = textContent;

            const response = await fetch('/api/ai-menu/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const responseText = await response.text();
            let result: any;
            try {
                result = JSON.parse(responseText);
            } catch {
                throw new Error(`Sunucu hatası: ${responseText.substring(0, 200)}`);
            }

            if (!response.ok) {
                throw new Error(result.error || 'Sunucu hatası');
            }

            const parsed = result.data as { categories: any[]; products: any[] };

            // Enrich with IDs and defaults
            const menu: ParsedMenu = {
                categories: (parsed.categories || []).map((cat: any, i: number) => ({
                    name: cat.name || `Kategori ${i + 1}`,
                    icon: cat.icon || CATEGORY_ICONS[cat.name] || '📦',
                    _selected: true,
                })),
                products: (parsed.products || []).map((prod: any, i: number) => ({
                    name: prod.name || `Ürün ${i + 1}`,
                    category: prod.category || '',
                    price: typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0,
                    description: prod.description || '',
                    unit: prod.unit || 'adet',
                    optionGroups: (prod.optionGroups || []).map((og: any, gi: number) => ({
                        id: `grp_${Date.now()}_${gi}`,
                        name: og.name || `Grup ${gi + 1}`,
                        type: og.type === 'checkbox' ? 'checkbox' : 'radio',
                        required: og.required ?? false,
                        minSelect: og.minSelect ?? (og.required ? 1 : 0),
                        maxSelect: og.maxSelect ?? (og.type === 'checkbox' ? -1 : 1),
                        options: (og.options || []).map((opt: any, oi: number) => ({
                            id: `opt_${Date.now()}_${gi}_${oi}`,
                            name: opt.name || `Seçenek ${oi + 1}`,
                            priceModifier: typeof opt.priceModifier === 'number' ? opt.priceModifier : 0,
                            defaultSelected: opt.defaultSelected ?? false,
                        })),
                    })),
                    _selected: true,
                })),
            };

            setParsedMenu(menu);
            setStep(3);
        } catch (err: any) {
            console.error('AI processing error:', err);
            setError(`AI işleme hatası: ${err.message || 'Bilinmeyen hata'}`);
            setStep(1);
        } finally {
            setProcessing(false);
        }
    };

    // ── Save to Firestore ────────────────────────────────────────
    const saveToFirestore = async () => {
        if (!butcherId || !parsedMenu) return;

        setSaving(true);
        setStep(4);
        setError(null);

        const selectedCategories = parsedMenu.categories.filter(c => c._selected);
        const selectedProducts = parsedMenu.products.filter(p => p._selected);
        const total = selectedCategories.length + selectedProducts.length;
        setSaveProgress({ current: 0, total });

        try {
            // 1) Save categories
            const categoriesRef = collection(db, `businesses/${butcherId}/categories`);
            const existingCatsSnap = await getDocs(query(categoriesRef, orderBy('order', 'asc')));
            const existingCatNames = new Set(existingCatsSnap.docs.map(d => d.data().name?.toLowerCase()));
            let orderCounter = existingCatsSnap.size;

            const categoryIdMap = new Map<string, string>(); // name -> docId

            for (const cat of selectedCategories) {
                if (existingCatNames.has(cat.name.toLowerCase())) {
                    // Category already exists, find its ID
                    const existingDoc = existingCatsSnap.docs.find(
                        d => d.data().name?.toLowerCase() === cat.name.toLowerCase()
                    );
                    if (existingDoc) categoryIdMap.set(cat.name, existingDoc.id);
                } else {
                    const catDoc = await addDoc(categoriesRef, {
                        name: cat.name,
                        icon: cat.icon,
                        order: orderCounter++,
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                    categoryIdMap.set(cat.name, catDoc.id);
                }
                setSaveProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }

            // 2) Save products
            const productsRef = collection(db, `businesses/${butcherId}/products`);

            for (const prod of selectedProducts) {
                const productData: any = {
                    name: prod.name,
                    category: prod.category,
                    price: prod.price,
                    description: prod.description,
                    unit: prod.unit || 'adet',
                    defaultUnit: prod.unit || 'adet',
                    isAvailable: true,
                    isActive: true,
                    optionGroups: prod.optionGroups.map(og => ({
                        id: og.id,
                        name: og.name,
                        type: og.type,
                        required: og.required,
                        minSelect: og.minSelect,
                        maxSelect: og.maxSelect,
                        options: og.options.map(opt => ({
                            id: opt.id,
                            name: opt.name,
                            priceModifier: opt.priceModifier,
                            defaultSelected: opt.defaultSelected,
                        })),
                    })),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    source: 'ai-menu-upload',
                };

                await addDoc(productsRef, productData);
                setSaveProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }

            setSaveComplete(true);
        } catch (err: any) {
            console.error('Firestore save error:', err);
            setError(`Kaydetme hatası: ${err.message || 'Bilinmeyen hata'}`);
        } finally {
            setSaving(false);
        }
    };

    // ── Edit Handlers ────────────────────────────────────────────
    const updateProduct = (index: number, updates: Partial<ParsedProduct>) => {
        if (!parsedMenu) return;
        const newProducts = [...parsedMenu.products];
        newProducts[index] = { ...newProducts[index], ...updates };
        setParsedMenu({ ...parsedMenu, products: newProducts });
    };

    const updateCategory = (index: number, updates: Partial<ParsedCategory>) => {
        if (!parsedMenu) return;
        const newCategories = [...parsedMenu.categories];
        newCategories[index] = { ...newCategories[index], ...updates };
        setParsedMenu({ ...parsedMenu, categories: newCategories });
    };

    const removeProduct = (index: number) => {
        if (!parsedMenu) return;
        const newProducts = parsedMenu.products.filter((_, i) => i !== index);
        setParsedMenu({ ...parsedMenu, products: newProducts });
    };

    const addProduct = () => {
        if (!parsedMenu) return;
        const newProd: ParsedProduct = {
            name: '',
            category: parsedMenu.categories[0]?.name || '',
            price: 0,
            description: '',
            unit: 'adet',
            optionGroups: [],
            _selected: true,
        };
        setParsedMenu({ ...parsedMenu, products: [...parsedMenu.products, newProd] });
    };

    const addOptionGroup = (productIndex: number) => {
        if (!parsedMenu) return;
        const newProducts = [...parsedMenu.products];
        const newGroup: ParsedOptionGroup = {
            id: `grp_${Date.now()}`,
            name: '',
            type: 'radio',
            required: false,
            minSelect: 0,
            maxSelect: 1,
            options: [],
        };
        newProducts[productIndex] = {
            ...newProducts[productIndex],
            optionGroups: [...newProducts[productIndex].optionGroups, newGroup],
        };
        setParsedMenu({ ...parsedMenu, products: newProducts });
    };

    const addOption = (productIndex: number, groupIndex: number) => {
        if (!parsedMenu) return;
        const newProducts = [...parsedMenu.products];
        const groups = [...newProducts[productIndex].optionGroups];
        const newOpt: ParsedOption = {
            id: `opt_${Date.now()}`,
            name: '',
            priceModifier: 0,
            defaultSelected: false,
        };
        groups[groupIndex] = {
            ...groups[groupIndex],
            options: [...groups[groupIndex].options, newOpt],
        };
        newProducts[productIndex] = { ...newProducts[productIndex], optionGroups: groups };
        setParsedMenu({ ...parsedMenu, products: newProducts });
    };

    // ── Computed ──────────────────────────────────────────────────
    const selectedProductCount = parsedMenu?.products.filter(p => p._selected).length ?? 0;
    const selectedCategoryCount = parsedMenu?.categories.filter(c => c._selected).length ?? 0;
    const filteredBusinesses = businesses.filter(b => {
        const searchTerms = businessSearch.toLowerCase().trim().split(/\s+/);
        const haystack = `${b.name} ${b.city} ${b.plz} ${b.id}`.toLowerCase();
        return searchTerms.every(term => haystack.includes(term));
    });
    const selectedBusiness = businesses.find(b => b.id === selectedBusinessId);

    // ══════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Sadece Super Admin</h2>
                    <p className="text-gray-400 mt-2">Bu özellik yalnızca Super Admin yetkisiyle kullanılabilir.</p>
                    <Link href="/admin/dashboard" className="mt-4 inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">
                        Dashboard&apos;a Git
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* ═══ Header ═══ */}
            <header className="bg-gradient-to-r from-cyan-800 via-teal-800 to-emerald-800 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🤖</span>
                            <div>
                                <h1 className="text-xl font-bold">AI Menü Yükleme</h1>
                                <p className="text-teal-200 text-sm">Menü dosyası yükle → AI ile parse et → Onayla & Kaydet</p>
                            </div>
                        </div>
                        {/* Step Indicator */}
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className="flex items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step === s ? 'bg-white text-teal-800 scale-110' :
                                        step > s ? 'bg-teal-500 text-white' :
                                            'bg-teal-900/50 text-teal-400'
                                        }`}>
                                        {step > s ? '✓' : s}
                                    </div>
                                    {s < 4 && <div className={`w-6 h-0.5 ${step > s ? 'bg-teal-500' : 'bg-teal-900/50'}`} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* ═══ Error Banner ═══ */}
                {error && (
                    <div className="mb-6 bg-red-900/50 border border-red-600 rounded-xl p-4 flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div className="flex-1">
                            <p className="text-red-200 font-medium">{error}</p>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 text-xl">×</button>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    STEP 1: Upload
                ═══════════════════════════════════════════════════════════ */}
                {step === 1 && (
                    <div className="space-y-6">
                        {/* Business Selector */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                🏪 İşletme Seçin
                                {businesses.length > 0 && (
                                    <span className="text-xs text-gray-500 font-normal">({businesses.length} işletme)</span>
                                )}
                            </h2>

                            {selectedBusiness ? (
                                <div className="flex items-center gap-3 bg-teal-900/30 border border-teal-700 rounded-lg px-4 py-3">
                                    <span className="text-lg">✅</span>
                                    <span className="text-teal-200 font-medium">{selectedBusiness.name}</span>
                                    {selectedBusiness.city && <span className="text-teal-400 text-sm">• {selectedBusiness.plz} {selectedBusiness.city}</span>}
                                    <button onClick={() => { setSelectedBusinessId(null); setShowDropdown(true); }} className="ml-auto text-teal-400 hover:text-teal-200 text-sm">Değiştir</button>
                                </div>
                            ) : businessesLoading ? (
                                <div className="flex items-center gap-3 text-gray-400 py-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
                                    <span className="text-sm">İşletmeler yükleniyor...</span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={businessSearch}
                                        onChange={e => setBusinessSearch(e.target.value)}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder={businesses.length > 0 ? `İşletme ara... (${businesses.length} işletme)` : 'İşletmeler yükleniyor...'}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-teal-500 text-sm"
                                    />
                                    {showDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg max-h-60 overflow-y-auto z-50 shadow-xl">
                                            {filteredBusinesses.length > 0 ? (
                                                filteredBusinesses.slice(0, 50).map(biz => (
                                                    <button
                                                        key={biz.id}
                                                        onClick={() => {
                                                            setSelectedBusinessId(biz.id);
                                                            setBusinessSearch('');
                                                            setShowDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-600 transition text-sm text-white border-b border-gray-600/50 last:border-0"
                                                    >
                                                        <span className="font-medium">{biz.name}</span>
                                                        {(biz.city || biz.plz) && <span className="text-gray-400 ml-2">• {biz.plz} {biz.city}</span>}
                                                        <span className="text-gray-500 ml-2 text-xs">({biz.id})</span>
                                                    </button>
                                                ))
                                            ) : businesses.length === 0 ? (
                                                <div className="px-4 py-3 text-gray-400 text-sm">İşletme bulunamadı. Yükleniyor olabilir...</div>
                                            ) : (
                                                <div className="px-4 py-3 text-gray-400 text-sm">"{businessSearch}" için sonuç bulunamadı.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* API Key — handled server-side, no input needed */}

                        {/* File Upload */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                📄 Menü Dosyaları
                                {files.length > 0 && <span className="text-xs text-gray-500 font-normal">({files.length} dosya)</span>}
                            </h2>

                            {/* Selected files list */}
                            {files.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {files.map((f, i) => (
                                        <div key={f.name + f.size + i} className="flex items-center gap-3 bg-gray-700/50 rounded-lg px-4 py-2">
                                            {filePreviews[f.name + f.size] ? (
                                                <img src={filePreviews[f.name + f.size]} alt="" className="w-12 h-12 object-cover rounded" />
                                            ) : (
                                                <span className="text-2xl">{f.type.startsWith('image/') ? '🖼️' : f.type.includes('pdf') ? '📄' : '📊'}</span>
                                            )}
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-teal-200 font-medium text-sm truncate">{f.name}</p>
                                                <p className="text-gray-400 text-xs">{(f.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-red-400 hover:text-red-300 text-lg">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Drop zone / Add more */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                                className={`relative border-2 border-dashed rounded-xl ${files.length > 0 ? 'p-6' : 'p-12'} text-center transition-all cursor-pointer ${files.length > 0 ? 'border-teal-500/50 bg-teal-900/10 hover:bg-teal-900/20' : 'border-gray-600 hover:border-teal-500 hover:bg-gray-700/50'
                                    }`}
                                onClick={() => document.getElementById('ai-menu-file-input')?.click()}
                            >
                                <input
                                    id="ai-menu-file-input"
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xlsx,.xls"
                                    multiple
                                    onChange={e => e.target.files && e.target.files.length > 0 && handleFilesSelect(e.target.files)}
                                    className="hidden"
                                />
                                {files.length > 0 ? (
                                    <div className="space-y-1">
                                        <span className="text-2xl">➕</span>
                                        <p className="text-gray-400 text-sm">Daha fazla dosya eklemek için tıklayın veya sürükleyin</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <span className="text-5xl">📤</span>
                                        <p className="text-gray-300 font-medium">Menü dosyalarını sürükleyip bırakın</p>
                                        <p className="text-gray-500 text-sm">Birden fazla dosya seçebilirsiniz</p>
                                        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                                            {['PDF', 'JPG', 'PNG', 'CSV', 'Excel'].map(fmt => (
                                                <span key={fmt} className="px-3 py-1 bg-gray-700 rounded-full text-gray-400 text-xs">{fmt}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Model Selector */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                🧠 AI Model Seçimi
                            </h2>
                            <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm font-medium focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                            >
                                {['Anthropic Claude', 'Google Gemini'].map(group => (
                                    <optgroup key={group} label={group}>
                                        {AI_MODELS.filter(m => m.group === group).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        {/* Process Button */}
                        <button
                            onClick={processWithAI}
                            disabled={files.length === 0 || !butcherId}
                            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                        >
                            <span className="text-2xl">🤖</span>
                            {AI_MODELS.find(m => m.id === selectedModel)?.name || 'AI'} ile Menüyü Analiz Et
                        </button>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    STEP 2: Processing
                ═══════════════════════════════════════════════════════════ */}
                {step === 2 && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center animate-pulse">
                                <span className="text-4xl">🤖</span>
                            </div>
                            <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-teal-400/30 animate-spin border-t-teal-400"></div>
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-white">Menü Analiz Ediliyor...</h2>
                            <p className="text-gray-400">{AI_MODELS.find(m => m.id === selectedModel)?.name || 'AI'} menünüzü okuyor ve yapılandırıyor</p>
                            <p className="text-gray-500 text-sm">Bu işlem birkaç saniye sürebilir</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></span> Dosya okunuyor</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></span> AI işliyor</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></span> Yapılandırılıyor</span>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    STEP 3: Preview & Edit
                ═══════════════════════════════════════════════════════════ */}
                {step === 3 && parsedMenu && (
                    <div className="space-y-6">
                        {/* Summary Bar */}
                        <div className="bg-gradient-to-r from-teal-900/50 to-cyan-900/50 border border-teal-700 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-6">
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-teal-300">{parsedMenu.categories.length}</p>
                                    <p className="text-gray-400 text-xs">Kategori</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-cyan-300">{parsedMenu.products.length}</p>
                                    <p className="text-gray-400 text-xs">Ürün</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-emerald-300">
                                        {parsedMenu.products.reduce((sum, p) => sum + p.optionGroups.length, 0)}
                                    </p>
                                    <p className="text-gray-400 text-xs">Seçenek Grubu</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setStep(1); setParsedMenu(null); setFiles([]); }}
                                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition text-sm"
                                >
                                    ← Yeniden Yükle
                                </button>
                                <button
                                    onClick={addProduct}
                                    className="px-4 py-2 bg-teal-700 text-teal-200 rounded-lg hover:bg-teal-600 transition text-sm"
                                >
                                    + Ürün Ekle
                                </button>
                            </div>
                        </div>

                        {/* Categories Section */}
                        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                🗂️ Kategoriler
                                <span className="text-gray-500 text-sm font-normal">({selectedCategoryCount} seçili)</span>
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {parsedMenu.categories.map((cat, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition cursor-pointer ${cat._selected
                                            ? 'bg-teal-900/40 border-teal-600 text-white'
                                            : 'bg-gray-900/50 border-gray-700 text-gray-500 opacity-60'
                                            }`}
                                        onClick={() => updateCategory(i, { _selected: !cat._selected })}
                                    >
                                        <span className="text-xl">{cat.icon}</span>
                                        <input
                                            type="text"
                                            value={cat.name}
                                            onChange={e => { e.stopPropagation(); updateCategory(i, { name: e.target.value }); }}
                                            onClick={e => e.stopPropagation()}
                                            className="bg-transparent border-none outline-none text-sm font-medium w-24 min-w-0"
                                        />
                                        <span className="text-xs text-gray-500">
                                            {parsedMenu.products.filter(p => p.category === cat.name).length} ürün
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Products Section — grouped by category */}
                        {parsedMenu.categories.filter(c => c._selected).map((cat, catIdx) => {
                            const catProducts = parsedMenu.products
                                .map((p, origIdx) => ({ ...p, _origIdx: origIdx }))
                                .filter(p => p.category === cat.name);

                            if (catProducts.length === 0) return null;

                            return (
                                <div key={catIdx} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                                    <div className="bg-gray-750 px-5 py-3 border-b border-gray-700 flex items-center gap-2">
                                        <span className="text-xl">{cat.icon}</span>
                                        <h3 className="text-white font-bold">{cat.name}</h3>
                                        <span className="text-gray-500 text-sm ml-2">({catProducts.length} ürün)</span>
                                    </div>

                                    <div className="divide-y divide-gray-700/50">
                                        {catProducts.map((prod) => (
                                            <div
                                                key={prod._origIdx}
                                                className={`p-4 transition ${prod._selected ? '' : 'opacity-40'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Toggle */}
                                                    <button
                                                        onClick={() => updateProduct(prod._origIdx, { _selected: !prod._selected })}
                                                        className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition ${prod._selected ? 'bg-teal-600 border-teal-500 text-white' : 'border-gray-600 text-transparent'
                                                            }`}
                                                    >
                                                        ✓
                                                    </button>

                                                    {/* Product Info */}
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="text"
                                                                value={prod.name}
                                                                onChange={e => updateProduct(prod._origIdx, { name: e.target.value })}
                                                                className="bg-transparent border-none outline-none text-white font-semibold text-sm flex-1"
                                                                placeholder="Ürün adı..."
                                                            />
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <input
                                                                    type="number"
                                                                    value={prod.price}
                                                                    onChange={e => updateProduct(prod._origIdx, { price: parseFloat(e.target.value) || 0 })}
                                                                    className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-right text-teal-300 font-bold text-sm"
                                                                    step="0.10"
                                                                />
                                                                <span className="text-gray-500 text-sm">€</span>
                                                            </div>
                                                        </div>

                                                        {/* Description */}
                                                        <input
                                                            type="text"
                                                            value={prod.description}
                                                            onChange={e => updateProduct(prod._origIdx, { description: e.target.value })}
                                                            className="bg-transparent border-none outline-none text-gray-400 text-xs w-full"
                                                            placeholder="Açıklama..."
                                                        />

                                                        {/* Option Groups */}
                                                        {prod.optionGroups.length > 0 && (
                                                            <div className="space-y-2 mt-2">
                                                                {prod.optionGroups.map((og, gIdx) => (
                                                                    <div key={gIdx} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <span className="text-xs text-gray-600">{og.type === 'radio' ? '🔘' : '☑️'}</span>
                                                                            <input
                                                                                type="text"
                                                                                value={og.name}
                                                                                onChange={e => {
                                                                                    const newProducts = [...parsedMenu.products];
                                                                                    const groups = [...newProducts[prod._origIdx].optionGroups];
                                                                                    groups[gIdx] = { ...groups[gIdx], name: e.target.value };
                                                                                    newProducts[prod._origIdx] = { ...newProducts[prod._origIdx], optionGroups: groups };
                                                                                    setParsedMenu({ ...parsedMenu, products: newProducts });
                                                                                }}
                                                                                className="bg-transparent border-none outline-none text-gray-300 text-xs font-medium flex-1"
                                                                                placeholder="Grup adı..."
                                                                            />
                                                                            {og.required && <span className="text-red-400 text-[10px]">zorunlu</span>}
                                                                            <button
                                                                                onClick={() => addOption(prod._origIdx, gIdx)}
                                                                                className="text-teal-400 hover:text-teal-300 text-[10px]"
                                                                            >
                                                                                + seçenek
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newProducts = [...parsedMenu.products];
                                                                                    const groups = [...newProducts[prod._origIdx].optionGroups];
                                                                                    groups.splice(gIdx, 1);
                                                                                    newProducts[prod._origIdx] = { ...newProducts[prod._origIdx], optionGroups: groups };
                                                                                    setParsedMenu({ ...parsedMenu, products: newProducts });
                                                                                }}
                                                                                className="text-red-400 hover:text-red-300 text-[10px]"
                                                                                title="Grubu sil"
                                                                            >
                                                                                🗑
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {og.options.map((opt, oIdx) => (
                                                                                <div key={oIdx} className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 group/opt">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={opt.name}
                                                                                        onChange={e => {
                                                                                            const newProducts = [...parsedMenu.products];
                                                                                            const groups = [...newProducts[prod._origIdx].optionGroups];
                                                                                            const options = [...groups[gIdx].options];
                                                                                            options[oIdx] = { ...options[oIdx], name: e.target.value };
                                                                                            groups[gIdx] = { ...groups[gIdx], options };
                                                                                            newProducts[prod._origIdx] = { ...newProducts[prod._origIdx], optionGroups: groups };
                                                                                            setParsedMenu({ ...parsedMenu, products: newProducts });
                                                                                        }}
                                                                                        className="bg-transparent border-none outline-none text-gray-300 text-[11px] w-20"
                                                                                        placeholder="Seçenek..."
                                                                                    />
                                                                                    {opt.priceModifier !== 0 && (
                                                                                        <span className="text-teal-400 text-[10px]">
                                                                                            {opt.priceModifier > 0 ? '+' : ''}{opt.priceModifier.toFixed(2)}€
                                                                                        </span>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const newProducts = [...parsedMenu.products];
                                                                                            const groups = [...newProducts[prod._origIdx].optionGroups];
                                                                                            const options = [...groups[gIdx].options];
                                                                                            options.splice(oIdx, 1);
                                                                                            groups[gIdx] = { ...groups[gIdx], options };
                                                                                            newProducts[prod._origIdx] = { ...newProducts[prod._origIdx], optionGroups: groups };
                                                                                            setParsedMenu({ ...parsedMenu, products: newProducts });
                                                                                        }}
                                                                                        className="text-red-400/50 hover:text-red-300 text-[10px] opacity-0 group-hover/opt:opacity-100 transition-opacity ml-0.5"
                                                                                        title="Seçeneği sil"
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Quick Actions */}
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button
                                                                onClick={() => addOptionGroup(prod._origIdx)}
                                                                className="text-[11px] text-teal-400 hover:text-teal-300"
                                                            >
                                                                + Seçenek Grubu
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => removeProduct(prod._origIdx)}
                                                        className="text-red-400 hover:text-red-300 text-sm mt-1"
                                                        title="Sil"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Approve Button */}
                        <button
                            onClick={saveToFirestore}
                            disabled={selectedProductCount === 0}
                            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                        >
                            <span className="text-2xl">✅</span>
                            Onayla & Kaydet ({selectedCategoryCount} kategori, {selectedProductCount} ürün)
                        </button>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    STEP 4: Saving / Complete
                ═══════════════════════════════════════════════════════════ */}
                {step === 4 && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-8">
                        {saving ? (
                            <>
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                    <span className="text-4xl animate-bounce">💾</span>
                                </div>
                                <div className="text-center space-y-2">
                                    <h2 className="text-2xl font-bold text-white">Kaydediliyor...</h2>
                                    <p className="text-gray-400">
                                        {saveProgress.current} / {saveProgress.total} öğe
                                    </p>
                                </div>
                                <div className="w-full max-w-md bg-gray-800 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${saveProgress.total > 0 ? (saveProgress.current / saveProgress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </>
                        ) : saveComplete ? (
                            <>
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                                    <span className="text-5xl">🎉</span>
                                </div>
                                <div className="text-center space-y-2">
                                    <h2 className="text-2xl font-bold text-white">Menü Başarıyla Kaydedildi!</h2>
                                    <p className="text-gray-400">
                                        {selectedCategoryCount} kategori ve {selectedProductCount} ürün eklendi
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => {
                                            setStep(1);
                                            setParsedMenu(null);
                                            setFiles([]);
                                            setSaveComplete(false);
                                        }}
                                        className="px-6 py-3 bg-teal-700 text-white rounded-xl hover:bg-teal-600 transition font-medium"
                                    >
                                        🤖 Yeni Menü Yükle
                                    </button>
                                    <Link
                                        href={`/admin/categories?businessId=${butcherId}`}
                                        className="px-6 py-3 bg-violet-700 text-white rounded-xl hover:bg-violet-600 transition font-medium"
                                    >
                                        🗂️ Kategorileri Gör
                                    </Link>
                                    <Link
                                        href="/admin/products"
                                        className="px-6 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-600 transition font-medium"
                                    >
                                        📋 Ürünleri Gör
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <p className="text-red-400 text-lg">Bir hata oluştu.</p>
                                <button
                                    onClick={() => setStep(3)}
                                    className="mt-4 px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
                                >
                                    ← Geri Dön
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

// Wrapper with Suspense for useSearchParams (Next.js 16+)
export default function AIMenuPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        }>
            <AIMenuPageContent />
        </Suspense>
    );
}
