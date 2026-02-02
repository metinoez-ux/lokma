'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { Supplier, SupplierCategory } from '@/types';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '@/services/supplierService';
import Link from 'next/link';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function SuppliersPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Supplier>>({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        category: 'meat',
        address: '',
        notes: ''
    });

    const categoryLabels: Record<SupplierCategory, string> = {
        meat: '🥩 Et',
        vegetable: '🥦 Sebze',
        packaging: '📦 Ambalaj',
        spices: '🧂 Baharat',
        other: '🔧 Diğer'
    };

    // Super admins can access global suppliers, others need butcherId
    const isSuperAdmin = admin?.adminType === 'super';
    const hasAccess = isSuperAdmin || admin?.butcherId;

    useEffect(() => {
        if (admin && hasAccess) {
            loadSuppliers();
        } else if (admin && !hasAccess) {
            setLoading(false);
        }
    }, [admin]);

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            // Super admins see global suppliers, others see their own
            const targetId = isSuperAdmin ? 'global' : admin?.butcherId || '';
            const data = await getSuppliers(targetId);
            setSuppliers(data);
        } catch (err) {
            console.error(err);
            setError('Tedarikçiler yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (supplier?: Supplier) => {
        if (supplier) {
            setEditingId(supplier.id);
            setFormData({
                name: supplier.name,
                contactName: supplier.contactName || '',
                phone: supplier.phone || '',
                email: supplier.email || '',
                category: supplier.category,
                address: supplier.address || '',
                notes: supplier.notes || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                contactName: '',
                phone: '',
                email: '',
                category: 'meat',
                address: '',
                notes: ''
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name) return;
        if (!hasAccess) return;

        setSaving(true);
        try {
            const targetId = isSuperAdmin ? 'global' : admin?.butcherId || '';
            if (editingId) {
                await updateSupplier(editingId, formData);
            } else {
                await addSupplier(targetId, formData);
            }
            setShowModal(false);
            loadSuppliers();
        } catch (err) {
            console.error(err);
            alert('Kaydetme başarısız');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu tedarikçiyi silmek istediğinize emin misiniz?')) return;
        try {
            await deleteSupplier(id);
            loadSuppliers();
        } catch (err) {
            console.error(err);
            alert('Silme başarısız');
        }
    };

    if (adminLoading) return <div className="p-8 text-white">Yükleniyor...</div>;

    if (!hasAccess) {
        return (
            <div className="p-8 text-white text-center">
                <h2 className="text-2xl font-bold mb-4">Yetki Yok</h2>
                <p>Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.</p>
                <div className="mt-4 p-4 bg-gray-800 rounded inline-block text-left text-sm text-gray-400">
                    <p>Debug Info:</p>
                    <p>Admin Type: {admin?.adminType}</p>
                    <p>Butcher ID: {admin?.butcherId || 'Yok'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <Link href="/admin/orders" className="text-gray-400 text-sm hover:text-white mb-2 inline-block">← Sipariş Paneline Dön</Link>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Tedarikçilerim</h1>
                        <p className="text-gray-400">Toptancı listenizi yönetin</p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/20 flex items-center gap-2"
                    >
                        <span>+</span> Yeni Tedarikçi
                    </button>
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Yükleniyor...</div>
                ) : suppliers.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-12 text-center">
                        <div className="text-4xl mb-4">🚛</div>
                        <h3 className="text-xl font-bold text-white mb-2">Henüz Tedarikçi Yok</h3>
                        <p className="text-gray-400 mb-6">İlk toptancınızı ekleyerek başlayın.</p>
                        <button onClick={() => handleOpenModal()} className="text-green-400 hover:text-green-300 underline">Şimdi Ekle</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suppliers.map(supplier => (
                            <div key={supplier.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-gray-700/50 p-3 rounded-lg text-2xl">
                                        {supplier.category === 'meat' ? '🥩' :
                                            supplier.category === 'vegetable' ? '🥦' :
                                                supplier.category === 'packaging' ? '📦' :
                                                    supplier.category === 'spices' ? '🧂' : '🔧'}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => handleOpenModal(supplier)} className="p-2 hover:bg-gray-700 rounded text-blue-400">✏️</button>
                                        <button onClick={() => handleDelete(supplier.id)} className="p-2 hover:bg-gray-700 rounded text-red-400">🗑️</button>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{supplier.name}</h3>
                                {supplier.companyName && <p className="text-sm text-gray-400 mb-4">{supplier.companyName}</p>}

                                <div className="space-y-2 text-sm text-gray-300">
                                    {supplier.contactName && (
                                        <div className="flex items-center gap-2">
                                            <span>👤</span> {supplier.contactName}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span>📱</span> {supplier.phone}
                                    </div>
                                    {supplier.email && (
                                        <div className="flex items-center gap-2">
                                            <span>✉️</span> {supplier.email}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">
                                {editingId ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi Ekle'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Tedarikçi Adı (Örn: Ahmet Et)</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                                    placeholder="Firma veya Kişi Adı"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Kategori</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value as SupplierCategory })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none"
                                    >
                                        {Object.entries(categoryLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Telefon (WhatsApp)</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none"
                                        placeholder="+49..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Yetkili Kişi (Opsiyonel)</label>
                                    <input
                                        type="text"
                                        value={formData.contactName}
                                        onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Email (Opsiyonel)</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Adres / Notlar</label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none"
                                    placeholder="Adres, banka bilgileri veya özel notlar..."
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-300 hover:text-white">İptal</button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold"
                            >
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
