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
    activityLogsDeleted: number;
    legalReportsDeleted: number;
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

    /* Cleanup categories */
    const CLEANUP_CATEGORIES = [
        { key: 'auth', label: 'Firebase Auth', desc: 'Login-Konten (E-Mail, Telefon, Google)', icon: '🔐' },
        { key: 'users', label: 'Benutzer', desc: 'Firestore user-Dokumente + Benachrichtigungen', icon: '👥' },
        { key: 'admins', label: 'Adminler', desc: 'Nicht-Super-Admin Konten', icon: '🛡' },
        { key: 'orders', label: 'Bestellungen', desc: 'Alle Bestellungen, Warenkörbe, Liefernachweise', icon: '📦' },
        { key: 'ratings', label: 'Bewertungen', desc: 'Bewertungen + Geschäftsstatistiken zurücksetzen', icon: '⭐' },
        { key: 'finance', label: 'Finanzen', desc: 'Provisionen, Gutscheine, Sponsoring, Nutzungsdaten', icon: '💰' },
        { key: 'notifications', label: 'Benachrichtigungen', desc: 'Geplante Push-Benachrichtigungen', icon: '🔔' },
        { key: 'referrals', label: 'Empfehlungen', desc: 'Referral / Empfehlungscodes', icon: '🤝' },
        { key: 'reservations', label: 'Reservierungen', desc: 'Tischreservierungen', icon: '📅' },
        { key: 'activity_logs', label: 'Aktivitatsprotokolle', desc: 'Admin-Aktivitatslogdaten', icon: '📝' },
        { key: 'legal_reports', label: 'Meldungen', desc: 'Produkt-/Betriebsmeldungen', icon: '🚩' },
    ] as const;
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

    /* Demo-Daten */
    type DemoPhase = 'idle' | 'searching' | 'results' | 'saving' | 'saved' | 'cleaning' | 'cleaned' | 'error';
    const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle');
    const [demoPlz, setDemoPlz] = useState('41836');
    const [demoMaxResults, setDemoMaxResults] = useState(20);
    const [demoFoundPlaces, setDemoFoundPlaces] = useState<any[]>([]);
    const [demoSelectedIds, setDemoSelectedIds] = useState<Set<string>>(new Set());
    const [demoCityName, setDemoCityName] = useState('');
    const [demoSavedBusinesses, setDemoSavedBusinesses] = useState<any[]>([]);
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
    const toggleCategory = (key: string) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllCategories = () => {
        if (selectedCategories.size === CLEANUP_CATEGORIES.length) {
            setSelectedCategories(new Set());
        } else {
            setSelectedCategories(new Set(CLEANUP_CATEGORIES.map(c => c.key)));
        }
    };

    const handleCleanup = async () => {
        if (confirmText !== CONFIRM_PHRASE) return;
        if (selectedCategories.size === 0) return;
        setPhase('loading');
        setErrorMsg('');
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/cleanup-test-data', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories: Array.from(selectedCategories) }),
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

    /* ── Demo Search (Phase 1) ── */
    const handleDemoSearch = async () => {
        if (!demoPlz.trim()) return;
        setDemoPhase('searching');
        setDemoErrorMsg('');
        setDemoFoundPlaces([]);
        setDemoSelectedIds(new Set());
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/demo-data/seed', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'search', postalCode: demoPlz, maxResults: demoMaxResults }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Suche fehlgeschlagen');
            setDemoFoundPlaces(data.places || []);
            setDemoCityName(data.cityName || demoPlz);
            setDemoErrors(data.errors || []);
            // Automatisch alle nicht-eklenmis isletmeleri sec
            const autoSelect = new Set<string>();
            (data.places || []).forEach((p: any) => { if (!p.alreadyAdded) autoSelect.add(p.placeId); });
            setDemoSelectedIds(autoSelect);
            setDemoPhase('results');
        } catch (e: any) {
            setDemoErrorMsg(e.message);
            setDemoPhase('error');
        }
    };

    /* ── Demo Save (Phase 2) ── */
    const handleDemoSave = async () => {
        if (demoSelectedIds.size === 0) return;
        setDemoPhase('saving');
        setDemoErrorMsg('');
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/demo-data/seed', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'save', placeIds: Array.from(demoSelectedIds) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen');
            setDemoSavedBusinesses(data.businesses || []);
            setDemoErrors(data.errors || []);
            setDemoPhase('saved');
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
            setDemoFoundPlaces([]);
            setDemoPhase('cleaned');
        } catch (e: any) {
            setDemoErrorMsg(e.message);
            setDemoPhase('error');
        }
    };

    const toggleDemoPlace = (placeId: string) => {
        setDemoSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(placeId)) next.delete(placeId);
            else next.add(placeId);
            return next;
        });
    };

    const toggleAllDemoPlaces = () => {
        const selectable = demoFoundPlaces.filter((p: any) => !p.alreadyAdded);
        if (demoSelectedIds.size === selectable.length) {
            setDemoSelectedIds(new Set());
        } else {
            setDemoSelectedIds(new Set(selectable.map((p: any) => p.placeId)));
        }
    };

    const BUSINESS_TYPE_LABELS: Record<string, string> = {
        restoran: 'Restaurant', kasap: 'Metzgerei', cafe: 'Cafe',
        firin: 'Backerei', pastane: 'Konditorei', cigkofte: 'Cigkofte',
        market: 'Markt', imbiss: 'Imbiss',
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

                {/* ── Demo-Daten (Betrieb Import) ── */}
                <section className="bg-gray-800 rounded-xl border border-blue-900/40 p-6">
                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Betrieb Import (Google Places)</h2>
                        <p className="text-xs text-gray-400 mt-1">
                            Google Places uzerinden gercek isletmeleri ara, sec ve sisteme ekle.
                            Her isletme icin otomatik menu olusturulur.
                        </p>
                    </div>

                    {/* Search form -- visible in idle and results */}
                    {(demoPhase === 'idle' || demoPhase === 'results') && (
                        <div className="space-y-3 mb-5">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] text-gray-500 mb-1">PLZ</label>
                                    <input
                                        type="text"
                                        value={demoPlz}
                                        onChange={e => setDemoPlz(e.target.value)}
                                        placeholder="z.B. 41836"
                                        className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-[10px] text-gray-500 mb-1">Max. Anzahl</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={demoMaxResults}
                                        onChange={e => setDemoMaxResults(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                                        className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleDemoSearch}
                                        disabled={!demoPlz.trim()}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Suchen
                                    </button>
                                </div>
                            </div>
                            {demoPhase === 'idle' && (
                                <button
                                    onClick={handleDemoCleanup}
                                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    Demo-Betriebe loschen
                                </button>
                            )}
                        </div>
                    )}

                    {/* Searching */}
                    {demoPhase === 'searching' && (
                        <div className="flex items-center gap-3 text-blue-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-400" />
                            <div>
                                <p className="font-medium">PLZ {demoPlz} wird gesucht...</p>
                                <p className="text-xs text-gray-400 mt-0.5">Google Places'ten isletmeler aliniyor.</p>
                            </div>
                        </div>
                    )}

                    {/* Results -- checkbox list */}
                    {demoPhase === 'results' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-300">
                                    <span className="text-blue-400 font-medium">{demoFoundPlaces.length}</span> Betriebe in <span className="text-white font-medium">{demoCityName}</span> gefunden
                                </p>
                                <button
                                    onClick={toggleAllDemoPlaces}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {demoSelectedIds.size === demoFoundPlaces.filter((p: any) => !p.alreadyAdded).length ? 'Alle abwahlen' : 'Alle auswahlen'}
                                </button>
                            </div>

                            <div className="max-h-80 overflow-y-auto space-y-1">
                                {demoFoundPlaces.map((p: any) => {
                                    const isSelected = demoSelectedIds.has(p.placeId);
                                    return (
                                        <button
                                            key={p.placeId}
                                            onClick={() => !p.alreadyAdded && toggleDemoPlace(p.placeId)}
                                            disabled={p.alreadyAdded}
                                            className={`w-full text-left flex items-center gap-2.5 text-xs rounded-lg px-3 py-2.5 border transition-all ${
                                                p.alreadyAdded
                                                    ? 'bg-gray-900/30 border-gray-800 opacity-50 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-blue-950/40 border-blue-600/50'
                                                        : 'bg-gray-900/60 border-gray-700/40 hover:border-gray-600'
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                                p.alreadyAdded
                                                    ? 'border-gray-600 bg-gray-700'
                                                    : isSelected
                                                        ? 'border-blue-500 bg-blue-500'
                                                        : 'border-gray-600'
                                            }`}>
                                                {(isSelected || p.alreadyAdded) && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Type badge */}
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                                                p.type === 'kasap' ? 'bg-red-900/40 text-red-400'
                                                : p.type === 'cafe' ? 'bg-amber-900/40 text-amber-400'
                                                : p.type === 'firin' ? 'bg-orange-900/40 text-orange-400'
                                                : p.type === 'pastane' ? 'bg-pink-900/40 text-pink-400'
                                                : 'bg-blue-900/40 text-blue-400'
                                            }`}>
                                                {BUSINESS_TYPE_LABELS[p.type] || p.type}
                                            </span>

                                            {/* Name */}
                                            <span className={`font-medium truncate flex-1 ${p.alreadyAdded ? 'text-gray-500' : 'text-white'}`}>
                                                {p.name}
                                            </span>

                                            {/* Google rating */}
                                            {p.rating && (
                                                <span className="text-yellow-500 text-[10px] shrink-0">
                                                    {p.rating} ({p.userRatingsTotal})
                                                </span>
                                            )}

                                            {/* Already added tag */}
                                            {p.alreadyAdded && (
                                                <span className="text-[10px] text-green-600 shrink-0">Bereits vorhanden</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {demoErrors.length > 0 && (
                                <div className="bg-yellow-950/30 rounded-lg p-2 text-xs text-yellow-400">
                                    {demoErrors.length} Fehler bei der Suche
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDemoSave}
                                    disabled={demoSelectedIds.size === 0}
                                    className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    {demoSelectedIds.size === 0
                                        ? 'Betrieb auswahlen'
                                        : `${demoSelectedIds.size} Betrieb${demoSelectedIds.size > 1 ? 'e' : ''} importieren`
                                    }
                                </button>
                                <button
                                    onClick={() => setDemoPhase('idle')}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Saving */}
                    {demoPhase === 'saving' && (
                        <div className="flex items-center gap-3 text-blue-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-400" />
                            <div>
                                <p className="font-medium">{demoSelectedIds.size} Betriebe werden importiert...</p>
                                <p className="text-xs text-gray-400 mt-0.5">Details und Menus werden erstellt. Bitte warten.</p>
                            </div>
                        </div>
                    )}

                    {/* Saved */}
                    {demoPhase === 'saved' && (
                        <div className="space-y-4">
                            <p className="text-green-400 font-medium text-sm">
                                {demoSavedBusinesses.length} Betriebe erfolgreich importiert!
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Betriebe', value: demoSavedBusinesses.length },
                                    { label: 'Kategorien', value: demoSavedBusinesses.reduce((s: number, b: any) => s + (b.categories || 0), 0) },
                                    { label: 'Produkte', value: demoSavedBusinesses.reduce((s: number, b: any) => s + (b.products || 0), 0) },
                                ].map(item => (
                                    <div key={item.label} className="bg-gray-900 rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-white">{item.value}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {demoSavedBusinesses.map((b: any) => (
                                    <div key={b.id} className="flex items-center gap-2 text-xs bg-gray-900/60 rounded-lg px-3 py-2">
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                            b.type === 'kasap' ? 'bg-red-900/40 text-red-400'
                                            : b.type === 'cafe' ? 'bg-amber-900/40 text-amber-400'
                                            : 'bg-blue-900/40 text-blue-400'
                                        }`}>{BUSINESS_TYPE_LABELS[b.type] || b.type}</span>
                                        <span className="text-white font-medium truncate flex-1">{b.name}</span>
                                        <span className="text-gray-500 text-[10px]">{b.categories} Kat. / {b.products} Prod.</span>
                                    </div>
                                ))}
                            </div>
                            {demoErrors.length > 0 && (
                                <div className="bg-yellow-950/30 rounded-lg p-2 text-xs text-yellow-400">
                                    {demoErrors.length} Fehler beim Import
                                </div>
                            )}
                            <button
                                onClick={() => { setDemoPhase('idle'); setDemoSavedBusinesses([]); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Schliessen
                            </button>
                        </div>
                    )}

                    {/* Cleaning */}
                    {demoPhase === 'cleaning' && (
                        <div className="flex items-center gap-3 text-yellow-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-yellow-400" />
                            Demo-Betriebe werden geloscht...
                        </div>
                    )}

                    {/* Cleaned */}
                    {demoPhase === 'cleaned' && demoCleanupStats && (
                        <div className="space-y-4">
                            <p className="text-green-400 font-medium text-sm">Demo-Betriebe wurden geloscht.</p>
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
                                Schliessen
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
                            metin.oez@gmail.com haric secilen kategorilerdeki test verilerini siler.
                        </p>
                    </div>

                    {/* Protected */}
                    <div className="bg-green-900/20 border border-green-800/30 rounded-lg px-4 py-2.5 mb-5 text-xs text-green-400">
                        metin.oez@gmail.com -- korumali, silinmez
                    </div>

                    {/* Category toggle cards */}
                    {(phase === 'idle' || phase === 'confirm') && (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-gray-500">Temizlenecek verileri secin:</span>
                                <button
                                    onClick={toggleAllCategories}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {selectedCategories.size === CLEANUP_CATEGORIES.length ? 'Alle abwahlen' : 'Alle auswahlen'}
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-5">
                                {CLEANUP_CATEGORIES.map(cat => {
                                    const isSelected = selectedCategories.has(cat.key);
                                    return (
                                        <button
                                            key={cat.key}
                                            onClick={() => toggleCategory(cat.key)}
                                            className={`text-left rounded-lg px-3 py-2.5 border transition-all duration-150 ${
                                                isSelected
                                                    ? 'bg-red-950/40 border-red-600/60 text-white'
                                                    : 'bg-gray-900/60 border-gray-700/40 text-gray-500 hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm">{cat.icon}</span>
                                                <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                                    {cat.label}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 leading-tight">{cat.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Idle */}
                    {phase === 'idle' && (
                        <button
                            onClick={() => { if (selectedCategories.size > 0) setPhase('confirm'); }}
                            disabled={selectedCategories.size === 0}
                            className="px-5 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {selectedCategories.size === 0
                                ? 'Kategorie auswahlen'
                                : `${selectedCategories.size} Kategorie${selectedCategories.size > 1 ? 'n' : ''} bereinigen`
                            }
                        </button>
                    )}

                    {/* Confirm */}
                    {phase === 'confirm' && (
                        <div className="space-y-3">
                            <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-3 text-sm">
                                <p className="text-red-300 font-medium mb-1">Bu islem geri alinamaz.</p>
                                <p className="text-gray-400 text-xs">
                                    {selectedCategories.size} kategori secildi. Devam etmek icin <strong className="text-white">{CONFIRM_PHRASE}</strong> yazin.
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
                                    Bestatigen
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
                            {selectedCategories.size} Kategorie{selectedCategories.size > 1 ? 'n' : ''} werden bereinigt... Bitte warten.
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
                                    { label: 'Bewertungen', value: stats.ratingsDeleted },
                                    { label: 'Provisionen', value: stats.commissionRecordsDeleted },
                                    { label: 'Benachricht.', value: stats.notificationsDeleted },
                                    { label: 'Empfehlungen', value: stats.referralsDeleted },
                                    { label: 'Gruppenbestell.', value: stats.groupOrdersDeleted },
                                    { label: 'Reservierungen', value: stats.reservationsDeleted },
                                    { label: 'Protokolle', value: stats.activityLogsDeleted },
                                    { label: 'Meldungen', value: stats.legalReportsDeleted },
                                    { label: 'Betriebe Reset', value: stats.businessesReset },
                                ].filter(item => item.value > 0).map(item => (
                                    <div key={item.label} className="bg-gray-900 rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-white">{item.value}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                                {stats.errors.length > 0 && (
                                    <div className="bg-gray-900 rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-red-400">{stats.errors.length}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">Fehler</div>
                                    </div>
                                )}
                            </div>
                            {stats.errors.length > 0 && (
                                <div className="bg-red-950/30 rounded-lg p-3 text-xs text-red-400 space-y-1">
                                    {stats.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                                </div>
                            )}
                            <button
                                onClick={() => { setPhase('idle'); setStats(null); setConfirmText(''); setSelectedCategories(new Set()); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Schliessen
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
