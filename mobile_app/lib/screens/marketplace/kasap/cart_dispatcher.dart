import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/kermes_cart_provider.dart';
import '../../../models/kermes_model.dart';
import '../../../utils/currency_utils.dart';
import '../../kermes/kermes_checkout_sheet.dart';
import 'cart_screen.dart';

const Color _lokmaPink = Color(0xFFEA184A);

/// Decides which cart view to show based on active cart state.
/// - If kermes cart has items -> show KermesCartView
/// - If regular cart has items (or both empty) -> show CartScreen
class CartDispatcher extends ConsumerWidget {
  final int initialTab;
  const CartDispatcher({super.key, this.initialTab = 0});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kermesCart = ref.watch(kermesCartProvider);

    // Kermes cart has items -> show kermes cart view
    if (kermesCart.isNotEmpty) {
      return _KermesCartView(cartState: kermesCart);
    }

    // Otherwise show regular cart screen
    return CartScreen(initialTab: initialTab);
  }
}

/// Standalone kermes cart view displayed in the cart tab
class _KermesCartView extends ConsumerStatefulWidget {
  final KermesCartState cartState;
  const _KermesCartView({required this.cartState});

  @override
  ConsumerState<_KermesCartView> createState() => _KermesCartViewState();
}

class _KermesCartViewState extends ConsumerState<_KermesCartView> {
  // Event metadata loaded from Firestore
  String? _kermesTitle;
  String? _kermesCity;
  DateTime? _kermesStartDate;
  DateTime? _kermesEndDate;
  String? _openingTime;
  String? _closingTime;
  bool _loadingMeta = true;

  @override
  void initState() {
    super.initState();
    _loadEventMeta();
  }

  Future<void> _loadEventMeta() async {
    final eventId = widget.cartState.eventId;
    if (eventId == null) {
      setState(() => _loadingMeta = false);
      return;
    }

    try {
      final doc = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(eventId)
          .get();
      if (doc.exists && doc.data() != null && mounted) {
        final data = doc.data()!;
        DateTime? start;
        if (data['startDate'] != null) {
          start = (data['startDate'] as Timestamp).toDate();
        } else if (data['date'] != null) {
          start = (data['date'] as Timestamp).toDate();
        }
        DateTime? end;
        if (data['endDate'] != null) {
          end = (data['endDate'] as Timestamp).toDate();
        }

        setState(() {
          _kermesTitle = data['name'] ?? data['title'] ?? widget.cartState.eventName;
          _kermesCity = data['city'] ?? '';
          _kermesStartDate = start;
          _kermesEndDate = end;
          _openingTime = data['openingTime'];
          _closingTime = data['closingTime'];
          _loadingMeta = false;
        });
      } else {
        setState(() => _loadingMeta = false);
      }
    } catch (e) {
      debugPrint('Error loading kermes meta: $e');
      setState(() => _loadingMeta = false);
    }
  }

  /// True if kermes end date has passed
  bool get _isKermesExpired {
    if (_kermesEndDate == null) return false;
    return DateTime.now().isAfter(_kermesEndDate!);
  }

  /// True if current time is within opening hours
  bool get _isWithinOpeningHours {
    if (_openingTime == null || _closingTime == null) return true; // no hours defined = always open
    try {
      final now = DateTime.now();
      final openParts = _openingTime!.split(':');
      final closeParts = _closingTime!.split(':');
      final openHour = int.parse(openParts[0]);
      final openMin = openParts.length > 1 ? int.parse(openParts[1]) : 0;
      final closeHour = int.parse(closeParts[0]);
      final closeMin = closeParts.length > 1 ? int.parse(closeParts[1]) : 0;

      final openTime = DateTime(now.year, now.month, now.day, openHour, openMin);
      final closeTime = DateTime(now.year, now.month, now.day, closeHour, closeMin);

      return now.isAfter(openTime) && now.isBefore(closeTime);
    } catch (_) {
      return true;
    }
  }

  String _formatDateRange() {
    if (_kermesStartDate == null) return '';
    final df = DateFormat('dd.MM.yyyy');
    final start = df.format(_kermesStartDate!);
    if (_kermesEndDate != null) {
      final end = df.format(_kermesEndDate!);
      if (start == end) return start;
      return '$start - $end';
    }
    return start;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cartState = ref.watch(kermesCartProvider);
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    final cardBg = isDark ? const Color(0xFF1C1C1E) : const Color(0xFFF5F5F5);

    return Scaffold(
      backgroundColor: isDark ? Colors.black : Colors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: textColor, size: 20),
          onPressed: () {
            HapticFeedback.lightImpact();
            GoRouter.of(context).go('/kermesler');
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _kermesTitle ?? widget.cartState.eventName ?? 'Kermes Sepeti',
              style: TextStyle(
                color: textColor,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (_kermesCity != null && _kermesCity!.isNotEmpty)
              Text(
                _kermesCity!,
                style: TextStyle(
                  color: subtleColor,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            if (!_loadingMeta && _kermesStartDate != null) ...[
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 11, color: _isKermesExpired ? Colors.red[400] : subtleColor),
                  const SizedBox(width: 4),
                  Text(
                    _formatDateRange(),
                    style: TextStyle(
                      color: _isKermesExpired ? Colors.red[400] : subtleColor,
                      fontSize: 12,
                      fontWeight: _isKermesExpired ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  if (_isKermesExpired) ...[
                    const SizedBox(width: 6),
                    Text(
                      '(Bitmis)',
                      style: TextStyle(color: Colors.red[400], fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
        toolbarHeight: _kermesStartDate != null ? 72 : 56,
        backgroundColor: isDark ? Colors.black : Colors.white,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: () {
              HapticFeedback.mediumImpact();
              _showClearCartDialog(context);
            },
            child: Text(
              'Temizle',
              style: TextStyle(
                color: Colors.red[400],
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      body: cartState.isEmpty
          ? _buildEmptyState(isDark, textColor, subtleColor)
          : Column(
              children: [
                // Expired warning banner
                if (_isKermesExpired)
                  Container(
                    margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Colors.red[700], size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Bu kermes sona ermis. Siparis verilemez.',
                            style: TextStyle(color: Colors.red[700], fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    itemCount: cartState.items.length,
                    itemBuilder: (context, index) {
                      final item = cartState.items[index];
                      return _buildCartItem(item, isDark, textColor, subtleColor, cardBg);
                    },
                  ),
                ),
              ],
            ),
      bottomNavigationBar: cartState.isNotEmpty
          ? _buildCheckoutButton(isDark, cartState)
          : null,
    );
  }

  Widget _buildCartItem(KermesCartItem item, bool isDark, Color textColor, Color subtleColor, Color cardBg) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          // Product image
          if (item.menuItem.imageUrl != null && item.menuItem.imageUrl!.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                item.menuItem.imageUrl!,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[800] : Colors.grey[200],
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.fastfood, color: subtleColor, size: 24),
                ),
              ),
            ),
          if (item.menuItem.imageUrl != null && item.menuItem.imageUrl!.isNotEmpty)
            const SizedBox(width: 12),
          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.menuItem.name,
                  style: TextStyle(
                    color: textColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                if (item.selectedOptions.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    item.selectedOptions.map((o) => o.optionName).join(', '),
                    style: TextStyle(color: subtleColor, fontSize: 13, fontWeight: FontWeight.w500),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  '${item.totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                  style: const TextStyle(color: _lokmaPink, fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          // Quantity controls
          Container(
            height: 36,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(kermesCartProvider.notifier).removeFromCart(item.menuItem.name);
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    child: Icon(
                      item.quantity <= 1 ? Icons.delete_outline : Icons.remove,
                      size: 18,
                      color: item.quantity <= 1 ? Colors.red[400] : (isDark ? Colors.white70 : Colors.black87),
                    ),
                  ),
                ),
                Container(
                  width: 30,
                  alignment: Alignment.center,
                  child: Text(
                    item.quantity.toString(),
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: textColor,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(kermesCartProvider.notifier).addItem(item.menuItem);
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    child: const Icon(Icons.add, size: 18, color: _lokmaPink),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark, Color textColor, Color subtleColor) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shopping_bag_outlined, size: 64, color: subtleColor),
          const SizedBox(height: 16),
          Text(
            'Sepetiniz bos',
            style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Kermes menusunden urunler ekleyin',
            style: TextStyle(color: subtleColor, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutButton(bool isDark, KermesCartState cartState) {
    final isDisabled = _isKermesExpired;

    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Summary
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${cartState.totalItems} urun',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          // Checkout button
          GestureDetector(
            onTap: isDisabled ? null : () {
              HapticFeedback.mediumImpact();
              _openCheckout();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              decoration: BoxDecoration(
                color: isDisabled ? Colors.grey : _lokmaPink,
                borderRadius: BorderRadius.circular(16),
                boxShadow: isDisabled ? [] : [
                  BoxShadow(
                    color: _lokmaPink.withOpacity(0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Text(
                isDisabled ? 'Kermes Bitmis' : 'Siparisi Onayla',
                style: TextStyle(
                  color: isDisabled ? Colors.grey[400] : Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openCheckout() async {
    final eventId = ref.read(kermesCartProvider).eventId;
    if (eventId == null) return;

    // Acilis saati kontrolu sonraya birakildi - siparis gonderme asamasinda yapilacak
    // Kullanici checkout akisini (teslimat tipi, bilgi, odeme) gezebilir

    // Show loading indicator
    if (mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );
    }

    try {
      final doc = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(eventId)
          .get();

      if (!mounted) return;
      Navigator.of(context).pop(); // dismiss loading

      if (!doc.exists || doc.data() == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Kermes bilgileri bulunamadi')),
          );
        }
        return;
      }

      final data = doc.data()!;
      final event = _parseKermesEvent(doc.id, data);

      if (!mounted) return;
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        useSafeArea: true,
        builder: (ctx) => KermesCheckoutSheet(event: event),
      );
    } catch (e) {
      debugPrint('Checkout error: $e');
      if (!mounted) return;
      // Try to dismiss loading dialog if still open
      try { Navigator.of(context).pop(); } catch (_) {}
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e')),
        );
      }
    }
  }

  /// Parse KermesEvent from Firestore document data
  KermesEvent _parseKermesEvent(String docId, Map<String, dynamic> data) {
    DateTime startDate;
    if (data['startDate'] != null) {
      startDate = (data['startDate'] as Timestamp).toDate();
    } else if (data['date'] != null) {
      startDate = (data['date'] as Timestamp).toDate();
    } else {
      startDate = DateTime.now();
    }

    DateTime endDate;
    if (data['endDate'] != null) {
      endDate = (data['endDate'] as Timestamp).toDate();
    } else {
      endDate = startDate.add(const Duration(days: 1));
    }

    List<KermesMenuItem> menuItems = [];
    final itemsData = data['items'] ?? data['menuItems'];
    if (itemsData is List) {
      menuItems = itemsData
          .map((e) => KermesMenuItem(
                name: e['title'] ?? e['name'] ?? '',
                price: (e['price'] is num) ? (e['price'] as num).toDouble() : 0.0,
                description: e['description']?.toString(),
                imageUrl: e['imageUrl']?.toString(),
                category: e['category']?.toString(),
                categoryData: e['categoryData'] is Map
                    ? Map<String, dynamic>.from(e['categoryData'])
                    : null,
              ))
          .toList();
    }

    final List<String> features = (data['features'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList();

    return KermesEvent(
      id: docId,
      title: data['name'] ?? data['title'] ?? '',
      address: data['address'] ?? '',
      city: data['city'] ?? '',
      phoneNumber: data['phoneNumber'] ?? '',
      startDate: startDate,
      endDate: endDate,
      latitude: data['latitude']?.toDouble() ?? 0.0,
      longitude: data['longitude']?.toDouble() ?? 0.0,
      menu: menuItems,
      parking: [],
      weatherForecast: [],
      openingTime: data['openingTime'] ?? '08:00',
      closingTime: data['closingTime'] ?? '22:00',
      flyers: data['imageUrl'] != null ? [data['imageUrl']] : [],
      hasTakeaway: features.contains('takeaway'),
      hasDelivery: features.contains('delivery'),
      hasDineIn: features.contains('dine_in') || features.contains('masa'),
      isMenuOnly: data['isMenuOnly'] ?? false,
      hasKidsActivities: features.contains('kids') || features.contains('kids_area'),
      activeBadgeIds: (data['activeBadgeIds'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      selectedDonationFundId: data['selectedDonationFundId']?.toString(),
    );
  }

  void _showClearCartDialog(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Sepeti Temizle', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
        content: Text(
          'Kermes sepetinizdeki tum urunler silinecek. Emin misiniz?',
          style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[700]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Vazgec', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
          ),
          TextButton(
            onPressed: () {
              ref.read(kermesCartProvider.notifier).clearCart();
              Navigator.pop(ctx);
            },
            child: Text('Temizle', style: TextStyle(color: Colors.red[400], fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
