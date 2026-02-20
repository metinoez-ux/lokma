'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { locales, localeNames, localeFlags, Locale } from '@/i18n';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher() {
    const locale = useLocale() as Locale;
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (newLocale: Locale) => {
        router.replace(pathname, { locale: newLocale });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition"
            >
                <span className="text-lg">{localeFlags[locale]}</span>
                <span className="hidden sm:inline">{localeNames[locale]}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 py-2 w-48 bg-gray-800 rounded-xl shadow-xl border border-gray-700 z-50">
                    {locales.map((l) => (
                        <button
                            key={l}
                            onClick={() => handleChange(l)}
                            className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-700 transition ${l === locale ? 'text-blue-400 bg-gray-700/50' : 'text-white'
                                }`}
                        >
                            <span className="text-lg">{localeFlags[l]}</span>
                            <span>{localeNames[l]}</span>
                            {l === locale && <span className="ml-auto">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
