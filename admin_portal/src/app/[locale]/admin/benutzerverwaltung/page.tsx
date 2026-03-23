'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';

interface SectionCard {
    href: string;
    labelKey: string;
    fallbackLabel: string;
    description: string;
    countCollection?: string;
}

const USER_SECTIONS: SectionCard[] = [
    {
        href: '/admin/customers',
        labelKey: 'customers',
        fallbackLabel: 'Kunden',
        description: 'Registrierte Endkunden verwalten',
        countCollection: 'users',
    },
    {
        href: '/admin/partners',
        labelKey: 'partners',
        fallbackLabel: 'Lokma-Partner',
        description: 'Restaurants und Geschaefte',
        countCollection: 'businesses',
    },
    {
        href: '/admin/drivers',
        labelKey: 'drivers',
        fallbackLabel: 'Fahrer',
        description: 'Kuriere und Lieferfahrer',
    },
    {
        href: '/admin/volunteers',
        labelKey: 'volunteers',
        fallbackLabel: 'Kermes-Partner',
        description: 'Community-Veranstaltungen',
    },
    {
        href: '/admin/dashboard',
        labelKey: 'allUsers',
        fallbackLabel: 'Alle Benutzer',
        description: 'Gesamtuebersicht aller Nutzer',
    },
    {
        href: '/admin/staff-shifts',
        labelKey: 'shifts',
        fallbackLabel: 'Arbeitszeiten',
        description: 'Arbeitszeiten und Einsatzplaene',
    },
    {
        href: '/admin/superadmins',
        labelKey: 'superAdmins',
        fallbackLabel: 'Super Admins',
        description: 'Plattform-Administratoren',
    },
    {
        href: '/admin/drivers/tips',
        labelKey: 'tips',
        fallbackLabel: 'Trinkgeld',
        description: 'Trinkgeld-Uebersicht der Fahrer',
    },
];

export default function BenutzerverwaltungPage() {
    const t = useTranslations('AdminNav');
    const [counts, setCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        const loadCounts = async () => {
            const results: Record<string, number> = {};
            for (const section of USER_SECTIONS) {
                if (section.countCollection) {
                    try {
                        const ref = collection(db, section.countCollection);
                        const snap = await getCountFromServer(ref);
                        results[section.countCollection] = snap.data().count;
                    } catch {
                        // skip
                    }
                }
            }
            setCounts(results);
        };
        loadCounts();
    }, []);

    return (
        <div className="min-h-screen bg-background text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold mb-1">Benutzerverwaltung</h1>
                    <p className="text-muted-foreground text-sm">
                        Benutzer, Partner und Teams verwalten
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {USER_SECTIONS.map(section => {
                        const count = section.countCollection ? counts[section.countCollection] : undefined;
                        return (
                            <Link
                                key={section.href}
                                href={section.href}
                                className="group bg-card border border-border rounded-xl p-5 hover:border-red-500/50 hover:bg-card/80 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="text-foreground font-semibold text-sm group-hover:text-red-800 dark:text-red-400 transition-colors">
                                        {t(section.labelKey) || section.fallbackLabel}
                                    </h3>
                                    {count !== undefined && (
                                        <span className="bg-gray-700 text-foreground text-xs px-2 py-0.5 rounded-full">
                                            {count.toLocaleString('de-DE')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-500 text-xs leading-relaxed">
                                    {section.description}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
