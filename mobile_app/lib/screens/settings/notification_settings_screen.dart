import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  // LOKMA Design Tokens
  static const Color lokmaRed = Color(0xFFFB335B);
  static const Color blackPure = Color(0xFF000000);
  static const Color surfaceCard = Color(0xFF181818);
  static const Color textSubtle = Color(0xFF888888);
  static const Color borderSubtle = Color(0xFF262626);

  bool _isLoading = true;
  
  // Notification Preferences
  bool _marketingNotifications = true;
  bool _orderConfirmation = true;
  bool _orderReady = true;
  bool _orderDelivered = true;
  bool _promotions = true;
  bool _newProducts = false;
  bool _favoriteShops = true;
  
  // Kermes & Etkinlik
  bool _kermesNotifications = true;
  bool _kermesReminders = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();

      if (doc.exists && doc.data()?['notificationPreferences'] != null) {
        final prefs = doc.data()!['notificationPreferences'] as Map<String, dynamic>;
        setState(() {
          _marketingNotifications = prefs['marketing'] ?? true;
          _orderConfirmation = prefs['orderConfirmation'] ?? true;
          _orderReady = prefs['orderReady'] ?? true;
          _orderDelivered = prefs['orderDelivered'] ?? true;
          _promotions = prefs['promotions'] ?? true;
          _newProducts = prefs['newProducts'] ?? false;
          _favoriteShops = prefs['favoriteShops'] ?? true;
          _kermesNotifications = prefs['kermesNotifications'] ?? true;
          _kermesReminders = prefs['kermesReminders'] ?? true;
        });
      }
    } catch (e) {
      debugPrint('Error loading notification preferences: $e');
    }

    setState(() => _isLoading = false);
  }

  Future<void> _savePreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    HapticFeedback.lightImpact();

    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .set({
            'notificationPreferences': {
              'marketing': _marketingNotifications,
              'orderConfirmation': _orderConfirmation,
              'orderReady': _orderReady,
              'orderDelivered': _orderDelivered,
              'promotions': _promotions,
              'newProducts': _newProducts,
              'favoriteShops': _favoriteShops,
              'kermesNotifications': _kermesNotifications,
              'kermesReminders': _kermesReminders,
            },
          }, SetOptions(merge: true));

      // Subscribe/unsubscribe to FCM topics
      final messaging = FirebaseMessaging.instance;
      
      if (_marketingNotifications) {
        await messaging.subscribeToTopic('lokma_marketing');
      } else {
        await messaging.unsubscribeFromTopic('lokma_marketing');
      }
      
      if (_promotions) {
        await messaging.subscribeToTopic('lokma_promotions');
      } else {
        await messaging.unsubscribeFromTopic('lokma_promotions');
      }
      
      if (_newProducts) {
        await messaging.subscribeToTopic('lokma_new_products');
      } else {
        await messaging.unsubscribeFromTopic('lokma_new_products');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bildirim ayarları kaydedildi'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error saving notification preferences: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _handleOrderNotificationToggle(String type, bool newValue) {
    // If turning ON, just enable it
    if (newValue) {
      setState(() {
        switch (type) {
          case 'orderConfirmation':
            _orderConfirmation = true;
            break;
          case 'orderReady':
            _orderReady = true;
            break;
          case 'orderDelivered':
            _orderDelivered = true;
            break;
        }
      });
      return;
    }

    // If turning OFF, show warning dialog
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
            SizedBox(width: 12),
            Text('Dikkat!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Sipariş bildirimlerini kapatırsanız, siparişleriniz hakkında önemli güncellemeleri alamazsınız.\n\nDevam etmek istiyor musunuz?',
          style: TextStyle(color: Color(0xFFAAAAAA), fontSize: 14, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('İptal', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                switch (type) {
                  case 'orderConfirmation':
                    _orderConfirmation = false;
                    break;
                  case 'orderReady':
                    _orderReady = false;
                    break;
                  case 'orderDelivered':
                    _orderDelivered = false;
                    break;
                }
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.withOpacity(0.8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Kapat', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: blackPure,
      appBar: AppBar(
        backgroundColor: blackPure,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Bildirim Ayarları', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: lokmaRed))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Order Notifications Section
                _buildSectionHeader('Sipariş Bildirimleri', Icons.shopping_bag),
                const SizedBox(height: 12),
                _buildNotificationTile(
                  title: 'Sipariş Onayı',
                  subtitle: 'Siparişiniz alındığında bildirim alın',
                  value: _orderConfirmation,
                  onChanged: (v) => _handleOrderNotificationToggle('orderConfirmation', v),
                  icon: Icons.check_circle_outline,
                ),
                _buildNotificationTile(
                  title: 'Sipariş Hazır',
                  subtitle: 'Siparişiniz hazırlandığında bildirim alın',
                  value: _orderReady,
                  onChanged: (v) => _handleOrderNotificationToggle('orderReady', v),
                  icon: Icons.restaurant,
                ),
                _buildNotificationTile(
                  title: 'Sipariş Teslim',
                  subtitle: 'Kurye siparişi teslim ettiğinde bildirim alın',
                  value: _orderDelivered,
                  onChanged: (v) => _handleOrderNotificationToggle('orderDelivered', v),
                  icon: Icons.local_shipping,
                ),

                const SizedBox(height: 32),
                
                // Marketing Section
                _buildSectionHeader('Pazarlama Bildirimleri', Icons.campaign),
                const SizedBox(height: 12),
                _buildNotificationTile(
                  title: 'Genel Bildirimler',
                  subtitle: 'Kampanya ve duyurulardan haberdar olun',
                  value: _marketingNotifications,
                  onChanged: (v) => setState(() => _marketingNotifications = v),
                  icon: Icons.notifications_active,
                ),
                _buildNotificationTile(
                  title: 'İndirim & Promosyon',
                  subtitle: 'Özel indirim ve promosyon fırsatları',
                  value: _promotions,
                  onChanged: (v) => setState(() => _promotions = v),
                  icon: Icons.local_offer,
                ),
                _buildNotificationTile(
                  title: 'Yeni Ürünler',
                  subtitle: 'Yeni ürün ve hizmetlerden haberdar olun',
                  value: _newProducts,
                  onChanged: (v) => setState(() => _newProducts = v),
                  icon: Icons.fiber_new,
                ),
                _buildNotificationTile(
                  title: 'Favori Dükkanlardan',
                  subtitle: 'Favori dükkanlarınızdan haftalık promosyonlar',
                  value: _favoriteShops,
                  onChanged: (v) => setState(() => _favoriteShops = v),
                  icon: Icons.store,
                ),

                const SizedBox(height: 32),

                // Kermes Section
                _buildSectionHeader('Kermes & Etkinlik', Icons.celebration),
                const SizedBox(height: 12),
                _buildNotificationTile(
                  title: 'Kermes Bildirimleri',
                  subtitle: 'Yakın çevredeki kermes etkinlikleri',
                  value: _kermesNotifications,
                  onChanged: (v) => setState(() => _kermesNotifications = v),
                  icon: Icons.festival,
                ),
                _buildNotificationTile(
                  title: 'Kermes Hatırlatıcılar',
                  subtitle: 'Kayıtlı olduğunuz kermeslerin başlama hatırlatmaları',
                  value: _kermesReminders,
                  onChanged: (v) => setState(() => _kermesReminders = v),
                  icon: Icons.alarm,
                ),

                const SizedBox(height: 40),

                // Save Button
                GestureDetector(
                  onTap: _savePreferences,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: lokmaRed,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Center(
                      child: Text(
                        'Kaydet',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 20),
              ],
            ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: lokmaRed, size: 20),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Widget _buildNotificationTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    required IconData icon,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: surfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderSubtle),
      ),
      child: Row(
        children: [
          Icon(icon, color: textSubtle, size: 22),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: textSubtle, fontSize: 12)),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: lokmaRed,
            activeTrackColor: lokmaRed.withOpacity(0.4),
          ),
        ],
      ),
    );
  }
}
