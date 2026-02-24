export const COUNTRY_CONFIG = {
    TR: { name: 'Türkiye', currency: 'TRY', symbol: '₺' },
    DE: { name: 'Deutschland', currency: 'EUR', symbol: '€' },
    AT: { name: 'Österreich', currency: 'EUR', symbol: '€' },
    CH: { name: 'Schweiz', currency: 'CHF', symbol: 'CHF' },
    NL: { name: 'Nederland', currency: 'EUR', symbol: '€' },
    BE: { name: 'Belgique/België', currency: 'EUR', symbol: '€' },
    MX: { name: 'Mexico', currency: 'MXN', symbol: '$' },
    US: { name: 'United States', currency: 'USD', symbol: '$' },
    UK: { name: 'United Kingdom', currency: 'GBP', symbol: '£' },
};

export type CountryCode = keyof typeof COUNTRY_CONFIG;

/**
 * Returns the currency symbol for a given ISO 4217 currency code.
 * Falls back to the code itself if not found.
 */
export function getCurrencySymbol(currencyCode: string | undefined): string {
    if (!currencyCode) return '€'; // default to Euro if missing

    const upperCode = currencyCode.toUpperCase();

    // Quick lookup for common ones
    switch (upperCode) {
        case 'EUR': return '€';
        case 'TRY': return '₺';
        case 'USD': return '$';
        case 'GBP': return '£';
        case 'CHF': return 'CHF';
        case 'MXN': return '$';
    }

    // Fallback to Intl API if browser supports it
    try {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: upperCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
        // Extract just the symbol, e.g., mapping 'USD 100' to '$'
        const parts = formatter.formatToParts(0);
        const symbolPart = parts.find(p => p.type === 'currency');
        return symbolPart ? symbolPart.value : upperCode;
    } catch (e) {
        // If currency code is invalid, just return the code
        return upperCode;
    }
}

/**
 * Formats an amount with the correct currency symbol and locale formatting.
 */
export function formatCurrency(amount: number, currencyCode: string = 'EUR', locale: string = 'de-DE'): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
        }).format(amount);
    } catch (e) {
        // Fallback if Intl fails
        const symbol = getCurrencySymbol(currencyCode);
        return `${amount.toFixed(2)} ${symbol}`;
    }
}
