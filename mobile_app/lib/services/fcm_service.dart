import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

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
    debugPrint('Foreground message received: ${message.notification?.title}');
    // You can show a local notification or snackbar here
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    debugPrint('Message opened app: ${message.data}');
    // Handle navigation based on message data
    // For example, navigate to order details
  }

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
