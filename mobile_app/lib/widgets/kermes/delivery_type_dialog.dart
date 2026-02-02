import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Teslimat türü enum
enum DeliveryType {
  gelAl,    // Gel Al - Takeaway
  masada,   // Masada Ye - Dine-in
  kurye,    // Kurye - Delivery
}

/// Teslimat türü seçim dialog'u
class DeliveryTypeSelectionDialog extends StatelessWidget {
  final String kermesName;
  final bool isGroupOrder;
  final Function(DeliveryType) onSelected;

  const DeliveryTypeSelectionDialog({
    super.key,
    required this.kermesName,
    required this.isGroupOrder,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.pink.shade400, Colors.pink.shade600],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.delivery_dining,
                    color: Colors.white,
                    size: 40,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Nasıl Almak İstersiniz?',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    kermesName,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.9),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),

            // Options
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Gel Al Option
                  _DeliveryOptionCard(
                    icon: Icons.shopping_bag_outlined,
                    iconColor: Colors.green,
                    title: 'Gel Al',
                    subtitle: 'Siparişinizi stanttan alın',
                    badge: 'Hızlı',
                    badgeColor: Colors.green,
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      onSelected(DeliveryType.gelAl);
                    },
                  ),
                  const SizedBox(height: 12),

                  // Masada Ye Option
                  _DeliveryOptionCard(
                    icon: Icons.table_restaurant_outlined,
                    iconColor: Colors.blue,
                    title: 'Masada Ye',
                    subtitle: 'Masanıza getirelim',
                    badge: 'Konforlu',
                    badgeColor: Colors.blue,
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      onSelected(DeliveryType.masada);
                    },
                  ),
                  const SizedBox(height: 12),

                  // Kurye Option
                  _DeliveryOptionCard(
                    icon: Icons.delivery_dining_outlined,
                    iconColor: Colors.orange,
                    title: 'Kurye ile Teslimat',
                    subtitle: 'Adresinize getirelim',
                    badge: 'Ücretli',
                    badgeColor: Colors.orange,
                    requiresAuth: true,
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      onSelected(DeliveryType.kurye);
                    },
                  ),
                ],
              ),
            ),

            // Cancel Button
            Padding(
              padding: const EdgeInsets.only(bottom: 20, left: 20, right: 20),
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  'İptal',
                  style: TextStyle(
                    color: Colors.grey,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Teslimat seçeneği kartı
class _DeliveryOptionCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String badge;
  final Color badgeColor;
  final bool requiresAuth;
  final VoidCallback onTap;

  const _DeliveryOptionCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.badgeColor,
    this.requiresAuth = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.grey.shade50,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              // Icon
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  icon,
                  color: iconColor,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),

              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.black87,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: badgeColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            badge,
                            style: TextStyle(
                              color: badgeColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            subtitle,
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        if (requiresAuth)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.lock_outline,
                                  size: 12,
                                  color: Colors.red.shade400,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Giriş Gerekli',
                                  style: TextStyle(
                                    color: Colors.red.shade400,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              // Arrow
              Icon(
                Icons.chevron_right,
                color: Colors.grey.shade400,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
