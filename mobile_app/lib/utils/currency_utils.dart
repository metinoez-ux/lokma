import 'package:intl/intl.dart';
import '../config/countries.dart';

class CurrencyUtils {
  /// Formats an amount into the appropriate currency string.
  /// Uses Intl to properly format the number and append/prepend the correct symbol.
  static String formatCurrency(double amount, {String? countryCode, String? currencyCode}) {
    final config = currencyCode != null 
        ? CountryRegistry.getConfigByCurrency(currencyCode)
        : CountryRegistry.getConfig(countryCode);
    
    final formatter = NumberFormat.currency(
      locale: config.locale,
      name: config.currencyCode,
      symbol: config.currencySymbol,
      decimalDigits: 2,
    );
    
    return formatter.format(amount);
  }

  /// Returns the currency symbol for a given country code or currency code.
  static String getCurrencySymbol({String? countryCode, String? currencyCode}) {
    if (currencyCode != null) {
      return CountryRegistry.getConfigByCurrency(currencyCode).currencySymbol;
    }
    return CountryRegistry.getCurrencySymbol(countryCode);
  }

  /// Returns the ISO 4217 currency code for a given country.
  static String getCurrencyCode({String? countryCode}) {
    return CountryRegistry.getCurrencyCode(countryCode);
  }
}
