export interface CountryConfig {
    code: string;           // ISO 3166-1 alpha-2 (e.g., 'DE', 'TR')
    name: string;           // Localized name of the country
    currencyCode: string;   // ISO 4217 (e.g., 'EUR', 'TRY')
    currencySymbol: string; // e.g., '€', '₺'
    dialCode: string;       // e.g., '+49', '+90'
    locale: string;         // e.g., 'de-DE', 'tr-TR' (used for Intl.NumberFormat)
}

export const SUPPORTED_COUNTRIES: Record<string, CountryConfig> = {
    DE: {
        code: 'DE',
        name: 'Deutschland',
        currencyCode: 'EUR',
        currencySymbol: '€',
        dialCode: '+49',
        locale: 'de-DE',
    },
    TR: {
        code: 'TR',
        name: 'Türkiye',
        currencyCode: 'TRY',
        currencySymbol: '₺',
        dialCode: '+90',
        locale: 'tr-TR',
    },
    NL: {
        code: 'NL',
        name: 'Nederland',
        currencyCode: 'EUR',
        currencySymbol: '€',
        dialCode: '+31',
        locale: 'nl-NL',
    },
    GB: {
        code: 'GB',
        name: 'United Kingdom',
        currencyCode: 'GBP',
        currencySymbol: '£',
        dialCode: '+44',
        locale: 'en-GB',
    },
    US: {
        code: 'US',
        name: 'United States',
        currencyCode: 'USD',
        currencySymbol: '$',
        dialCode: '+1',
        locale: 'en-US',
    }
};

export const DEFAULT_COUNTRY_CODE = 'DE';
export const DEFAULT_CURRENCY = 'EUR';

export function getCountryConfig(countryCode: string = DEFAULT_COUNTRY_CODE): CountryConfig {
    return SUPPORTED_COUNTRIES[countryCode] || SUPPORTED_COUNTRIES[DEFAULT_COUNTRY_CODE];
}

export function getCurrencyForCountry(countryCode: string = DEFAULT_COUNTRY_CODE): string {
    return getCountryConfig(countryCode).currencyCode;
}

export function getCurrencySymbolForCountry(countryCode: string = DEFAULT_COUNTRY_CODE): string {
    return getCountryConfig(countryCode).currencySymbol;
}

export function getAllCountries(): CountryConfig[] {
    return Object.values(SUPPORTED_COUNTRIES);
}
