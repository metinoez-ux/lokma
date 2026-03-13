'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Coupon {
    id: string;
    code: string;
    discountType: 'percent' | 'fixed' | 'freeDelivery';
    discountValue: number;
    minOrderAmount: number;
    maxDiscount: number;
    usageLimit: number;
    usageCount: number;
    perUserLimit: number;
    couponType: 'single_use' | 'multi_use' | 'one_per_user';
    validFrom: string;
    validUntil: string;
    businessId?: string;
    isActive: boolean;
    newCustomersOnly?: boolean;
    createdAt?: any;
}

interface Props {
    businessId: string | null;
    isSuperAdmin: boolean;
    businesses: { id: string; name: string }[];
    coupons: Coupon[];
    setCoupons: (c: Coupon[]) => void;
    loaded: boolean;
    setLoaded: (b: boolean) => void;
    setAllBusinesses: (b: { id: string; name: string }[]) => void;
}

const defaultCoupon: Omit<Coupon, 'id'> = {
    code: '',
    discountType: 'percent',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscount: 0,
    usageLimit: 100,
    usageCount: 0,
    perUserLimit: 1,
    couponType: 'multi_use',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    isActive: true,
    newCustomersOnly: false,
};

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CouponsTab({ businessId, isSuperAdmin, businesses, coupons, setCoupons, loaded, setLoaded, setAllBusinesses }: Props) {
    const [loading, setLoading] = useState(!loaded);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Coupon | null>(null);
    const [form, setForm] = useState<Omit<Coupon, 'id'>>(defaultCoupon);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);
    const [searchQ, setSearchQ] = useState('');

    useEffect(() => {
        if (loaded) return;
        const load = async () => {
            setLoading(true);
            try {
                const colRef = businessId && !isSuperAdmin
                    ? query(collection(db, 'coupons'), where('businessId', '==', businessId), orderBy('createdAt', 'desc'))
                    : query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(colRef);
                setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon)));

                if (isSuperAdmin && businesses.length === 0) {
                    const bizSnap = await getDocs(query(collection(db, 'businesses'), where('isActive', '==', true)));
                    setAllBusinesses(bizSnap.docs.map(d => ({ id: d.id, name: (d.data().name as any)?.tr || (d.data().name as string) || d.id })));
                }
            } catch (e) {
                console.error('CouponsTab load error:', e);
            }
            setLoading(false);
            setLoaded(true);
        };
        load();
    }, []);

    const openAdd = () => {
        setEditing(null);
        setForm({ ...defaultCoupon, code: generateCode(), businessId: businessId || undefined });
        setShowModal(true);
    };
    const openEdit = (c: Coupon) => {
        setEditing(c);
        setForm({ code: c.code, discountType: c.discountType, discountValue: c.discountValue, minOrderAmount: c.minOrderAmount, maxDiscount: c.maxDiscount, usageLimit: c.usageLimit, usageCount: c.usageCount, perUserLimit: c.perUserLimit, couponType: c.couponType, validFrom: c.validFrom, validUntil: c.validUntil, businessId: c.businessId, isActive: c.isActive, newCustomersOnly: c.newCustomersOnly });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.code.trim()) return;
        setSaving(true);
        try {
            if (editing) {
                await updateDoc(doc(db, 'coupons', editing.id), { ...form });
                setCoupons(coupons.map(c => c.id === editing.id ? { ...c, ...form } : c));
            } else {
                const ref = await addDoc(collection(db, 'coupons'), { ...form, createdAt: new Date() });
                setCoupons([{ id: ref.id, ...form }, ...coupons]);
            }
            setShowModal(false);
        } catch (e) {
            console.error('Coupon save error:', e);
        }
        setSaving(false);
    };

    const handleDelete = async (coupon: Coupon) => {
        await deleteDoc(doc(db, 'coupons', coupon.id));
        setCoupons(coupons.filter(c => c.id !== coupon.id));
        setConfirmDelete(null);
    };

    const toggleActive = async (coupon: Coupon) => {
        await updateDoc(doc(db, 'coupons', coupon.id), { isActive: !coupon.isActive });
        setCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
    };

    const filtered = coupons.filter(c => c.code.toLowerCase().includes(searchQ.toLowerCase()));

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
        </div>
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-white font-bold text-lg">🎫 Gutscheine</h2>
                    <p className="text-gray-400 text-sm mt-0.5">{coupons.length} Gutscheine · {coupons.filter(c => c.isActive).length} aktiv</p>
                </div>
                <button onClick={openAdd} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition">
                    + Gutschein erstellen
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input type="text" placeholder="Gutscheincode suchen..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:outline-none" />
            </div>

            {filtered.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-5xl">🎫</span>
                    <h3 className="text-lg font-medium text-white mt-4">{searchQ ? 'Kein passender Gutschein' : 'Noch keine Gutscheine'}</h3>
                    {!searchQ && <button onClick={openAdd} className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition">+ Ersten Gutschein erstellen</button>}
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map(coupon => (
                        <div key={coupon.id} className={`bg-gray-800 rounded-xl overflow-hidden border ${coupon.isActive ? 'border-green-800/40' : 'border-gray-700 opacity-70'}`}>
                            <div className="px-4 py-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="bg-gray-700 rounded-lg px-3 py-2 font-mono text-lg font-bold text-green-300 tracking-widest shrink-0">
                                        {coupon.code}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">
                                                {coupon.discountType === 'percent' ? `%${coupon.discountValue}` : coupon.discountType === 'fixed' ? `€${coupon.discountValue}` : 'Gratis Lieferung'}
                                            </span>
                                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                                                {coupon.usageCount}/{coupon.usageLimit} Nutzungen
                                            </span>
                                            {coupon.minOrderAmount > 0 && (
                                                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Min €{coupon.minOrderAmount}</span>
                                            )}
                                            {coupon.newCustomersOnly && (
                                                <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full">Neuk.</span>
                                            )}
                                        </div>
                                        {coupon.validUntil && <p className="text-xs text-gray-500 mt-1">📅 {coupon.validFrom} → {coupon.validUntil}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-xs px-2 py-1 rounded-full ${coupon.isActive ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                        {coupon.isActive ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                    <button onClick={() => toggleActive(coupon)} className={`p-1.5 rounded-lg text-sm transition text-white ${coupon.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}>{coupon.isActive ? '✅' : '⏸️'}</button>
                                    <button onClick={() => openEdit(coupon)} className="p-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-white text-sm">✏️</button>
                                    <button onClick={() => setConfirmDelete(coupon)} className="p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm">🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">{editing ? 'Gutschein bearbeiten' : 'Neuer Gutschein'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-gray-400 text-sm mb-1 block">Gutscheincode *</label>
                                    <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono tracking-widest focus:ring-2 focus:ring-green-500" />
                                </div>
                                <button onClick={() => setForm({ ...form, code: generateCode() })}
                                    className="self-end px-3 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition text-sm">
                                    🎲 Generieren
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Rabatttyp</label>
                                    <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value as any })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                                        <option value="percent">Prozent (%)</option>
                                        <option value="fixed">Fest (€)</option>
                                        <option value="freeDelivery">Gratis Lieferung</option>
                                    </select>
                                </div>
                                {form.discountType !== 'freeDelivery' && (
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">Wert</label>
                                        <input type="number" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500" />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Min. Bestellung (€)</label>
                                    <input type="number" value={form.minOrderAmount} onChange={e => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Nutzungslimit gesamt</label>
                                    <input type="number" value={form.usageLimit} onChange={e => setForm({ ...form, usageLimit: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Gutscheintyp</label>
                                <select value={form.couponType} onChange={e => setForm({ ...form, couponType: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                                    <option value="multi_use">Mehrfachnutzung</option>
                                    <option value="one_per_user">1x pro Person</option>
                                    <option value="single_use">Einmalig</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Startdatum</label>
                                    <input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Enddatum</label>
                                    <input type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-green-500" />
                                    <span className="text-gray-300 text-sm">Aktiv</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={!!form.newCustomersOnly} onChange={e => setForm({ ...form, newCustomersOnly: e.target.checked })} className="w-4 h-4 accent-purple-500" />
                                    <span className="text-gray-300 text-sm">Nur Neukunden</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition">Abbrechen</button>
                            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition disabled:opacity-50">
                                {saving ? 'Wird gespeichert...' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center">
                        <span className="text-4xl">🗑️</span>
                        <h3 className="text-white font-bold mt-3">Gutschein löschen</h3>
                        <p className="text-gray-400 text-sm mt-2">Sind Sie sicher, dass Sie den Gutschein "{confirmDelete.code}" endgültig löschen möchten?</p>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">Abbrechen</button>
                            <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500">Löschen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
