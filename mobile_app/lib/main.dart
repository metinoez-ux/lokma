import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase/config.dart';
import 'router/app_router.dart';
import 'services/stripe_payment_service.dart';
import 'services/fcm_service.dart';
import 'package:geolocator/geolocator.dart';
import 'providers/theme_provider.dart';
import 'package:intl/date_symbol_data_local.dart';

String? _initError;

void main() async {
  // Wrap everything in a zone to catch all errors
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    
    // Set up Flutter error handler
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      debugPrint('FlutterError: ${details.exception}');
    };
    
    try {
      // Initialize Firebase on both platforms
      // On iOS, APNs token handling is done in AppDelegate.swift
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
      
      // Initialize Stripe SDK
      await StripePaymentService.initialize();
      
      // Initialize FCM for push notifications
      await FCMService().initialize();
      
      // Initialize date formatting for all locales (multi-language ready)
      await initializeDateFormatting('tr');
      // Future: add more locales here (de, en, ar, etc.)
      
      // Request location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }
    } catch (e, stack) {
      _initError = 'Firebase Error: $e';
      debugPrint('Firebase init error: $e\n$stack');
    }

    runApp(ProviderScope(child: LokmaApp(initError: _initError)));
  }, (error, stack) {
    debugPrint('Uncaught error: $error');
    debugPrint('Stack: $stack');
    _initError = 'Uncaught Error: $error';
  });
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
      themeMode: themeMode, // Dynamic theme based on user preference
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFE8E8EC), // Hafif gri - kontrastlı arka plan
        colorScheme: ColorScheme.light(
          primary: const Color(0xFFF43F5E), // LOKMA Brand Color
          secondary: const Color(0xFFFFB347),
          surface: Colors.white,
          error: Colors.redAccent,
          onSurface: Colors.black87,
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
          selectedItemColor: Color(0xFFF43F5E), // LOKMA Brand Color
          unselectedItemColor: Colors.grey,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF121212),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFFF43F5E), // LOKMA Brand Color
          secondary: const Color(0xFFFFB347),
          surface: const Color(0xFF1E1E1E),
          error: Colors.redAccent,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E1E1E),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF1E1E1E),
          elevation: 2,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFF1E1E1E),
          selectedItemColor: Color(0xFFF43F5E), // LOKMA Brand Color
          unselectedItemColor: Colors.grey,
        ),
      ),
      routerConfig: AppRouter.router,
    );
  }
}
