import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';

/// Kermes siparis durumu
enum KermesOrderStatus {
  pending,      // Beklemede
  preparing,    // Hazirlaniyor
  ready,        // Hazir
  onTheWay,     // Yolda
  delivered,    // Teslim Edildi
  cancelled,    // Iptal
}

/// Item-bazli statu (KDS/Mutfak icin)
enum KermesItemStatus {
  pending,      // Beklemede - mutfaga henuz dusmedi veya islem baslamamis
  preparing,    // Hazirlaniyor - mutfak isleme aldi
  ready,        // Hazir - mutfak tamamladi
}

/// Kermes siparis ogesi (item-bazli statu destekli)
class KermesOrderItem {
  final String name;
  final int quantity;
  final double price;
  final String? productId;         // Firestore urun referansi
  final String? prepZone;          // Urunun hazirlik alani (Kadinlar Standi, Erkekler Standi vb.)
  final KermesItemStatus itemStatus; // Item-bazli statu: pending / preparing / ready
  final DateTime? readyAt;         // Hazir oldugu zaman
  final String? readyByZone;       // Hangi zone "hazir" dedi
  final String? category;          // Urun kategorisi (Ana Yemek, Icecek vb.)
  final String? imageUrl;          // Urun resmi (POS ekraninda gosterim icin)

  KermesOrderItem({
    required this.name,
    required this.quantity,
    required this.price,
    this.productId,
    this.prepZone,
    this.itemStatus = KermesItemStatus.pending,
    this.readyAt,
    this.readyByZone,
    this.category,
    this.imageUrl,
  });

  double get totalPrice => price * quantity;

  /// Item hazir mi?
  bool get isReady => itemStatus == KermesItemStatus.ready;

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'quantity': quantity,
      'price': price,
      if (productId != null) 'productId': productId,
      if (prepZone != null) 'prepZone': prepZone,
      'itemStatus': itemStatus.name,
      if (readyAt != null) 'readyAt': Timestamp.fromDate(readyAt!),
      if (readyByZone != null) 'readyByZone': readyByZone,
      if (category != null) 'category': category,
      if (imageUrl != null) 'imageUrl': imageUrl,
    };
  }

  factory KermesOrderItem.fromMap(Map<String, dynamic> map) {
    return KermesOrderItem(
      name: map['name'] ?? '',
      quantity: map['quantity'] ?? 0,
      price: (map['price'] ?? 0).toDouble(),
      productId: map['productId'] as String?,
      prepZone: map['prepZone'] as String?,
      itemStatus: KermesItemStatus.values.firstWhere(
        (e) => e.name == map['itemStatus'],
        orElse: () => KermesItemStatus.pending,
      ),
      readyAt: (map['readyAt'] as Timestamp?)?.toDate(),
      readyByZone: map['readyByZone'] as String?,
      category: map['category'] as String?,
      imageUrl: map['imageUrl'] as String?,
    );
  }

  /// Kopyalama (statu guncelleme icin)
  KermesOrderItem copyWith({
    String? name,
    int? quantity,
    double? price,
    String? productId,
    String? prepZone,
    KermesItemStatus? itemStatus,
    DateTime? readyAt,
    String? readyByZone,
    String? category,
    String? imageUrl,
  }) {
    return KermesOrderItem(
      name: name ?? this.name,
      quantity: quantity ?? this.quantity,
      price: price ?? this.price,
      productId: productId ?? this.productId,
      prepZone: prepZone ?? this.prepZone,
      itemStatus: itemStatus ?? this.itemStatus,
      readyAt: readyAt ?? this.readyAt,
      readyByZone: readyByZone ?? this.readyByZone,
      category: category ?? this.category,
      imageUrl: imageUrl ?? this.imageUrl,
    );
  }
}

/// Kermes siparisi ana modeli
class KermesOrder {
  final String id;              // Firestore doc ID (kermesId_orderNumber)
  final String orderNumber;     // Kullaniciya gosterilen numara (11001)
  final String kermesId;
  final String kermesName;
  final String? userId;  // Anonim siparislerde null olabilir
  final String customerName;
  final String customerPhone;
  final DeliveryType deliveryType;
  final String? tableNumber;
  final String? address;
  final List<KermesOrderItem> items;
  final double totalAmount;
  final double donationAmount; // Bagis/yuvarlama tutari
  final PaymentMethodType paymentMethod;
  final bool isPaid;
  final KermesOrderStatus status;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? notes;
  final String? courierId;
  // POS/KDS ek alanlari
  final String? createdByStaffId;   // Siparisi alan garson/kasiyer
  final String? createdByStaffName; // Garson adi
  final String? tableSection;      // Masanin ait oldugu bolum (Kadin Bolumu, Erkek Bolumu vb.)

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
    this.donationAmount = 0.0,
    required this.paymentMethod,
    required this.isPaid,
    required this.status,
    required this.createdAt,
    this.completedAt,
    this.notes,
    this.courierId,
    this.createdByStaffId,
    this.createdByStaffName,
    this.tableSection,
  });

  /// Siparisin tum itemlari hazir mi?
  bool get isFullyReady => items.every((item) => item.isReady);

  /// Hazir olan item sayisi
  int get readyItemCount => items.where((item) => item.isReady).length;

  /// Toplam item sayisi
  int get totalItemCount => items.length;

  /// Ilerleme yuzdesi (0.0 - 1.0)
  double get readyProgress => totalItemCount > 0 ? readyItemCount / totalItemCount : 0.0;

  /// Bu sipariste belirli bir zone'a ait itemlar
  List<KermesOrderItem> itemsForZone(String zone) {
    return items.where((item) => item.prepZone == zone).toList();
  }

  /// Bu siparisteki tum zone'lar
  Set<String> get allZones {
    return items.map((item) => item.prepZone).whereType<String>().toSet();
  }

  /// Firestore'a kaydetmek icin Map
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
      'donationAmount': donationAmount,
      'paymentMethod': paymentMethod.name,
      'isPaid': isPaid,
      'status': status.name,
      'createdAt': Timestamp.fromDate(createdAt),
      'completedAt': completedAt != null ? Timestamp.fromDate(completedAt!) : null,
      'notes': notes,
      'courierId': courierId,
      if (createdByStaffId != null) 'createdByStaffId': createdByStaffId,
      if (createdByStaffName != null) 'createdByStaffName': createdByStaffName,
      if (tableSection != null) 'tableSection': tableSection,
    };
  }

  /// Firestore'dan olustur
  factory KermesOrder.fromMap(Map<String, dynamic> map) {
    return KermesOrder(
      id: map['id'] ?? '',
      orderNumber: map['orderNumber'] ?? map['id'] ?? '',  // Fallback eski siparisler icin
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
      donationAmount: (map['donationAmount'] ?? 0).toDouble(),
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
      courierId: map['courierId'],
      createdByStaffId: map['createdByStaffId'] as String?,
      createdByStaffName: map['createdByStaffName'] as String?,
      tableSection: map['tableSection'] as String?,
    );
  }

  /// Firestore document'indan olustur
  factory KermesOrder.fromDocument(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    data['id'] = doc.id;
    return KermesOrder.fromMap(data);
  }

  /// Teslimat turu Turkce label
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

  /// Odeme yontemi Turkce label
  String get paymentMethodLabel {
    switch (paymentMethod) {
      case PaymentMethodType.cash:
        return 'Nakit';
      case PaymentMethodType.card:
        return 'Kredi Karti';
      case PaymentMethodType.tapToPay:
        return 'Kapida Kart';
    }
  }

  /// Siparis durumu Turkce label
  String get statusLabel {
    switch (status) {
      case KermesOrderStatus.pending:
        return 'Beklemede';
      case KermesOrderStatus.preparing:
        return 'Hazirlaniyor';
      case KermesOrderStatus.ready:
        return 'Hazir';
      case KermesOrderStatus.onTheWay:
        return 'Yolda';
      case KermesOrderStatus.delivered:
        return 'Teslim Edildi';
      case KermesOrderStatus.cancelled:
        return 'Iptal';
    }
  }

  /// Kopyalama methodu
  KermesOrder copyWith({
    String? id,
    String? orderNumber,
    String? kermesId,
    String? kermesName,
    String? userId,
    String? customerName,
    String? customerPhone,
    DeliveryType? deliveryType,
    String? tableNumber,
    String? address,
    List<KermesOrderItem>? items,
    double? totalAmount,
    double? donationAmount,
    PaymentMethodType? paymentMethod,
    bool? isPaid,
    KermesOrderStatus? status,
    DateTime? createdAt,
    DateTime? completedAt,
    String? notes,
    String? courierId,
    String? createdByStaffId,
    String? createdByStaffName,
    String? tableSection,
  }) {
    return KermesOrder(
      id: id ?? this.id,
      orderNumber: orderNumber ?? this.orderNumber,
      kermesId: kermesId ?? this.kermesId,
      kermesName: kermesName ?? this.kermesName,
      userId: userId ?? this.userId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      deliveryType: deliveryType ?? this.deliveryType,
      tableNumber: tableNumber ?? this.tableNumber,
      address: address ?? this.address,
      items: items ?? this.items,
      totalAmount: totalAmount ?? this.totalAmount,
      donationAmount: donationAmount ?? this.donationAmount,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      isPaid: isPaid ?? this.isPaid,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      completedAt: completedAt ?? this.completedAt,
      notes: notes ?? this.notes,
      courierId: courierId ?? this.courierId,
      createdByStaffId: createdByStaffId ?? this.createdByStaffId,
      createdByStaffName: createdByStaffName ?? this.createdByStaffName,
      tableSection: tableSection ?? this.tableSection,
    );
  }
}
