'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface InventoryItem {
    id: string;
    productId?: string;
    productName: string;
    brand?: string; // Marke
    manufacturer?: string; // Hersteller
    barcode?: string;
    batchNumber?: string; // Charge numarası
    expiryDate?: string; // Son kullanma tarihi
    quantity: number;
    unit: string;
    purchasePrice?: number;
    supplierId?: string;
    supplierName?: string;
    receivedAt: Date;
    notes?: string;
    status: 'in_stock' | 'low' | 'expired' | 'used';
}

export default function VendorInventoryPage() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [scanMode, setScanMode] = useState(false);
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        productName: '',
        brand: '',
        manufacturer: '',
        barcode: '',
        batchNumber: '',
        expiryDate: '',
        quantity: '',
        unit: 'kg',
        purchasePrice: '',
        supplierId: '',
        notes: '',
    });

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Get business ID
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    setBusinessId(data.butcherId || data.businessId);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Load data
    useEffect(() => {
        if (!businessId) return;

        const loadData = async () => {
            try {
                // Load inventory
                const invQ = query(
                    collection(db, 'businesses', businessId, 'inventory'),
                    orderBy('receivedAt', 'desc')
                );
                const invSnapshot = await getDocs(invQ);
                const invData = invSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as InventoryItem[];

                // Check expiry status
                const today = new Date();
                const processedInv = invData.map(item => {
                    if (item.expiryDate) {
                        const expiry = new Date(item.expiryDate);
                        if (expiry < today) {
                            return { ...item, status: 'expired' as const };
                        }
                        // Warn 3 days before expiry
                        const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
                        if (expiry < threeDays) {
                            return { ...item, status: 'low' as const };
                        }
                    }
                    return item;
                });

                setInventory(processedInv);

                // Load products
                const prodQ = query(collection(db, 'businesses', businessId, 'products'));
                const prodSnapshot = await getDocs(prodQ);
                setProducts(prodSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

                // Load suppliers
                const supQ = query(collection(db, 'businesses', businessId, 'suppliers'));
                const supSnapshot = await getDocs(supQ);
                setSuppliers(supSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [businessId]);

    // Barcode scan handler
    const handleBarcodeScan = async (barcode: string) => {
        if (!barcode || !businessId) return;

        // Check if product exists with this barcode
        const existingProduct = products.find(p => p.barcode === barcode);

        if (existingProduct) {
            setFormData({
                ...formData,
                productName: existingProduct.name,
                barcode,
                unit: existingProduct.unit || 'kg',
            });
            showToast(`Ürün bulundu: ${existingProduct.name}`, 'success');
        } else {
            setFormData({ ...formData, barcode });
            showToast('Yeni ürün - bilgileri girin', 'success');
        }

        setShowModal(true);
        setScanMode(false);
    };

    // Keyboard barcode capture
    useEffect(() => {
        if (!scanMode) return;

        let barcodeBuffer = '';
        let lastKeyTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();

            // If more than 100ms between keystrokes, reset buffer
            if (now - lastKeyTime > 100) {
                barcodeBuffer = '';
            }
            lastKeyTime = now;

            if (e.key === 'Enter' && barcodeBuffer.length > 5) {
                handleBarcodeScan(barcodeBuffer);
                barcodeBuffer = '';
            } else if (e.key.length === 1) {
                barcodeBuffer += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scanMode, products, businessId]);

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = !searchQuery ||
            item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.barcode?.includes(searchQuery) ||
            item.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const resetForm = () => {
        setFormData({
            productName: '',
            brand: '',
            manufacturer: '',
            barcode: '',
            batchNumber: '',
            expiryDate: '',
            quantity: '',
            unit: 'kg',
            purchasePrice: '',
            supplierId: '',
            notes: '',
        });
        setEditingItem(null);
    };

    const handleEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setFormData({
            productName: item.productName,
            brand: item.brand || '',
            manufacturer: item.manufacturer || '',
            barcode: item.barcode || '',
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            quantity: item.quantity.toString(),
            unit: item.unit || 'kg',
            purchasePrice: item.purchasePrice?.toString() || '',
            supplierId: item.supplierId || '',
            notes: item.notes || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!businessId || !formData.productName || !formData.quantity) {
            showToast('Ürün adı ve miktar zorunlu', 'error');
            return;
        }

        setSaving(true);
        try {
            const supplier = suppliers.find(s => s.id === formData.supplierId);

            const itemData = {
                productName: formData.productName,
                brand: formData.brand || null,
                manufacturer: formData.manufacturer || null,
                barcode: formData.barcode || null,
                batchNumber: formData.batchNumber || null,
                expiryDate: formData.expiryDate || null,
                quantity: parseFloat(formData.quantity),
                unit: formData.unit,
                purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
                supplierId: formData.supplierId || null,
                supplierName: supplier?.name || null,
                status: 'in_stock',
                updatedAt: new Date(),
            };

            if (editingItem) {
                await updateDoc(doc(db, 'businesses', businessId, 'inventory', editingItem.id), itemData);
                showToast('Stok güncellendi', 'success');
            } else {
                await addDoc(collection(db, 'businesses', businessId, 'inventory'), {
                    ...itemData,
                    receivedAt: new Date(),
                });

                // If barcode provided, update product catalog
                if (formData.barcode) {
                    const existingProduct = products.find(p => p.barcode === formData.barcode);
                    if (!existingProduct) {
                        // Create new product in catalog
                        await addDoc(collection(db, 'businesses', businessId, 'products'), {
                            name: formData.productName,
                            barcode: formData.barcode,
                            unit: formData.unit,
                            price: 0, // To be set later
                            isAvailable: true,
                            createdAt: new Date(),
                        });
                        showToast('Stok eklendi + yeni ürün kataloğa kaydedildi', 'success');
                    } else {
                        showToast('Stok eklendi', 'success');
                    }
                } else {
                    showToast('Stok eklendi', 'success');
                }
            }

            setShowModal(false);
            resetForm();

            // Reload inventory
            const invQ = query(
                collection(db, 'businesses', businessId, 'inventory'),
                orderBy('receivedAt', 'desc')
            );
            const invSnapshot = await getDocs(invQ);
            setInventory(invSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as InventoryItem[]);
        } catch (error) {
            console.error('Error:', error);
            showToast('Kaydedilirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: InventoryItem) => {
        if (!businessId || !confirm(`"${item.productName}" stoğunu silmek istiyor musunuz?`)) return;

        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'inventory', item.id));
            setInventory(inventory.filter(i => i.id !== item.id));
            showToast('Stok silindi', 'success');
        } catch (error) {
            console.error('Error:', error);
            showToast('Silinirken hata oluştu', 'error');
        }
    };

    // Stats
    const stats = {
        total: inventory.length,
        expiringSoon: inventory.filter(i => i.status === 'low').length,
        expired: inventory.filter(i => i.status === 'expired').length,
    };

    return (
        <div className="p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                    {toast.message}
                </div>
            )}

            {/* Scan Mode Overlay */}
            {scanMode && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="text-6xl mb-4 animate-pulse">📷</div>
                        <h2 className="text-white text-2xl font-bold mb-2">Barkod Tarama Modu</h2>
                        <p className="text-gray-400 mb-4">Barkod okuyucuyu kullanın veya barkodu yazın</p>
                        <input
                            ref={barcodeInputRef}
                            type="text"
                            autoFocus
                            placeholder="Barkod numarası..."
                            className="px-6 py-3 bg-gray-800 text-white text-xl rounded-xl border border-gray-600 text-center"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleBarcodeScan((e.target as HTMLInputElement).value);
                                }
                            }}
                        />
                        <br />
                        <button
                            onClick={() => setScanMode(false)}
                            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl"
                        >
                            ✕ İptal
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">📦 Stok Yönetimi</h1>
                    <p className="text-gray-400">Ürün girişi, charge no, SKT takibi</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setScanMode(true)}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium"
                    >
                        📷 Barkod Tara
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium"
                    >
                        ➕ Stok Girişi
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Toplam Stok</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
                    <p className="text-yellow-400 text-sm">⚠️ SKT Yaklaşan</p>
                    <p className="text-2xl font-bold text-yellow-400">{stats.expiringSoon}</p>
                </div>
                <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 text-sm">❌ Tarihi Geçmiş</p>
                    <p className="text-2xl font-bold text-red-400">{stats.expired}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ürün, barkod veya charge no ara..."
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-xl border border-gray-600"
                />
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-xl border border-gray-600"
                >
                    <option value="all">Tüm Durumlar</option>
                    <option value="in_stock">✅ Stokta</option>
                    <option value="low">⚠️ SKT Yaklaşıyor</option>
                    <option value="expired">❌ Tarihi Geçmiş</option>
                </select>
            </div>

            {/* Inventory Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
            ) : filteredInventory.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-4xl block mb-2">📦</span>
                    <p className="text-gray-400">Stok kaydı bulunamadı</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-700/50 text-gray-400 text-sm">
                            <tr>
                                <th className="px-4 py-3">Ürün</th>
                                <th className="px-4 py-3">Barkod</th>
                                <th className="px-4 py-3">Charge No</th>
                                <th className="px-4 py-3">Miktar</th>
                                <th className="px-4 py-3">SKT</th>
                                <th className="px-4 py-3">Durum</th>
                                <th className="px-4 py-3">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredInventory.map(item => (
                                <tr key={item.id} className="hover:bg-gray-700/30">
                                    <td className="px-4 py-3">
                                        <p className="text-white font-medium">{item.productName}</p>
                                        {(item.brand || item.manufacturer) && (
                                            <p className="text-gray-500 text-xs">
                                                {item.brand && <span>🏷️ {item.brand}</span>}
                                                {item.brand && item.manufacturer && ' • '}
                                                {item.manufacturer && <span>🏭 {item.manufacturer}</span>}
                                            </p>
                                        )}
                                        {item.supplierName && (
                                            <p className="text-gray-500 text-xs">📦 {item.supplierName}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 font-mono text-sm">
                                        {item.barcode || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 font-mono text-sm">
                                        {item.batchNumber || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-white">
                                        {item.quantity} {item.unit}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.expiryDate ? (
                                            <span className={`${item.status === 'expired' ? 'text-red-400' :
                                                item.status === 'low' ? 'text-yellow-400' : 'text-gray-400'
                                                }`}>
                                                {new Date(item.expiryDate).toLocaleDateString('tr-TR')}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'expired' ? 'bg-red-600/20 text-red-400' :
                                            item.status === 'low' ? 'bg-yellow-600/20 text-yellow-400' :
                                                'bg-green-600/20 text-green-400'
                                            }`}>
                                            {item.status === 'expired' ? '❌ Geçmiş' :
                                                item.status === 'low' ? '⚠️ Yakın' : '✅ OK'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">
                                {editingItem ? '✏️ Stok Düzenle' : '📦 Yeni Stok Girişi'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Barcode */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Barkod</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
                                        placeholder="Barkod numarası"
                                    />
                                    <button
                                        onClick={() => {
                                            setShowModal(false);
                                            setScanMode(true);
                                        }}
                                        className="px-3 py-2 bg-purple-600 text-white rounded-lg"
                                    >
                                        📷
                                    </button>
                                </div>
                            </div>

                            {/* Product Name */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Ürün Adı *</label>
                                <input
                                    type="text"
                                    value={formData.productName}
                                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="örn: Dana Kıyma"
                                />
                            </div>

                            {/* Brand & Manufacturer */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">🏷️ Marke</label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="örn: TUNA"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">🏭 Hersteller</label>
                                    <input
                                        type="text"
                                        value={formData.manufacturer}
                                        onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="Üretici firma"
                                    />
                                </div>
                            </div>

                            {/* Batch & Expiry */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Charge No</label>
                                    <input
                                        type="text"
                                        value={formData.batchNumber}
                                        onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="LOT12345"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Son K. Tarihi</label>
                                    <input
                                        type="date"
                                        value={formData.expiryDate}
                                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    />
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-gray-400 text-sm mb-1">Miktar *</label>
                                    <input
                                        type="number"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        step="0.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Birim</label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    >
                                        <option value="kg">kg</option>
                                        <option value="adet">Adet</option>
                                        <option value="paket">Paket</option>
                                        <option value="koli">Koli</option>
                                    </select>
                                </div>
                            </div>

                            {/* Purchase Price */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Alış Fiyatı (€)</label>
                                <input
                                    type="number"
                                    value={formData.purchasePrice}
                                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    step="0.01"
                                />
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Toptancı</label>
                                <select
                                    value={formData.supplierId}
                                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                >
                                    <option value="">Seçiniz...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Not</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-700 flex gap-3">
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl"
                                disabled={saving}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : (editingItem ? 'Güncelle' : 'Kaydet')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
