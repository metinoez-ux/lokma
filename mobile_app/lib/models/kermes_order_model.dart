import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';

/// Kermes sipariş durumu
enum KermesOrderStatus {
  pending,      // Beklemede
  preparing,    // Hazırlanıyor
  ready,        // Hazır
  delivered,    // Teslim Edildi
  cancelled,    // İptal
}

/// Kermes sipariş öğesi
class KermesOrderItem {
  final String name;
  final int quantity;
  final double price;

  KermesOrderItem({
    required this.name,
    required this.quantity,
    required this.price,
  });

  double get totalPrice => price * quantity;

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'quantity': quantity,
      'price': price,
    };
  }

  factory KermesOrderItem.fromMap(Map<String, dynamic> map) {
    return KermesOrderItem(
      name: map['name'] ?? '',
      quantity: map['quantity'] ?? 0,
      price: (map['price'] ?? 0).toDouble(),
    );
  }
}

/// Kermes siparişi ana modeli
class KermesOrder {
  final String id;              // Firestore doc ID (kermesId_orderNumber)
  final String orderNumber;     // Kullanıcıya gösterilen numara (11001)
  final String kermesId;
  final String kermesName;
  final String? userId;  // Anonim siparişlerde null olabilir
  final String customerName;
  final String customerPhone;
  final DeliveryType deliveryType;
  final String? tableNumber;
  final String? address;
  final List<KermesOrderItem> items;
  final double totalAmount;
  final PaymentMethodType paymentMethod;
  final bool isPaid;
  final KermesOrderStatus status;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? notes;

  KermesOrder({
    required this.id,
    required this.orderNumber,
    required this.kermesId,
    required this.kermesName,
    this.userId,
    required this.customerName,
    required this.customerPhone,
    required this.deliveryType,
    this.tableNumber,
    this.address,
    required this.items,
    required this.totalAmount,
    required this.paymentMethod,
    required this.isPaid,
    required this.status,
    required this.createdAt,
    this.completedAt,
    this.notes,
  });

  /// Firestore'a kaydetmek için Map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'orderNumber': orderNumber,
      'kermesId': kermesId,
      'kermesName': kermesName,
      'userId': userId,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'deliveryType': deliveryType.name,
      'tableNumber': tableNumber,
      'address': address,
      'items': items.map((item) => item.toMap()).toList(),
      'totalAmount': totalAmount,
      'paymentMethod': paymentMethod.name,
      'isPaid': isPaid,
      'status': status.name,
      'createdAt': Timestamp.fromDate(createdAt),
      'completedAt': completedAt != null ? Timestamp.fromDate(completedAt!) : null,
      'notes': notes,
    };
  }

  /// Firestore'dan oluştur
  factory KermesOrder.fromMap(Map<String, dynamic> map) {
    return KermesOrder(
      id: map['id'] ?? '',
      orderNumber: map['orderNumber'] ?? map['id'] ?? '',  // Fallback eski siparişler için
      kermesId: map['kermesId'] ?? '',
      kermesName: map['kermesName'] ?? '',
      userId: map['userId'],
      customerName: map['customerName'] ?? '',
      customerPhone: map['customerPhone'] ?? '',
      deliveryType: DeliveryType.values.firstWhere(
        (e) => e.name == map['deliveryType'],
        orElse: () => DeliveryType.gelAl,
      ),
      tableNumber: map['tableNumber'],
      address: map['address'],
      items: (map['items'] as List<dynamic>?)
              ?.map((item) => KermesOrderItem.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
      totalAmount: (map['totalAmount'] ?? 0).toDouble(),
      paymentMethod: PaymentMethodType.values.firstWhere(
        (e) => e.name == map['paymentMethod'],
        orElse: () => PaymentMethodType.cash,
      ),
      isPaid: map['isPaid'] ?? false,
      status: KermesOrderStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => KermesOrderStatus.pending,
      ),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      completedAt: (map['completedAt'] as Timestamp?)?.toDate(),
      notes: map['notes'],
    );
  }

  /// Firestore document'ından oluştur
  factory KermesOrder.fromDocument(DocumentSnapshot doc) {
    return KermesOrder.fromMap(doc.data() as Map<String, dynamic>);
  }

  /// Teslimat türü Türkçe label
  String get deliveryTypeLabel {
    switch (deliveryType) {
      case DeliveryType.gelAl:
        return 'Gel Al';
      case DeliveryType.masada:
        return 'Masa $tableNumber';
      case DeliveryType.kurye:
        return 'Kurye';
    }
  }

  /// Ödeme yöntemi Türkçe label
  String get paymentMethodLabel {
    switch (paymentMethod) {
      case PaymentMethodType.cash:
        return 'Nakit';
      case PaymentMethodType.card:
        return 'Kredi Kartı';
    }
  }

  /// Sipariş durumu Türkçe label
  String get statusLabel {
    switch (status) {
      case KermesOrderStatus.pending:
        return 'Beklemede';
      case KermesOrderStatus.preparing:
        return 'Hazırlanıyor';
      case KermesOrderStatus.ready:
        return 'Hazır';
      case KermesOrderStatus.delivered:
        return 'Teslim Edildi';
      case KermesOrderStatus.cancelled:
        return 'İptal';
    }
  }
}
