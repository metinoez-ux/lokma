'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { auth, db, storage } from '@/lib/firebase';
import { doc, collection, query, where, getDocs, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import Image from 'next/image';

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

interface CleanupStats {
    authDeleted: number;
    usersDeleted: number;
    adminsDeleted: number;
    ordersDeleted: number;
    ratingsDeleted: number;
    commissionRecordsDeleted: number;
    notificationsDeleted: number;
    scheduledNotificationsDeleted: number;
    sponsoredConversionsDeleted: number;
    referralsDeleted: number;
    groupOrdersDeleted: number;
    reservationsDeleted: number;
    businessesReset: number;
    errors: string[];
}

type CleanupPhase = 'idle' | 'confirm' | 'loading' | 'done' | 'error';

/* ── Component ── */
export default function SuperAdminsPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading } = useAdmin();

    /* Super admin list */
    const [superAdmins, setSuperAdmins] = useState<SuperAdminProfile[]>([]);
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

    /* Cleanup */
    const [phase, setPhase] = useState<CleanupPhase>('idle');
    const [confirmText, setConfirmText] = useState('');
    const [stats, setStats] = useState<CleanupStats | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const CONFIRM_PHRASE = 'OK';

    /* Demo-Daten */
    type DemoPhase = 'idle' | 'seeding' | 'seeded' | 'cleaning' | 'cleaned' | 'error';
    const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle');
    const [demoBusinesses, setDemoBusinesses] = useState<any[]>([]);
    const [demoErrors, setDemoErrors] = useState<string[]>([]);
    const [demoCleanupStats, setDemoCleanupStats] = useState<any>(null);
    const [demoErrorMsg, setDemoErrorMsg] = useState('');

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

    /* ── Cleanup ── */
    const handleCleanup = async () => {
        if (confirmText !== CONFIRM_PHRASE) return;
        setPhase('loading');
        setErrorMsg('');
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/cleanup-test-data', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Cleanup fehlgeschlagen');
            setStats(data.stats);
            setPhase('done');
        } catch (e: any) {
            setErrorMsg(e.message);
            setPhase('error');
        }
    };

    /* ── Demo Seed ── */
    const handleDemoSeed = async () => {
        setDemoPhase('seeding');
        setDemoErrorMsg('');
        setDemoBusinesses([]);
        setDemoErrors([]);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/demo-data/seed', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Seed fehlgeschlagen');
            setDemoBusinesses(data.businesses || []);
            setDemoErrors(data.errors || []);
            setDemoPhase('seeded');
        } catch (e: any) {
            setDemoErrorMsg(e.message);
            setDemoPhase('error');
        }
    };

    /* ── Demo Cleanup ── */
    const handleDemoCleanup = async () => {
        setDemoPhase('cleaning');
        setDemoErrorMsg('');
        setDemoCleanupStats(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/demo-data/cleanup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Cleanup fehlgeschlagen');
            setDemoCleanupStats(data.stats);
            setDemoBusinesses([]);
            setDemoPhase('cleaned');
        } catch (e: any) {
            setDemoErrorMsg(e.message);
            setDemoPhase('error');
        }
    };

    /* ── Guards ── */
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-500" />
            </div>
        );
    }

    if (!admin || admin.adminType !== 'super') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-red-400">Zugriff verweigert</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

                {/* ── Header ── */}
                <div>
                    <h1 className="text-2xl font-bold">Super Admins</h1>
                    <p className="text-gray-400 text-sm mt-1">Plattform-Administratoren verwalten</p>
                </div>

                {/* ── Profile Cards ── */}
                <section>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Aktive Super Admins</h2>

                    {loadingAdmins ? (
                        <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
                    ) : (
                        <div className="space-y-3">
                            {superAdmins.map(sa => (
                                <div key={sa.uid} className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
                                    {/* Avatar */}
                                    <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gray-700">
                                        {sa.photoURL ? (
                                            <img src={sa.photoURL} alt={sa.displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                                                {sa.displayName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-white">{sa.displayName}</div>
                                        <div className="text-xs text-gray-400">{sa.email}</div>
                                        {sa.title && <div className="text-xs text-gray-500 mt-0.5">{sa.title}</div>}
                                        {sa.bio && <div className="text-xs text-gray-500 mt-1 truncate">{sa.bio}</div>}
                                    </div>

                                    {/* Edit button (own profile or any profile for super admin) */}
                                    {sa.uid === auth.currentUser?.uid && (
                                        <button
                                            onClick={() => openEdit(sa)}
                                            className="shrink-0 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                        >
                                            Bearbeiten
                                        </button>
                                    )}
                                </div>
                            ))}

                            {superAdmins.length === 0 && (
                                <p className="text-gray-500 text-sm">Keine Super Admins gefunden</p>
                            )}
                        </div>
                    )}
                </section>

                {/* ── Edit Profile Modal ── */}
                {editingUid && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                        <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                            <h3 className="text-lg font-bold">Profil bearbeiten</h3>

                            {/* Photo */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 cursor-pointer border-2 border-gray-600 hover:border-gray-400 transition"
                                    onClick={() => photoInputRef.current?.click()}
                                >
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center leading-tight px-1">
                                            Foto<br/>hinzufügen
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <button
                                        onClick={() => photoInputRef.current?.click()}
                                        className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        Foto ändern
                                    </button>
                                    <p className="text-xs text-gray-500 mt-0.5">JPG, PNG, max 2 MB</p>
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
                                <label className="block text-xs text-gray-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editForm.displayName}
                                    onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none text-sm"
                                />
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Titel / Position</label>
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
                                <label className="block text-xs text-gray-400 mb-1">Bio</label>
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
                                    className="flex-1 py-2 bg-white text-gray-900 font-medium rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 transition"
                                >
                                    {saving ? 'Speichern...' : 'Speichern'}
                                </button>
                                <button
                                    onClick={() => setEditingUid(null)}
                                    className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Add Super Admin ── */}
                <section className="bg-gray-800 rounded-xl p-6">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Neuen Super Admin hinzufügen</h2>
                    <p className="text-xs text-gray-500 mb-4">
                        Wenn die E-Mail bereits registriert ist, wird der Benutzer sofort zum Super Admin befördert.
                        Sonst wird ein Einladungslink erstellt (72 Std. gültig).
                    </p>

                    <div className="flex gap-3">
                        <input
                            type="email"
                            value={addEmail}
                            onChange={e => setAddEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSuperAdmin()}
                            placeholder="E-Mail-Adresse"
                            className="flex-1 px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:border-gray-400 focus:outline-none"
                        />
                        <button
                            onClick={handleAddSuperAdmin}
                            disabled={adding || !addEmail.trim()}
                            className="px-4 py-2 bg-white text-gray-900 font-medium rounded-lg text-sm hover:bg-gray-100 disabled:opacity-40 transition"
                        >
                            {adding ? 'Lädt...' : 'Hinzufügen'}
                        </button>
                    </div>

                    {addResult && (
                        <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm">
                            {addResult.mode === 'promoted' ? (
                                <p className="text-green-400">Benutzer wurde zum Super Admin befördert.</p>
                            ) : (
                                <div>
                                    <p className="text-blue-400 mb-2">Einladungslink erstellt:</p>
                                    <code className="text-xs text-gray-300 break-all block bg-gray-900 p-2 rounded">
                                        {addResult.inviteLink}
                                    </code>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* ── Demo-Daten (Presentation) ── */}
                <section className="bg-gray-800 rounded-xl border border-blue-900/40 p-6">
                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Demo-Betriebe (Presentation)</h2>
                        <p className="text-xs text-gray-400 mt-1">
                            PLZ 41836 Hückelhoven etrafindaki ~20-30 gercek isletmeyi Google Places'ten alarak demo olarak sisteme ekler.
                            Her isletme icin gercekci menu otomatik olusturulur.
                        </p>
                    </div>

                    {/* Idle */}
                    {demoPhase === 'idle' && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleDemoSeed}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Demo-Betriebe erstellen
                            </button>
                            <button
                                onClick={handleDemoCleanup}
                                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                            >
                                Demo-Betriebe löschen
                            </button>
                        </div>
                    )}

                    {/* Seeding in progress */}
                    {demoPhase === 'seeding' && (
                        <div className="flex items-center gap-3 text-blue-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-400" />
                            <div>
                                <p className="font-medium">Google Places'ten isletmeler aliniyor...</p>
                                <p className="text-xs text-gray-400 mt-0.5">Bu islem 1-2 dakika surebilir. Lutfen bekleyin.</p>
                            </div>
                        </div>
                    )}

                    {/* Cleaning in progress */}
                    {demoPhase === 'cleaning' && (
                        <div className="flex items-center gap-3 text-yellow-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-yellow-400" />
                            Demo-Betriebe werden gelöscht...
                        </div>
                    )}

                    {/* Seeded - show results */}
                    {demoPhase === 'seeded' && (
                        <div className="space-y-4">
                            <p className="text-green-400 font-medium text-sm">
                                {demoBusinesses.length} Demo-Betriebe erfolgreich erstellt!
                            </p>

                            {/* Stats grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Betriebe', value: demoBusinesses.length },
                                    { label: 'Kategorien', value: demoBusinesses.reduce((s: number, b: any) => s + (b.categories || 0), 0) },
                                    { label: 'Produkte', value: demoBusinesses.reduce((s: number, b: any) => s + (b.products || 0), 0) },
                                ].map(item => (
                                    <div key={item.label} className="bg-gray-900 rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-white">{item.value}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Business list */}
                            <div className="max-h-60 overflow-y-auto space-y-1.5">
                                {demoBusinesses.map((b: any) => (
                                    <div key={b.id} className="flex items-center gap-2 text-xs bg-gray-900/60 rounded-lg px-3 py-2">
                                        <span className="text-gray-500 font-mono text-[10px] w-16 shrink-0">{b.type}</span>
                                        <span className="text-white font-medium truncate flex-1">{b.name}</span>
                                        <span className="text-gray-400 shrink-0">{b.postalCode} {b.city}</span>
                                    </div>
                                ))}
                            </div>

                            {demoErrors.length > 0 && (
                                <div className="bg-yellow-950/30 rounded-lg p-3 text-xs text-yellow-400 space-y-1">
                                    <p className="font-medium">{demoErrors.length} Fehler:</p>
                                    {demoErrors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDemoCleanup}
                                    className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                                >
                                    Alle Demo-Betriebe löschen
                                </button>
                                <button
                                    onClick={() => setDemoPhase('idle')}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                >
                                    Schließen
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Cleaned */}
                    {demoPhase === 'cleaned' && demoCleanupStats && (
                        <div className="space-y-4">
                            <p className="text-green-400 font-medium text-sm">Demo-Betriebe wurden gelöscht.</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Betriebe', value: demoCleanupStats.businessesDeleted },
                                    { label: 'Kategorien', value: demoCleanupStats.categoriesDeleted },
                                    { label: 'Produkte', value: demoCleanupStats.productsDeleted },
                                ].map(item => (
                                    <div key={item.label} className="bg-gray-900 rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-white">{item.value}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => { setDemoPhase('idle'); setDemoCleanupStats(null); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Schließen
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {demoPhase === 'error' && (
                        <div className="space-y-3">
                            <p className="text-red-400 text-sm">{demoErrorMsg}</p>
                            <button
                                onClick={() => setDemoPhase('idle')}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Erneut versuchen
                            </button>
                        </div>
                    )}
                </section>

                {/* ── Test Data Cleanup ── */}
                <section className="bg-gray-800 rounded-xl border border-red-900/40 p-6">
                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Test Verilerini Temizle</h2>
                        <p className="text-xs text-gray-400 mt-1">
                            metin.oez@gmail.com hariç tüm kullanıcıları, siparişleri ve test verilerini siler.
                        </p>
                    </div>

                    {/* What gets deleted */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5 text-xs text-gray-400">
                        {['Firebase Auth', 'Siparişler', 'Adminler', 'Ratingler'].map(label => (
                            <div key={label} className="bg-gray-900/60 rounded px-3 py-2">{label}</div>
                        ))}
                    </div>

                    {/* Protected */}
                    <div className="bg-green-900/20 border border-green-800/30 rounded-lg px-4 py-2.5 mb-5 text-xs text-green-400">
                        metin.oez@gmail.com — korumalı, silinmez
                    </div>

                    {/* Idle */}
                    {phase === 'idle' && (
                        <button
                            onClick={() => setPhase('confirm')}
                            className="px-5 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Test Verilerini Temizle
                        </button>
                    )}

                    {/* Confirm */}
                    {phase === 'confirm' && (
                        <div className="space-y-3">
                            <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-3 text-sm">
                                <p className="text-red-300 font-medium mb-1">Bu işlem geri alınamaz.</p>
                                <p className="text-gray-400 text-xs">
                                    Devam etmek için <strong className="text-white">{CONFIRM_PHRASE}</strong> yazın.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder={`"${CONFIRM_PHRASE}" yaz`}
                                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-red-500"
                                />
                                <button
                                    onClick={handleCleanup}
                                    disabled={confirmText !== CONFIRM_PHRASE}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors"
                                >
                                    Bestätigen
                                </button>
                                <button
                                    onClick={() => { setPhase('idle'); setConfirmText(''); }}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {phase === 'loading' && (
                        <div className="flex items-center gap-3 text-yellow-400 text-sm">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-yellow-400" />
                            Wird bereinigt... Bitte warten (max. 5 Min.)
                        </div>
                    )}

                    {/* Done */}
                    {phase === 'done' && stats && (
                        <div className="space-y-4">
                            <p className="text-green-400 font-medium text-sm">Bereinigung abgeschlossen.</p>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                {[
                                    { label: 'Auth', value: stats.authDeleted },
                                    { label: 'Benutzer', value: stats.usersDeleted },
                                    { label: 'Admins', value: stats.adminsDeleted },
                                    { label: 'Bestellungen', value: stats.ordersDeleted },
                                    { label: 'Ratings', value: stats.ratingsDeleted },
                                    { label: 'Provisionen', value: stats.commissionRecordsDeleted },
                                    { label: 'Benachricht.', value: stats.notificationsDeleted },
                                    { label: 'Referenzen', value: stats.referralsDeleted },
                                    { label: 'Gruppenbestell.', value: stats.groupOrdersDeleted },
                                    { label: 'Betriebe Reset', value: stats.businessesReset },
                                    { label: 'Fehler', value: stats.errors.length },
                                ].map(item => (
                                    <div key={item.label} className="bg-gray-900 rounded-lg p-2.5 text-center">
                                        <div className={`text-lg font-bold ${item.label === 'Fehler' && item.value > 0 ? 'text-red-400' : 'text-white'}`}>
                                            {item.value}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            {stats.errors.length > 0 && (
                                <div className="bg-red-950/30 rounded-lg p-3 text-xs text-red-400 space-y-1">
                                    {stats.errors.map((e, i) => <div key={i}>{e}</div>)}
                                </div>
                            )}
                            <button
                                onClick={() => { setPhase('idle'); setStats(null); setConfirmText(''); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Schließen
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {phase === 'error' && (
                        <div className="space-y-3">
                            <p className="text-red-400 text-sm">{errorMsg}</p>
                            <button
                                onClick={() => { setPhase('idle'); setConfirmText(''); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Erneut versuchen
                            </button>
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}
