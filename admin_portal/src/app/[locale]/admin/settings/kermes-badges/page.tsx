'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface KermesBadge {
 id: string;
 name: string;
 description: string;
 iconUrl: string;
 storagePath: string;
 isActive: boolean;
 createdAt: any;
 createdBy: string;
}

export default function KermesBadgesPage() {
 const { admin, loading: adminLoading } = useAdmin();
 const [loading, setLoading] = useState(true);
 const [badges, setBadges] = useState<KermesBadge[]>([]);

 const [uploading, setUploading] = useState(false);
 const [showUploadModal, setShowUploadModal] = useState(false);
 const [newBadge, setNewBadge] = useState({
 name: '',
 description: '',
 colorHex: '#EA184A',
 textColorHex: '#FFFFFF',
 isActive: true,
 file: null as File | null,
 });
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Assignment State
 const [showAssignModal, setShowAssignModal] = useState(false);
 const [selectedBadge, setSelectedBadge] = useState<KermesBadge | null>(null);
 const [kermeses, setKermeses] = useState<any[]>([]);
 const [selectedKermesIds, setSelectedKermesIds] = useState<Set<string>>(new Set());
 const [assigning, setAssigning] = useState(false);

 const loadBadges = async () => {
 setLoading(true);
 try {
 const badgesQuery = query(collection(db, 'kermes_badges'), orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(badgesQuery);
 const loadedBadges = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesBadge));
 setBadges(loadedBadges);
 } catch (error) {
 console.error('Error loading badges:', error);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (!adminLoading && admin?.role === 'super_admin') {
 loadBadges();
 }
 }, [adminLoading, admin]);

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 setNewBadge(prev => ({ ...prev, file }));
 }
 };

 const handleUpload = async () => {
 if (!newBadge.file || !newBadge.name || !admin) return;

 setUploading(true);
 try {
 const fileName = `kermes-badges/${Date.now()}_${newBadge.file.name}`;
 const storageRef = ref(storage, fileName);
 await uploadBytes(storageRef, newBadge.file, { cacheControl: 'public, max-age=31536000' });
 const downloadUrl = await getDownloadURL(storageRef);

 await addDoc(collection(db, 'kermes_badges'), {
 name: newBadge.name,
 label: newBadge.name,
 description: newBadge.description,
 iconUrl: downloadUrl,
 storagePath: fileName,
 colorHex: newBadge.colorHex,
 textColorHex: newBadge.textColorHex,
 isActive: newBadge.isActive,
 createdAt: serverTimestamp(),
 createdBy: admin.id,
 });

 setNewBadge({ name: '', description: '', colorHex: '#EA184A', textColorHex: '#FFFFFF', isActive: true, file: null });
 setShowUploadModal(false);
 loadBadges();
 } catch (error) {
 console.error('Error uploading badge:', error);
 alert('Rozet yüklenirken hata oluştu.');
 } finally {
 setUploading(false);
 }
 };

 const toggleBadgeStatus = async (badge: KermesBadge) => {
 try {
 await updateDoc(doc(db, 'kermes_badges', badge.id), {
 isActive: !badge.isActive
 });
 loadBadges();
 } catch (error) {
 console.error('Error toggling badge:', error);
 }
 };

 const [confirmDeleteBadge, setConfirmDeleteBadge] = useState<KermesBadge | null>(null);

 const handleDeleteConfirm = async () => {
 if (!confirmDeleteBadge) return;
 try {
 if (confirmDeleteBadge.storagePath) {
 const storageRef = ref(storage, confirmDeleteBadge.storagePath);
 await deleteObject(storageRef).catch(() => { });
 }
 await deleteDoc(doc(db, 'kermes_badges', confirmDeleteBadge.id));
 loadBadges();
 } catch (error) {
 console.error('Error deleting badge:', error);
 alert('Rozet silinirken hata oluştu.');
 }
 setConfirmDeleteBadge(null);
 };

 // Mass Assignment Logic
 const openAssignModal = async (badge: KermesBadge) => {
 setSelectedBadge(badge);
 setAssigning(true);
 try {
 // Load all kermes events to manage assignment
 const kQuery = query(collection(db, 'kermes_events'), orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(kQuery);
 const loadedK = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
 
 setKermeses(loadedK);
 
 // Pre-select kermeses that already have this badge
 const initialSelected = new Set<string>();
 for (const k of loadedK) {
 if (k.activeBadgeIds && Array.isArray(k.activeBadgeIds) && k.activeBadgeIds.includes(badge.id)) {
 initialSelected.add(k.id);
 }
 }
 setSelectedKermesIds(initialSelected);
 setShowAssignModal(true);
 } catch (error) {
 console.error('Error loading kermeses for assignment:', error);
 } finally {
 setAssigning(false);
 }
 };

 const handleAssignSave = async () => {
 if (!selectedBadge) return;
 setAssigning(true);
 try {
 const batch = writeBatch(db);
 
 // For each kermes, check if it was checked or unchecked
 kermeses.forEach((kermes) => {
 const isSelected = selectedKermesIds.has(kermes.id);
 const currentBadges = Array.isArray(kermes.activeBadgeIds) ? [...kermes.activeBadgeIds] : [];
 const hasBadge = currentBadges.includes(selectedBadge.id);
 
 if (isSelected && !hasBadge) {
 currentBadges.push(selectedBadge.id);
 batch.update(doc(db, 'kermes_events', kermes.id), { activeBadgeIds: currentBadges });
 } else if (!isSelected && hasBadge) {
 const newBadges = currentBadges.filter(id => id !== selectedBadge.id);
 batch.update(doc(db, 'kermes_events', kermes.id), { activeBadgeIds: newBadges });
 }
 });

 await batch.commit();
 setShowAssignModal(false);
 alert('Başarıyla atandı!');
 } catch (error) {
 console.error('Error assigning badges:', error);
 alert('Sertifika ataması sırasında hata oluştu.');
 } finally {
 setAssigning(false);
 }
 };

 const toggleKermesSelection = (kermesId: string) => {
 const next = new Set(selectedKermesIds);
 if (next.has(kermesId)) next.delete(kermesId);
 else next.add(kermesId);
 setSelectedKermesIds(next);
 };

 if (adminLoading || loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
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
 <div className="max-w-7xl mx-auto mb-6">
 <Link href="/admin/kermes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
 ← Kermes Yönetimi
 </Link>
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
 <div>
 <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">🏅 Zertifikate & Badges Yönetimi</h1>
 <p className="text-muted-foreground text-sm mt-1">Kermes kartlarında gösterilecek sertifikaları ve sponsorluk logolarını yönetin.</p>
 </div>
 <button
 onClick={() => setShowUploadModal(true)}
 className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
 >
 <span>➕</span>
 Yeni Rozet Yükle
 </button>
 </div>
 </div>

 <div className="max-w-7xl mx-auto">
 {badges.length === 0 ? (
 <div className="bg-card rounded-xl p-12 text-center border border-border">
 <div className="text-6xl mb-4">🏅</div>
 <h2 className="text-xl font-bold text-foreground mb-2">Henüz rozet eklenmemiş</h2>
 <button onClick={() => setShowUploadModal(true)} className="mt-4 px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg">İlk Rozeti Ekle</button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {badges.map((badge) => (
 <div key={badge.id} className="bg-card rounded-xl overflow-hidden border border-border hover:border-pink-500 transition group p-4 flex flex-col">
 <div className="flex items-center gap-4 mb-4">
 <div className="relative w-16 h-16 bg-background rounded-lg border border-border overflow-hidden shrink-0 p-1 flex items-center justify-center">
 <Image src={badge.iconUrl} alt={badge.name} width={50} height={50} className="object-contain max-h-full max-w-full" unoptimized />
 </div>
 <div className="flex-1">
 <h3 className="text-foreground font-bold">{badge.name}</h3>
 <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${badge.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
 {badge.isActive ? 'Aktif' : 'Gizli'}
 </span>
 </div>
 </div>
 <p className="text-muted-foreground text-sm mb-6 flex-1">{badge.description || 'Açıklama yok'}</p>
 <div className="flex gap-2 mt-auto">
 <button onClick={() => openAssignModal(badge)} disabled={assigning} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 font-medium">
 👥 Kermeslere Ata
 </button>
 <button onClick={() => toggleBadgeStatus(badge)} className={`px-3 py-2 rounded-lg text-sm font-medium ${badge.isActive ? 'bg-gray-700 text-white' : 'bg-green-600 text-white'}`}>
 {badge.isActive ? 'Gizle' : 'Göster'}
 </button>
 <button onClick={() => setConfirmDeleteBadge(badge)} className="px-3 py-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg text-sm">
 🗑️
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Upload Modal */}
 {showUploadModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
 <div className="bg-card rounded-2xl w-full max-w-lg p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-bold text-foreground">Yeni Rozet/Sertifika</h2>
 <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">×</button>
 </div>

 <div className="mb-4">
 <label className="block text-foreground text-sm font-medium mb-2">Rozet İkonu (Şeffaf PNG önerilir)</label>
 <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
 <button onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-600 rounded-xl hover:border-pink-500 transition flex flex-col items-center justify-center gap-2">
 {newBadge.file ? (
 <div className="text-center">
 <span className="text-pink-400 text-3xl">✅</span>
 <p className="text-foreground mt-1">{newBadge.file.name}</p>
 </div>
 ) : (
 <>
 <span className="text-4xl">🏅</span>
 <span className="text-muted-foreground">İkon Seçmek İçin Tıklayın</span>
 </>
 )}
 </button>
 </div>

 <div className="mb-4">
 <label className="block text-foreground text-sm font-medium mb-2">Rozet Adı</label>
 <input type="text" value={newBadge.name} onChange={(e) => setNewBadge(prev => ({ ...prev, name: e.target.value }))} placeholder="örn: Tuna Helal Kesim %100" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
 </div>
 
 <div className="mb-4">
 <label className="block text-foreground text-sm font-medium mb-2">Kısa Açıklama (İsteğe Bağlı)</label>
 <textarea value={newBadge.description} onChange={(e) => setNewBadge(prev => ({ ...prev, description: e.target.value }))} placeholder="Bu rozetin anlamı..." className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none" rows={3}></textarea>
 </div>

 <div className="mb-6 grid grid-cols-2 gap-4">
 <div>
 <label className="block text-foreground text-sm font-medium mb-2">Arka Plan Rengi</label>
 <div className="flex items-center gap-3">
 <input type="color" value={newBadge.colorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, colorHex: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
 <input type="text" value={newBadge.colorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, colorHex: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono" />
 </div>
 </div>
 <div>
 <label className="block text-foreground text-sm font-medium mb-2">Yazı Rengi</label>
 <div className="flex items-center gap-3">
 <input type="color" value={newBadge.textColorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, textColorHex: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
 <input type="text" value={newBadge.textColorHex} onChange={(e) => setNewBadge(prev => ({ ...prev, textColorHex: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono" />
 </div>
 </div>
 </div>

 <div className="flex gap-3">
 <button onClick={() => setShowUploadModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg">İptal</button>
 <button onClick={handleUpload} disabled={uploading || !newBadge.file || !newBadge.name} className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg disabled:opacity-50">
 {uploading ? 'Yükleniyor...' : 'Rozeti Oluştur'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Mass Assign Modal */}
 {showAssignModal && selectedBadge && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
 <div className="bg-card rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
 <div className="flex items-center justify-between mb-2">
 <h2 className="text-xl font-bold text-foreground">Kermes Seçimi</h2>
 <button onClick={() => setShowAssignModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">×</button>
 </div>
 <p className="text-muted-foreground text-sm mb-6">
 <strong className="text-white">{selectedBadge.name}</strong> rozetini hangi kermeslere tanımlamak istiyorsunuz?
 </p>

 <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-6 border border-border rounded-lg p-2 bg-background">
 {kermeses.map(k => (
 <label key={k.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/50 cursor-pointer border border-transparent hover:border-gray-700">
 <input 
 type="checkbox" 
 className="w-5 h-5 rounded border-gray-600 text-pink-500 focus:ring-pink-500 bg-gray-700"
 checked={selectedKermesIds.has(k.id)}
 onChange={() => toggleKermesSelection(k.id)}
 />
 <div className="flex flex-col">
 <span className="text-white font-medium">{k.title}</span>
 <span className="text-xs text-muted-foreground">{k.city} {k.organizationName ? `· ${k.organizationName}` : ''}</span>
 </div>
 </label>
 ))}
 {kermeses.length === 0 && <p className="text-center p-4 text-muted-foreground">Henüz kermes bulunmuyor.</p>}
 </div>

 <div className="flex gap-3 mt-auto">
 <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg">İptal</button>
 <button onClick={handleAssignSave} disabled={assigning} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg disabled:opacity-50">
 {assigning ? 'Kaydediliyor...' : `Atamayı Kaydet (${selectedKermesIds.size} Kermes)`}
 </button>
 </div>
 </div>
 </div>
 )}

 <ConfirmModal
 isOpen={!!confirmDeleteBadge}
 onClose={() => setConfirmDeleteBadge(null)}
 onConfirm={handleDeleteConfirm}
 title="Rozeti Sil"
 message="Bu rozeti silmek istediğinize emin misiniz? Bu işlem daha önce bu sertifikayı atanmış olan kermeslerde eksik gösterime sebep olabilir."
 itemName={confirmDeleteBadge?.name}
 variant="danger"
 confirmText="Evet, Sil"
 loadingText="Siliniyor..."
 />
 </div>
 );
}
