import 'package:intl/intl.dart';
import '../config/countries.dart';

class CurrencyUtils {
  /// Formats an amount into the appropriate currency string.
  /// Uses Intl to properly format the number and append/prepend the correct symbol.
  static String formatCurrency(double amount, {String? countryCode, String? currencyCode}) {
    // If currencyCode is provided, we format based on it, else we format based on countryCode
    final currency = currencyCode ?? SupportedCountries.getCurrencyForCountry(countryCode);
    final symbol = SupportedCountries.getSymbolForCurrency(currency);
    
    // For now we assume a standard locale, but this could be enhanced based on country
    final formatter = NumberFormat.currency(
      locale: 'de_DE', // Standard locale for numbers, can be dynamic later
      name: currency,
      symbol: symbol,
      decimalDigits: 2,
    );
    
    return formatter.format(amount);
  }

  /// Returns the currency symbol for a given country code or currency code.
  static String getCurrencySymbol({String? countryCode, String? currencyCode}) {
    if (currencyCode != null) {
      return SupportedCountries.getSymbolForCurrency(currencyCode);
    }
    final currency = SupportedCountries.getCurrencyForCountry(countryCode);
    return SupportedCountries.getSymbolForCurrency(currency);
  }

  /// Returns the ISO 4217 currency code for a given country.
  static String getCurrencyCode({String? countryCode}) {
    return SupportedCountries.getCurrencyForCountry(countryCode);
  }
}
