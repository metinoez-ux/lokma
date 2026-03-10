'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Deal {
    id: string;
    title: string;
    description: string;
    discountType: 'percent' | 'fixed' | 'freeDelivery' | 'buyXGetY' | 'cashback' | 'bundleDeal' | 'flashSale' | 'productDiscount' | 'cartBooster';
    discountValue: number;
    buyX?: number;       // BOGO: X adet al
    getY?: number;       // BOGO: Y adet bedava
    minOrderAmount?: number;  // Sepet büyütücü / min sipariş
    targetProductId?: string; // Ürün bazlı indirim
    businessIds: string[];
    targetAudience: 'all' | 'new' | 'returning' | 'vip';
    validFrom: string;
    validUntil: string;
    isActive: boolean;
    imageUrl?: string;
    createdAt?: any;
}

interface Props {
    businessId: string | null;
    isSuperAdmin: boolean;
    businesses: { id: string; name: string }[];
    deals: Deal[];
    setDeals: (d: Deal[]) => void;
    loaded: boolean;
    setLoaded: (b: boolean) => void;
    setAllBusinesses: (b: { id: string; name: string }[]) => void;
}

const defaultDeal: Omit<Deal, 'id'> = {
    title: '',
    description: '',
    discountType: 'percent',
    discountValue: 10,
    businessIds: [],
    targetAudience: 'all',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    isActive: true,
};

export default function DealsTab({ businessId, isSuperAdmin, businesses, deals, setDeals, loaded, setLoaded, setAllBusinesses }: Props) {
    const [loading, setLoading] = useState(!loaded);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Deal | null>(null);
    const [form, setForm] = useState<Omit<Deal, 'id'>>(defaultDeal);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null);

    useEffect(() => {
        if (loaded) return;
        const load = async () => {
            setLoading(true);
            try {
                // C-6: Read from businesses/{id}/promotions instead of standalone 'deals' collection
                if (businessId) {
                    // Business admin: only their own deals
                    const snap = await getDocs(query(
                        collection(db, 'businesses', businessId, 'promotions'),
                        where('sourceType', '==', 'deal'),
                        orderBy('createdAt', 'desc')
                    ));
                    setDeals(snap.docs.map(d => ({ id: d.id, businessIds: [businessId], ...d.data() } as Deal)));
                } else if (isSuperAdmin) {
                    // Super Admin: fallback to legacy deals collection for visibility
                    const snap = await getDocs(query(collection(db, 'deals'), orderBy('createdAt', 'desc')));
                    setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal)));
                }

                if (isSuperAdmin && businesses.length === 0) {
                    const bizSnap = await getDocs(query(collection(db, 'businesses'), where('isActive', '==', true)));
                    setAllBusinesses(bizSnap.docs.map(d => ({ id: d.id, name: (d.data().name as any)?.tr || (d.data().name as string) || d.id })));
                }
            } catch (e) {
                console.error('DealsTab load error:', e);
            }
            setLoading(false);
            setLoaded(true);
        };
        load();
    }, []);

    const openAdd = () => { setEditing(null); setForm({ ...defaultDeal, businessIds: businessId ? [businessId] : [] }); setShowModal(true); };
    const openEdit = (d: Deal) => { setEditing(d); setForm({ title: d.title, description: d.description, discountType: d.discountType, discountValue: d.discountValue, businessIds: d.businessIds, targetAudience: d.targetAudience, validFrom: d.validFrom, validUntil: d.validUntil, isActive: d.isActive }); setShowModal(true); };

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            // C-6: Write to businesses/{id}/promotions for each target business
            const promoData = {
                ...form,
                sourceType: 'deal', // marks this as a deal-originated promotion
                type: form.discountType === 'percent' ? 'percentOff' : form.discountType === 'fixed' ? 'fixedDiscount' : form.discountType,
                value: form.discountValue,
                valueType: form.discountType === 'percent' ? 'percent' : 'fixed',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            if (editing) {
                // Update in all target businesses
                for (const bizId of form.businessIds) {
                    try {
                        await updateDoc(doc(db, 'businesses', bizId, 'promotions', editing.id), promoData);
                    } catch {
                        // If doc doesn't exist in this business, create it
                        await addDoc(collection(db, 'businesses', bizId, 'promotions'), promoData);
                    }
                }
                // Also keep legacy deals collection in sync
                await updateDoc(doc(db, 'deals', editing.id), { ...form }).catch(() => { });
                setDeals(deals.map(d => d.id === editing.id ? { ...d, ...form } : d));
            } else {
                let firstId = '';
                for (const bizId of form.businessIds) {
                    const ref = await addDoc(collection(db, 'businesses', bizId, 'promotions'), promoData);
                    if (!firstId) firstId = ref.id;
                }
                // Also write to legacy deals collection for Super Admin visibility
                const legacyRef = await addDoc(collection(db, 'deals'), { ...form, createdAt: new Date() });
                setDeals([{ id: legacyRef.id, ...form }, ...deals]);
            }
            setShowModal(false);
        } catch (e) {
            console.error('Deal save error:', e);
        }
        setSaving(false);
    };

    const handleDelete = async (deal: Deal) => {
        await deleteDoc(doc(db, 'deals', deal.id));
        setDeals(deals.filter(d => d.id !== deal.id));
        setConfirmDelete(null);
    };

    const toggleActive = async (deal: Deal) => {
        await updateDoc(doc(db, 'deals', deal.id), { isActive: !deal.isActive });
        setDeals(deals.map(d => d.id === deal.id ? { ...d, isActive: !d.isActive } : d));
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-white font-bold text-lg">🔥 Fırsatlar</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Global veya işletmeye özel fırsatlar oluşturun</p>
                </div>
                <button
                    onClick={openAdd}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition"
                >
                    + Fırsat Ekle
                </button>
            </div>

            {deals.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-5xl">🔥</span>
                    <h3 className="text-lg font-medium text-white mt-4">Henüz fırsat yok</h3>
                    <p className="text-gray-400 mt-2">Müşterilerinizi cezbeden fırsatlar oluşturun!</p>
                    <p className="text-gray-500 text-sm mt-3">Sağ üstteki <span className="text-amber-400 font-medium">+ Fırsat Ekle</span> butonunu kullanın</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {deals.map(deal => (
                        <div key={deal.id} className={`bg-gray-800 rounded-xl overflow-hidden border ${deal.isActive ? 'border-amber-800/50' : 'border-gray-700 opacity-70'}`}>
                            <div className={`px-4 py-3 flex items-center justify-between ${deal.isActive ? 'bg-amber-900/20' : 'bg-gray-800'}`}>
                                <div>
                                    <h3 className="text-white font-semibold">{deal.title}</h3>
                                    <span className="text-xs text-gray-400">{deal.discountType === 'percent' ? `%${deal.discountValue}` : deal.discountType === 'fixed' ? `€${deal.discountValue}` : deal.discountType === 'freeDelivery' ? 'Ücretsiz Teslimat' : deal.discountType === 'buyXGetY' ? `${deal.buyX || 1} Al ${deal.getY || 1} Bedava` : deal.discountType === 'cashback' ? `€${deal.discountValue} Cashback` : deal.discountType === 'flashSale' ? `⚡ %${deal.discountValue}` : deal.discountType === 'cartBooster' ? `€${deal.minOrderAmount}+ → €${deal.discountValue} hediye` : `${deal.discountType}`} · {deal.targetAudience === 'all' ? 'Herkese' : deal.targetAudience === 'new' ? 'Yeni müşteriler' : deal.targetAudience === 'vip' ? 'VIP müşteriler' : 'Geri dönenler'}</span>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${deal.isActive ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                    {deal.isActive ? '✅ Aktif' : '⏸️ Pasif'}
                                </span>
                            </div>
                            <div className="px-4 py-3">
                                {deal.description && <p className="text-gray-300 text-sm mb-2">{deal.description}</p>}
                                {deal.validUntil && <p className="text-xs text-gray-500">📅 {deal.validFrom} → {deal.validUntil}</p>}
                            </div>
                            <div className="flex items-center gap-1 px-4 pb-3">
                                <button onClick={() => toggleActive(deal)} className={`p-1.5 rounded-lg text-sm transition text-white ${deal.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}>{deal.isActive ? '✅' : '⏸️'}</button>
                                <button onClick={() => openEdit(deal)} className="p-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-white text-sm">✏️</button>
                                <button onClick={() => setConfirmDelete(deal)} className="p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg my-8">
                        <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Fırsat Düzenle' : 'Yeni Fırsat'}</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Başlık *</label>
                                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    placeholder="Örn: Hafta Sonu %20 İndirim"
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500" />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Açıklama</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    rows={2} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">İndirim Türü</label>
                                    <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value as any })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                                        <option value="percent">🔥 Yüzde İndirim (%)</option>
                                        <option value="fixed">🎉 Sabit İndirim (€)</option>
                                        <option value="freeDelivery">🚚 Ücretsiz Teslimat</option>
                                        <option value="buyXGetY">🎁 BOGO (X Al Y Bedava)</option>
                                        <option value="cashback">💸 Cashback (Bakiye İade)</option>
                                        <option value="bundleDeal">📦 Bundle / Combo</option>
                                        <option value="flashSale">⚡ Flash Sale</option>
                                        <option value="productDiscount">🏷️ Ürün Bazlı İndirim</option>
                                        <option value="cartBooster">🛒 Sepet Büyütücü</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Değer</label>
                                    <input type="number" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Hedef Kitle</label>
                                <select value={form.targetAudience} onChange={e => setForm({ ...form, targetAudience: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                                    <option value="all">Herkese</option>
                                    <option value="new">Yeni Müşteriler</option>
                                    <option value="returning">Geri Dönenler</option>
                                    <option value="vip">VIP Müşteriler</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Başlangıç</label>
                                    <input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Bitiş</label>
                                    <input type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                                </label>
                                <span className="text-gray-300 text-sm">Aktif</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition">İptal</button>
                            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition disabled:opacity-50">
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center">
                        <span className="text-4xl">🗑️</span>
                        <h3 className="text-white font-bold mt-3">Fırsatı Sil</h3>
                        <p className="text-gray-400 text-sm mt-2">"{confirmDelete.title}" fırsatını kalıcı olarak silmek istediğinizden emin misiniz?</p>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition">İptal</button>
                            <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition">Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
