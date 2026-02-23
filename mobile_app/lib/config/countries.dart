import '../utils/currency_utils.dart';
class CountryConfig {
  final String code;           // ISO 3166-1 alpha-2 (e.g., 'DE', 'TR')
  final String name;           // Localized name of the country
  final String currencyCode;   // ISO 4217 (e.g., 'EUR', 'TRY')
  final String currencySymbol; // e.g., '${CurrencyUtils.getCurrencySymbol()}', '₺'
  final String dialCode;       // e.g., '+49', '+90'
  final String locale;         // e.g., 'de-DE', 'tr-TR'

  const CountryConfig({
    required this.code,
    required this.name,
    required this.currencyCode,
    required this.currencySymbol,
    required this.dialCode,
    required this.locale,
  });
}

class CountryRegistry {
  static const Map<String, CountryConfig> supportedCountries = {
    'DE': CountryConfig(
      code: 'DE',
      name: 'Deutschland',
      currencyCode: 'EUR',
      currencySymbol: '€',
      dialCode: '+49',
      locale: 'de-DE',
    ),
    'TR': CountryConfig(
      code: 'TR',
      name: 'Türkiye',
      currencyCode: 'TRY',
      currencySymbol: '₺',
      dialCode: '+90',
      locale: 'tr-TR',
    ),
    'NL': CountryConfig(
      code: 'NL',
      name: 'Nederland',
      currencyCode: 'EUR',
      currencySymbol: '€',
      dialCode: '+31',
      locale: 'nl-NL',
    ),
    'GB': CountryConfig(
      code: 'GB',
      name: 'United Kingdom',
      currencyCode: 'GBP',
      currencySymbol: '£',
      dialCode: '+44',
      locale: 'en-GB',
    ),
    'US': CountryConfig(
      code: 'US',
      name: 'United States',
      currencyCode: 'USD',
      currencySymbol: '\$',
      dialCode: '+1',
      locale: 'en-US',
    ),
  };

  static const String defaultCountryCode = 'DE';
  static const String defaultCurrencyCode = 'EUR';

  static CountryConfig getConfigByCurrency(String? currencyCode) {
    if (currencyCode == null) return supportedCountries[defaultCountryCode]!;
    // Find the first country config that matches the currency code, or default
    return supportedCountries.values.firstWhere(
      (c) => c.currencyCode == currencyCode,
      orElse: () => supportedCountries[defaultCountryCode]!,
    );
  }

  static CountryConfig getConfig(String? countryCode) {
    if (countryCode == null || !supportedCountries.containsKey(countryCode)) {
      return supportedCountries[defaultCountryCode]!;
    }
    return supportedCountries[countryCode]!;
  }

  static String getCurrencyCode(String? countryCode) {
    return getConfig(countryCode).currencyCode;
  }

  static String getCurrencySymbol(String? countryCode) {
    return getConfig(countryCode).currencySymbol;
  }

  static List<CountryConfig> getAllCountries() {
    return supportedCountries.values.toList();
  }
}
