'use client';

import { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface DonationFund {
    id: string;
    name: string;
    description?: string;
    websiteUrl?: string;
    logoUrl?: string;
    isActive: boolean;
    createdAt?: any;
}

export default function DonationFundsPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [funds, setFunds] = useState<DonationFund[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFund, setNewFund] = useState({ name: '', description: '', websiteUrl: '', logoUrl: '' });
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<DonationFund | null>(null);

    const loadFunds = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'donation_funds'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setFunds(snap.docs.map(d => ({ id: d.id, ...d.data() } as DonationFund)));
        } catch (e) {
            console.error('Error loading donation funds:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!adminLoading && admin?.role === 'super_admin') {
            loadFunds();
        }
    }, [adminLoading, admin]);

    const handleAdd = async () => {
        if (!newFund.name.trim() || !admin) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'donation_funds'), {
                name: newFund.name.trim(),
                description: newFund.description.trim() || null,
                websiteUrl: newFund.websiteUrl.trim() || null,
                logoUrl: newFund.logoUrl.trim() || null,
                isActive: true,
                createdAt: serverTimestamp(),
                createdBy: admin.id,
            });
            setNewFund({ name: '', description: '', websiteUrl: '', logoUrl: '' });
            setShowAddModal(false);
            loadFunds();
        } catch (e) {
            console.error('Error adding fund:', e);
            alert('Bir hata olustu.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (fund: DonationFund) => {
        try {
            await updateDoc(doc(db, 'donation_funds', fund.id), { isActive: !fund.isActive });
            loadFunds();
        } catch (e) {
            console.error('Error toggling fund status:', e);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete) return;
        try {
            await deleteDoc(doc(db, 'donation_funds', confirmDelete.id));
            loadFunds();
        } catch (e) {
            console.error('Error deleting fund:', e);
        }
        setConfirmDelete(null);
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    if (!admin || admin.role !== 'super_admin') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-foreground">Yetkiniz yok.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-4xl mx-auto">
                <Link href="/admin/kermes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
                    ← Kermes Yönetimi
                </Link>
                <div className="flex items-center justify-between mt-2 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Bagis Fonlari</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Kermes yuvarlama destegi icin kullanilabilecek global bagis fonlari. Her kermes admin bu listeden bir fon secebilir.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition shadow-lg text-sm"
                    >
                        + Yeni Fon Ekle
                    </button>
                </div>

                {funds.length === 0 ? (
                    <div className="bg-card rounded-xl p-12 text-center border border-border">
                        <div className="text-5xl mb-4">💝</div>
                        <h2 className="text-lg font-bold text-foreground mb-2">Henuz bagis fonu eklenmemis</h2>
                        <p className="text-muted-foreground text-sm mb-4">Dr. Help gibi global bagis fonlarini buraya ekleyin.</p>
                        <button onClick={() => setShowAddModal(true)} className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm">
                            Ilk Fonu Ekle
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {funds.map((fund) => (
                            <div key={fund.id} className="bg-card rounded-xl p-5 border border-border flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-pink-600/20 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                                        {(fund as any).logoUrl ? (
                                            <img src={(fund as any).logoUrl} alt={fund.name} className="w-full h-full object-contain p-1" />
                                        ) : '💝'}
                                    </div>
                                    <div>
                                        <h3 className="text-foreground font-semibold">{fund.name}</h3>
                                        {fund.description && <p className="text-muted-foreground text-sm">{fund.description}</p>}
                                        {(fund as any).websiteUrl && (
                                            <a href={(fund as any).websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs mt-0.5 inline-flex items-center gap-1">
                                                🔗 {(fund as any).websiteUrl}
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${fund.isActive ? 'bg-green-600/30 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
                                        {fund.isActive ? 'Aktif' : 'Pasif'}
                                    </span>
                                    <button
                                        onClick={() => toggleStatus(fund)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${fund.isActive ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}
                                    >
                                        {fund.isActive ? 'Gizle' : 'Aktif Et'}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(fund)}
                                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs transition"
                                    >
                                        Sil
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-foreground">Yeni Bagis Fonu</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">Fon Adi *</label>
                                <input
                                    type="text"
                                    value={newFund.name}
                                    onChange={(e) => setNewFund(p => ({ ...p, name: e.target.value }))}
                                    placeholder="orn: Dr. Help"
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">Website URL (Opsiyonel)</label>
                                <input
                                    type="url"
                                    value={newFund.websiteUrl}
                                    onChange={(e) => setNewFund(p => ({ ...p, websiteUrl: e.target.value }))}
                                    placeholder="https://drhelp.de"
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">Logo URL (Opsiyonel)</label>
                                <input
                                    type="url"
                                    value={newFund.logoUrl}
                                    onChange={(e) => setNewFund(p => ({ ...p, logoUrl: e.target.value }))}
                                    placeholder="https://domain.com/logo.png"
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                                />
                                {newFund.logoUrl && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <img src={newFund.logoUrl} alt="logo preview" className="w-10 h-10 rounded-lg object-contain border border-gray-600 bg-white p-1" />
                                        <span className="text-muted-foreground text-xs">Onizleme</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">Aciklama (Opsiyonel)</label>
                                <textarea
                                    value={newFund.description}
                                    onChange={(e) => setNewFund(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Kisa bir aciklama..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm">Iptal</button>
                            <button
                                onClick={handleAdd}
                                disabled={saving || !newFund.name.trim()}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : 'Olustur'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Bagis Fonunu Sil"
                message="Bu bagis fonunu silmek istediginizden emin misiniz? Bu fonu secmis kermeslerde 2. secit kaldirilir."
                itemName={confirmDelete?.name}
                variant="danger"
                confirmText="Evet, Sil"
                loadingText="Siliniyor..."
            />
        </div>
    );
}
