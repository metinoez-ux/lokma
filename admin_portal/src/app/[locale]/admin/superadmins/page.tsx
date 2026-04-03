'use client';

import { useSearchParams } from 'next/navigation';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { auth, db, storage } from '@/lib/firebase';
import { doc, collection, query, where, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';

/* ── Types ── */
interface SuperAdminProfile {
 uid: string;
 email: string;
 displayName: string;
 photoURL: string;
 title: string;
 bio: string;
 createdAt?: Date;
}

interface AdminInvitation {
 id: string;
 email: string;
 role: string;
 adminType: string;
 status: string;
 createdAt?: Date;
}

/* ── Component ── */
export default function SuperAdminsPage() {
 const searchParams = useSearchParams();
 const t = useTranslations('SuperAdmins');
 const { admin, loading } = useAdmin();

 /* Super admin list */
 const [superAdmins, setSuperAdmins] = useState<SuperAdminProfile[]>([]);
 const [pendingInvitations, setPendingInvitations] = useState<AdminInvitation[]>([]);
 const [loadingAdmins, setLoadingAdmins] = useState(true);

 /* Profile edit */
 const [editingUid, setEditingUid] = useState<string | null>(null);
 const [editForm, setEditForm] = useState({ displayName: '', title: '', bio: '' });
 const [photoFile, setPhotoFile] = useState<File | null>(null);
 const [photoPreview, setPhotoPreview] = useState<string>('');
 const [saving, setSaving] = useState(false);
 const photoInputRef = useRef<HTMLInputElement>(null);

 /* Add super admin */
 const [addEmail, setAddEmail] = useState('');
 const [addResult, setAddResult] = useState<{ mode: string; inviteLink?: string } | null>(null);
 const [adding, setAdding] = useState(false);

 /* ── Load super admins ── */
 useEffect(() => {
 if (!admin) return;
 loadSuperAdmins();
 }, [admin]);

 const loadSuperAdmins = async () => {
 setLoadingAdmins(true);
 try {
 const q = query(collection(db, 'admins'), where('adminType', '==', 'super'));
 const snap = await getDocs(q);
 const list: SuperAdminProfile[] = snap.docs.map(d => ({
 uid: d.id,
 email: d.data().email || '',
 displayName: d.data().displayName || d.data().email?.split('@')[0] || 'Super Admin',
 photoURL: d.data().photoURL || '',
 title: d.data().title || 'Super Admin',
 bio: d.data().bio || '',
 createdAt: d.data().createdAt?.toDate?.(),
 }));
 setSuperAdmins(list);

 const invQ = query(collection(db, 'admin_invitations'), where('adminType', '==', 'super'), where('status', '==', 'pending'));
 const invSnap = await getDocs(invQ);
 const invList: AdminInvitation[] = invSnap.docs.map(d => ({
 id: d.id,
 email: d.data().email || '',
 role: d.data().role || '',
 adminType: d.data().adminType || '',
 status: d.data().status || '',
 createdAt: d.data().createdAt?.toDate?.(),
 }));
 setPendingInvitations(invList);
 } catch (e) {
 console.error(e);
 }
 setLoadingAdmins(false);
 };

 /* ── Profile edit ── */
 const openEdit = (sa: SuperAdminProfile) => {
 setEditingUid(sa.uid);
 setEditForm({ displayName: sa.displayName, title: sa.title, bio: sa.bio });
 setPhotoPreview(sa.photoURL);
 setPhotoFile(null);
 };

 const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setPhotoFile(file);
 setPhotoPreview(URL.createObjectURL(file));
 };

 // Deep-link edit modal
 useEffect(() => {
 if (!loadingAdmins && superAdmins.length > 0 && searchParams) {
 const editId = searchParams.get('edit');
 if (editId) {
 const targetAdmin = superAdmins.find(a => a.uid === editId);
 if (targetAdmin) {
 openEdit(targetAdmin);
 const url = new URL(window.location.href);
 url.searchParams.delete('edit');
 window.history.replaceState(null, '', url.pathname + url.search);
 }
 }
 }
 }, [loadingAdmins, superAdmins, searchParams]);

 const handleSaveProfile = async () => {
 if (!editingUid || !auth.currentUser) return;
 setSaving(true);
 try {
 let photoURL = photoPreview;

 /* Upload photo to Storage if new file selected */
 if (photoFile) {
 const imgRef = storageRef(storage, `super-admins/${editingUid}/photo`);
 await uploadBytes(imgRef, photoFile);
 photoURL = await getDownloadURL(imgRef);
 }

 /* Update Firestore admins doc */
 await updateDoc(doc(db, 'admins', editingUid), {
 displayName: editForm.displayName,
 title: editForm.title,
 bio: editForm.bio,
 photoURL,
 updatedAt: Timestamp.now(),
 });

 /* Update Firebase Auth profile (only for self) */
 if (editingUid === auth.currentUser.uid) {
 await updateProfile(auth.currentUser, {
 displayName: editForm.displayName,
 photoURL,
 });
 }

 await loadSuperAdmins();
 setEditingUid(null);
 } catch (e: any) {
 alert('Fehler: ' + e.message);
 }
 setSaving(false);
 };

 /* ── Add super admin ── */
 const handleAddSuperAdmin = async () => {
 if (!addEmail.trim()) return;
 setAdding(true);
 setAddResult(null);
 try {
 const token = await auth.currentUser?.getIdToken();
 const res = await fetch('/api/super-admin/add', {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ email: addEmail.trim() }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error);
 setAddResult(data);
 setAddEmail('');
 await loadSuperAdmins();
 } catch (e: any) {
 alert('Fehler: ' + e.message);
 }
 setAdding(false);
 };



 /* ── Guards ── */
 if (loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-500" />
 </div>
 );
 }

 if (!admin || admin.adminType !== 'super') {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <p className="text-red-800 dark:text-red-400">Zugriff verweigert</p>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background text-foreground">
 <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

 {/* ── Header ── */}
 <div>
 <h1 className="text-2xl font-bold">{t('super_admins_title')}</h1>
 <p className="text-muted-foreground text-sm mt-1">{t('plattform_adminleri_yonet')}</p>
 </div>

 {/* ── Profile Cards ── */}
 <section>
 <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('aktif_super_adminler')}</h2>

 {loadingAdmins ? (
 <div className="animate-pulse h-24 bg-card rounded-xl" />
 ) : (
 <div className="space-y-3">
 {superAdmins.map(sa => (
 <div key={sa.uid} className="bg-card rounded-xl p-4 flex items-center gap-4">
 {/* Avatar */}
 <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gray-700">
 {sa.photoURL ? (
 <img src={sa.photoURL} alt={sa.displayName} className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold">
 {sa.displayName.charAt(0).toUpperCase()}
 </div>
 )}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-foreground">{sa.displayName}</div>
 <div className="text-xs text-muted-foreground">{sa.email}</div>
 {sa.title && <div className="text-xs text-muted-foreground/80 mt-0.5">{sa.title}</div>}
 {sa.bio && <div className="text-xs text-muted-foreground/80 mt-1 truncate">{sa.bio}</div>}
 </div>

 {/* Edit button (own profile or any profile for super admin) */}
 {sa.uid === auth.currentUser?.uid && (
 <button
 onClick={() => openEdit(sa)}
 className="shrink-0 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
 >{t('duzenle')}</button>
 )}
 </div>
 ))}

 {superAdmins.length === 0 && (
 <p className="text-muted-foreground/80 text-sm">{t('super_admin_bulunamadi')}</p>
 )}
 </div>
 )}
 </section>

 {/* ── Pending Invitations ── */}
 {pendingInvitations.length > 0 && (
 <section>
 <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Bekleyen Davetler (Pending)</h2>
 <div className="space-y-3">
 {pendingInvitations.map(inv => (
 <div key={inv.id} className="bg-card border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
 <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-red-500/10 flex items-center justify-center text-red-500 font-bold">
 ✉️
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-foreground">{inv.email}</div>
 <div className="text-xs text-red-500 mt-0.5">Davet Gönderildi (Kayıt Bekleniyor)</div>
 {inv.createdAt && (
 <div className="text-xs text-muted-foreground/80 mt-1">
 {inv.createdAt.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* ── Edit Profile Modal ── */}
 {editingUid && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
 <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
 <h3 className="text-lg font-bold">{t('profili_duzenle')}</h3>

 {/* Photo */}
 <div className="flex items-center gap-4">
 <div
 className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 cursor-pointer border-2 border-gray-600 hover:border-gray-400 transition"
 onClick={() => photoInputRef.current?.click()}
 >
 {photoPreview ? (
 <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center leading-tight px-1" dangerouslySetInnerHTML={{ __html: t('foto_ekle') }}></div>
 )}
 </div>
 <div>
 <button
 onClick={() => photoInputRef.current?.click()}
 className="text-sm text-blue-800 dark:text-blue-400 hover:text-blue-300"
 >{t('fotografi_degistir')}</button>
 <p className="text-xs text-muted-foreground/80 mt-0.5">JPG, PNG, max 2 MB</p>
 </div>
 <input
 ref={photoInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handlePhotoChange}
 />
 </div>

 {/* Name */}
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('isim')}</label>
 <input
 type="text"
 value={editForm.displayName}
 onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
 className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
 />
 </div>

 {/* Title */}
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('unvan_pozisyon')}</label>
 <input
 type="text"
 value={editForm.title}
 onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
 placeholder="z. B. CEO & Gründer"
 className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
 />
 </div>

 {/* Bio */}
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('biyografi')}</label>
 <textarea
 value={editForm.bio}
 onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
 rows={3}
 className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm resize-none"
 />
 </div>

 {/* Actions */}
 <div className="flex gap-3 pt-1">
 <button
 onClick={handleSaveProfile}
 disabled={saving}
 className="flex-1 py-2 bg-card text-foreground font-medium rounded-lg text-sm hover:bg-muted disabled:opacity-50 transition"
 >
 {saving ? t('kaydediliyor') : t('kaydet')}
 </button>
 <button
 onClick={() => setEditingUid(null)}
 className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition"
 >{t('iptal_et')}</button>
 </div>
 </div>
 </div>
 )}

 {/* ── Add Super Admin ── */}
 <section className="bg-card rounded-xl p-6">
 <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('yeni_super_admin_ekle')}</h2>
 <p className="text-xs text-muted-foreground/80 mb-4">
 Wenn die E-Mail bereits registriert ist, wird der Benutzer sofort zum Super Admin befördert.
 Sonst wird ein Einladungslink erstellt (72 Std. gültig).
 </p>

 <div className="flex gap-3">
 <input
 type="email"
 value={addEmail}
 onChange={e => setAddEmail(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleAddSuperAdmin()}
 placeholder={t('eposta_adresi')}
 className="flex-1 px-3 py-2 bg-muted/50 text-foreground/90 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none"
 />
 <button
 onClick={handleAddSuperAdmin}
 disabled={adding || !addEmail.trim()}
 className="px-4 py-2 bg-card text-foreground font-medium rounded-lg text-sm hover:bg-muted disabled:opacity-40 transition"
 >
 {adding ? t('yukleniyor') : t('ekle')}
 </button>
 </div>

 {addResult && (
 <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm">
 {addResult.mode === 'promoted' ? (
 <p className="text-green-800 dark:text-green-400">{t('kullanici_super_admin_yapildi')}</p>
 ) : (
 <div>
 <p className="text-blue-800 dark:text-blue-400 mb-2">{t('davet_linki_olusturuldu')}</p>
 <code className="text-xs text-foreground break-all block bg-background p-2 rounded">
 {addResult.inviteLink}
 </code>
 </div>
 )}
 </div>
 )}
 </section>

 </div>
 </div>
 );
}

