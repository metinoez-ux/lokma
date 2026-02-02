'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface Supplier {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    categories?: string[];
    // Delivery tracking
    deliveryDays?: string[]; // Haftalık geliş günleri
    avgDeliveryTime?: number; // Ortalama teslimat süresi (gün)
    // Banking
    bankName?: string;
    iban?: string;
    bic?: string;
    accountHolder?: string;
    paymentTerms?: string; // Ödeme vadesi (örn: 30 gün)
    notes?: string;
    isActive: boolean;
    createdAt?: Date;
}

export default function VendorSuppliersPage() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        whatsapp: '',
        address: '',
        categories: '',
        deliveryDays: [] as string[],
        avgDeliveryTime: '',
        bankName: '',
        iban: '',
        bic: '',
        accountHolder: '',
        paymentTerms: '',
        notes: '',
        isActive: true,
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

    // Load suppliers - TENANT SCOPED
    useEffect(() => {
        if (!businessId) return;

        const loadSuppliers = async () => {
            try {
                const q = query(collection(db, 'businesses', businessId, 'suppliers'));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Supplier[];
                setSuppliers(data);
            } catch (error) {
                console.error('Error loading suppliers:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSuppliers();
    }, [businessId]);

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const resetForm = () => {
        setFormData({
            name: '',
            contactPerson: '',
            email: '',
            phone: '',
            whatsapp: '',
            address: '',
            categories: '',
            deliveryDays: [],
            avgDeliveryTime: '',
            bankName: '',
            iban: '',
            bic: '',
            accountHolder: '',
            paymentTerms: '',
            notes: '',
            isActive: true,
        });
        setEditingSupplier(null);
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            name: supplier.name,
            contactPerson: supplier.contactPerson || '',
            email: supplier.email || '',
            phone: supplier.phone || '',
            whatsapp: supplier.whatsapp || '',
            address: supplier.address || '',
            categories: supplier.categories?.join(', ') || '',
            deliveryDays: supplier.deliveryDays || [],
            avgDeliveryTime: supplier.avgDeliveryTime?.toString() || '',
            bankName: supplier.bankName || '',
            iban: supplier.iban || '',
            bic: supplier.bic || '',
            accountHolder: supplier.accountHolder || '',
            paymentTerms: supplier.paymentTerms || '',
            notes: supplier.notes || '',
            isActive: supplier.isActive ?? true,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!businessId || !formData.name) {
            showToast('Toptancı adı zorunludur', 'error');
            return;
        }

        setSaving(true);
        try {
            const supplierData = {
                name: formData.name,
                contactPerson: formData.contactPerson || null,
                email: formData.email || null,
                phone: formData.phone || null,
                whatsapp: formData.whatsapp || null,
                address: formData.address || null,
                categories: formData.categories.split(',').map(c => c.trim()).filter(Boolean),
                deliveryDays: formData.deliveryDays.length > 0 ? formData.deliveryDays : null,
                avgDeliveryTime: formData.avgDeliveryTime ? parseInt(formData.avgDeliveryTime) : null,
                bankName: formData.bankName || null,
                iban: formData.iban || null,
                bic: formData.bic || null,
                accountHolder: formData.accountHolder || null,
                paymentTerms: formData.paymentTerms || null,
                notes: formData.notes || null,
                isActive: formData.isActive,
                updatedAt: new Date(),
            };

            if (editingSupplier) {
                await updateDoc(doc(db, 'businesses', businessId, 'suppliers', editingSupplier.id), supplierData);
                showToast('Toptancı güncellendi', 'success');
            } else {
                await addDoc(collection(db, 'businesses', businessId, 'suppliers'), {
                    ...supplierData,
                    createdAt: new Date(),
                });
                showToast('Toptancı eklendi', 'success');
            }

            setShowModal(false);
            resetForm();

            // Reload
            const q = query(collection(db, 'businesses', businessId, 'suppliers'));
            const snapshot = await getDocs(q);
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[]);
        } catch (error) {
            console.error('Error:', error);
            showToast('Kaydedilirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (supplier: Supplier) => {
        if (!businessId || !confirm(`"${supplier.name}" toptancısını silmek istiyor musunuz?`)) return;

        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'suppliers', supplier.id));
            setSuppliers(suppliers.filter(s => s.id !== supplier.id));
            showToast('Toptancı silindi', 'success');
        } catch (error) {
            console.error('Error:', error);
            showToast('Silinirken hata oluştu', 'error');
        }
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

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">🏭 Toptancılarım</h1>
                    <p className="text-gray-400">{suppliers.length} toptancı kayıtlı</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium"
                >
                    ➕ Toptancı Ekle
                </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <a href="/vendor/suppliers/orders" className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-4 text-center hover:from-blue-500 hover:to-blue-700 transition">
                    <span className="text-3xl block mb-2">📦</span>
                    <span className="text-white font-medium">Sipariş Oluştur</span>
                </a>
                <a href="/vendor/suppliers/history" className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-4 text-center hover:from-purple-500 hover:to-purple-700 transition">
                    <span className="text-3xl block mb-2">📋</span>
                    <span className="text-white font-medium">Sipariş Geçmişi</span>
                </a>
                <a href="/vendor/suppliers/pending" className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-xl p-4 text-center hover:from-orange-500 hover:to-orange-700 transition">
                    <span className="text-3xl block mb-2">⏳</span>
                    <span className="text-white font-medium">Bekleyen Siparişler</span>
                </a>
                <a href="/vendor/suppliers/analytics" className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-xl p-4 text-center hover:from-teal-500 hover:to-teal-700 transition">
                    <span className="text-3xl block mb-2">📊</span>
                    <span className="text-white font-medium">Harcama Analizi</span>
                </a>
            </div>

            {/* Search */}
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Toptancı ara..."
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                />
            </div>

            {/* Suppliers List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-4xl block mb-2">🏭</span>
                    <p className="text-gray-400 mb-4">Henüz toptancı eklenmemiş</p>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                        İlk Toptancını Ekle
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-white font-bold text-lg">{supplier.name}</h3>
                                    {supplier.contactPerson && (
                                        <p className="text-gray-400 text-sm">👤 {supplier.contactPerson}</p>
                                    )}
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${supplier.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                                    }`}>
                                    {supplier.isActive ? '✓ Aktif' : '✗ Pasif'}
                                </span>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-1 mb-4 text-sm">
                                {supplier.phone && (
                                    <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-gray-400 hover:text-white">
                                        📞 {supplier.phone}
                                    </a>
                                )}
                                {supplier.whatsapp && (
                                    <a href={`https://wa.me/${supplier.whatsapp.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-2 text-green-400 hover:text-green-300">
                                        💬 WhatsApp
                                    </a>
                                )}
                                {supplier.email && (
                                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-gray-400 hover:text-white">
                                        ✉️ {supplier.email}
                                    </a>
                                )}
                            </div>

                            {/* Categories */}
                            {supplier.categories && supplier.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {supplier.categories.map((cat, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Delivery Days */}
                            {supplier.deliveryDays && supplier.deliveryDays.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-gray-500 text-xs mb-1">🚚 Geliş Günleri:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {supplier.deliveryDays.map((day, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">
                                                {day.slice(0, 3)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bank Info Badge */}
                            {supplier.iban && (
                                <div className="mb-4 p-2 bg-gray-700/50 rounded-lg">
                                    <p className="text-gray-500 text-xs">🏦 {supplier.bankName || 'Banka'}</p>
                                    <p className="text-gray-400 text-xs font-mono">{supplier.iban.slice(0, 12)}...</p>
                                    {supplier.paymentTerms && (
                                        <p className="text-yellow-400 text-xs mt-1">
                                            💰 Vade: {supplier.paymentTerms.replace('_', ' ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                <a
                                    href={`/vendor/suppliers/orders?supplierId=${supplier.id}`}
                                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-center text-sm"
                                >
                                    📦 Sipariş Ver
                                </a>
                                <button
                                    onClick={() => handleEdit(supplier)}
                                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDelete(supplier)}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">
                                {editingSupplier ? '✏️ Toptancı Düzenle' : '➕ Yeni Toptancı'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Firma Adı *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="örn: TUNA Et Toptancısı"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">İlgili Kişi</label>
                                <input
                                    type="text"
                                    value={formData.contactPerson}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Telefon</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="+49..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">WhatsApp</label>
                                    <input
                                        type="tel"
                                        value={formData.whatsapp}
                                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="+49..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">E-posta</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Adres</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Kategoriler (virgülle ayırın)</label>
                                <input
                                    type="text"
                                    value={formData.categories}
                                    onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="Dana, Kuzu, Tavuk..."
                                />
                            </div>

                            {/* Delivery Section */}
                            <div className="border-t border-gray-700 pt-4 mt-4">
                                <h3 className="text-white font-bold mb-3">🚚 Teslimat Bilgileri</h3>

                                <div className="mb-3">
                                    <label className="block text-gray-400 text-sm mb-2">Haftalık Geliş Günleri</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(day => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                    const days = formData.deliveryDays.includes(day)
                                                        ? formData.deliveryDays.filter(d => d !== day)
                                                        : [...formData.deliveryDays, day];
                                                    setFormData({ ...formData, deliveryDays: days });
                                                }}
                                                className={`px-3 py-1 rounded-lg text-sm ${formData.deliveryDays.includes(day)
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-700 text-gray-400'
                                                    }`}
                                            >
                                                {day.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Ortalama Teslimat Süresi (gün)</label>
                                    <input
                                        type="number"
                                        value={formData.avgDeliveryTime}
                                        onChange={(e) => setFormData({ ...formData, avgDeliveryTime: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="örn: 2"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Banking Section */}
                            <div className="border-t border-gray-700 pt-4 mt-4">
                                <h3 className="text-white font-bold mb-3">🏦 Banka Bilgileri</h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Hesap Sahibi</label>
                                        <input
                                            type="text"
                                            value={formData.accountHolder}
                                            onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Banka</label>
                                        <input
                                            type="text"
                                            value={formData.bankName}
                                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            placeholder="örn: Sparkasse"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">IBAN</label>
                                        <input
                                            type="text"
                                            value={formData.iban}
                                            onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
                                            placeholder="DE89 3704 0044 0532 0130 00"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">BIC/SWIFT</label>
                                            <input
                                                type="text"
                                                value={formData.bic}
                                                onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })}
                                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
                                                placeholder="COBADEFFXXX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-sm mb-1">Ödeme Vadesi</label>
                                            <select
                                                value={formData.paymentTerms}
                                                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            >
                                                <option value="">Seçiniz...</option>
                                                <option value="pesin">Peşin</option>
                                                <option value="7_gun">7 Gün</option>
                                                <option value="14_gun">14 Gün</option>
                                                <option value="30_gun">30 Gün</option>
                                                <option value="45_gun">45 Gün</option>
                                                <option value="60_gun">60 Gün</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Notlar</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    rows={2}
                                    placeholder="Özel anlaşmalar, indirimler..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                <label htmlFor="isActive" className="text-white">Aktif Toptancı</label>
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
                                {saving ? 'Kaydediliyor...' : (editingSupplier ? 'Güncelle' : 'Ekle')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
