'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { auth } from '@/lib/firebase';

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

export default function SuperAdminsPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading } = useAdmin();

    const [phase, setPhase] = useState<CleanupPhase>('idle');
    const [confirmText, setConfirmText] = useState('');
    const [stats, setStats] = useState<CleanupStats | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const CONFIRM_PHRASE = 'SIFIRLA';

    const handleCleanup = async () => {
        if (confirmText !== CONFIRM_PHRASE) return;
        setPhase('loading');
        setErrorMsg('');

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Keine Authentifizierung');

            const fnUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 'https://us-central1-aylar-a45af.cloudfunctions.net';
            const res = await fetch(`${fnUrl}/cleanupTestData`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Cleanup fehlgeschlagen');
            }

            setStats(data.stats);
            setPhase('done');
        } catch (e: any) {
            setErrorMsg(e.message);
            setPhase('error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!admin || admin.adminType !== 'super') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-red-400 text-lg">Zugriff verweigert</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">👑</span>
                        <div>
                            <h1 className="text-2xl font-bold">{t('superAdmins')}</h1>
                            <p className="text-gray-400 text-sm">Plattform-Administratoren mit Vollzugriff</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/dashboard"
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                    >
                        ← {t('allUsers')}
                    </Link>
                </div>

                {/* Super Admin Info */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center mb-6">
                    <span className="text-6xl mb-4 block">👑</span>
                    <h2 className="text-xl font-semibold mb-2">Super Admin Verwaltung</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Hier werden alle Super Administratoren der Plattform verwaltet.
                        Super Admins haben vollen Zugriff auf alle Funktionen und Einstellungen.
                    </p>
                    <div className="mt-6 flex gap-3 justify-center">
                        <Link
                            href="/admin/dashboard?filter=superadmins"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            Super Admins im Dashboard anzeigen →
                        </Link>
                    </div>
                </div>

                {/* ── TEST DATA CLEANUP ZONE ── */}
                <div className="bg-gray-800 rounded-xl border border-red-900/50 p-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">🧹</span>
                        <div>
                            <h2 className="text-lg font-bold text-red-400">Test Verilerini Temizle</h2>
                            <p className="text-gray-400 text-sm">
                                metin.oez@gmail.com hariç tüm kullanıcıları, siparişleri ve test verilerini siler.
                            </p>
                        </div>
                    </div>

                    {/* What gets deleted */}
                    <div className="bg-gray-900/60 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {[
                            { icon: '👤', label: 'Firebase Auth', sub: 'Tüm test hesapları' },
                            { icon: '📋', label: 'Siparişler', sub: 'Tüm meat_orders' },
                            { icon: '👷', label: 'Adminler', sub: 'Super admin korunur' },
                            { icon: '⭐', label: 'Ratingler', sub: 'Tüm test yorumları' },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2 text-gray-300">
                                <span className="text-lg">{item.icon}</span>
                                <div>
                                    <div className="font-medium">{item.label}</div>
                                    <div className="text-xs text-gray-500">{item.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Protected account notice */}
                    <div className="bg-green-900/20 border border-green-800/40 rounded-lg px-4 py-3 mb-6 flex items-center gap-2 text-sm text-green-400">
                        <span>🛡️</span>
                        <span><strong>metin.oez@gmail.com</strong> — Korumalı, hiçbir zaman silinmez</span>
                    </div>

                    {/* Idle state */}
                    {phase === 'idle' && (
                        <button
                            onClick={() => setPhase('confirm')}
                            className="px-6 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <span>🗑️</span>
                            Test Verilerini Temizle
                        </button>
                    )}

                    {/* Confirm dialog */}
                    {phase === 'confirm' && (
                        <div className="space-y-4">
                            <div className="bg-red-950/40 border border-red-700/50 rounded-lg p-4">
                                <p className="text-red-300 font-medium mb-1">⚠️ Bu işlem geri alınamaz!</p>
                                <p className="text-gray-400 text-sm">
                                    Tüm test kullanıcıları, siparişler ve ilgili veriler kalıcı olarak silinecek.
                                    Devam etmek için aşağıya <strong className="text-white">{CONFIRM_PHRASE}</strong> yazın.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder={`"${CONFIRM_PHRASE}" yazın`}
                                    className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono"
                                />
                                <button
                                    onClick={handleCleanup}
                                    disabled={confirmText !== CONFIRM_PHRASE}
                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Onayla ve Sil
                                </button>
                                <button
                                    onClick={() => { setPhase('idle'); setConfirmText(''); }}
                                    className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                >
                                    İptal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {phase === 'loading' && (
                        <div className="flex items-center gap-3 text-yellow-400">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-yellow-400"></div>
                            <span className="text-sm">Temizleniyor... Lütfen bekleyin (max 5 dakika)</span>
                        </div>
                    )}

                    {/* Success */}
                    {phase === 'done' && stats && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-green-400 font-medium">
                                <span>✅</span>
                                <span>Temizleme tamamlandı!</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Auth Hesapları', value: stats.authDeleted, icon: '👤' },
                                    { label: 'Kullanıcı Dokümanı', value: stats.usersDeleted, icon: '📄' },
                                    { label: 'Admin Kayıtları', value: stats.adminsDeleted, icon: '👷' },
                                    { label: 'Siparişler', value: stats.ordersDeleted, icon: '📦' },
                                    { label: 'Ratingler', value: stats.ratingsDeleted, icon: '⭐' },
                                    { label: 'Komisyonlar', value: stats.commissionRecordsDeleted, icon: '💶' },
                                    { label: 'Bildirimler', value: stats.notificationsDeleted, icon: '🔔' },
                                    { label: 'Zamanlanmış', value: stats.scheduledNotificationsDeleted, icon: '⏰' },
                                    { label: 'Sponsorlu Dön.', value: stats.sponsoredConversionsDeleted, icon: '📣' },
                                    { label: 'Referanslar', value: stats.referralsDeleted, icon: '🔗' },
                                    { label: 'Grup Sipariş', value: stats.groupOrdersDeleted, icon: '👥' },
                                    { label: 'İşletme Reset', value: stats.businessesReset, icon: '🏪' },
                                    { label: 'Hatalar', value: stats.errors.length, icon: '⚠️' },
                                ].map(item => (
                                    <div key={item.label} className="bg-gray-900 rounded-lg p-3 text-center">
                                        <div className="text-lg mb-1">{item.icon}</div>
                                        <div className={`text-xl font-bold ${item.label === 'Hatalar' && item.value > 0 ? 'text-red-400' : 'text-white'}`}>
                                            {item.value}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
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
                                Kapat
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {phase === 'error' && (
                        <div className="space-y-3">
                            <div className="text-red-400 flex items-center gap-2">
                                <span>❌</span>
                                <span className="text-sm">{errorMsg}</span>
                            </div>
                            <button
                                onClick={() => { setPhase('idle'); setConfirmText(''); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                            >
                                Tekrar Dene
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
