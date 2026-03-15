'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

export default function PartnersPage() {
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
                <p className="text-red-400 text-lg">{t('access_denied')}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏪</span>
                        <div>
                            <h1 className="text-2xl font-bold">{t('partners')}</h1>
                            <p className="text-gray-400 text-sm">{t('business_owners')}</p>
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
                    <span className="text-6xl mb-4 block">🏪</span>
                    <h2 className="text-xl font-semibold mb-2">{t('partner_management')}</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Hier werden alle Partner (İşletme Sahipleri) der Plattform verwaltet.
                        Partner können ihre eigenen Geschäfte, Mitarbeiter und Berechtigungen verwalten.
                    </p>
                    <div className="mt-6 flex gap-3 justify-center">
                        <Link
                            href="/admin/dashboard?filter=admins"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            Partner im Dashboard anzeigen →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
