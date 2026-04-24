import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase/config.dart';
import 'router/app_router.dart';
import 'services/stripe_payment_service.dart';
import 'services/fcm_service.dart';
import 'providers/theme_provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'utils/firestore_asset_loader.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:google_fonts/google_fonts.dart';

String? _initError;

void main() async {
  // Wrap everything in a zone to catch all errors
  runZonedGuarded(() async {
    WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
    FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
    
    // Increase ImageCache size to prevent flickering and reloading when scrolling
    // Default is 100 MB / 1000 items, which fills up quickly with list images.
    PaintingBinding.instance.imageCache.maximumSizeBytes = 1024 * 1024 * 300; // 300 MB
    PaintingBinding.instance.imageCache.maximumSize = 2000; // 2000 items
    
    // ---------------------------------------------------------------
    // CRITICAL PATH: Only await what is absolutely required before
    // runApp(). Everything else runs in parallel or is deferred.
    // Goal: get to runApp() in < 1 second.
    // ---------------------------------------------------------------
    
    // Set up Flutter error handler
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      debugPrint('FlutterError: ${details.exception}');
    };
    
    // These two are synchronous-fast and required before runApp:
    await EasyLocalization.ensureInitialized();
    
    // Firebase MUST be ready before the widget tree (Firestore, Auth, etc.)
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
    } catch (e, stack) {
      _initError = 'Firebase Error: $e';
      debugPrint('Firebase init error: $e\n$stack');
    }
    
    // SharedPreferences is fast (~10ms) and needed for router
    final prefs = await SharedPreferences.getInstance();
    final hasSeenOnboarding = prefs.getBool('onboarding_seen') ?? false;
    
    AppRouter.initializeRouter(hasSeenOnboarding);
    
    // ---------------------------------------------------------------
    // NON-CRITICAL: Fire and forget. These run in background while
    // the splash animation plays. No need to block the UI.
    // ---------------------------------------------------------------
    _initializeBackgroundServices();
    
    // ---------------------------------------------------------------
    // LAUNCH: Get the Flutter engine rendering ASAP.
    // ---------------------------------------------------------------
    runApp(
      ProviderScope(
        child: EasyLocalization(
          supportedLocales: const [
          Locale('tr'), 
          Locale('en'), 
          Locale('de'),
          Locale('it'),
          Locale('fr'),
          Locale('es'),
          Locale('nl'),
        ],
          path: 'assets/translations',
          assetLoader: const FirestoreAssetLoader(), // Live translations
          fallbackLocale: const Locale('tr'),
          useOnlyLangCode: true, // IMPORTANT: Allows matching 'de_DE' to 'de'
          // Use device system language automatically (user can change in Profile)
          child: LokmaApp(initError: _initError),
        ),
      ),
    );
    
    // Remove native splash quickly after runApp.
    // The SplashScreen widget paints the same red background,
    // so removing the native splash here is invisible to the user.
    // We use a short delay to let the first frame render.
    Future.delayed(const Duration(milliseconds: 100), () {
      FlutterNativeSplash.remove();
    });
    
  }, (error, stack) {
    debugPrint('Uncaught error: $error');
    debugPrint('Stack: $stack');
    _initError = 'Uncaught Error: $error';
  });
}

/// Background services that don't need to block the UI.
/// These initialize while the splash animation is playing (~2s window).
void _initializeBackgroundServices() {
  // Stripe SDK -- needed before first payment, not before first frame
  StripePaymentService.initialize().catchError((e) {
    debugPrint('Stripe init error (non-blocking): $e');
  });
  
  // FCM push notifications
  FCMService().initialize().catchError((e) {
    debugPrint('FCM initialization error (non-blocking): $e');
  });
  
  // Date formatting
  initializeDateFormatting('tr').catchError((_) {});
  
  // Detect system locale (informational only)
  try {
    final systemLang = Platform.localeName.split('_')[0].toLowerCase();
    const supportedCodes = ['tr', 'en', 'de', 'it', 'fr', 'es'];
    debugPrint('System language detected: $systemLang, supported: ${supportedCodes.contains(systemLang)}');
  } catch (_) {}
}

class LokmaApp extends ConsumerWidget {
  final String? initError;
  
  const LokmaApp({super.key, this.initError});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch theme preference
    final themePreference = ref.watch(themePreferenceProvider);
    final themeMode = themePreferenceToMode(themePreference);
    
    // If there was an initialization error, show error screen
    if (initError != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: const Color(0xFF121212),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 60),
                  const Icon(Icons.error_outline, color: Colors.red, size: 64),
                  const SizedBox(height: 24),
                  const Text(
                    'Initialization Error',
                    style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  SelectableText(
                    initError!,
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    
    return MaterialApp.router(
      title: 'LOKMA',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      themeMode: themeMode, // Dynamic theme based on user preference
      theme: ThemeData(
        fontFamily: GoogleFonts.inter().fontFamily,
        textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
        useMaterial3: true,
        brightness: Brightness.light,
        primaryColor: const Color(0xFFEA184A), // Added to fix simple auth screen
        scaffoldBackgroundColor: Colors.white, // Pure white background for modern aesthetic
        colorScheme: ColorScheme.light(
          primary: const Color(0xFFEA184A), // LOKMA Brand Color
          secondary: const Color(0xFFFFB347),
          surface: Colors.white,
          error: Colors.redAccent,
          onSurface: Colors.black87,
        ),
        cupertinoOverrideTheme: const CupertinoThemeData(
          primaryColor: Color(0xFFEA184A), // LOKMA Brand Color (Cupertino)
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent, // Modern transparent look
          foregroundColor: Colors.black,
          elevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle.dark,
        ),
        cardTheme: const CardThemeData(
          color: Colors.white,
          elevation: 0, // Flat premium look
          margin: EdgeInsets.zero,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Colors.white,
          selectedItemColor: Color(0xFFEA184A), // LOKMA Brand Color
          unselectedItemColor: Colors.grey,
        ),
      ),
      darkTheme: ThemeData(
        fontFamily: GoogleFonts.inter().fontFamily,
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        useMaterial3: true,
        brightness: Brightness.dark,
        primaryColor: const Color(0xFFEA184A), // Added to fix simple auth screen
        scaffoldBackgroundColor: const Color(0xFF1C1B18),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFFEA184A), // LOKMA Brand Color
          secondary: const Color(0xFFFFB347),
          surface: const Color(0xFF2A2A28),
          error: Colors.redAccent,
        ),
        cupertinoOverrideTheme: const CupertinoThemeData(
          primaryColor: Color(0xFFEA184A), // LOKMA Brand Color (Cupertino)
          brightness: Brightness.dark,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1C1B18),
          foregroundColor: Colors.white,
          elevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle.light,
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF2A2A28),
          elevation: 2,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFF1C1B18),
          selectedItemColor: Color(0xFFEA184A), // LOKMA Brand Color
          unselectedItemColor: Colors.grey,
        ),
      ),
      routerConfig: AppRouter.router,
    );
  }
}
