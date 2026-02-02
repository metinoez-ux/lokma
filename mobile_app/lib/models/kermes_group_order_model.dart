import 'package:cloud_firestore/cloud_firestore.dart';
import 'kermes_model.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';

/// Grup siparişi durumu
enum GroupOrderStatus {
  collecting,      // Katılımcılar ürün ekliyor
  readyToOrder,    // Tüm katılımcılar onayladı, host ödeme bekliyor
  ordered,         // Sipariş verildi
  completed,       // Teslim edildi
  cancelled,       // İptal edildi
}

/// Teslimat türü - delivery_type_dialog.dart'tan import edilir
// Artık burada tanımlanmıyor, tek kaynak olarak delivery_type_dialog.dart kullanılıyor

/// Ödeme yöntemi
enum PaymentMethod {
  cash,    // Nakit
  stripe,  // Kredi Kartı
}

/// Grup siparişindeki bir katılımcının ürünü
class GroupOrderItem {
  final String menuItemName;
  final int quantity;
  final double price;

  GroupOrderItem({
    required this.menuItemName,
    required this.quantity,
    required this.price,
  });

  double get totalPrice => price * quantity;

  Map<String, dynamic> toMap() {
    return {
      'menuItemName': menuItemName,
      'quantity': quantity,
      'price': price,
    };
  }

  factory GroupOrderItem.fromMap(Map<String, dynamic> map) {
    return GroupOrderItem(
      menuItemName: map['menuItemName'] ?? '',
      quantity: map['quantity'] ?? 0,
      price: (map['price'] ?? 0).toDouble(),
    );
  }
}

/// Grup siparişindeki bir katılımcı
class GroupOrderParticipant {
  final String oderId; // Tekil tanımlayıcı
  final String userId; // Kullanıcı ID (veya anonim için boş)
  final String name;
  final bool isHost;
  final bool isReady; // "Siparişim Tamam" durumu
  final List<GroupOrderItem> items;

  GroupOrderParticipant({
    required this.oderId,
    required this.userId,
    required this.name,
    required this.isHost,
    required this.isReady,
    required this.items,
  });

  double get totalAmount => items.fold(0.0, (sum, item) => sum + item.totalPrice);
  int get totalItems => items.fold(0, (sum, item) => sum + item.quantity);

  Map<String, dynamic> toMap() {
    return {
      'oderId': oderId,
      'userId': userId,
      'name': name,
      'isHost': isHost,
      'isReady': isReady,
      'items': items.map((item) => item.toMap()).toList(),
    };
  }

  factory GroupOrderParticipant.fromMap(Map<String, dynamic> map) {
    return GroupOrderParticipant(
      oderId: map['oderId'] ?? '',
      userId: map['userId'] ?? '',
      name: map['name'] ?? '',
      isHost: map['isHost'] ?? false,
      isReady: map['isReady'] ?? false,
      items: (map['items'] as List<dynamic>?)
              ?.map((item) => GroupOrderItem.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  GroupOrderParticipant copyWith({
    String? oderId,
    String? userId,
    String? name,
    bool? isHost,
    bool? isReady,
    List<GroupOrderItem>? items,
  }) {
    return GroupOrderParticipant(
      oderId: oderId ?? this.oderId,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      isHost: isHost ?? this.isHost,
      isReady: isReady ?? this.isReady,
      items: items ?? this.items,
    );
  }
}

/// Teslimat bilgileri
class GroupOrderDelivery {
  final DeliveryType type;
  final String? tableNumber;  // Masaya sipariş için
  final String? address;      // Kurye için
  final String phone;
  final String contactName;

  GroupOrderDelivery({
    required this.type,
    this.tableNumber,
    this.address,
    required this.phone,
    required this.contactName,
  });

  Map<String, dynamic> toMap() {
    return {
      'type': type.name,
      'tableNumber': tableNumber,
      'address': address,
      'phone': phone,
      'contactName': contactName,
    };
  }

  factory GroupOrderDelivery.fromMap(Map<String, dynamic> map) {
    return GroupOrderDelivery(
      type: DeliveryType.values.firstWhere(
        (e) => e.name == map['type'],
        orElse: () => DeliveryType.gelAl,
      ),
      tableNumber: map['tableNumber'],
      address: map['address'],
      phone: map['phone'] ?? '',
      contactName: map['contactName'] ?? '',
    );
  }
}

/// Grup siparişi ana modeli
class KermesGroupOrder {
  final String id;
  final String kermesId;
  final String kermesName;
  final String hostUserId;
  final String hostName;
  final GroupOrderStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt; // Geçerlilik süresi (varsayılan: 60 dakika)
  final List<GroupOrderParticipant> participants;
  final GroupOrderDelivery? delivery;
  final PaymentMethod? paymentMethod;

  KermesGroupOrder({
    required this.id,
    required this.kermesId,
    required this.kermesName,
    required this.hostUserId,
    required this.hostName,
    required this.status,
    required this.createdAt,
    this.expiresAt,
    required this.participants,
    this.delivery,
    this.paymentMethod,
  });

  /// Toplam tutar
  double get totalAmount => participants.fold(0.0, (sum, p) => sum + p.totalAmount);

  /// Toplam ürün sayısı
  int get totalItems => participants.fold(0, (sum, p) => sum + p.totalItems);

  /// Tüm katılımcılar hazır mı?
  bool get allParticipantsReady => participants.every((p) => p.isReady);

  /// Katılımcı sayısı
  int get participantCount => participants.length;

  /// Paylaşım linki
  String get shareLink => 'https://lokma.shop/group/$id';

  /// Firestore'a kaydetmek için Map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'kermesId': kermesId,
      'kermesName': kermesName,
      'hostUserId': hostUserId,
      'hostName': hostName,
      'status': status.name,
      'createdAt': Timestamp.fromDate(createdAt),
      'expiresAt': expiresAt != null ? Timestamp.fromDate(expiresAt!) : null,
      'participants': participants.map((p) => p.toMap()).toList(),
      'delivery': delivery?.toMap(),
      'paymentMethod': paymentMethod?.name,
    };
  }

  /// Firestore'dan oluştur
  factory KermesGroupOrder.fromMap(Map<String, dynamic> map) {
    return KermesGroupOrder(
      id: map['id'] ?? '',
      kermesId: map['kermesId'] ?? '',
      kermesName: map['kermesName'] ?? '',
      hostUserId: map['hostUserId'] ?? '',
      hostName: map['hostName'] ?? '',
      status: GroupOrderStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => GroupOrderStatus.collecting,
      ),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      expiresAt: (map['expiresAt'] as Timestamp?)?.toDate(),
      participants: (map['participants'] as List<dynamic>?)
              ?.map((p) => GroupOrderParticipant.fromMap(p as Map<String, dynamic>))
              .toList() ??
          [],
      delivery: map['delivery'] != null
          ? GroupOrderDelivery.fromMap(map['delivery'] as Map<String, dynamic>)
          : null,
      paymentMethod: map['paymentMethod'] != null
          ? PaymentMethod.values.firstWhere(
              (e) => e.name == map['paymentMethod'],
              orElse: () => PaymentMethod.cash,
            )
          : null,
    );
  }

  /// Firestore document'ından oluştur
  factory KermesGroupOrder.fromDocument(DocumentSnapshot doc) {
    return KermesGroupOrder.fromMap(doc.data() as Map<String, dynamic>);
  }

  /// Kopyala ve değiştir
  KermesGroupOrder copyWith({
    String? id,
    String? kermesId,
    String? kermesName,
    String? hostUserId,
    String? hostName,
    GroupOrderStatus? status,
    DateTime? createdAt,
    DateTime? expiresAt,
    List<GroupOrderParticipant>? participants,
    GroupOrderDelivery? delivery,
    PaymentMethod? paymentMethod,
  }) {
    return KermesGroupOrder(
      id: id ?? this.id,
      kermesId: kermesId ?? this.kermesId,
      kermesName: kermesName ?? this.kermesName,
      hostUserId: hostUserId ?? this.hostUserId,
      hostName: hostName ?? this.hostName,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      participants: participants ?? this.participants,
      delivery: delivery ?? this.delivery,
      paymentMethod: paymentMethod ?? this.paymentMethod,
    );
  }
}
