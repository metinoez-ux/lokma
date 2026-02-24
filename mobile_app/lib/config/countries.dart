class CountryConfig {
  final String code; // ISO 3166-1 alpha-2 (e.g., 'DE', 'TR')
  final String name;
  final String currency; // ISO 4217 (e.g., 'EUR', 'TRY')
  final String symbol; // e.g., '€', '₺'
  final String dialCode;

  const CountryConfig({
    required this.code,
    required this.name,
    required this.currency,
    required this.symbol,
    required this.dialCode,
  });
}

class SupportedCountries {
  static const Map<String, CountryConfig> countries = {
    'DE': CountryConfig(
      code: 'DE',
      name: 'Deutschland',
      currency: 'EUR',
      symbol: '€',
      dialCode: '+49',
    ),
    'TR': CountryConfig(
      code: 'TR',
      name: 'Türkiye',
      currency: 'TRY',
      symbol: '₺',
      dialCode: '+90',
    ),
    // Add more countries here
  };

  static const String defaultCountryCode = 'DE';
  static const String defaultCurrency = 'EUR';

  static CountryConfig getCountryConfig([String? countryCode]) {
    return countries[countryCode] ?? countries[defaultCountryCode]!;
  }

  static String getCurrencyForCountry([String? countryCode]) {
    if (countryCode == null) return defaultCurrency;
    return countries[countryCode]?.currency ?? defaultCurrency;
  }

  static String getSymbolForCurrency(String currencyCode) {
    for (final country in countries.values) {
      if (country.currency == currencyCode) {
        return country.symbol;
      }
    }
    return currencyCode; // Fallback to characters if no symbol is found
  }
}
