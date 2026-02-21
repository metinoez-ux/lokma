import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/splash/splash_screen.dart';
import '../screens/marketplace/kasap/kasap_screen.dart';
import '../screens/marketplace/kasap/business_detail_screen.dart';
import '../screens/marketplace/market/market_screen.dart';
import '../screens/marketplace/restoran/restoran_screen.dart';
import '../screens/marketplace/kahve/kahve_shop_screen.dart';
import '../screens/marketplace/kermes/kermes_screen.dart';
import '../screens/kermes/kermes_list_screen.dart';
import '../screens/marketplace/catering/catering_screen.dart';
import '../screens/orders/orders_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/profile/my_info_screen.dart';
import '../screens/profile/payment_methods_screen.dart';
import '../screens/profile/help_screen.dart';
import '../screens/favorites/favorites_screen.dart';
import '../screens/settings/notification_settings_screen.dart';
import '../screens/profile/notification_history_screen.dart';
import '../screens/feedback/feedback_form_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/search/smart_search_screen.dart';
import '../screens/marketplace/kasap/cart_screen.dart';
import '../screens/driver/driver_delivery_screen.dart';
import '../screens/profile/my_reservations_screen.dart';
import '../screens/staff/staff_reservations_screen.dart';
import '../screens/staff/staff_hub_screen.dart';
import '../screens/staff/waiter_order_screen.dart';
import '../screens/customer/table_order_view_screen.dart';
import '../widgets/main_scaffold.dart';


class AppRouter {
  // Global navigator key for FCM notification deep linking
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  
  static late final GoRouter router;

  static void initializeRouter(bool hasSeenSplash) {
    router = GoRouter(
      navigatorKey: navigatorKey,
      initialLocation: hasSeenSplash ? '/restoran' : '/splash',  // Open directly to Yemek (food) page or splash
    // Handle Firebase Auth callback URLs - redirect to login and let Firebase SDK handle internally
    redirect: (context, state) {
      final location = state.uri.toString();
      // Firebase Auth reCAPTCHA callback URLs should be ignored by router
      if (location.contains('firebaseauth') || location.contains('__/auth/')) {
        return '/login';  // Redirect to login page to enter verification code
      }
      return null;  // No redirect for normal routes
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const RestoranScreen(),  // Home is now Yemek
          ),
          GoRoute(
            path: '/kasap',
            builder: (context, state) => KasapScreen(),
          ),
          GoRoute(
            path: '/market',
            builder: (context, state) => MarketScreen(),
          ),
          GoRoute(
            path: '/restoran',
            builder: (context, state) => const RestoranScreen(),
          ),
          GoRoute(
            path: '/kahve',
            builder: (context, state) => const KahveShopScreen(),
          ),
          GoRoute(
            path: '/kermes',
            builder: (context, state) => const KermesScreen(),
          ),
          // Kermesler - Full featured kermes list (from MIRA)
          GoRoute(
            path: '/kermesler',
            builder: (context, state) => const KermesListScreen(),
          ),
          // Kermes Detail - navigates to kermes list (detail is shown via modal)
          GoRoute(
            path: '/kermesler/:id',
            builder: (context, state) {
              // KermesListScreen no longer accepts initialKermesId
              // The detail view is opened via bottom sheet from the list
              return const KermesListScreen();
            },
          ),
          GoRoute(
            path: '/catering',
            builder: (context, state) => const CateringScreen(),
          ),
          GoRoute(
            path: '/orders',
            builder: (context, state) => OrdersScreen(),
          ),
          GoRoute(
            path: '/cart',
            builder: (context, state) => const CartScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
          GoRoute(
            path: '/search',
            builder: (context, state) {
              final segment = state.uri.queryParameters['segment'] ?? 'yemek';
              return SmartSearchScreen(segment: segment);
            },
          ),
        ],
      ),
      // DETAIL PAGES: Outside ShellRoute = No bottom nav bar (like Lieferando)
      // PRIMARY ROUTE: Turkish naming for user-facing URLs
      GoRoute(
        path: '/kasap/:id',
        builder: (context, state) {
          final businessId = state.pathParameters['id']!;
          final modeStr = state.uri.queryParameters['mode'] ?? 'teslimat';
          final deliveryMode = modeStr == 'masa' ? 2 : (modeStr == 'gelal' ? 1 : 0);
          final tableNumber = state.uri.queryParameters['table'];
          return BusinessDetailScreen(
            businessId: businessId,
            initialDeliveryMode: deliveryMode,
            initialTableNumber: tableNumber,
          );
        },
      ),
      // DINE-IN DEEP LINK: QR code → app opens → correct business + table
      GoRoute(
        path: '/dinein/:businessId/table/:tableNum',
        redirect: (context, state) {
          final id = state.pathParameters['businessId']!;
          final table = state.pathParameters['tableNum']!;
          return '/kasap/$id?mode=masa&table=$table';
        },
      ),
      // BACKWARD COMPATIBILITY ALIASES: Redirect to primary Turkish route
      GoRoute(
        path: '/butcher/:id',
        redirect: (context, state) {
          final id = state.pathParameters['id']!;
          final query = state.uri.query.isNotEmpty ? '?${state.uri.query}' : '';
          return '/kasap/$id$query';
        },
      ),
      GoRoute(
        path: '/business/:id',
        redirect: (context, state) {
          final id = state.pathParameters['id']!;
          final query = state.uri.query.isNotEmpty ? '?${state.uri.query}' : '';
          return '/kasap/$id$query';
        },
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/favorites',
        builder: (context, state) => const FavoritesScreen(),
      ),
      GoRoute(
        path: '/my-info',
        builder: (context, state) => const MyInfoScreen(),
      ),
      GoRoute(
        path: '/payment-methods',
        builder: (context, state) => const PaymentMethodsScreen(),
      ),
      GoRoute(
        path: '/notification-settings',
        builder: (context, state) => const NotificationSettingsScreen(),
      ),
      GoRoute(
        path: '/notification-history',
        builder: (context, state) => const NotificationHistoryScreen(),
      ),
      GoRoute(
        path: '/feedback',
        builder: (context, state) => const FeedbackFormScreen(),
      ),
      GoRoute(
        path: '/help',
        builder: (context, state) => const HelpScreen(),
      ),
      // Driver Deliveries - For couriers assigned to multiple businesses
      GoRoute(
        path: '/driver-deliveries',
        builder: (context, state) => const DriverDeliveryScreen(),
      ),
      // My Reservations - User's table reservations
      GoRoute(
        path: '/my-reservations',
        builder: (context, state) => const MyReservationsScreen(),
      ),
      // Staff Reservation Management
      GoRoute(
        path: '/staff-reservations',
        builder: (context, state) => const StaffReservationsScreen(),
      ),
      // Unified Staff Hub
      GoRoute(
        path: '/staff-hub',
        builder: (context, state) => const StaffHubScreen(),
      ),
      // Waiter Order Screen
      GoRoute(
        path: '/waiter-order',
        builder: (context, state) {
          final businessId = state.uri.queryParameters['businessId'];
          final businessName = state.uri.queryParameters['businessName'];
          final tableNumStr = state.uri.queryParameters['tableNumber'];
          final tableNumber = tableNumStr != null ? int.tryParse(tableNumStr) : null;
          return WaiterOrderScreen(
            businessId: businessId,
            businessName: businessName,
            tableNumber: tableNumber,
          );
        },
      ),
      // Customer Table Order View
      GoRoute(
        path: '/table-order',
        builder: (context, state) => const TableOrderViewScreen(),
      ),
    ],
  );
  }
}
