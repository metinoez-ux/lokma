'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SIDEBAR_ITEMS = [
    { href: '/admin/customers',    label: 'Kunden' },
    { href: '/admin/partners',     label: 'Lokma-Partner' },
    { href: '/admin/drivers',      label: 'Fahrer' },
    { href: '/admin/volunteers',   label: 'Kermes-Partner' },
    { href: '/admin/dashboard',    label: 'Alle Benutzer' },
    { href: '/admin/drivers/tips', label: 'Trinkgeld' },
    { href: '/admin/staff-shifts', label: 'Schichten' },
    { href: '/admin/superadmins',  label: 'Super Admins' },
];

const SETTINGS_ITEMS = [
    { href: '/admin/settings',         label: 'Einstellungen' },
    { href: '/admin/settings/company', label: 'Firmeneinstellungen' },
    { href: '/admin/ui-translations',  label: 'UiTranslations' },
    { href: '/admin/image-generator',  label: 'Bildgenerator' },
    { href: '/admin/ai-menu',          label: 'KI-Menü' },
];

export default function BenutzerverwaltungPage() {
    const pathname = usePathname();

    return (
        <div className="flex min-h-[calc(100vh-88px)] bg-gray-950">
            {/* Left Sidebar */}
            <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 py-6">
                <div className="px-4 mb-3">
                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Benutzer</p>
                </div>
                <nav className="space-y-0.5 px-2 mb-6">
                    {SIDEBAR_ITEMS.map(item => {
                        const active = pathname?.includes(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`block px-3 py-2 rounded-lg text-sm transition-all ${
                                    active
                                        ? 'bg-red-900/40 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-gray-800 mx-3 mb-4" />

                <div className="px-4 mb-3">
                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Einstellungen</p>
                </div>
                <nav className="space-y-0.5 px-2">
                    {SETTINGS_ITEMS.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Right — empty until user picks a section */}
            <main className="flex-1 flex items-center justify-center">
                <p className="text-gray-700 text-sm">Bitte wählen Sie einen Bereich aus.</p>
            </main>
        </div>
    );
}
