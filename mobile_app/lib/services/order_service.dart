import 'package:cloud_firestore/cloud_firestore.dart';
import '../providers/cart_provider.dart';

/// Order status enum
enum OrderStatus {
  pending,    // Beklemede
  accepted,   // Onaylandı
  preparing,  // Hazırlanıyor
  ready,      // Hazır
  onTheWay,   // Yolda (for delivery)
  delivered,  // Teslim edildi
  cancelled,  // İptal
}

/// Order type enum
enum OrderType {
  delivery,   // Teslimat
  pickup,     // Gel Al
  dineIn,     // Masa (Yerinde)
}

/// Order model for LOKMA
class LokmaOrder {
  final String id;
  final String butcherId;
  final String butcherName;
  final String userId;
  final String userName;
  final String userPhone;
  final List<OrderItem> items;
  final double totalAmount;
  final OrderType orderType;
  final OrderStatus status;
  final String? deliveryAddress;
  final DateTime? scheduledTime;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  LokmaOrder({
    required this.id,
    required this.butcherId,
    required this.butcherName,
    required this.userId,
    required this.userName,
    required this.userPhone,
    required this.items,
    required this.totalAmount,
    required this.orderType,
    required this.status,
    this.deliveryAddress,
    this.scheduledTime,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory LokmaOrder.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return LokmaOrder(
      id: doc.id,
      butcherId: data['butcherId'] ?? '',
      butcherName: data['butcherName'] ?? '',
      userId: data['userId'] ?? '',
      userName: data['userName'] ?? '',
      userPhone: data['userPhone'] ?? '',
      items: (data['items'] as List<dynamic>?)
          ?.map((i) => OrderItem.fromMap(i))
          .toList() ?? [],
      totalAmount: (data['totalAmount'] ?? 0).toDouble(),
      orderType: OrderType.values.firstWhere(
        (e) => e.name == data['orderType'],
        orElse: () => OrderType.pickup,
      ),
      status: OrderStatus.values.firstWhere(
        (e) => e.name == data['status'],
        orElse: () => OrderStatus.pending,
      ),
      deliveryAddress: data['deliveryAddress'],
      scheduledTime: (data['scheduledTime'] as Timestamp?)?.toDate(),
      notes: data['notes'],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}

class OrderItem {
  final String sku;
  final String name;
  final double price;
  final double quantity;
  final String unit;

  OrderItem({
    required this.sku,
    required this.name,
    required this.price,
    required this.quantity,
    required this.unit,
  });

  Map<String, dynamic> toMap() => {
    'sku': sku,
    'name': name,
    'price': price,
    'quantity': quantity,
    'unit': unit,
  };

  factory OrderItem.fromMap(Map<String, dynamic> map) => OrderItem(
    sku: map['sku'] ?? '',
    name: map['name'] ?? '',
    price: (map['price'] ?? 0).toDouble(),
    quantity: (map['quantity'] ?? 0).toDouble(),
    unit: map['unit'] ?? 'kg',
  );

  factory OrderItem.fromCartItem(CartItem cartItem) => OrderItem(
    sku: cartItem.product.sku,
    name: cartItem.product.name,
    price: cartItem.product.price,
    quantity: cartItem.quantity,
    unit: cartItem.product.unitType,
  );
}

/// Order Service for LOKMA
class OrderService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  static const String _collection = 'lokma_orders';

  /// Create a new order from cart
  Future<String> createOrder({
    required String butcherId,
    required String butcherName,
    required String userId,
    required String userName,
    required String userPhone,
    required List<CartItem> cartItems,
    required double totalAmount,
    required OrderType orderType,
    String? deliveryAddress,
    DateTime? scheduledTime,
    String? notes,
  }) async {
    final orderItems = cartItems.map((item) => OrderItem.fromCartItem(item).toMap()).toList();

    final docRef = await _db.collection(_collection).add({
      'butcherId': butcherId,
      'butcherName': butcherName,
      'userId': userId,
      'userName': userName,
      'userPhone': userPhone,
      'items': orderItems,
      'totalAmount': totalAmount,
      'orderType': orderType.name,
      'status': OrderStatus.pending.name,
      'deliveryAddress': deliveryAddress,
      'scheduledTime': scheduledTime != null ? Timestamp.fromDate(scheduledTime) : null,
      'notes': notes,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    return docRef.id;
  }

  /// Get user's orders stream (from both collections)
  Stream<List<LokmaOrder>> getUserOrdersStream(String userId) {
    // Stream from lokma_orders
    final lokmaStream = _db
        .collection(_collection)
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => LokmaOrder.fromFirestore(doc))
            .toList());
    
    // Stream from meat_orders (legacy cart collection)
    final meatStream = _db
        .collection('meat_orders')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => LokmaOrder.fromFirestore(doc))
            .toList());
    
    // Combine both streams
    return lokmaStream.asyncExpand((lokmaOrders) {
      return meatStream.map((meatOrders) {
        final allOrders = [...lokmaOrders, ...meatOrders];
        // Sort by createdAt descending
        allOrders.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        return allOrders;
      });
    });
  }

  /// Get single order
  Future<LokmaOrder?> getOrder(String orderId) async {
    final doc = await _db.collection(_collection).doc(orderId).get();
    if (!doc.exists) return null;
    return LokmaOrder.fromFirestore(doc);
  }

  /// Cancel order (user can only cancel pending orders)
  Future<bool> cancelOrder(String orderId) async {
    final doc = await _db.collection(_collection).doc(orderId).get();
    if (!doc.exists) return false;
    
    final data = doc.data() as Map<String, dynamic>;
    if (data['status'] != OrderStatus.pending.name) {
      return false; // Can only cancel pending orders
    }

    await _db.collection(_collection).doc(orderId).update({
      'status': OrderStatus.cancelled.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return true;
  }
}
