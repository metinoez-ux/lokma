// i18n configuration for MiraPortal Admin
// Supports: TR, DE, EN, AR, FR, IT, ES, NL

export const locales = ['tr', 'de', 'en', 'ar', 'fr', 'it', 'es', 'nl'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'tr';

// RTL languages
export const rtlLocales: Locale[] = ['ar'];

export function isRTL(locale: Locale): boolean {
    return rtlLocales.includes(locale);
}

export const localeNames: Record<Locale, string> = {
    tr: 'Türkçe',
    de: 'Deutsch',
    en: 'English',
    ar: 'العربية',
    fr: 'Français',
    it: 'Italiano',
    es: 'Español',
    nl: 'Nederlands',
};

export const localeFlags: Record<Locale, string> = {
    tr: '🇹🇷',
    de: '🇩🇪',
    en: '🇬🇧',
    ar: '🇸🇦',
    fr: '🇫🇷',
    it: '🇮🇹',
    es: '🇪🇸',
    nl: '🇳🇱',
};

// Message loading utility
export async function loadMessages(locale: string) {
    try {
        return (await import(`../messages/${locale}.json`)).default;
    } catch {
        return (await import(`../messages/${defaultLocale}.json`)).default;
    }
}

// Get locale from pathname
export function getLocaleFromPath(pathname: string): Locale {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0];
    if (firstSegment && locales.includes(firstSegment as Locale)) {
        return firstSegment as Locale;
    }
    return defaultLocale;
}
