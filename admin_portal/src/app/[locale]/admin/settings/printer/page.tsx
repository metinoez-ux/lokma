'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import {
    PrinterSettings,
    DEFAULT_PRINTER_SETTINGS,
    checkHealth,
    testPrint,
    PrinterHealthState,
    DEFAULT_HEALTH_STATE,
} from '@/services/printerService';

const STORAGE_KEY = 'lokma_printer_settings';

export default function PrinterSettingsPage() {
    const t = useTranslations('AdminSettings');
    const { admin } = useAdmin();

    const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
    const [health, setHealth] = useState<PrinterHealthState>(DEFAULT_HEALTH_STATE);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [saved, setSaved] = useState(false);

    // Load from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setSettings(JSON.parse(raw));
        } catch { /* ignore */ }
    }, []);

    // Save settings
    const save = (next: PrinterSettings) => {
        setSettings(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Health check on load & when settings change
    useEffect(() => {
        if (!settings.enabled || !settings.printerIp) {
            setHealth(DEFAULT_HEALTH_STATE);
            return;
        }

        let cancelled = false;
        const doCheck = async () => {
            setHealth(prev => ({ ...prev, status: 'checking' }));
            const result = await checkHealth(settings);
            if (cancelled) return;
            setHealth({
                status: result.online ? 'online' : 'offline',
                lastChecked: new Date(),
                lastOnline: result.online ? new Date() : health.lastOnline,
                responseTimeMs: result.responseTimeMs,
                consecutiveFailures: result.online ? 0 : health.consecutiveFailures + 1,
                error: result.error,
            });
        };

        doCheck();
        const interval = setInterval(doCheck, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.enabled, settings.printerIp, settings.printerPort, settings.printServerUrl]);

    // Test print handler
    const handleTestPrint = async () => {
        setTesting(true);
        setTestResult(null);
        const result = await testPrint(settings, admin?.businessName || 'LOKMA');
        setTestResult({ ok: result.success, msg: result.message });
        setTesting(false);
    };

    return (
        <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
            <div className="max-w-2xl mx-auto">
                {/* Back Link */}
                <div className="flex items-center gap-3 mb-2">
                    <a href="/admin/settings" className="text-muted-foreground hover:text-white transition">← Zurück</a>
                </div>

                <h1 className="text-3xl font-bold mb-2">🖨️ Bon-Drucker Einstellungen</h1>
                <p className="text-muted-foreground mb-8">Konfigurieren Sie Ihren Bondrucker für den automatischen Belegdruck.</p>

                {/* ─── Main Config Card ─── */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                        ⚙️ Verbindungseinstellungen
                        {saved && <span className="text-xs bg-green-500/20 text-green-800 dark:text-green-400 px-2 py-0.5 rounded-full">✓ Gespeichert</span>}
                    </h2>

                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border mb-4">
                        <div>
                            <h3 className="font-semibold text-foreground">Drucker aktivieren</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Bon-Drucker für die Bestellverarbeitung aktivieren</p>
                        </div>
                        <button
                            onClick={() => save({ ...settings, enabled: !settings.enabled })}
                            className={`relative w-14 h-7 rounded-full transition-colors ${settings.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 bg-card dark:bg-slate-800 rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {/* IP Address */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-muted-foreground text-sm font-medium block mb-2">IP-Adresse</label>
                            <input
                                type="text"
                                value={settings.printerIp}
                                onChange={(e) => save({ ...settings, printerIp: e.target.value })}
                                placeholder="z.B. 192.168.188.177"
                                className="w-full px-4 py-3 bg-background text-foreground rounded-xl border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition placeholder:text-gray-600"
                            />
                            <p className="text-xs text-gray-600 mt-1">Die lokale Netzwerkadresse Ihres Druckers</p>
                        </div>
                        <div>
                            <label className="text-muted-foreground text-sm font-medium block mb-2">Port</label>
                            <input
                                type="number"
                                value={settings.printerPort}
                                onChange={(e) => save({ ...settings, printerPort: parseInt(e.target.value) || 9100 })}
                                className="w-full px-4 py-3 bg-background text-foreground rounded-xl border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                            />
                            <p className="text-xs text-gray-600 mt-1">Standard: 9100 (ESC/POS)</p>
                        </div>
                    </div>

                    {/* Print Server URL (Local Relay) */}
                    <div className="mb-4">
                        <label className="text-muted-foreground text-sm font-medium block mb-2">
                            🔗 Print-Server (Lokal Relay)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.printServerUrl || ''}
                                onChange={(e) => save({ ...settings, printServerUrl: e.target.value })}
                                placeholder="z.B. http://192.168.x.x:3000"
                                className="flex-1 px-4 py-3 bg-background text-foreground rounded-xl border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition placeholder:text-gray-600 font-mono text-sm"
                            />
                            <button
                                onClick={() => save({ ...settings, printServerUrl: 'http://localhost:3000' })}
                                className="px-4 py-3 bg-card text-foreground rounded-xl border border-gray-600 hover:bg-gray-700 hover:text-white transition whitespace-nowrap text-sm font-medium"
                                title="Localhost 3000 einfügen"
                            >
                                localhost:3000
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {typeof window !== 'undefined' && (
                                window.location.hostname === 'localhost' ||
                                window.location.hostname === '127.0.0.1' ||
                                window.location.hostname.startsWith('192.168.') ||
                                window.location.hostname.startsWith('10.') ||
                                window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
                            )
                                ? '✅ Lokalnetzwerk / Localhost — Das iPad sendet Druckbefehle direkt an diesen Server (Relay leer lassen).'
                                : '⚠️ Cloud-Modus erkannt! Wenn Sie über das Internet zugreifen, müssen Sie die LOKALE IP-Adresse Ihres Print-Servers (z.B. http://192.168.188.45:3000) angeben, da Tablets nicht "localhost" verwenden können.'
                            }
                        </p>
                        {settings.printServerUrl && (
                            <div className="mt-2 bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl p-3">
                                <p className="text-blue-800 dark:text-blue-400 text-xs">
                                    🔄 Print-Befehle werden über <span className="font-mono font-bold">{settings.printServerUrl}</span> weitergeleitet.
                                    <br />
                                    <b>Wichtig für Tablets:</b> Verwenden Sie hier NICHT "localhost", sondern die tatsächliche IP (z.B. 192.168.x.x) des PCs, auf dem <code className="font-mono bg-blue-900 px-1 rounded">npm run dev</code> läuft.
                                </p>
                            </div>
                        )}
                    </div>
                </div>


                {/* ─── Status Card ─── */}
                {settings.enabled && settings.printerIp && (
                    <div className={`rounded-2xl p-6 mb-6 border-2 ${
                        health.status === 'online'
                            ? 'bg-green-950/30 border-green-500/40'
                            : health.status === 'offline'
                            ? 'bg-red-950/30 border-red-500/40'
                            : 'bg-card border-border'
                    }`}>
                        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                            📡 Verbindungsstatus
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-background/50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-1">Status</p>
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${
                                        health.status === 'online' ? 'bg-green-400' :
                                        health.status === 'offline' ? 'bg-red-500 animate-pulse' :
                                        health.status === 'checking' ? 'bg-yellow-400 animate-pulse' :
                                        'bg-gray-500'
                                    }`} />
                                    <span className={`font-bold text-sm ${
                                        health.status === 'online' ? 'text-green-800 dark:text-green-400' :
                                        health.status === 'offline' ? 'text-red-800 dark:text-red-400' :
                                        health.status === 'checking' ? 'text-yellow-800 dark:text-yellow-400' :
                                        'text-muted-foreground'
                                    }`}>
                                        {health.status === 'online' ? 'Verbunden' :
                                         health.status === 'offline' ? 'OFFLINE' :
                                         health.status === 'checking' ? 'Prüfe...' : 'Unbekannt'}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-background/50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-1">Antwortzeit</p>
                                <p className="font-bold text-sm text-foreground">{health.responseTimeMs ? `${health.responseTimeMs}ms` : '—'}</p>
                            </div>
                            <div className="bg-background/50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-1">Letzte Prüfung</p>
                                <p className="font-bold text-sm text-foreground">
                                    {health.lastChecked ? health.lastChecked.toLocaleTimeString('de-DE') : '—'}
                                </p>
                            </div>
                            <div className="bg-background/50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-1">Adresse</p>
                                <p className="font-bold text-sm text-foreground font-mono">{settings.printerIp}:{settings.printerPort}</p>
                            </div>
                        </div>

                        {health.error && (
                            <div className="mt-4 bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-xl p-3">
                                <p className="text-red-800 dark:text-red-400 text-sm">⚠️ {health.error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Test Print Card ─── */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-bold text-foreground mb-4">🧪 Druckertest</h2>
                    <p className="text-muted-foreground text-sm mb-4">
                        Senden Sie einen Test-Bon, um die Verbindung und Druckqualität zu überprüfen.
                    </p>
                    <button
                        onClick={handleTestPrint}
                        disabled={testing || !settings.enabled || !settings.printerIp}
                        className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                            testing
                                ? 'bg-gray-700 text-muted-foreground cursor-wait'
                                : !settings.enabled || !settings.printerIp
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                        }`}
                    >
                        {testing ? '⏳ Wird gedruckt...' : '🖨️ Test-Bon drucken'}
                    </button>
                    {testResult && (
                        <div className={`mt-3 p-3 rounded-xl text-sm ${testResult.ok ? 'bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-700/50' : 'bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-700/50'}`}>
                            {testResult.ok ? '✅' : '❌'} {testResult.msg}
                        </div>
                    )}
                </div>

                {/* ─── Info Box ─── */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-400 mb-3">💡 Hinweise</h3>
                    <ul className="text-sm text-muted-foreground space-y-2">
                        <li>• Unterstützt werden ESC/POS-kompatible Thermodrucker (Epson, Star, etc.)</li>
                        <li>• Der Drucker muss im gleichen WLAN-Netzwerk wie dieses Gerät sein</li>
                        <li>• Der Drucker-Status wird alle 30 Sekunden automatisch geprüft</li>
                        <li>• Auto-Print und Kopien werden auf der Bestellungen-Seite konfiguriert</li>
                        <li>• Bei Verbindungsproblemen: Drucker neustarten und IP-Adresse prüfen</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
