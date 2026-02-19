import 'package:cloud_firestore/cloud_firestore.dart';

/// Grup oturum durumu
enum GroupSessionStatus {
  active,     // Katılımcılar ürün ekliyor
  ordering,   // Sipariş gönderildi, mutfakta
  paying,     // Ödeme aşamasında
  closed,     // Oturum kapandı
  cancelled,  // Host tarafından iptal edildi
}

/// Grup masasındaki bir ürün
class TableGroupItem {
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final double totalPrice;
  final String? imageUrl;
  final String? itemNote;
  final List<Map<String, dynamic>> selectedOptions;

  TableGroupItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
    this.imageUrl,
    this.itemNote,
    this.selectedOptions = const [],
  });

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'productName': productName,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'totalPrice': totalPrice,
      'imageUrl': imageUrl,
      'itemNote': itemNote,
      if (selectedOptions.isNotEmpty) 'selectedOptions': selectedOptions,
    };
  }

  factory TableGroupItem.fromMap(Map<String, dynamic> map) {
    return TableGroupItem(
      productId: map['productId'] ?? '',
      productName: map['productName'] ?? '',
      quantity: map['quantity'] ?? 1,
      unitPrice: (map['unitPrice'] ?? 0).toDouble(),
      totalPrice: (map['totalPrice'] ?? 0).toDouble(),
      imageUrl: map['imageUrl'],
      itemNote: map['itemNote'],
      selectedOptions: (map['selectedOptions'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [],
    );
  }

  TableGroupItem copyWith({int? quantity, double? totalPrice, String? itemNote}) {
    return TableGroupItem(
      productId: productId,
      productName: productName,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice ?? this.totalPrice,
      imageUrl: imageUrl,
      itemNote: itemNote ?? this.itemNote,
      selectedOptions: selectedOptions,
    );
  }
}

/// Grup masasındaki bir katılımcı
class TableGroupParticipant {
  final String participantId; // UUID
  final String userId;        // Firebase UID
  final String name;
  final bool isHost;
  final bool isReady;         // Siparişim hazır
  final List<TableGroupItem> items;
  final double subtotal;
  final String paymentStatus; // 'pending' | 'paid'
  final String? paymentMethod; // 'cash' | 'card'
  final DateTime? paidAt;

  TableGroupParticipant({
    required this.participantId,
    required this.userId,
    required this.name,
    required this.isHost,
    this.isReady = false,
    this.items = const [],
    this.subtotal = 0,
    this.paymentStatus = 'pending',
    this.paymentMethod,
    this.paidAt,
  });

  bool get isPaid => paymentStatus == 'paid';
  int get totalItemCount => items.fold(0, (sum, item) => sum + item.quantity);

  Map<String, dynamic> toMap() {
    return {
      'participantId': participantId,
      'userId': userId,
      'name': name,
      'isHost': isHost,
      'isReady': isReady,
      'items': items.map((item) => item.toMap()).toList(),
      'subtotal': subtotal,
      'paymentStatus': paymentStatus,
      'paymentMethod': paymentMethod,
      'paidAt': paidAt != null ? Timestamp.fromDate(paidAt!) : null,
    };
  }

  factory TableGroupParticipant.fromMap(Map<String, dynamic> map) {
    return TableGroupParticipant(
      participantId: map['participantId'] ?? '',
      userId: map['userId'] ?? '',
      name: map['name'] ?? '',
      isHost: map['isHost'] ?? false,
      isReady: map['isReady'] ?? false,
      items: (map['items'] as List<dynamic>?)
              ?.map((e) => TableGroupItem.fromMap(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          [],
      subtotal: (map['subtotal'] ?? 0).toDouble(),
      paymentStatus: map['paymentStatus'] ?? 'pending',
      paymentMethod: map['paymentMethod'],
      paidAt: (map['paidAt'] as Timestamp?)?.toDate(),
    );
  }

  TableGroupParticipant copyWith({
    List<TableGroupItem>? items,
    double? subtotal,
    bool? isReady,
    String? paymentStatus,
    String? paymentMethod,
    DateTime? paidAt,
  }) {
    return TableGroupParticipant(
      participantId: participantId,
      userId: userId,
      name: name,
      isHost: isHost,
      isReady: isReady ?? this.isReady,
      items: items ?? this.items,
      subtotal: subtotal ?? this.subtotal,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paidAt: paidAt ?? this.paidAt,
    );
  }
}

/// Masa Grup Oturumu ana modeli
class TableGroupSession {
  final String id;
  final String businessId;
  final String businessName;
  final String tableNumber;
  final GroupSessionStatus status;
  final String hostUserId;
  final String hostName;
  final String? groupPin; // 4-digit PIN for joining
  final List<TableGroupParticipant> participants;
  final double grandTotal;
  final double paidTotal;
  final String? paymentType; // 'individual' | 'single'
  final String? paidByUserId;
  final DateTime createdAt;
  final DateTime? closedAt;

  TableGroupSession({
    required this.id,
    required this.businessId,
    required this.businessName,
    required this.tableNumber,
    required this.status,
    required this.hostUserId,
    required this.hostName,
    this.groupPin,
    this.participants = const [],
    this.grandTotal = 0,
    this.paidTotal = 0,
    this.paymentType,
    this.paidByUserId,
    required this.createdAt,
    this.closedAt,
  });

  /// Kalan hesap tutarı
  double get remainingBalance => grandTotal - paidTotal;

  /// Ödenmemiş katılımcı sayısı
  int get unpaidCount => participants.where((p) => !p.isPaid).length;

  /// Tüm katılımcılar ödedi mi?
  bool get allPaid => participants.isNotEmpty && participants.every((p) => p.isPaid);

  /// Katılımcı sayısı
  int get participantCount => participants.length;

  /// Hazır olan katılımcı sayısı
  int get readyCount => participants.where((p) => p.isReady).length;

  /// Tüm katılımcılar hazır mı?
  bool get allReady => participants.isNotEmpty && participants.every((p) => p.isReady);

  /// Host mutfağa yollayabilir mi?
  bool get canSubmitToKitchen => allReady && status == GroupSessionStatus.active;

  /// Toplam ürün sayısı (tüm katılımcılar)
  int get totalItemCount => participants.fold(0, (sum, p) => sum + p.totalItemCount);

  /// Ürün bazlı toplam (işletme için): {productName: {quantity, totalPrice}}
  Map<String, Map<String, dynamic>> get aggregatedItems {
    final Map<String, Map<String, dynamic>> result = {};
    for (final p in participants) {
      for (final item in p.items) {
        if (result.containsKey(item.productName)) {
          result[item.productName]!['quantity'] = 
              (result[item.productName]!['quantity'] as int) + item.quantity;
          result[item.productName]!['totalPrice'] = 
              (result[item.productName]!['totalPrice'] as double) + item.totalPrice;
        } else {
          result[item.productName] = {
            'productId': item.productId,
            'productName': item.productName,
            'quantity': item.quantity,
            'unitPrice': item.unitPrice,
            'totalPrice': item.totalPrice,
            'imageUrl': item.imageUrl,
          };
        }
      }
    }
    return result;
  }

  bool get isActive => status == GroupSessionStatus.active;

  Map<String, dynamic> toMap() {
    return {
      'businessId': businessId,
      'businessName': businessName,
      'tableNumber': tableNumber,
      'status': status.name,
      'hostUserId': hostUserId,
      'hostName': hostName,
      if (groupPin != null) 'groupPin': groupPin,
      'participants': participants.map((p) => p.toMap()).toList(),
      'grandTotal': grandTotal,
      'paidTotal': paidTotal,
      'paymentType': paymentType,
      'paidByUserId': paidByUserId,
      'createdAt': Timestamp.fromDate(createdAt),
      'closedAt': closedAt != null ? Timestamp.fromDate(closedAt!) : null,
    };
  }

  factory TableGroupSession.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TableGroupSession(
      id: doc.id,
      businessId: data['businessId'] ?? '',
      businessName: data['businessName'] ?? '',
      tableNumber: data['tableNumber']?.toString() ?? '',
      status: GroupSessionStatus.values.firstWhere(
        (e) => e.name == data['status'],
        orElse: () => GroupSessionStatus.active,
      ),
      hostUserId: data['hostUserId'] ?? '',
      hostName: data['hostName'] ?? '',
      groupPin: data['groupPin'],
      participants: (data['participants'] as List<dynamic>?)
              ?.map((e) => TableGroupParticipant.fromMap(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          [],
      grandTotal: (data['grandTotal'] ?? 0).toDouble(),
      paidTotal: (data['paidTotal'] ?? 0).toDouble(),
      paymentType: data['paymentType'],
      paidByUserId: data['paidByUserId'],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      closedAt: (data['closedAt'] as Timestamp?)?.toDate(),
    );
  }

  TableGroupSession copyWith({
    GroupSessionStatus? status,
    String? groupPin,
    List<TableGroupParticipant>? participants,
    double? grandTotal,
    double? paidTotal,
    String? paymentType,
    String? paidByUserId,
    DateTime? closedAt,
  }) {
    return TableGroupSession(
      id: id,
      businessId: businessId,
      businessName: businessName,
      tableNumber: tableNumber,
      status: status ?? this.status,
      hostUserId: hostUserId,
      hostName: hostName,
      groupPin: groupPin ?? this.groupPin,
      participants: participants ?? this.participants,
      grandTotal: grandTotal ?? this.grandTotal,
      paidTotal: paidTotal ?? this.paidTotal,
      paymentType: paymentType ?? this.paymentType,
      paidByUserId: paidByUserId ?? this.paidByUserId,
      createdAt: createdAt,
      closedAt: closedAt ?? this.closedAt,
    );
  }
}
