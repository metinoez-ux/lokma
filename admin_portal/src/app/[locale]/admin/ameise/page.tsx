'use client';

import React, { useState, useRef } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { auth } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

/* ── Types ── */
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
    businessesDeleted: number;
    shiftsDeleted: number;
    errors: string[];
}

export default function AmeisePage() {
    const { admin, loading } = useAdmin();
    const t = useTranslations('Ameise');

    /* ── Cleanup State ── */
    const CONFIRM_PHRASE = 'ALLE DATEN LOSCHEN';
    const CLEANUP_CATEGORIES = [
        { key: 'auth', label: 'Firebase Auth', desc: 'Login-Konten (E-Mail, Telefon, Google)', icon: '\ud83d\udd10' },
        { key: 'users', label: 'Benutzer', desc: 'Firestore user-Dokumente + Benachrichtigungen', icon: '\ud83d\udc65' },
        { key: 'admins', label: 'Adminler', desc: 'Nicht-Super-Admin Konten', icon: '\ud83d\udee1' },
        { key: 'orders', label: 'Bestellungen', desc: 'Alle Bestellungen, Warenkorbe, Liefernachweise', icon: '\ud83d\udce6' },
        { key: 'ratings', label: 'Bewertungen', desc: 'Bewertungen + Geschaftsstatistiken zurucksetzen', icon: '\u2b50' },
        { key: 'finance', label: 'Finanzen', desc: 'Provisionen, Gutscheine, Sponsoring, Nutzungsdaten', icon: '\ud83d\udcb0' },
        { key: 'notifications', label: 'Benachrichtigungen', desc: 'Geplante Push-Benachrichtigungen', icon: '\ud83d\udd14' },
        { key: 'referrals', label: 'Empfehlungen', desc: 'Referral / Empfehlungscodes', icon: '\ud83e\udd1d' },
        { key: 'reservations', label: 'Reservierungen', desc: 'Tischreservierungen', icon: '\ud83d\udcc5' },
        { key: 'activity_logs', label: 'Aktivitatsprotokolle', desc: 'Admin-Aktivitatslogdaten', icon: '\ud83d\udcdd' },
        { key: 'legal_reports', label: 'Meldungen', desc: 'Produkt-/Betriebsmeldungen', icon: '🚩' },
        { key: 'businesses', label: 'Betriebe', desc: 'Registrierte Betriebe + Menüs + Produkte', icon: '🏬' },
        { key: 'shifts', label: 'Arbeitszeiten', desc: 'Personal-Schichten (İş Saatleri)', icon: '⏱️' },
    ] as const;
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [businessDateFilter, setBusinessDateFilter] = useState<string>('today');
    const [confirmText, setConfirmText] = useState('');
    const [phase, setPhase] = useState<'idle' | 'confirm' | 'loading' | 'done' | 'error'>('idle');
    const [stats, setStats] = useState<CleanupStats | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    /* ── Demo-Daten State ── */
    type DemoPhase = 'idle' | 'searching' | 'results' | 'saving' | 'saved' | 'cleaning' | 'cleaned' | 'error';
    const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle');
    const [demoPlz, setDemoPlz] = useState('41836');
    const [demoStreet, setDemoStreet] = useState('Schulte-Braucks-Str. 1');
    const [demoMaxCount, setDemoMaxCount] = useState(20);
    const [demoFoundPlaces, setDemoFoundPlaces] = useState<any[]>([]);
    const [demoSelectedIds, setDemoSelectedIds] = useState<Set<string>>(new Set());
    const [demoSavedBusinesses, setDemoSavedBusinesses] = useState<any[]>([]);
    const [demoErrors, setDemoErrors] = useState<string[]>([]);
    const [demoCleanupStats, setDemoCleanupStats] = useState<any>(null);
    const [demoErrorMsg, setDemoErrorMsg] = useState('');

    /* ── Export/Import State ── */
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<any>(null);
    const [importResult, setImportResult] = useState<any>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const BUSINESS_TYPE_LABELS: Record<string, string> = {
        restoran: 'Restaurant', kasap: 'Metzgerei', cafe: 'Cafe',
        firin: 'Backerei', pastane: 'Konditorei', cigkofte: 'Cigkofte',
        market: 'Markt', imbiss: 'Imbiss',
    };

    /* ── Cleanup Handlers ── */
    const toggleCategory = (key: string) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAll = () => {
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
                body: JSON.stringify({
                    categories: Array.from(selectedCategories),
                    ...(selectedCategories.has('businesses') ? { businessDateFilter } : {}),
                }),
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

    /* ── Export ── */
    const handleExport = async () => {
        setExporting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/businesses/export', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Export fehlgeschlagen');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `lokma_betriebe_export_${date}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert('Export-Fehler: ' + e.message);
        }
        setExporting(false);
    };

    /* ── Import File Change ── */
    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFile(file);
        setImportResult(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                setImportPreview(data);
            } catch {
                setImportPreview(null);
                alert('Ungueltige JSON-Datei');
            }
        };
        reader.readAsText(file);
    };

    /* ── Import ── */
    const handleImport = async () => {
        if (!importPreview) return;
        setImporting(true);
        setImportResult(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/businesses/import', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(importPreview),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Import fehlgeschlagen');
            setImportResult(data.stats);
            setImportFile(null);
            setImportPreview(null);
        } catch (e: any) {
            alert('Import-Fehler: ' + e.message);
        }
        setImporting(false);
    };

    /* ── Demo Search (Phase 1) ── */
    const handleDemoSearch = async () => {
        if (!demoPlz.trim()) return;
        setDemoPhase('searching');
        setDemoFoundPlaces([]);
        setDemoSelectedIds(new Set());
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const res = await fetch('/api/demo-data/seed', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    postalCode: demoPlz.trim(), 
                    street: demoStreet.trim(),
                    maxBusinesses: demoMaxCount, 
                    dryRun: true 
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Suche fehlgeschlagen');
            setDemoFoundPlaces(data.foundPlaces || []);
            if ((data.foundPlaces || []).length > 0) {
                const selectable = (data.foundPlaces || []).filter((p: any) => !p.alreadyAdded);
                setDemoSelectedIds(new Set(selectable.map((p: any) => p.placeId)));
            }
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
        setDemoSavedBusinesses([]);
        setDemoErrors([]);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');
            const selectedPlaces = demoFoundPlaces
                .filter((p: any) => demoSelectedIds.has(p.placeId))
                .map((p: any) => p.placeId);
            const res = await fetch('/api/demo-data/seed', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    postalCode: demoPlz.trim(), 
                    street: demoStreet.trim(),
                    maxBusinesses: demoMaxCount, 
                    dryRun: false, 
                    selectedPlaceIds: selectedPlaces 
                }),
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
                    <h1 className="text-2xl font-bold">{t('ameise_title')}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t('datenimport_export_und_bereinigung')}</p>
                </div>

                {/* ── Betriebe Export / Import ── */}
                <section className="bg-card rounded-xl border border-emerald-900/40 p-6">
                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">{t('betriebe_export_import')}</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Alle Betriebe mit Kategorien, Produkten, Offnungszeiten und allen Daten als JSON sichern oder wiederherstellen.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-4">
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {exporting ? (
                                <>
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white" />{t('exportiere')}</>
                            ) : (
                                'JSON Export'
                            )}
                        </button>

                        <button
                            onClick={() => importInputRef.current?.click()}
                            disabled={importing}
                            className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >{t('json_import')}</button>
                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImportFileChange}
                        />
                    </div>

                    {/* Import Preview */}
                    {importPreview && (
                        <div className="space-y-3">
                            <div className="bg-background/60 rounded-lg p-4">
                                <p className="text-sm text-foreground font-medium mb-2">{t('import_vorschau')}</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-card rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-foreground">{importPreview.businessCount || importPreview.businesses?.length || 0}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">Betriebe</div>
                                    </div>
                                    <div className="bg-card rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-foreground">
                                            {(importPreview.businesses || []).reduce((s: number, b: any) => s + (b.categories?.length || 0), 0)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">Kategorien</div>
                                    </div>
                                    <div className="bg-card rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-foreground">
                                            {(importPreview.businesses || []).reduce((s: number, b: any) => s + (b.products?.length || 0), 0)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">Produkte</div>
                                    </div>
                                </div>
                                {importPreview.exportedAt && (
                                    <p className="text-[10px] text-gray-500 mt-2">
                                        Exportiert am: {new Date(importPreview.exportedAt).toLocaleString('de-DE')}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    {importing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white" />
                                            Importiere...
                                        </>
                                    ) : (
                                        `${importPreview.businesses?.length || 0} Betriebe importieren`
                                    )}
                                </button>
                                <button
                                    onClick={() => { setImportFile(null); setImportPreview(null); }}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                >{t('abbrechen')}</button>
                            </div>
                        </div>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div className="space-y-3">
                            <p className="text-green-800 dark:text-green-400 font-medium text-sm">Import abgeschlossen.</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Importiert', value: importResult.imported },
                                    { label: 'Uebersprungen', value: importResult.skipped },
                                    { label: 'Kategorien', value: importResult.categoriesCreated },
                                    { label: 'Produkte', value: importResult.productsCreated },
                                ].map(item => (
                                    <div key={item.label} className="bg-background rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-foreground">{item.value}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            {importResult.errors?.length > 0 && (
                                <div className="bg-red-950/30 rounded-lg p-3 text-xs text-red-800 dark:text-red-400 space-y-1">
                                    {importResult.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                                </div>
                            )}
                            <button
                                onClick={() => setImportResult(null)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >{t('schliessen')}</button>
                        </div>
                    )}
                </section>

                {/* ── Demo-Daten (Betrieb Import) ── */}
                <section className="bg-card rounded-xl border border-blue-900/40 p-6">
                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-400 uppercase tracking-wider">Betrieb Import (Google Places)</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Google Places uzerinden gercek isletmeleri ara, sec ve sisteme ekle.
                            Her isletme icin otomatik menu olusturulur.
                        </p>
                    </div>

                    {/* Search form */}
                    {(demoPhase === 'idle' || demoPhase === 'results') && (
                        <div className="space-y-3 mb-5">
                            <div className="flex gap-3">
                                <div className="flex-[2]">
                                    <label className="block text-[10px] text-gray-500 mb-1">Strasse & Hausnr. (Merkez)</label>
                                    <input
                                        type="text"
                                        value={demoStreet}
                                        onChange={e => setDemoStreet(e.target.value)}
                                        placeholder="z.B. Hauptstr. 1"
                                        className="w-full px-3 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="block text-[10px] text-gray-500 mb-1">PLZ</label>
                                    <input
                                        type="text"
                                        value={demoPlz}
                                        onChange={e => setDemoPlz(e.target.value)}
                                        placeholder="z.B. 41836"
                                        className="w-full px-3 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-[10px] text-gray-500 mb-1">Max. Anzahl</label>
                                    <input
                                        type="number"
                                        value={demoMaxCount}
                                        onChange={e => setDemoMaxCount(Number(e.target.value))}
                                        min={1}
                                        max={60}
                                        className="w-full px-3 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleDemoSearch}
                                        disabled={false}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                                    >{t('suchen')}</button>
                                </div>
                            </div>
                            {/* Demo cleanup button */}
                            <button
                                onClick={handleDemoCleanup}
                                className="text-xs text-gray-500 hover:text-red-800 dark:text-red-400 transition-colors"
                            >
                                Demo-Betriebe loschen
                            </button>
                        </div>
                    )}

                    {/* Searching */}
                    {demoPhase === 'searching' && (
                        <div className="flex items-center gap-3 text-blue-800 dark:text-blue-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-400" />
                            Google Places API wird abgefragt...
                        </div>
                    )}

                    {/* Results */}
                    {demoPhase === 'results' && demoFoundPlaces.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-muted-foreground">
                                    {demoFoundPlaces.length} Betriebe gefunden, {demoSelectedIds.size} ausgewahlt
                                </p>
                                <button onClick={toggleAllDemoPlaces} className="text-xs text-blue-800 dark:text-blue-400 hover:text-blue-300">
                                    {demoSelectedIds.size === demoFoundPlaces.filter((p: any) => !p.alreadyAdded).length ? 'Keine' : 'Alle'} auswahlen
                                </button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
                                {demoFoundPlaces.map((p: any) => (
                                    <div
                                        key={p.placeId}
                                        onClick={() => !p.alreadyAdded && toggleDemoPlace(p.placeId)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                                            p.alreadyAdded
                                                ? 'bg-gray-700/30 text-gray-600 cursor-not-allowed'
                                                : demoSelectedIds.has(p.placeId)
                                                    ? 'bg-blue-950/40 border border-blue-600/40 text-white'
                                                    : 'bg-gray-700/40 border border-transparent text-muted-foreground hover:text-white hover:border-gray-600'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                            p.alreadyAdded ? 'border-gray-600 bg-gray-700' :
                                                demoSelectedIds.has(p.placeId)
                                                    ? 'border-blue-500 bg-blue-600' : 'border-gray-500'
                                        }`}>
                                            {(demoSelectedIds.has(p.placeId) || p.alreadyAdded) && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{p.name}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{p.address}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                p.alreadyAdded ? 'bg-green-900/30 text-green-600' : 'bg-gray-600/30 text-muted-foreground'
                                            }`}>
                                                {p.alreadyAdded ? 'Vorhanden' : (BUSINESS_TYPE_LABELS[p.businessType] || p.businessType)}
                                            </span>
                                            {p.rating && <div className="text-[10px] text-yellow-500 mt-0.5">{p.rating}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={handleDemoSave}
                                disabled={demoSelectedIds.size === 0}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {demoSelectedIds.size} Betriebe importieren
                            </button>
                        </div>
                    )}

                    {demoPhase === 'results' && demoFoundPlaces.length === 0 && (
                        <p className="text-gray-500 text-sm">Keine Betriebe gefunden fur PLZ {demoPlz}.</p>
                    )}

                    {/* Saving */}
                    {demoPhase === 'saving' && (
                        <div className="flex items-center gap-3 text-blue-800 dark:text-blue-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-400" />
                            {demoSelectedIds.size} Betriebe werden importiert...
                        </div>
                    )}

                    {/* Saved */}
                    {demoPhase === 'saved' && (
                        <div className="space-y-4">
                            <p className="text-green-800 dark:text-green-400 font-medium text-sm">
                                {demoSavedBusinesses.length} Betriebe erfolgreich importiert.
                            </p>
                            {demoErrors.length > 0 && (
                                <div className="bg-red-950/30 rounded-lg p-3 text-xs text-red-800 dark:text-red-400 space-y-1">
                                    {demoErrors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                                </div>
                            )}
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                                {demoSavedBusinesses.map((b: any, i: number) => (
                                    <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                                        <span className="text-green-500">+</span>
                                        <span className="text-foreground font-medium">{b.companyName}</span>
                                        <span className="text-gray-600">({BUSINESS_TYPE_LABELS[b.businessType] || b.businessType})</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => { setDemoPhase('idle'); setDemoSavedBusinesses([]); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >{t('schliessen')}</button>
                        </div>
                    )}

                    {/* Cleaning */}
                    {demoPhase === 'cleaning' && (
                        <div className="flex items-center gap-3 text-yellow-800 dark:text-yellow-400 text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-yellow-400" />
                            Demo-Betriebe werden geloscht...
                        </div>
                    )}

                    {/* Cleaned */}
                    {demoPhase === 'cleaned' && demoCleanupStats && (
                        <div className="space-y-4">
                            <p className="text-green-800 dark:text-green-400 font-medium text-sm">Demo-Betriebe wurden geloscht.</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Betriebe', value: demoCleanupStats.businessesDeleted },
                                    { label: 'Kategorien', value: demoCleanupStats.categoriesDeleted },
                                    { label: 'Produkte', value: demoCleanupStats.productsDeleted },
                                ].map(item => (
                                    <div key={item.label} className="bg-background rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-foreground">{item.value}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => { setDemoPhase('idle'); setDemoCleanupStats(null); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >{t('schliessen')}</button>
                        </div>
                    )}

                    {/* Error */}
                    {demoPhase === 'error' && (
                        <div className="space-y-3">
                            <p className="text-red-800 dark:text-red-400 text-sm">{demoErrorMsg}</p>
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
                <section className="bg-card rounded-xl border border-red-900/40 p-6">
                    <div className="mb-4">
                        <h2 className="text-sm font-semibold text-red-800 dark:text-red-400 uppercase tracking-wider">{t('test_verilerini_temizle')}</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            metin.oez@gmail.com haric secilen kategorilerdeki test verilerini siler.
                        </p>
                    </div>

                    {/* Protected */}
                    <div className="bg-green-900/20 border border-green-800/30 rounded-lg px-4 py-2.5 mb-5 text-xs text-green-800 dark:text-green-400">
                        metin.oez@gmail.com -- korumali, silinmez
                    </div>

                    {/* Category toggle cards */}
                    {(phase === 'idle' || phase === 'confirm') && (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-muted-foreground">Temizlenecek verileri secin:</p>
                                <button onClick={toggleAll} className="text-xs text-blue-800 dark:text-blue-400 hover:text-blue-300">
                                    {selectedCategories.size === CLEANUP_CATEGORIES.length ? 'Keine' : 'Alle'} auswahlen
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
                                                    : 'bg-background/60 border-border/40 text-gray-500 hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm">{cat.icon}</span>
                                                <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
                                                    {cat.label}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 leading-tight">{cat.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Date filter for businesses */}
                            {selectedCategories.has('businesses') && (
                                <div className="bg-background/60 rounded-lg px-4 py-3 mb-5 flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>Betriebe-Filter:</span>
                                    </div>
                                    <select
                                        title="Betriebe Datumsfilter"
                                        value={businessDateFilter}
                                        onChange={e => setBusinessDateFilter(e.target.value)}
                                        className="px-3 py-1.5 bg-card text-white text-xs rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none"
                                    >
                                        <option value="today">Heute hinzugefuegt</option>
                                        <option value="yesterday">Gestern hinzugefuegt</option>
                                        <option value="7days">Letzte 7 Tage</option>
                                        <option value="30days">Letzte 30 Tage</option>
                                        <option value="all">Alle Betriebe</option>
                                    </select>
                                    {businessDateFilter === 'all' && (
                                        <span className="text-[10px] text-red-800 dark:text-red-400 font-medium">Alle Betriebe werden geloscht!</span>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Idle */}
                    {phase === 'idle' && (
                        <button
                            onClick={() => selectedCategories.size > 0 && setPhase('confirm')}
                            disabled={selectedCategories.size === 0}
                            className="px-5 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Kategorie auswahlen
                        </button>
                    )}

                    {/* Confirm */}
                    {phase === 'confirm' && (
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Zum Bestatigen <span className="font-mono text-red-800 dark:text-red-400">{CONFIRM_PHRASE}</span> eingeben:
                            </p>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder={CONFIRM_PHRASE}
                                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-red-600/40 focus:border-red-500 focus:outline-none font-mono"
                                />
                                <button
                                    onClick={handleCleanup}
                                    disabled={confirmText !== CONFIRM_PHRASE}
                                    className="px-5 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Jetzt loschen
                                </button>
                                <button
                                    onClick={() => { setPhase('idle'); setConfirmText(''); }}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                >{t('abbrechen')}</button>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {phase === 'loading' && (
                        <div className="flex items-center gap-3 text-yellow-800 dark:text-yellow-400 text-sm">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-yellow-400" />
                            {selectedCategories.size} Kategorie{selectedCategories.size > 1 ? 'n' : ''} werden bereinigt... Bitte warten.
                        </div>
                    )}

                    {/* Done */}
                    {phase === 'done' && stats && (
                        <div className="space-y-4">
                            <p className="text-green-800 dark:text-green-400 font-medium text-sm">Bereinigung abgeschlossen.</p>
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
                                    { label: 'Betriebe gelöscht', value: stats.businessesDeleted },
                                    { label: 'Arbeitszeiten', value: stats.shiftsDeleted },
                                ].filter(item => item.value > 0).map(item => (
                                    <div key={item.label} className="bg-background rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-foreground">{item.value}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                                {stats.errors.length > 0 && (
                                    <div className="bg-background rounded-lg p-2.5 text-center">
                                        <div className="text-lg font-bold text-red-800 dark:text-red-400">{stats.errors.length}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">Fehler</div>
                                    </div>
                                )}
                            </div>
                            {stats.errors.length > 0 && (
                                <div className="bg-red-950/30 rounded-lg p-3 text-xs text-red-800 dark:text-red-400 space-y-1">
                                    {stats.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                                </div>
                            )}
                            <button
                                onClick={() => { setPhase('idle'); setStats(null); setConfirmText(''); setSelectedCategories(new Set()); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >{t('schliessen')}</button>
                        </div>
                    )}

                    {/* Error */}
                    {phase === 'error' && (
                        <div className="space-y-3">
                            <p className="text-red-800 dark:text-red-400 text-sm">{errorMsg}</p>
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
