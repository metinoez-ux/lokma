/**
 * Türkçe karakter normalizasyonu - esnek arama için
 * ı→i, ğ→g, ü→u, ş→s, ö→o, ç→c dönüşümleri yapar
 */
export function normalizeTurkish(text: string): string {
 if (!text) return '';
 return text
 .toLowerCase()
 .replace(/ı/g, 'i')
 .replace(/İ/g, 'i')
 .replace(/ğ/g, 'g')
 .replace(/Ğ/g, 'g')
 .replace(/ü/g, 'u')
 .replace(/Ü/g, 'u')
 .replace(/ş/g, 's')
 .replace(/Ş/g, 's')
 .replace(/ö/g, 'o')
 .replace(/Ö/g, 'o')
 .replace(/ç/g, 'c')
 .replace(/Ç/g, 'c')
 .replace(/â/g, 'a')
 .replace(/î/g, 'i')
 .replace(/û/g, 'u')
 .replace(/ê/g, 'e');
}

/**
 * Gets a localized string from a translations map (or falls back appropriately).
 */
export function getLocalizedText(textObj: any, locale: string = 'tr'): string {
 if (!textObj) return '';
 if (typeof textObj === 'string') return textObj; // legacy string support

 return textObj[locale] || textObj['tr'] || textObj['en'] || Object.values(textObj)[0] || '';
}
