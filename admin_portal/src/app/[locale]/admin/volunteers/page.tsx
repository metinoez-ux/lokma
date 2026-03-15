'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

export default function VolunteersPage() {
    const t = useTranslations('AdminNav');
    const { admin, loading } = useAdmin();

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
                        <span className="text-3xl">🤝</span>
                        <div>
                            <h1 className="text-2xl font-bold">{t('volunteers')}</h1>
                            <p className="text-gray-400 text-sm">Kermes gönüllüleri ve çalışanları</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/dashboard"
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                    >
                        ← {t('allUsers')}
                    </Link>
                </div>

                {/* Placeholder Content */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                    <span className="text-6xl mb-4 block">🤝</span>
                    <h2 className="text-xl font-semibold mb-2">Gönüllü-Verwaltung</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Hier werden alle Gönüllüler (Freiwillige / Kermes-Mitarbeiter) verwaltet.
                        Gönüllüler können als reguläre Mitarbeiter oder als Kermes-Administratoren mit erweiterten Rechten arbeiten.
                    </p>
                    <div className="mt-6 flex gap-3 justify-center">
                        <Link
                            href="/admin/dashboard?filter=subadmins"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            Gönüllüler im Dashboard anzeigen →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
