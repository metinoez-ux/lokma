export interface CountryConfig {
    code: string; // ISO 3166-1 alpha-2 (e.g., 'DE', 'TR')
    name: string;
    currency: string; // ISO 4217 (e.g., 'EUR', 'TRY')
    symbol: string; // e.g., '€', '₺'
    dialCode: string; // e.g., '+49', '+90'
    locale: string;
}

export const SUPPORTED_COUNTRIES: Record<string, CountryConfig> = {
    DE: {
        code: 'DE',
        name: 'Deutschland',
        currency: 'EUR',
        symbol: '€',
        dialCode: '+49',
        locale: 'de-DE',
    },
    TR: {
        code: 'TR',
        name: 'Türkiye',
        currency: 'TRY',
        symbol: '₺',
        dialCode: '+90',
        locale: 'tr-TR',
    },
    // Add more countries here as needed
};

// Default fallback for legacy or unspecified cases
export const DEFAULT_COUNTRY_CODE = 'DE';
export const DEFAULT_CURRENCY = 'EUR';

export function getCountryConfig(countryCode: string = DEFAULT_COUNTRY_CODE): CountryConfig {
    return SUPPORTED_COUNTRIES[countryCode] || SUPPORTED_COUNTRIES[DEFAULT_COUNTRY_CODE];
}

export function getCurrencyForCountry(countryCode?: string): string {
    if (!countryCode) return DEFAULT_CURRENCY;
    return SUPPORTED_COUNTRIES[countryCode]?.currency || DEFAULT_CURRENCY;
}

export function getSymbolForCurrency(currencyCode: string): string {
    const country = Object.values(SUPPORTED_COUNTRIES).find((c) => c.currency === currencyCode);
    return country?.symbol || currencyCode; // Fallback to the text code if symbol not found
}
