import { getCountryConfig, DEFAULT_COUNTRY_CODE, DEFAULT_CURRENCY, SUPPORTED_COUNTRIES } from '../config/countries';

/**
 * Helper to find the best locale for a given currency code.
 */
function getLocaleForCurrency(currencyCode: string): string {
    const country = Object.values(SUPPORTED_COUNTRIES).find(c => c.currencyCode === currencyCode);
    return country ? country.locale : 'de-DE'; // Default to German locale if not found
}

/**
 * Formats an amount into the appropriate currency string.
 * @param amount The numeric amount to format.
 * @param currencyCode The ISO 4217 currency code (e.g., 'EUR', 'TRY'). Defaults to EUR.
 * @returns Formatted currency string (e.g., "1.234,56 €", "₺1.234,56")
 */
export function formatCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
    return new Intl.NumberFormat(getLocaleForCurrency(currencyCode), {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Returns the currency symbol for a given country code.
 * @param countryCode The ISO 3166-1 alpha-2 country code. Defaults to DE.
 * @returns The currency symbol (e.g., '€', '₺').
 */
export function getCurrencySymbol(countryCode: string = DEFAULT_COUNTRY_CODE): string {
    return getCountryConfig(countryCode).currencySymbol;
}

/**
 * Returns the ISO 4217 currency code for a given country.
 * @param countryCode The ISO 3166-1 alpha-2 country code. Defaults to DE.
 * @returns The currency code (e.g., 'EUR', 'TRY').
 */
export function getCurrencyCode(countryCode: string = DEFAULT_COUNTRY_CODE): string {
    return getCountryConfig(countryCode).currencyCode;
}
