import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_de.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_it.dart';
import 'app_localizations_nl.dart';
import 'app_localizations_tr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of L
/// returned by `L.of(context)`.
///
/// Applications need to include `L.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: L.localizationsDelegates,
///   supportedLocales: L.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the L.supportedLocales
/// property.
abstract class L {
  L(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static L? of(BuildContext context) {
    return Localizations.of<L>(context, L);
  }

  static const LocalizationsDelegate<L> delegate = _LDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('de'),
    Locale('es'),
    Locale('fr'),
    Locale('it'),
    Locale('nl'),
    Locale('tr')
  ];

  /// No description provided for @appName.
  ///
  /// In tr, this message translates to:
  /// **'LOKMA'**
  String get appName;

  /// No description provided for @search.
  ///
  /// In tr, this message translates to:
  /// **'Ara'**
  String get search;

  /// No description provided for @searchHint.
  ///
  /// In tr, this message translates to:
  /// **'Yemek, restoran veya market ara...'**
  String get searchHint;

  /// No description provided for @searchNoResults.
  ///
  /// In tr, this message translates to:
  /// **'Sonuç bulunamadı'**
  String get searchNoResults;

  /// No description provided for @searchTryDifferent.
  ///
  /// In tr, this message translates to:
  /// **'Farklı bir arama terimi deneyin'**
  String get searchTryDifferent;

  /// No description provided for @searching.
  ///
  /// In tr, this message translates to:
  /// **'Aranıyor...'**
  String get searching;

  /// No description provided for @popularSearches.
  ///
  /// In tr, this message translates to:
  /// **'Popüler Aramalar'**
  String get popularSearches;

  /// No description provided for @showMore.
  ///
  /// In tr, this message translates to:
  /// **'Daha Fazla Göster'**
  String get showMore;

  /// No description provided for @maxDistance.
  ///
  /// In tr, this message translates to:
  /// **'Maksimum Mesafe'**
  String get maxDistance;

  /// No description provided for @kmUnit.
  ///
  /// In tr, this message translates to:
  /// **'km'**
  String get kmUnit;

  /// No description provided for @categoryButcher.
  ///
  /// In tr, this message translates to:
  /// **'Kasap'**
  String get categoryButcher;

  /// No description provided for @categoryMarket.
  ///
  /// In tr, this message translates to:
  /// **'Market'**
  String get categoryMarket;

  /// No description provided for @categoryRestaurant.
  ///
  /// In tr, this message translates to:
  /// **'Restoran'**
  String get categoryRestaurant;

  /// No description provided for @categoryFlorist.
  ///
  /// In tr, this message translates to:
  /// **'Çiçekçi'**
  String get categoryFlorist;

  /// No description provided for @categoryKermes.
  ///
  /// In tr, this message translates to:
  /// **'Kermes'**
  String get categoryKermes;

  /// No description provided for @categoryPastry.
  ///
  /// In tr, this message translates to:
  /// **'Pastane'**
  String get categoryPastry;

  /// No description provided for @categoryCoffee.
  ///
  /// In tr, this message translates to:
  /// **'Kahve'**
  String get categoryCoffee;

  /// No description provided for @categoryImbiss.
  ///
  /// In tr, this message translates to:
  /// **'İmbiss'**
  String get categoryImbiss;

  /// No description provided for @businesses.
  ///
  /// In tr, this message translates to:
  /// **'İşletmeler'**
  String get businesses;

  /// No description provided for @products.
  ///
  /// In tr, this message translates to:
  /// **'Ürünler'**
  String get products;

  /// No description provided for @categories.
  ///
  /// In tr, this message translates to:
  /// **'Kategoriler'**
  String get categories;

  /// No description provided for @order.
  ///
  /// In tr, this message translates to:
  /// **'Sipariş'**
  String get order;

  /// No description provided for @go.
  ///
  /// In tr, this message translates to:
  /// **'Git'**
  String get go;

  /// No description provided for @orderAgain.
  ///
  /// In tr, this message translates to:
  /// **'Tekrar Sipariş'**
  String get orderAgain;

  /// No description provided for @profile.
  ///
  /// In tr, this message translates to:
  /// **'Profil'**
  String get profile;

  /// No description provided for @welcome.
  ///
  /// In tr, this message translates to:
  /// **'Hoş Geldiniz'**
  String get welcome;

  /// No description provided for @loginPrompt.
  ///
  /// In tr, this message translates to:
  /// **'Siparişlerinizi takip etmek ve özel fırsatlardan yararlanmak için giriş yapın.'**
  String get loginPrompt;

  /// No description provided for @loginWithPhone.
  ///
  /// In tr, this message translates to:
  /// **'Telefon ile Giriş'**
  String get loginWithPhone;

  /// No description provided for @loginWithEmail.
  ///
  /// In tr, this message translates to:
  /// **'E-posta ile Giriş'**
  String get loginWithEmail;

  /// No description provided for @loginWithApple.
  ///
  /// In tr, this message translates to:
  /// **'Apple ile Giriş'**
  String get loginWithApple;

  /// No description provided for @loginWithGoogle.
  ///
  /// In tr, this message translates to:
  /// **'Google ile Giriş'**
  String get loginWithGoogle;

  /// No description provided for @logout.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış Yap'**
  String get logout;

  /// No description provided for @myOrders.
  ///
  /// In tr, this message translates to:
  /// **'Siparişlerim'**
  String get myOrders;

  /// No description provided for @myFavorites.
  ///
  /// In tr, this message translates to:
  /// **'Favorilerim'**
  String get myFavorites;

  /// No description provided for @myAddresses.
  ///
  /// In tr, this message translates to:
  /// **'Adreslerim'**
  String get myAddresses;

  /// No description provided for @paymentMethods.
  ///
  /// In tr, this message translates to:
  /// **'Ödeme Yöntemleri'**
  String get paymentMethods;

  /// No description provided for @notifications.
  ///
  /// In tr, this message translates to:
  /// **'Bildirimler'**
  String get notifications;

  /// No description provided for @help.
  ///
  /// In tr, this message translates to:
  /// **'Yardım'**
  String get help;

  /// No description provided for @home.
  ///
  /// In tr, this message translates to:
  /// **'Ana Sayfa'**
  String get home;

  /// No description provided for @orders.
  ///
  /// In tr, this message translates to:
  /// **'Siparişler'**
  String get orders;

  /// No description provided for @comingSoon.
  ///
  /// In tr, this message translates to:
  /// **'Yakında aktif olacak'**
  String get comingSoon;

  /// No description provided for @sendFlowers.
  ///
  /// In tr, this message translates to:
  /// **'Çiçek Gönder'**
  String get sendFlowers;

  /// No description provided for @sameDay.
  ///
  /// In tr, this message translates to:
  /// **'Aynı Gün Teslimat'**
  String get sameDay;

  /// No description provided for @recipientName.
  ///
  /// In tr, this message translates to:
  /// **'Alıcı Adı'**
  String get recipientName;

  /// No description provided for @recipientPhone.
  ///
  /// In tr, this message translates to:
  /// **'Alıcı Telefonu'**
  String get recipientPhone;

  /// No description provided for @cardMessage.
  ///
  /// In tr, this message translates to:
  /// **'Kart Mesajı'**
  String get cardMessage;
}

class _LDelegate extends LocalizationsDelegate<L> {
  const _LDelegate();

  @override
  Future<L> load(Locale locale) {
    return SynchronousFuture<L>(lookupL(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
        'de',
        'es',
        'fr',
        'it',
        'nl',
        'tr'
      ].contains(locale.languageCode);

  @override
  bool shouldReload(_LDelegate old) => false;
}

L lookupL(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'de':
      return LDe();
    case 'es':
      return LEs();
    case 'fr':
      return LFr();
    case 'it':
      return LIt();
    case 'nl':
      return LNl();
    case 'tr':
      return LTr();
  }

  throw FlutterError(
      'L.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
