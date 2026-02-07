import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../router/app_router.dart';

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  String? _fcmToken;
  
  String? get token => _fcmToken;

  /// Initialize FCM and request permissions
  Future<void> initialize() async {
    debugPrint('🔔 FCMService: Initializing...');
    
    // Request permission (iOS requires this)
    final settings = await _messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );
    
    debugPrint('🔔 FCM Permission status: ${settings.authorizationStatus}');
    
    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      // CRITICAL: Tell iOS to show notification banners even when app is in foreground
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint('🔔 Foreground notification presentation options set');
      
      await _getAndSaveToken();
      
      // Listen for token refresh
      _messaging.onTokenRefresh.listen((newToken) {
        debugPrint('🔔 FCM Token refreshed');
        _fcmToken = newToken;
        _saveTokenToFirestore(newToken);
      });
      
      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      
      // Handle background/terminated messages
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);
    } else {
      debugPrint('⚠️ FCM: Notification permission denied');
    }
  }

  /// Manually refresh token - call this before placing an order
  Future<String?> refreshToken() async {
    await _getAndSaveToken();
    return _fcmToken;
  }

  Future<void> _getAndSaveToken() async {
    try {
      // On iOS, we need APNS token first
      String? apnsToken = await _messaging.getAPNSToken();
      debugPrint('APNS Token: ${apnsToken != null ? 'available' : 'not available'}');
      
      // If APNS not ready, wait and retry (iOS specific)
      if (apnsToken == null) {
        debugPrint('Waiting for APNS token...');
        await Future.delayed(const Duration(seconds: 2));
        apnsToken = await _messaging.getAPNSToken();
        
        // If still null after retry, try one more time
        if (apnsToken == null) {
          await Future.delayed(const Duration(seconds: 3));
          apnsToken = await _messaging.getAPNSToken();
        }
      }
      
      // Now get FCM token
      _fcmToken = await _messaging.getToken();
      debugPrint('FCM Token: ${_fcmToken != null ? '${_fcmToken!.substring(0, 20)}...' : 'null'}');
      
      if (_fcmToken != null) {
        await _saveTokenToFirestore(_fcmToken!);
      }
    } catch (e) {
      debugPrint('Error getting FCM token: $e');
    }
  }

  Future<void> _saveTokenToFirestore(String token) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      debugPrint('⚠️ No user logged in, cannot save FCM token');
      return;
    }
    
    try {
      // Use set with merge to create document if it doesn't exist
      await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
        'fcmToken': token,
        'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      debugPrint('✅ FCM Token saved to Firestore for user: ${user.uid}');
    } catch (e) {
      debugPrint('Error saving FCM token: $e');
      // Try to set if document might not exist
      try {
        await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
          'fcmToken': token,
          'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      } catch (e2) {
        debugPrint('Error setting FCM token: $e2');
      }
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('🔔 Foreground message received: ${message.notification?.title}');
    debugPrint('🔔 Message data: ${message.data}');
    
    final title = message.notification?.title;
    final body = message.notification?.body;
    
    if (title == null && body == null) return;
    
    // Show in-app SnackBar for foreground messages
    try {
      final context = _navigatorKey.currentContext;
      if (context != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null)
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                if (body != null)
                  Text(
                    body,
                    style: const TextStyle(fontSize: 13),
                  ),
              ],
            ),
            backgroundColor: const Color(0xFF2E7D32),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Göster',
              textColor: Colors.white,
              onPressed: () {
                // Navigate based on notification type
                final data = message.data;
                final type = data['type'];
                final orderId = data['orderId'];
                if (type == 'new_delivery' && orderId != null) {
                  _navigateToDriverDeliveries(orderId);
                } else if (type == 'order_status' && orderId != null) {
                  _navigateToOrders();
                }
              },
            ),
          ),
        );
        debugPrint('✅ Foreground notification SnackBar shown');
      } else {
        debugPrint('⚠️ No context available for SnackBar');
      }
    } catch (e) {
      debugPrint('❌ Error showing foreground notification: $e');
    }
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    debugPrint('Message opened app: ${message.data}');
    
    final data = message.data;
    final type = data['type'];
    final orderId = data['orderId'];
    
    debugPrint('🔔 Notification type: $type, orderId: $orderId');
    
    // Handle different notification types
    if (type == 'new_delivery' && orderId != null) {
      // Driver tapped on new delivery notification - navigate to driver deliveries
      debugPrint('🚚 Navigating to driver deliveries for order: $orderId');
      _navigateToDriverDeliveries(orderId);
    } else if (type == 'order_status' && orderId != null) {
      // Customer tapped on order status notification - navigate to orders
      debugPrint('📦 Navigating to orders for order: $orderId');
      _navigateToOrders();
    }
  }
  
  void _navigateToDriverDeliveries(String orderId) {
    // Use a slight delay to ensure the app is fully initialized
    Future.delayed(const Duration(milliseconds: 500), () {
      // Import and use GoRouter for navigation
      try {
        // Navigate to driver deliveries screen
        // The screen will show the order that needs attention
        final context = _navigatorKey.currentContext;
        if (context != null) {
          GoRouter.of(context).go('/driver-deliveries');
          debugPrint('✅ Navigated to driver-deliveries');
        } else {
          debugPrint('⚠️ Navigator context not available');
        }
      } catch (e) {
        debugPrint('❌ Navigation error: $e');
      }
    });
  }
  
  void _navigateToOrders() {
    Future.delayed(const Duration(milliseconds: 500), () {
      try {
        final context = _navigatorKey.currentContext;
        if (context != null) {
          GoRouter.of(context).go('/orders');
          debugPrint('✅ Navigated to orders');
        }
      } catch (e) {
        debugPrint('❌ Navigation error: $e');
      }
    });
  }
  
  // Global navigator key - set this from main.dart
  GlobalKey<NavigatorState> get _navigatorKey => AppRouter.navigatorKey;

  /// Delete token on logout
  Future<void> deleteToken() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      try {
        await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
          'fcmToken': FieldValue.delete(),
        });
      } catch (e) {
        debugPrint('Error deleting FCM token: $e');
      }
    }
    
    await _messaging.deleteToken();
    _fcmToken = null;
    debugPrint('FCM Token deleted');
  }
}
