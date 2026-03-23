'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { auth } from '@/lib/firebase';

// Predefined services that can be configured
// -- Email & Messaging --
// -- Payments --
// -- AI & ML --
// -- Maps & Location --
// -- Accounting --
// -- Cloud Storage --
// -- Push Notifications --
const API_SERVICES = [
    // ── Email ────────────────────────────────────────────
    {
        keyId: 'resend',
        label: 'Resend (Loka)',
        service: 'resend',
        descKey: 'resendDesc',
        icon: '📧',
        color: 'emerald',
        placeholder: 're_...',
        envVar: 'RESEND_API_KEY',
    },
    // ── Payments ─────────────────────────────────────────
    {
        keyId: 'stripe_secret',
        label: 'Stripe Secret Key (Live)',
        service: 'stripe',
        descKey: 'stripeDesc',
        icon: '💳',
        color: 'indigo',
        placeholder: 'sk_live_...',
        envVar: 'STRIPE_SECRET_KEY',
    },
    {
        keyId: 'stripe_publishable',
        label: 'Stripe Publishable Key (Live)',
        service: 'stripe',
        descKey: 'stripePublishableDesc',
        icon: '💳',
        color: 'indigo',
        placeholder: 'pk_live_...',
        envVar: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    },
    {
        keyId: 'stripe_webhook',
        label: 'Stripe Webhook Secret',
        service: 'stripe',
        descKey: 'stripeWebhookDesc',
        icon: '🔗',
        color: 'indigo',
        placeholder: 'whsec_...',
        envVar: 'STRIPE_WEBHOOK_SECRET',
    },
    {
        keyId: 'stripe_test_secret',
        label: 'Stripe Secret Key (Test)',
        service: 'stripe',
        descKey: 'stripeTestDesc',
        icon: '💳',
        color: 'slate',
        placeholder: 'sk_test_...',
        envVar: 'STRIPE_TEST_SECRET_KEY',
    },
    {
        keyId: 'stripe_test_publishable',
        label: 'Stripe Publishable Key (Test)',
        service: 'stripe',
        descKey: 'stripeTestPublishableDesc',
        icon: '💳',
        color: 'slate',
        placeholder: 'pk_test_...',
        envVar: 'NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY',
    },
    // ── AI & ML ──────────────────────────────────────────
    {
        keyId: 'gemini',
        label: 'Google Gemini AI',
        service: 'gemini',
        descKey: 'geminiDesc',
        icon: '🤖',
        color: 'blue',
        placeholder: 'AIzaSy...',
        envVar: 'GEMINI_API_KEY',
    },
    {
        keyId: 'imagen',
        label: 'Google Imagen 4',
        service: 'imagen',
        descKey: 'imagenDesc',
        icon: '🎨',
        color: 'purple',
        placeholder: 'AIzaSy...',
        envVar: 'IMAGEN_API_KEY',
    },
    // ── Maps & Location ──────────────────────────────────
    {
        keyId: 'google_maps',
        label: 'Google Maps',
        service: 'google_maps',
        descKey: 'googleMapsDesc',
        icon: '🗺️',
        color: 'green',
        placeholder: 'AIzaSy...',
        envVar: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    },
    {
        keyId: 'mapbox',
        label: 'Mapbox',
        service: 'mapbox',
        descKey: 'mapboxDesc',
        icon: '📍',
        color: 'teal',
        placeholder: 'pk.eyJ1...',
        envVar: 'MAPBOX_API_KEY',
    },
    // ── Accounting ───────────────────────────────────────
    {
        keyId: 'lexware',
        label: 'Lexware Office',
        service: 'lexware',
        descKey: 'lexwareDesc',
        icon: '📊',
        color: 'orange',
        placeholder: 'lex_...',
        envVar: 'LEXWARE_API_KEY',
    },
    // ── SMS / Voice ──────────────────────────────────────
    {
        keyId: 'twilio',
        label: 'Twilio',
        service: 'twilio',
        descKey: 'twilioDesc',
        icon: '📱',
        color: 'red',
        placeholder: 'SK...',
        envVar: 'TWILIO_AUTH_TOKEN',
    },
    // ── Cloud (AWS S3) ───────────────────────────────────
    {
        keyId: 'aws_access_key',
        label: 'AWS Access Key ID',
        service: 'aws',
        descKey: 'awsAccessDesc',
        icon: '☁️',
        color: 'yellow',
        placeholder: 'AKIA...',
        envVar: 'AWS_ACCESS_KEY_ID',
    },
    {
        keyId: 'aws_secret',
        label: 'AWS Secret Access Key',
        service: 'aws',
        descKey: 'awsSecretDesc',
        icon: '☁️',
        color: 'yellow',
        placeholder: 'wJal...',
        envVar: 'AWS_SECRET_ACCESS_KEY',
    },
    // ── Push Notifications ───────────────────────────────
    {
        keyId: 'firebase_vapid',
        label: 'Firebase VAPID Key',
        service: 'firebase',
        descKey: 'firebaseVapidDesc',
        icon: '🔔',
        color: 'amber',
        placeholder: 'BN...',
        envVar: 'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
    },
];

interface StoredKey {
    masked: string;
    label: string;
    service: string;
    updatedAt: string;
    updatedBy: string;
}

export default function ApiKeysPage() {
    const { admin } = useAdmin();
    const t = useTranslations('AdminApiKeys');
    const [keys, setKeys] = useState<Record<string, StoredKey>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newKeyValue, setNewKeyValue] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // ── Auth header ──────────────────────────────────────
    const getAuthHeaders = useCallback(async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Not authenticated');
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        };
    }, []);

    // ── Load keys ────────────────────────────────────────
    const loadKeys = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/api-keys', { headers });
            if (!res.ok) throw new Error('Failed to load keys');
            const data = await res.json();
            setKeys(data.keys || {});
        } catch (err: any) {
            console.error('Load keys error:', err);
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (admin?.adminType === 'super') {
            loadKeys();
        }
    }, [admin, loadKeys]);

    // ── Save key ─────────────────────────────────────────
    const handleSave = async (keyId: string, service: string, label: string) => {
        if (!newKeyValue.trim()) return;

        setSaving(keyId);
        setFeedback(null);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/api-keys', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    keyId,
                    value: newKeyValue.trim(),
                    label,
                    service,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Save failed');
            }
            const data = await res.json();
            setKeys((prev) => ({
                ...prev,
                [keyId]: {
                    masked: data.masked,
                    label,
                    service,
                    updatedAt: new Date().toISOString(),
                    updatedBy: admin?.email || '',
                },
            }));
            setEditingKey(null);
            setNewKeyValue('');
            setFeedback({ type: 'success', message: `${label} ${t('savedSuccess')}` });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setSaving(null);
        }
    };

    // ── Delete key ───────────────────────────────────────
    const handleDelete = async (keyId: string, label: string) => {
        if (!confirm(`"${label}" ${t('confirmDelete')}`)) return;

        setSaving(keyId);
        setFeedback(null);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/api-keys', {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ keyId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Delete failed');
            }
            setKeys((prev) => {
                const copy = { ...prev };
                delete copy[keyId];
                return copy;
            });
            setFeedback({ type: 'success', message: `${label} ${t('deletedSuccess')}` });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setSaving(null);
        }
    };

    // ── Guard: super admin only ──────────────────────────
    if (admin?.adminType !== 'super') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <span className="text-6xl block mb-4">🔒</span>
                    <h1 className="text-2xl font-bold text-foreground mb-2">{t('accessDenied')}</h1>
                    <p className="text-muted-foreground">{t('superAdminOnly')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-900/30">
                        🔑
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{t('title')}</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>

                {/* Security Info Banner */}
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-5 mb-8 flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">🛡️</span>
                    <div>
                        <h3 className="font-bold text-emerald-300 text-sm">{t('encryption')}</h3>
                        <p className="text-emerald-800 dark:text-emerald-400/70 text-xs mt-1">
                            {t('encryptionDesc')}
                        </p>
                    </div>
                </div>

                {/* Feedback Toast */}
                {feedback && (
                    <div
                        className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-2 ${feedback.type === 'success'
                                ? 'bg-emerald-950/40 border-emerald-200 dark:border-emerald-700/50 text-emerald-300'
                                : 'bg-red-950/40 border-red-200 dark:border-red-700/50 text-red-300'
                            }`}
                    >
                        <span>{feedback.type === 'success' ? '✅' : '❌'}</span>
                        {feedback.message}
                        <button
                            onClick={() => setFeedback(null)}
                            className="ml-auto text-current opacity-50 hover:opacity-100"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="text-center py-16">
                        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground text-sm">{t('loading')}</p>
                    </div>
                ) : (
                    /* Key Cards */
                    <div className="space-y-4">
                        {API_SERVICES.map((svc) => {
                            const stored = keys[svc.keyId];
                            const isEditing = editingKey === svc.keyId;
                            const isSaving = saving === svc.keyId;

                            return (
                                <div
                                    key={svc.keyId}
                                    className={`bg-card border rounded-2xl p-6 transition-all ${isEditing
                                            ? 'border-amber-600 shadow-lg shadow-amber-900/20'
                                            : 'border-border hover:border-gray-600'
                                        }`}
                                >
                                    {/* Card Header */}
                                    <div className="flex items-start gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                                                ({
                                                    emerald: 'bg-emerald-900/50',
                                                    indigo: 'bg-indigo-900/50',
                                                    slate: 'bg-slate-700/50',
                                                    blue: 'bg-blue-900/50',
                                                    purple: 'bg-purple-900/50',
                                                    green: 'bg-green-900/50',
                                                    teal: 'bg-teal-900/50',
                                                    orange: 'bg-orange-900/50',
                                                    red: 'bg-red-900/50',
                                                    yellow: 'bg-yellow-900/50',
                                                    amber: 'bg-amber-900/50',
                                                } as Record<string, string>)[svc.color] || 'bg-gray-700/50'
                                            }`}
                                        >
                                            {svc.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-foreground text-lg">{svc.label}</h3>
                                                {stored ? (
                                                    <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 text-xs rounded-full font-medium">
                                                        {t('configured')}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 text-xs rounded-full font-medium">
                                                        {t('notConfigured')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground text-sm mt-0.5">{t(svc.descKey)}</p>
                                        </div>
                                    </div>

                                    {/* Stored Key Info */}
                                    {stored && !isEditing && (
                                        <div className="mt-4 bg-background/80 rounded-xl p-4 border border-border/50">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-gray-500 text-xs font-medium">{t('keyLabel')}</span>
                                                <code className="text-amber-800 dark:text-amber-400 font-mono text-sm bg-card px-2 py-0.5 rounded">
                                                    {stored.masked}
                                                </code>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span>
                                                    {t('updated')}:{' '}
                                                    {stored.updatedAt
                                                        ? new Date(stored.updatedAt).toLocaleDateString('de-DE', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })
                                                        : '—'}
                                                </span>
                                                {stored.updatedBy && <span>{t('by')}: {stored.updatedBy}</span>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit Form */}
                                    {isEditing && (
                                        <div className="mt-4">
                                            <label className="block text-xs text-muted-foreground font-medium mb-2">
                                                {stored ? t('enterNewKey') : t('enterKey')}
                                            </label>
                                            <input
                                                type="password"
                                                value={newKeyValue}
                                                onChange={(e) => setNewKeyValue(e.target.value)}
                                                placeholder={svc.placeholder}
                                                className="w-full bg-background border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 font-mono text-sm transition-all"
                                                autoFocus
                                            />
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => handleSave(svc.keyId, svc.service, svc.label)}
                                                    disabled={!newKeyValue.trim() || isSaving}
                                                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-foreground font-bold rounded-xl text-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                                >
                                                    {isSaving ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                            {t('savingKey')}
                                                        </>
                                                    ) : (
                                                        <>🔐 {t('saveEncrypted')}</>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingKey(null);
                                                        setNewKeyValue('');
                                                    }}
                                                    className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-xl text-sm hover:bg-gray-600 transition-all"
                                                >
                                                    {t('cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {!isEditing && (
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingKey(svc.keyId);
                                                    setNewKeyValue('');
                                                    setFeedback(null);
                                                }}
                                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${stored
                                                        ? 'bg-gray-700 text-foreground hover:bg-gray-600'
                                                        : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-400 hover:to-orange-500'
                                                    }`}
                                            >
                                                {stored ? (
                                                    <>✏️ {t('changeKey')}</>
                                                ) : (
                                                    <>🔑 {t('addKey')}</>
                                                )}
                                            </button>
                                            {stored && (
                                                <button
                                                    onClick={() => handleDelete(svc.keyId, svc.label)}
                                                    disabled={isSaving}
                                                    className="px-4 py-2 bg-red-900/30 text-red-800 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-900/50 transition-all disabled:opacity-50"
                                                >
                                                    🗑️ {t('deleteKey')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Additional Info */}
                <div className="mt-8 bg-card/50 border border-border/50 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <span>ℹ️</span> {t('notes')}
                    </h3>
                    <ul className="space-y-2 text-xs text-gray-500">
                        <li className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {t('note1')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {t('note2')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {t('note3')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {t('note4')}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
