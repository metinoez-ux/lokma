import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../utils/i18n_utils.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/table_session_service.dart';
import '../../services/order_service.dart';
import '../../models/butcher_product.dart';
import '../../data/product_catalog_data.dart';

/// Garson Sipariş Ekranı
/// Waiter selects table → opens/joins session → browses menu → adds items → sends to kitchen
class WaiterOrderScreen extends StatefulWidget {
  final String? businessId;
  final String? businessName;
  final int? tableNumber;

  const WaiterOrderScreen({super.key, this.businessId, this.businessName, this.tableNumber});

  @override
  State<WaiterOrderScreen> createState() => _WaiterOrderScreenState();
}

class _WaiterOrderScreenState extends State<WaiterOrderScreen> {
  final TableSessionService _sessionService = TableSessionService();
  final OrderService _orderService = OrderService();
  
  // State
  String? _businessId;
  String? _businessName;
  int? _selectedTable;
  TableSession? _activeSession;
  String _selectedCategory = 'Tümü';
  String _menuSearchQuery = '';
  final Map<String, _CartItem> _cart = {}; // productId -> cart item
  bool _isLoading = false;
  String? _notes;
  
  // Step tracking
  _WaiterStep _currentStep = _WaiterStep.selectTable;
  
  @override
  void initState() {
    super.initState();
    _businessId = widget.businessId;
    _businessName = widget.businessName;
    
    // If no businessId provided, load from user's admin profile
    if (_businessId == null) {
      _loadBusinessFromProfile();
    }
    
    // If tableNumber provided (from dashboard), auto-select and skip to menu
    if (widget.tableNumber != null && _businessId != null) {
      _isLoading = true; // Start in loading state — never show table grid
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        final existingSession = await _sessionService.getActiveSession(_businessId!, widget.tableNumber!);
        if (existingSession != null && mounted) {
          setState(() {
            _selectedTable = widget.tableNumber;
            _activeSession = existingSession;
            _currentStep = _WaiterStep.browseMenu;
            _isLoading = false;
          });
        } else {
          // No session yet — create one directly (user already confirmed on StaffHub)
          await _createSessionAndGoToMenu(widget.tableNumber!);
        }
      });
    }
  }

  Future<void> _loadBusinessFromProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    try {
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      
      if (!adminDoc.exists || !mounted) return;
      
      final data = adminDoc.data()!;
      String? bizId;
      
      // 1) Check direct businessId / butcherId (primary for staff/garson)
      bizId = data['businessId'] ?? data['butcherId'];
      
      // 2) Fallback: check assignedBusinesses array (for drivers who also serve)
      if (bizId == null) {
        final assigned = data['assignedBusinesses'] as List<dynamic>?;
        if (assigned != null && assigned.isNotEmpty) {
          bizId = assigned.first.toString();
        }
      }
      
      if (bizId != null) {
        final bizDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(bizId)
            .get();
        
        if (mounted) {
          setState(() {
            _businessId = bizId;
            _businessName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? 'İşletme';
          });
        }
      }
    } catch (e) {
      debugPrint('Error loading business: $e');
    }
  }

  Future<void> _selectTable(int tableNumber, {bool fromDashboard = false}) async {
    if (_businessId == null) return;

    // Check for existing session first
    final existingSession = await _sessionService.getActiveSession(_businessId!, tableNumber);
    
    if (existingSession != null) {
      // Table has active session → show order overview bottom sheet
      if (mounted) {
        _showTableOverviewSheet(existingSession, tableNumber);
      }
      return;
    }
    
    // No active session → ask the user before creating one
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.table_restaurant, color: const Color(0xFFFB335B)),
            const SizedBox(width: 8),
            Text('Masa $tableNumber'),
          ],
        ),
        content: Text(
          'Masa $tableNumber için yeni sipariş oturumu başlatmak istiyor musunuz?',
          style: const TextStyle(fontSize: 15),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('İptal', style: TextStyle(color: Colors.grey[600])),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFB335B)),
            child: Text(tr('staff.yes_start')),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      // User cancelled — if came from dashboard, go back instead of showing table grid
      if (fromDashboard && mounted) {
        Navigator.of(context).pop();
      }
      return;
    }

    // User confirmed — create new session
    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      final waiterName = adminDoc.data()?['name'] ?? user.displayName ?? 'Garson';
      
      final session = await _sessionService.createSession(
        businessId: _businessId!,
        tableNumber: tableNumber,
        waiterId: user.uid,
        waiterName: waiterName,
      );
      
      if (mounted) {
        setState(() {
          _selectedTable = tableNumber;
          _activeSession = session;
          _currentStep = _WaiterStep.browseMenu;
          _isLoading = false;
        });
        _showPinDialog(session.pin);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
      }
    }
  }

  /// Creates session directly and goes to menu (used when coming from dashboard,
  /// where user already confirmed via the StaffHub dialog)
  Future<void> _createSessionAndGoToMenu(int tableNumber) async {
    if (_businessId == null) return;
    // Keep _isLoading = true the entire time (set by initState)
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      final waiterName = adminDoc.data()?['name'] ?? user.displayName ?? 'Garson';

      final session = await _sessionService.createSession(
        businessId: _businessId!,
        tableNumber: tableNumber,
        waiterId: user.uid,
        waiterName: waiterName,
      );

      if (mounted) {
        setState(() {
          _selectedTable = tableNumber;
          _activeSession = session;
          _currentStep = _WaiterStep.browseMenu;
          _isLoading = false;
        });
        _showPinDialog(session.pin);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
        // Go back to staff hub on error
        if (Navigator.canPop(context)) Navigator.pop(context);
      }
    }
  }

  /// Shows a bottom sheet with the table's current order summary and payment status
  void _showTableOverviewSheet(TableSession session, int tableNumber) {
    const brandColor = Color(0xFFFB335B);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
        final sheetBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
        
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.3,
          builder: (_, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: sheetBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // Handle bar
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(
                      children: [
                        Icon(Icons.table_restaurant, color: brandColor, size: 28),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Masa $tableNumber',
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                              ),
                              Text(
                                'Garson: ${session.waiterName} • PIN: ${session.pin}',
                                style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(),
                  // Orders stream
                  Expanded(
                    child: StreamBuilder<List<LokmaOrder>>(
                      stream: _orderService.getTableSessionOrdersStream(session.id),
                      builder: (context, snapshot) {
                        final orders = snapshot.data ?? [];
                        if (orders.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.receipt_long, size: 48, color: Colors.grey[300]),
                                const SizedBox(height: 12),
                                Text('Henüz sipariş yok', style: TextStyle(color: Colors.grey[500])),
                              ],
                            ),
                          );
                        }
                        
                        final grandTotal = orders.fold<double>(0, (sum, o) => sum + o.totalAmount);
                        final paidOrders = orders.where((o) => o.paymentStatus == 'paid').length;
                        final allPaid = paidOrders == orders.length;
                        
                        return ListView(
                          controller: scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          children: [
                            // Summary card
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: allPaid ? Colors.green.shade50 : brandColor.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: allPaid ? Colors.green.shade200 : brandColor.withOpacity(0.2)),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    allPaid ? Icons.check_circle : Icons.receipt_long,
                                    color: allPaid ? Colors.green.shade700 : brandColor,
                                    size: 32,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          allPaid ? 'Hesap Ödendi ✓' : 'Hesap Açık',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: allPaid ? Colors.green.shade800 : brandColor,
                                          ),
                                        ),
                                        Text(
                                          '${orders.length} sipariş • $paidOrders/${ orders.length} ödendi',
                                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '€${grandTotal.toStringAsFixed(2)}',
                                    style: TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                      color: allPaid ? Colors.green.shade800 : brandColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            
                            // Individual orders
                            ...orders.map((order) {
                              final isPaid = order.paymentStatus == 'paid';
                              // Status badge config
                              final statusConfig = <OrderStatus, Map<String, dynamic>>{
                                OrderStatus.pending: {'label': '⏳ Beklemede', 'color': Colors.yellow.shade700, 'bg': Colors.yellow.shade50},
                                OrderStatus.preparing: {'label': '👨‍🍳 Hazırlanıyor', 'color': Colors.amber.shade700, 'bg': Colors.amber.shade50},
                                OrderStatus.ready: {'label': '📦 Hazır', 'color': Colors.green.shade700, 'bg': Colors.green.shade50},
                                OrderStatus.served: {'label': '🍽️ Servis Edildi', 'color': Colors.teal.shade700, 'bg': Colors.teal.shade50},
                              };
                              final sc = statusConfig[order.status];
                              
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: cardBg,
                                  borderRadius: BorderRadius.circular(14),
                                  border: isPaid
                                      ? Border.all(color: Colors.green.shade200)
                                      : order.status == OrderStatus.ready
                                          ? Border.all(color: Colors.green.shade400, width: 2)
                                          : null,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                                        ),
                                        const SizedBox(width: 8),
                                        // Order status badge
                                        if (sc != null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: (sc['bg'] as Color),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              sc['label'] as String,
                                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: sc['color'] as Color),
                                            ),
                                          ),
                                        const Spacer(),
                                        if (isPaid)
                                          Icon(Icons.check_circle, size: 14, color: Colors.green.shade700)
                                        else
                                          Icon(Icons.circle_outlined, size: 14, color: Colors.red.shade400),
                                        const SizedBox(width: 6),
                                        Text(
                                          '€${order.totalAmount.toStringAsFixed(2)}',
                                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: brandColor),
                                        ),
                                      ],
                                    ),
                                    const Divider(height: 12),
                                    ...order.items.map((item) => Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 1),
                                      child: Text(
                                        '${item.quantity.toStringAsFixed(item.unit == 'kg' ? 1 : 0)}x ${item.name}',
                                        style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                                      ),
                                    )),
                                    // "Servis Edildi" action button for ready orders
                                    if (order.status == OrderStatus.ready)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 10),
                                        child: SizedBox(
                                          width: double.infinity,
                                          child: FilledButton.icon(
                                            icon: const Icon(Icons.restaurant, size: 16),
                                            label: const Text('Servis Edildi', style: TextStyle(fontWeight: FontWeight.w700)),
                                            style: FilledButton.styleFrom(
                                              backgroundColor: Colors.teal.shade600,
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                            onPressed: () async {
                                              try {
                                                final user = FirebaseAuth.instance.currentUser;
                                                if (user == null) return;
                                                await _orderService.markAsServed(
                                                  orderId: order.id,
                                                  waiterId: user.uid,
                                                  waiterName: user.displayName ?? 'Garson',
                                                );
                                                if (mounted) {
                                                  HapticFeedback.mediumImpact();
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(
                                                      content: Text(tr('staff.order_served_success')),
                                                      backgroundColor: Colors.teal.shade700,
                                                      behavior: SnackBarBehavior.floating,
                                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                                    ),
                                                  );
                                                }
                                              } catch (e) {
                                                if (mounted) {
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
                                                  );
                                                }
                                              }
                                            },
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        );
                      },
                    ),
                  ),
                  // Action buttons
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              icon: const Icon(Icons.add, size: 18),
                              label: Text(tr('staff.add_order')),
                              style: FilledButton.styleFrom(
                                backgroundColor: brandColor,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              onPressed: () {
                                Navigator.pop(ctx);
                                setState(() {
                                  _selectedTable = tableNumber;
                                  _activeSession = session;
                                  _currentStep = _WaiterStep.browseMenu;
                                });
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.receipt_long, size: 18),
                              label: Text(tr('staff.bill')),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: brandColor,
                                side: BorderSide(color: brandColor.withOpacity(0.5)),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              onPressed: () {
                                Navigator.pop(ctx);
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => _TableBillView(
                                      session: session,
                                      businessId: _businessId!,
                                      businessName: _businessName ?? '',
                                      orderService: _orderService,
                                      sessionService: _sessionService,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showPinDialog(String pin) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.lock_outline, color: const Color(0xFFFB335B)),
            const SizedBox(width: 8),
            Text(tr('staff.table_pin_code')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Masa $_selectedTable için PIN:',
              style: const TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFFB335B).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFB335B).withValues(alpha: 0.3)),
              ),
              child: Text(
                pin,
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 12,
                  color: const Color(0xFFFB335B),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Bu kodu müşteriye verin.\nMüşteri bu kodla siparişlerini takip edebilir.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: pin));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(tr('common.pin_copied'))),
              );
            },
            child: Text(tr('common.copy')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFB335B),
            ),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _addToCart(ButcherProduct product) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_cart.containsKey(product.id)) {
        _cart[product.id]!.quantity += product.stepQuantity;
      } else {
        _cart[product.id] = _CartItem(
          product: product,
          quantity: product.minQuantity,
        );
      }
    });
  }

  void _removeFromCart(String productId) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_cart.containsKey(productId)) {
        final item = _cart[productId]!;
        item.quantity -= item.product.stepQuantity;
        if (item.quantity <= 0) {
          _cart.remove(productId);
        }
      }
    });
  }

  double get _cartTotal => _cart.values.fold(0, (sum, item) => sum + (item.product.price * item.quantity));
  int get _cartItemCount => _cart.values.fold(0, (sum, item) => sum + (item.quantity ~/ item.product.stepQuantity));

  Future<void> _submitOrder() async {
    if (_cart.isEmpty || _activeSession == null || _businessId == null) return;
    
    setState(() => _isLoading = true);
    
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      final waiterName = adminDoc.data()?['name'] ?? user.displayName ?? 'Garson';
      
      final items = _cart.values.map((ci) => OrderItem(
        sku: ci.product.sku,
        name: ci.product.name,
        price: ci.product.price,
        quantity: ci.quantity,
        unit: ci.product.unitType,
      )).toList();
      
      await _orderService.createDineInOrder(
        butcherId: _businessId!,
        butcherName: _businessName ?? '',
        waiterId: user.uid,
        waiterName: waiterName,
        tableNumber: _selectedTable!,
        tableSessionId: _activeSession!.id,
        items: items,
        totalAmount: _cartTotal,
        notes: _notes,
      );
      
      if (mounted) {
        setState(() {
          _cart.clear();
          _notes = null;
          _isLoading = false;
        });
        
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 8),
                Text('Masa $_selectedTable siparişi mutfağa gönderildi!'),
              ],
            ),
            backgroundColor: Colors.green.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('orders.order_send_failed')), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Force rebuild on language change
    context.locale;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    
    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        title: Text(
          _currentStep == _WaiterStep.selectTable
              ? 'Masa Seçin'
              : 'Masa $_selectedTable',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: scaffoldBg,
        surfaceTintColor: scaffoldBg,
        centerTitle: true,
        actions: [
          if (_activeSession != null)
            IconButton(
              icon: const Icon(Icons.receipt_long),
              tooltip: 'Masa Hesabı',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => _TableBillView(
                      session: _activeSession!,
                      businessId: _businessId!,
                      businessName: _businessName ?? '',
                      orderService: _orderService,
                      sessionService: _sessionService,
                    ),
                  ),
                );
              },
            ),
          if (_activeSession != null)
            IconButton(
              icon: const Icon(Icons.lock_outline),
              tooltip: 'PIN Göster',
              onPressed: () => _showPinDialog(_activeSession!.pin),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFFB335B)))
          : _businessId == null
              ? _buildNoBusinessView()
              : _currentStep == _WaiterStep.selectTable
                  ? _buildTableSelection()
                  : _buildMenuView(),
      bottomNavigationBar: _cart.isNotEmpty ? _buildCartBar() : null,
    );
  }

  Widget _buildNoBusinessView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.store, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'İşletme bulunamadı',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Sipariş almak için bir işletmeye atanmış olmanız gerekir.',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTableSelection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    const brandColor = Color(0xFFFB335B);
    
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Business name header
          Text(
            _businessName ?? 'İşletme',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Sipariş alacağınız masayı seçin',
            style: TextStyle(fontSize: 14, color: Colors.grey[500]),
          ),
          const SizedBox(height: 12),
          
          // Legend
          Row(
            children: [
              _legendDot(brandColor, 'Siparişli'),
              const SizedBox(width: 12),
              _legendDot(Colors.green, 'Ödendi'),
              const SizedBox(width: 12),
              _legendDot(Colors.amber, 'Rezerveli'),
              const SizedBox(width: 12),
              _legendDot(Colors.grey.shade300, 'Boş'),
            ],
          ),
          const SizedBox(height: 16),
          
          // Table grid with combined stream data
          Expanded(
            child: StreamBuilder<List<TableSession>>(
              stream: _businessId != null 
                  ? _sessionService.getActiveSessionsStream(_businessId!)
                  : const Stream.empty(),
              builder: (context, sessionSnapshot) {
                final activeSessions = sessionSnapshot.data ?? [];
                final activeTableNums = activeSessions.map((s) => s.tableNumber).toSet();
                
                // Also get today's reservations for this business
                return StreamBuilder<QuerySnapshot>(
                  stream: _businessId != null 
                      ? FirebaseFirestore.instance
                          .collection('businesses')
                          .doc(_businessId)
                          .collection('reservations')
                          .where('date', isEqualTo: _todayString())
                          .where('status', whereIn: ['confirmed', 'pending'])
                          .snapshots()
                      : const Stream<QuerySnapshot>.empty(),
                  builder: (context, reservationSnapshot) {
                    // Extract reserved table numbers
                    final reservedTableNums = <int>{};
                    if (reservationSnapshot.hasData) {
                      for (final doc in reservationSnapshot.data!.docs) {
                        final data = doc.data() as Map<String, dynamic>;
                        final tableNum = data['tableNumber'] as int?;
                        if (tableNum != null) {
                          reservedTableNums.add(tableNum);
                        }
                      }
                    }
                    
                    return GridView.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 1,
                      ),
                      itemCount: 20,
                      itemBuilder: (context, index) {
                        final tableNum = index + 1;
                        final hasOrders = activeTableNums.contains(tableNum);
                        final hasReservation = reservedTableNums.contains(tableNum);
                        // Find session for this table (if any)
                        final session = hasOrders
                            ? activeSessions.firstWhere((s) => s.tableNumber == tableNum)
                            : null;
                        
                        return _buildTableButton(
                          tableNum: tableNum,
                          cardBg: cardBg,
                          hasOrders: hasOrders,
                          hasReservation: hasReservation,
                          brandColor: brandColor,
                          session: session,
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12, height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }

  String _todayString() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  Widget _buildTableButton({
    required int tableNum,
    required Color cardBg,
    required bool hasOrders,
    required bool hasReservation,
    required Color brandColor,
    TableSession? session,
  }) {
    // Color logic: orders > reservation > empty
    Color bgColor;
    Color borderColor;
    Color textColor;
    Color iconColor;
    
    if (hasOrders) {
      bgColor = brandColor.withOpacity(0.1);
      borderColor = brandColor;
      textColor = brandColor;
      iconColor = brandColor;
    } else if (hasReservation) {
      bgColor = Colors.amber.shade50;
      borderColor = Colors.amber.shade400;
      textColor = Colors.amber.shade800;
      iconColor = Colors.amber.shade700;
    } else {
      bgColor = cardBg;
      borderColor = Colors.grey.withOpacity(0.2);
      textColor = Colors.grey.shade600;
      iconColor = Colors.grey.shade400;
    }
    
    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(16),
      elevation: hasOrders ? 2 : 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _selectTable(tableNum),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: borderColor,
              width: hasOrders ? 2 : 1,
            ),
          ),
          child: Stack(
            children: [
              // Reservation badge
              if (hasReservation)
                Positioned(
                  top: 4,
                  right: 4,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: Colors.amber,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Center(
                      child: Text(
                        'R',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ),
              // Payment status badge (for active tables)
              if (hasOrders && session != null)
                Positioned(
                  top: 4,
                  left: 4,
                  child: StreamBuilder<List<LokmaOrder>>(
                    stream: _orderService.getTableSessionOrdersStream(session.id),
                    builder: (context, orderSnap) {
                      final orders = orderSnap.data ?? [];
                      if (orders.isEmpty) return const SizedBox.shrink();
                      
                      final paidCount = orders.where((o) => o.paymentStatus == 'paid').length;
                      final allPaid = paidCount == orders.length;
                      final somePaid = paidCount > 0 && !allPaid;
                      
                      return Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          color: allPaid
                              ? Colors.green
                              : somePaid
                                  ? Colors.amber
                                  : Colors.red.shade400,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Center(
                          child: Icon(
                            allPaid
                                ? Icons.check
                                : somePaid
                                    ? Icons.more_horiz
                                    : Icons.euro,
                            size: 13,
                            color: Colors.white,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              // Table content
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.table_restaurant, size: 28, color: iconColor),
                    const SizedBox(height: 4),
                    Text(
                      '$tableNum',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: textColor,
                      ),
                    ),
                    if (hasOrders)
                      Text(
                        'Açık',
                        style: TextStyle(
                          fontSize: 10,
                          color: brandColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMenuView() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('businesses')
          .doc(_businessId)
          .collection('products')
          .where('isActive', isEqualTo: true)
          .snapshots(),
      builder: (context, snapshot) {
        List<ButcherProduct> products = [];
        if (snapshot.hasData) {
          products = snapshot.data!.docs.map((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final sku = data['masterProductId'] ?? data['masterProductSku'];
            final masterData = MASTER_PRODUCT_CATALOG[sku];
            
            final masterMap = masterData != null ? {
              'name': masterData.name,
              'description': masterData.description,
              'category': masterData.category,
              'unit': masterData.unitType,
              'imageAsset': masterData.imagePath,
              'tags': masterData.tags,
            } : null;
            
            return ButcherProduct.fromFirestore(data, doc.id, butcherId: _businessId!, masterData: masterMap);
          }).toList();
        }

        // Category extraction
        final categories = ['Tümü', ...{...products.map((p) => p.category)}];
        
        // Filter
        var filteredProducts = _selectedCategory == 'Tümü'
            ? products
            : products.where((p) => p.category == _selectedCategory).toList();
        
        if (_menuSearchQuery.isNotEmpty) {
          final query = _menuSearchQuery.toLowerCase();
          filteredProducts = filteredProducts.where((p) =>
              p.name.toLowerCase().contains(query) ||
              (p.description.toLowerCase().contains(query))).toList();
        }

        return Column(
          children: [
            // Search bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: TextField(
                onChanged: (v) => setState(() => _menuSearchQuery = v),
                decoration: InputDecoration(
                  hintText: 'Menüde ara...',
                  prefixIcon: const Icon(Icons.search),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
            
            // Category chips
            SizedBox(
              height: 40,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final cat = categories.elementAt(index);
                  final isSelected = cat == _selectedCategory;
                  return ChoiceChip(
                    label: Text(cat),
                    selected: isSelected,
                    selectedColor: Colors.amber.shade100,
                    onSelected: (_) => setState(() => _selectedCategory = cat),
                  );
                },
              ),
            ),
            
            const SizedBox(height: 8),
            
            // Product list
            Expanded(
              child: filteredProducts.isEmpty
                  ? Center(
                      child: Text(
                        snapshot.connectionState == ConnectionState.waiting
                            ? 'Menü yükleniyor...'
                            : 'Ürün bulunamadı',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                      itemCount: filteredProducts.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        return _buildProductCard(filteredProducts[index], isDark);
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildProductCard(ButcherProduct product, bool isDark) {
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final inCart = _cart.containsKey(product.id);
    final cartQty = _cart[product.id]?.quantity ?? 0;
    
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: inCart
            ? Border.all(color: Colors.amber.shade300, width: 1.5)
            : Border.all(color: Colors.grey.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          // Product image
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 60,
              height: 60,
              child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                  ? (product.imageUrl!.startsWith('assets/')
                      ? Image.asset(product.imageUrl!, fit: BoxFit.cover)
                      : CachedNetworkImage(
                          imageUrl: product.imageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(color: Colors.grey[200]),
                          errorWidget: (_, __, ___) => _productPlaceholder(),
                        ))
                  : _productPlaceholder(),
            ),
          ),
          const SizedBox(width: 12),
          
          // Product info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  I18nUtils.getLocalizedText(context, product.nameData),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '€${product.price.toStringAsFixed(2)} / ${product.unitType}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.amber.shade700,
                  ),
                ),
              ],
            ),
          ),
          
          // Quantity controls
          if (inCart)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _circleButton(Icons.remove, () => _removeFromCart(product.id)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    product.unitType == 'kg'
                        ? '${cartQty.toStringAsFixed(1)}'
                        : '${cartQty.toInt()}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
                _circleButton(Icons.add, () => _addToCart(product)),
              ],
            )
          else
            FilledButton.icon(
              onPressed: () => _addToCart(product),
              icon: const Icon(Icons.add, size: 18),
              label: Text(tr('common.add')),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.amber.shade700,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                minimumSize: Size.zero,
                textStyle: const TextStyle(fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }

  Widget _circleButton(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.amber.shade50,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 18, color: Colors.amber.shade700),
        ),
      ),
    );
  }

  Widget _productPlaceholder() {
    return Container(
      color: Colors.grey[200],
      child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28),
    );
  }

  Widget _buildCartBar() {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: _isLoading ? null : _submitOrder,
          style: FilledButton.styleFrom(
            backgroundColor: Colors.amber.shade700,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.send, size: 20),
              const SizedBox(width: 8),
              Text(
                'Mutfağa Gönder • $_cartItemCount ürün • €${_cartTotal.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Simple cart item model (private to this file)
class _CartItem {
  final ButcherProduct product;
  double quantity;
  
  _CartItem({required this.product, required this.quantity});
}

/// Step enum for waiter flow
enum _WaiterStep { selectTable, browseMenu }

/// ─────────────────────────────────────────────────────────────────────────────
/// Inline Table Bill View (Hesap Görüntüleme)
/// Shows all orders for the session with payment controls
/// ─────────────────────────────────────────────────────────────────────────────
class _TableBillView extends StatelessWidget {
  final TableSession session;
  final String businessId;
  final String businessName;
  final OrderService orderService;
  final TableSessionService sessionService;

  const _TableBillView({
    required this.session,
    required this.businessId,
    required this.businessName,
    required this.orderService,
    required this.sessionService,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        title: Text('Masa ${session.tableNumber} Hesabı'),
        backgroundColor: scaffoldBg,
        surfaceTintColor: scaffoldBg,
        centerTitle: true,
      ),
      body: StreamBuilder<List<LokmaOrder>>(
        stream: orderService.getTableSessionOrdersStream(session.id),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Colors.amber));
          }

          final orders = snapshot.data ?? [];
          
          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_long, size: 64, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text('Henüz sipariş yok', style: TextStyle(fontSize: 16, color: Colors.grey[500])),
                ],
              ),
            );
          }

          // Calculate totals
          double grandTotal = orders.fold(0, (sum, o) => sum + o.totalAmount);
          bool allPaid = orders.isNotEmpty && orders.every((o) => o.paymentStatus == 'paid');

          return Column(
            children: [
              // Session info header
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: allPaid ? Colors.green.shade50 : Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: allPaid ? Colors.green.shade200 : Colors.amber.shade100),
                ),
                child: Row(
                  children: [
                    Icon(
                      allPaid ? Icons.check_circle : Icons.table_restaurant,
                      color: allPaid ? Colors.green.shade700 : Colors.amber.shade700,
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Masa ${session.tableNumber} • ${session.waiterName}',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: allPaid ? Colors.green.shade900 : Colors.amber.shade900),
                          ),
                          Text(
                            allPaid
                                ? 'Tüm siparişler ödendi ✓'
                                : 'PIN: ${session.pin} • ${orders.length} sipariş',
                            style: TextStyle(fontSize: 12, color: allPaid ? Colors.green.shade600 : Colors.amber.shade600),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      children: [
                        Text(
                          '€${grandTotal.toStringAsFixed(2)}',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: allPaid ? Colors.green.shade800 : Colors.amber.shade800),
                        ),
                        Text(
                          allPaid ? 'Ödendi' : 'Toplam',
                          style: TextStyle(fontSize: 11, color: allPaid ? Colors.green.shade600 : Colors.amber.shade600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Orders list
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: orders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final order = orders[index];
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(width: 6),
                              // Payment status badge
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: order.paymentStatus == 'paid' 
                                      ? Colors.green.shade50 
                                      : Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      order.paymentStatus == 'paid' ? Icons.check_circle : Icons.warning_amber,
                                      size: 12,
                                      color: order.paymentStatus == 'paid' ? Colors.green.shade700 : Colors.red.shade700,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      order.paymentStatus == 'paid'
                                          ? (order.paymentMethod == 'card' ? 'Kart ✓' : order.paymentMethod == 'cash' ? 'Nakit ✓' : 'Online ✓')
                                          : 'Ödenmedi',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: order.paymentStatus == 'paid' ? Colors.green.shade700 : Colors.red.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Spacer(),
                              _statusChip(order.status),
                            ],
                          ),
                          const Divider(height: 16),
                          ...order.items.map((item) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${item.quantity.toStringAsFixed(item.unit == 'kg' ? 1 : 0)}x ${item.name}',
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                ),
                                Text(
                                  '€${(item.price * item.quantity).toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          )),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              '€${order.totalAmount.toStringAsFixed(2)}',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Colors.amber.shade700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Payment buttons
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _paymentButton(
                              context,
                              icon: Icons.money,
                              label: 'Nakit',
                              color: Colors.green.shade700,
                              onTap: () => _closeWithPayment(context, orders, 'cash'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _paymentButton(
                              context,
                              icon: Icons.credit_card,
                              label: 'Kart',
                              color: Colors.blue.shade700,
                              onTap: () => _closeWithPayment(context, orders, 'card'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.phone_android),
                          label: Text(tr('payments.customer_pays_online')),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.amber.shade700,
                            side: BorderSide(color: Colors.amber.shade300),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(tr('payments.customer_will_pay_own_phone')),
                                backgroundColor: Colors.amber.shade700,
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _paymentButton(BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return FilledButton.icon(
      onPressed: onTap,
      icon: Icon(icon),
      label: Text(label),
      style: FilledButton.styleFrom(
        backgroundColor: color,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }

  void _closeWithPayment(BuildContext context, List<LokmaOrder> orders, String method) async {
    // Mark all orders as paid
    for (final order in orders) {
      await orderService.updatePaymentStatus(
        orderId: order.id,
        paymentStatus: 'paid',
        paymentMethod: method,
      );
    }
    
    // Close session
    await sessionService.closeSession(session.id, businessId);
    
    if (context.mounted) {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white),
              const SizedBox(width: 8),
              Text('Masa ${session.tableNumber} hesabı kapatıldı!'),
            ],
          ),
          backgroundColor: Colors.green.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      Navigator.pop(context);
    }
  }

  Widget _statusChip(OrderStatus status) {
    Color color;
    String label;
    switch (status) {
      case OrderStatus.pending:
        color = Colors.amber;
        label = 'Beklemede';
      case OrderStatus.accepted:
        color = Colors.blue;
        label = 'Onaylandı';
      case OrderStatus.preparing:
        color = Colors.amber;
        label = 'Hazırlanıyor';
      case OrderStatus.ready:
        color = Colors.green;
        label = 'Hazır';
      case OrderStatus.delivered:
        color = Colors.teal;
        label = 'Teslim';
      case OrderStatus.cancelled:
        color = Colors.red;
        label = 'İptal';
      default:
        color = Colors.grey;
        label = status.name;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
