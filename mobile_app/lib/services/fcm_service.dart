import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:easy_localization/easy_localization.dart';
import '../router/app_router.dart';
import '../widgets/in_app_notification.dart';

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  String? _fcmToken;
  
  // Local notifications plugin for foreground sound
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  bool _localNotificationsInitialized = false;
  
  String? get token => _fcmToken;

  /// Initialize FCM and request permissions
  Future<void> initialize() async {
    debugPrint('🔔 FCMService: Initializing...');
    
    // Initialize local notifications for sound playback
    await _initLocalNotifications();
    
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
      // Sound is OFF here because we play it ourselves via flutter_local_notifications
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: false,  // We show our own InAppNotification overlay
        badge: true,
        sound: false,  // We play sound ourselves via local notification
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

  /// Initialize flutter_local_notifications for foreground sound
  Future<void> _initLocalNotifications() async {
    if (_localNotificationsInitialized) return;
    
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );
    
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint('🔔 Local notification tapped: ${response.payload}');
        if (response.payload != null) {
          final parts = response.payload!.split(':');
          if (parts.length >= 2) {
            final type = parts[0];
            final orderId = parts[1];
            if (type == 'new_delivery') {
              _navigateToDriverDeliveries(orderId);
            } else if (type == 'chat_message') {
              _navigateToOrders(orderId: orderId, openChat: true);
            } else {
              _navigateToOrders(orderId: orderId);
            }
          }
        }
      },
    );
    
    // Create notification channel for Android
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'lokma_orders',
        'Sipariş Bildirimleri',
        description: 'LOKMA sipariş bildirimleri',
        importance: Importance.high,
        playSound: true,
      );
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
    
    _localNotificationsInitialized = true;
    debugPrint('🔔 Local notifications initialized');
  }

  /// Get the appropriate sound file for each notification type
  String _getSoundForType(String? type) {
    switch (type) {
      case 'order_status':
        return 'lokma_classic_ding.caf';    // Pop Melody — status update
      case 'order_ready':
        return 'lokma_bright_bell.caf';     // Signature Melody — ready!
      case 'new_delivery':
        return 'lokma_warm_dong.caf';       // Delivery Alert — strong attention
      case 'order_cancelled':
        return 'lokma_double_ding.caf';     // Marimba Hit — short, serious
      case 'order_delivered':
        return 'lokma_soft_gong.caf';       // Completion — happy, satisfying ✨
      case 'chat_message':
        return 'lokma_classic_ding.caf';    // Sound for chat message
      default:
        return 'lokma_order_bell.caf';      // Cascade Chime — premium default
    }
  }

  /// Show a local notification with type-specific LOKMA sound (instant)
  Future<void> _showLocalNotificationWithSound(String? title, String? body, {String? payload, String? type, String? imageUrl}) async {
    final soundFile = _getSoundForType(type);
    
    StyleInformation? styleInformation;
    if (imageUrl != null && imageUrl.isNotEmpty) {
      try {
        final response = await http.get(Uri.parse(imageUrl));
        if (response.statusCode == 200) {
          styleInformation = BigPictureStyleInformation(
            ByteArrayAndroidBitmap(response.bodyBytes),
            largeIcon: ByteArrayAndroidBitmap(response.bodyBytes),
            contentTitle: title,
            summaryText: body,
            htmlFormatContentTitle: true,
            htmlFormatSummaryText: true,
          );
        }
      } catch (e) {
        debugPrint('Error downloading image for notification: $e');
      }
    }
    
    // Use custom LOKMA sound from iOS bundle
    final androidDetails = AndroidNotificationDetails(
      'lokma_orders',
      'Sipariş Bildirimleri',
      channelDescription: 'LOKMA sipariş bildirimleri',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
      styleInformation: styleInformation,
    );
    
    // Use type-specific CAF sound from iOS app bundle
    final iosDetails = DarwinNotificationDetails(
      presentSound: true,
      presentAlert: true,
      presentBadge: true,
      sound: soundFile,
    );
    
    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
    
    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title ?? 'Bildirim',
      body,
      details,
      payload: payload,
    );
    debugPrint('🔔 Notification with sound [$soundFile] for type [$type]: $title');
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
      // Safely determine the user's localized language context
      String currentLang = 'tr';
      try {
        final context = _navigatorKey.currentContext;
        if (context != null) {
          currentLang = context.locale.languageCode;
        } else {
          currentLang = Platform.localeName.split('_')[0].toLowerCase();
        }
      } catch (e) {
        debugPrint('Language detection error in FCMService: $e');
      }

      await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
        'fcmToken': token,
        'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
        'language': currentLang,
      }, SetOptions(merge: true));
      debugPrint('✅ FCM Token and language ($currentLang) saved to Firestore for user: ${user.uid}');
    } catch (e) {
      debugPrint('Error saving FCM token: $e');
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
    
    final data = message.data;
    final type = data['type'] as String?;
    
    String? imageUrl;
    if (Platform.isAndroid) {
      imageUrl = message.notification?.android?.imageUrl;
    } else {
      imageUrl = message.notification?.apple?.imageUrl;
    }
    imageUrl ??= data['image'] ?? data['imageUrl'];
    
    // ── INSTANT: Play custom sound via local notification FIRST ──
    final payload = '${type ?? "unknown"}:${data['orderId'] ?? ""}';
    _showLocalNotificationWithSound(title, body, payload: payload, type: type, imageUrl: imageUrl);
    
    // ── Then show in-app overlay ──
    String emoji;
    Color accentColor;
    
    switch (type) {
      case 'order_cancelled':
        emoji = '❌';
        accentColor = const Color(0xFFE53935);
        break;
      case 'order_status':
        emoji = '📦';
        accentColor = const Color(0xFF42A5F5);
        break;
      case 'new_delivery':
        emoji = '🚚';
        accentColor = const Color(0xFFEA184A);
        break;
      case 'order_ready':
        emoji = '✅';
        accentColor = const Color(0xFF66BB6A);
        break;
      case 'chat_message':
        emoji = '💬';
        accentColor = const Color(0xFF9C27B0);
        break;
      case 'kermes_assignment':
      case 'roster_shift':
        emoji = '🛠️';
        accentColor = const Color(0xFF1976D2);
        break;
      case 'kermes_flash_sale':
        emoji = '🌟';
        accentColor = const Color(0xFFE91E63);
        break;
      case 'roster_deleted':
        emoji = '❌';
        accentColor = const Color(0xFFEA184A);
        break;
      default:
        emoji = '🔔';
        accentColor = const Color(0xFF6C63FF);
    }
    
    try {
      final context = _navigatorKey.currentContext;
      if (context != null) {
        InAppNotification.show(
          context: context,
          title: title ?? 'Bildirim',
          body: body,
          emoji: emoji,
          accentColor: accentColor,
          duration: const Duration(seconds: 4),
          onTap: () {
            final orderId = data['orderId'];
            if (type == 'new_delivery' && orderId != null) {
              _navigateToDriverDeliveries(orderId);
            } else if (type == 'chat_message' && orderId != null) {
              _navigateToOrders(orderId: orderId, openChat: true);
            } else if (type == 'kermes_flash_sale') {
              final kermesId = data['kermesId'];
              if (kermesId != null && kermesId.isNotEmpty) {
                _navigateTo('/kermesler/$kermesId');
              }
            } else if (type == 'kermes_assignment' || type == 'roster_shift' || type == 'roster_deleted') {
              _navigateTo('/staff-hub');
            } else if (orderId != null && orderId.isNotEmpty) {
              _navigateToOrders(orderId: orderId);
            } else {
              final nId = data['notificationId'];
              _navigateTo('/notification-history${nId != null ? '?openNotificationId=$nId' : ''}');
            }
          },
        );
        debugPrint('✅ Foreground notification overlay shown');
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
    
    debugPrint('[FCM] Notification type: $type, orderId: $orderId');
    
    if (type == 'new_delivery' && orderId != null) {
      _navigateToDriverDeliveries(orderId);
    } else if (type == 'chat_message' && orderId != null) {
      _navigateToOrders(orderId: orderId, openChat: true);
    } else if (type == 'kermes_flash_sale') {
      final kermesId = data['kermesId'];
      if (kermesId != null && kermesId.isNotEmpty) {
        _navigateTo('/kermesler/$kermesId');
      } else {
        final nId = data['notificationId'];
        _navigateTo('/notification-history${nId != null ? '?openNotificationId=$nId' : ''}');
      }
    } else if (type == 'kermes_assignment') {
      _navigateTo('/staff-hub');
    } else if (orderId != null && orderId.isNotEmpty) {
      _navigateToOrders(orderId: orderId);
    } else {
      final nId = data['notificationId'];
      _navigateTo('/notification-history${nId != null ? '?openNotificationId=$nId' : ''}');
    }
  }
  
  void _navigateToDriverDeliveries(String orderId) {
    Future.delayed(const Duration(milliseconds: 500), () {
      try {
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
  
  void _navigateToOrders({String? orderId, bool openChat = false}) {
    Future.delayed(const Duration(milliseconds: 500), () {
      try {
        final context = _navigatorKey.currentContext;
        if (context != null) {
          String path = '/notification-history';
          if (orderId != null) {
            path += '?orderId=$orderId';
            if (openChat) {
              path += '&openChat=true';
            }
          }
          GoRouter.of(context).go(path);
          debugPrint('[FCM] Navigated to $path');
        }
      } catch (e) {
        debugPrint('[FCM] Navigation error: $e');
      }
    });
  }
  
  void _navigateTo(String path) {
    Future.delayed(const Duration(milliseconds: 500), () {
      try {
        final context = _navigatorKey.currentContext;
        if (context != null) {
          GoRouter.of(context).go(path);
          debugPrint('[FCM] Navigated to $path');
        }
      } catch (e) {
        debugPrint('[FCM] Navigation error: $e');
      }
    });
  }
  
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
