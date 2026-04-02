export const COUNTRY_CODES = [
 { code: 'TR', name: 'Türkiye', dial: '+90', flag: '🇹🇷' },
 { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
 { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
 { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
 { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
 { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
 { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
 { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
 { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
];

export const getDialCode = (countryCode: string) => {
 const country = COUNTRY_CODES.find(c => c.code === countryCode || c.name.toLowerCase() === countryCode.toLowerCase());
 return country ? country.dial : '+90'; // Default to TR
};

export const getCountryFromDial = (dial: string) => {
 return COUNTRY_CODES.find(c => c.dial === dial);
};
