'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, getDoc, updateDoc, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Admin } from '@/types';
import { getRoleLabel } from '@/lib/business-types';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function VolunteersPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading } = useAdmin();

    const [volunteers, setVolunteers] = useState<Admin[]>([]);
    const [kermesMap, setKermesMap] = useState<Record<string, string>>({});
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Deletion state
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', confirmText: '', onConfirm: () => {} });

    const [editPersonData, setEditPersonData] = useState<any>(null);
    const [isSavingPerson, setIsSavingPerson] = useState(false);

    useEffect(() => {
        if (!admin || admin.adminType !== 'super') return;

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // 1. Fetch all Kermeses for mapping Business ID -> Name
                const kermesQuery = query(collection(db, 'businesses'), where('type', '==', 'kermes'));
                const kermesSnap = await getDocs(kermesQuery);
                const kMap: Record<string, string> = {};
                kermesSnap.docs.forEach(doc => {
                    kMap[doc.id] = doc.data().companyName || doc.data().name || 'İsimsiz Kermes';
                });
                setKermesMap(kMap);

                // 2. Fetch all Kermes Staff & Drivers & Admins
                const staffQuery = query(
                    collection(db, 'admins'),
                    where('adminType', 'in', ['kermes', 'kermes_staff', 'kermes_driver'])
                );
                const staffSnap = await getDocs(staffQuery);
                const staffData = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Admin));
                
                // Sort by creation date descending
                staffData.sort((a, b) => {
                    const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
                    const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
                    return timeB - timeA;
                });
                
                setVolunteers(staffData);
            } catch (error) {
                console.error("Error fetching volunteers data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [admin]);

    const handleDelete = (volunteer: Admin) => {
        setConfirmState({
            isOpen: true,
            title: 'Personeli Sil',
            message: `${volunteer.firstName} ${volunteer.lastName} isimli personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: 'Sil',
            onConfirm: async () => {
                try {
                    // Remove from kermes business document
                    const kermesId = volunteer.butcherId || volunteer.businessId;
                    if (kermesId) {
                        const kermesRef = doc(db, 'businesses', kermesId);
                        const kermesSnap = await getDoc(kermesRef);
                        if (kermesSnap.exists()) {
                            const data = kermesSnap.data();
                            const newStaff = (data.assignedStaff || []).filter((id: string) => id !== volunteer.id);
                            const newDrivers = (data.assignedDrivers || []).filter((id: string) => id !== volunteer.id);
                            await updateDoc(kermesRef, { assignedStaff: newStaff, assignedDrivers: newDrivers });
                        }
                    }

                    await deleteDoc(doc(db, 'admins', volunteer.id));
                    await deleteDoc(doc(db, 'users', volunteer.id)); // Delete from users as well just in case
                    
                    setVolunteers(prev => prev.filter(v => v.id !== volunteer.id));
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setEditPersonData(null);
                } catch (error) {
                    console.error("Error deleting volunteer:", error);
                    alert("Silme işlemi başarısız oldu.");
                }
            }
        });
    };

    // Filter by search query
    const filteredVolunteers = useMemo(() => {
        if (!searchQuery.trim()) return volunteers;
        const lowerQ = searchQuery.toLowerCase();
        return volunteers.filter(v => {
            const fullName = `${v.firstName || ''} ${v.lastName || ''}`.toLowerCase();
            const email = (v.email || '').toLowerCase();
            const kermesName = (kermesMap[v.butcherId || v.businessId || ''] || '').toLowerCase();
            return fullName.includes(lowerQ) || email.includes(lowerQ) || kermesName.includes(lowerQ);
        });
    }, [searchQuery, volunteers, kermesMap]);

    const handleSaveEditPerson = async () => {
        if (!editPersonData?.id) return;
        setIsSavingPerson(true);
        try {
            const adminRef = doc(db, 'admins', editPersonData.id);
            const userRef = doc(db, 'users', editPersonData.id);
            
            const adminSnap = await getDoc(adminRef);
            if (adminSnap.exists()) {
                await updateDoc(adminRef, {
                    firstName: editPersonData.firstName || editPersonData.name?.split(' ')[0] || '',
                    lastName: editPersonData.lastName || editPersonData.name?.split(' ').slice(1).join(' ') || '',
                    displayName: editPersonData.name,
                    phone: editPersonData.phone,
                    email: editPersonData.email,
                });
            } else {
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    await updateDoc(userRef, {
                        firstName: editPersonData.firstName || editPersonData.name?.split(' ')[0] || '',
                        lastName: editPersonData.lastName || editPersonData.name?.split(' ').slice(1).join(' ') || '',
                        displayName: editPersonData.name,
                        name: editPersonData.name,
                        phone: editPersonData.phone,
                        email: editPersonData.email,
                    });
                }
            }

            setVolunteers(prev => prev.map(v => v.id === editPersonData.id ? {
                ...v,
                firstName: editPersonData.firstName || editPersonData.name?.split(' ')[0] || '',
                lastName: editPersonData.lastName || editPersonData.name?.split(' ').slice(1).join(' ') || '',
                email: editPersonData.email,
                phone: editPersonData.phone,
            } : v));
            
            setEditPersonData(null);
        } catch (e) {
            console.error(e);
            alert('Kullanıcı güncellenemedi');
        } finally {
            setIsSavingPerson(false);
        }
    };

    if (loading || isLoadingData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!admin || admin.adminType !== 'super') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-red-800 dark:text-red-400 text-lg">Zugriff verweigert</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🤝</span>
                        <div>
                            <h1 className="text-2xl font-bold">{t('volunteers')}</h1>
                            <p className="text-muted-foreground text-sm">Tüm Kermes Personelleri ve Sürücüleri</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/benutzerverwaltung"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
                    >
                        ← Geri
                    </Link>
                </div>

                {/* Search & Actions */}
                <div className="bg-card rounded-xl border border-border p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400">🔍</span>
                        </div>
                        <input
                            type="text"
                            placeholder="İsim, E-posta veya Kermes adı ile ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    <div className="text-sm text-muted-foreground font-medium">
                        Toplam {filteredVolunteers.length} Görevli
                    </div>
                </div>

                {/* Table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                <tr>
                                    <th className="px-6 py-4">Personel</th>
                                    <th className="px-6 py-4">İletişim</th>
                                    <th className="px-6 py-4">Rolü</th>
                                    <th className="px-6 py-4">Görev Yeri (Kermes)</th>
                                    <th className="px-6 py-4 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredVolunteers.length > 0 ? (
                                    filteredVolunteers.map(volunteer => {
                                        const businessName = kermesMap[volunteer.butcherId || volunteer.businessId || ''] || 'Bilinmiyor';
                                        
                                        // Rol badge rengi
                                        let roleColor = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
                                        let roleLabel = getRoleLabel(volunteer.adminType);
                                        
                                        if (volunteer.adminType === 'kermes') {
                                            roleColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
                                            roleLabel = 'Kermes Sorumlusu';
                                        } else if (volunteer.adminType === 'kermes_staff') {
                                            roleColor = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300';
                                            roleLabel = 'Kermes Personeli';
                                        } else if ((volunteer.adminType as string) === 'kermes_driver') {
                                            roleColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
                                            roleLabel = 'Kermes Sürücüsü';
                                        }

                                        return (
                                            <tr key={volunteer.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-foreground">
                                                    {volunteer.firstName} {volunteer.lastName}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span>{volunteer.email || '-'}</span>
                                                        <span className="text-muted-foreground text-xs mt-1">
                                                            {volunteer.phone || '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor}`}>
                                                        {roleLabel}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Link 
                                                        href={`/admin/kermes/${volunteer.butcherId || volunteer.businessId}`}
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        {businessName}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setEditPersonData({
                                                            id: volunteer.id,
                                                            name: volunteer.displayName || (volunteer.firstName ? `${volunteer.firstName} ${volunteer.lastName || ''}`.trim() : '') || (volunteer as any).name,
                                                            email: volunteer.email || '',
                                                            phone: volunteer.phone || '',
                                                        })}
                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium mr-4"
                                                    >
                                                        Düzenle
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(volunteer)}
                                                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                                                    >
                                                        Sil
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                            Kayıtlı personel bulunamadı.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
            />

            {/* Edit Person Modal */}
            {editPersonData && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[99]">
                    <div className="bg-card rounded-2xl w-full max-w-md p-6 border border-border">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">Personeli Düzenle</h2>
                            <button onClick={() => setEditPersonData(null)} className="text-muted-foreground hover:text-white text-xl">✕</button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">Ad Soyad</label>
                                <input 
                                    type="text" 
                                    value={editPersonData.name} 
                                    onChange={(e) => setEditPersonData({...editPersonData, name: e.target.value})}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-cyan-500 focus:outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">E-Posta</label>
                                <input 
                                    type="email" 
                                    value={editPersonData.email} 
                                    onChange={(e) => setEditPersonData({...editPersonData, email: e.target.value})}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-cyan-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">Telefon</label>
                                <input 
                                    type="text" 
                                    value={editPersonData.phone} 
                                    onChange={(e) => setEditPersonData({...editPersonData, phone: e.target.value})}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-cyan-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setEditPersonData(null)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">İptal</button>
                            <button onClick={handleSaveEditPerson} disabled={isSavingPerson} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 transition">
                                {isSavingPerson ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
