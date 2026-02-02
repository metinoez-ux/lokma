import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/kermes_group_order_model.dart';
import '../models/kermes_model.dart';

/// Firestore collection referansı
final _groupOrdersCollection = FirebaseFirestore.instance.collection('kermes_group_orders');

/// Grup siparişi state
class GroupOrderState {
  final KermesGroupOrder? currentOrder;
  final bool isLoading;
  final String? error;
  final String? currentParticipantId; // Mevcut kullanıcının katılımcı ID'si

  GroupOrderState({
    this.currentOrder,
    this.isLoading = false,
    this.error,
    this.currentParticipantId,
  });

  GroupOrderState copyWith({
    KermesGroupOrder? currentOrder,
    bool? isLoading,
    String? error,
    String? currentParticipantId,
  }) {
    return GroupOrderState(
      currentOrder: currentOrder ?? this.currentOrder,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      currentParticipantId: currentParticipantId ?? this.currentParticipantId,
    );
  }
}

/// Grup siparişi notifier
class GroupOrderNotifier extends Notifier<GroupOrderState> {
  final _uuid = const Uuid();

  @override
  GroupOrderState build() {
    return GroupOrderState();
  }

  /// Yeni grup siparişi oluştur (Host olarak)
  Future<String?> createGroupOrder({
    required String kermesId,
    required String kermesName,
    required String hostName,
    int expirationMinutes = 10, // Varsayılan 10 dakika
    String? hostUserId, // Kermes için anonim olabilir
    List<GroupOrderItem>? initialItems,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final orderId = _uuid.v4().substring(0, 8).toUpperCase(); // Kısa ID: ABC12345
      final participantId = _uuid.v4();
      final now = DateTime.now();
      final generatedHostUserId = hostUserId ?? 'anon_${_uuid.v4().substring(0, 8)}';

      final order = KermesGroupOrder(
        id: orderId,
        kermesId: kermesId,
        kermesName: kermesName,
        hostUserId: generatedHostUserId,
        hostName: hostName,
        status: GroupOrderStatus.collecting,
        createdAt: now,
        expiresAt: now.add(Duration(minutes: expirationMinutes)),
        participants: [
          GroupOrderParticipant(
            oderId: participantId,
            userId: generatedHostUserId,
            name: hostName,
            isHost: true,
            isReady: false,
            items: initialItems ?? [],
          ),
        ],
      );

      // Firestore'a kaydet
      await _groupOrdersCollection.doc(orderId).set(order.toMap());

      state = state.copyWith(
        currentOrder: order,
        isLoading: false,
        currentParticipantId: participantId,
      );

      return orderId;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  /// Mevcut grup siparişine katıl
  Future<bool> joinGroupOrder({
    required String orderId,
    required String userId,
    required String userName,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final doc = await _groupOrdersCollection.doc(orderId).get();
      
      if (!doc.exists) {
        state = state.copyWith(isLoading: false, error: 'Sipariş bulunamadı');
        return false;
      }

      final order = KermesGroupOrder.fromDocument(doc);

      // Süre dolmuş mu kontrol et
      if (order.expiresAt != null && DateTime.now().isAfter(order.expiresAt!)) {
        state = state.copyWith(isLoading: false, error: 'Sipariş süresi dolmuş');
        return false;
      }

      // Zaten katılmış mı kontrol et
      if (order.participants.any((p) => p.userId == userId)) {
        // Zaten katılmış, sadece state güncelle
        final participantId = order.participants.firstWhere((p) => p.userId == userId).oderId;
        state = state.copyWith(
          currentOrder: order,
          isLoading: false,
          currentParticipantId: participantId,
        );
        return true;
      }

      // Yeni katılımcı ekle
      final participantId = _uuid.v4();
      final newParticipant = GroupOrderParticipant(
        oderId: participantId,
        userId: userId,
        name: userName,
        isHost: false,
        isReady: false,
        items: [],
      );

      await _groupOrdersCollection.doc(orderId).update({
        'participants': FieldValue.arrayUnion([newParticipant.toMap()]),
      });

      final updatedOrder = order.copyWith(
        participants: [...order.participants, newParticipant],
      );

      state = state.copyWith(
        currentOrder: updatedOrder,
        isLoading: false,
        currentParticipantId: participantId,
      );

      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Katılımcının sepetine ürün ekle
  Future<void> addItemToCart({
    required String participantId,
    required KermesMenuItem menuItem,
  }) async {
    final order = state.currentOrder;
    if (order == null) return;

    final participantIndex = order.participants.indexWhere((p) => p.oderId == participantId);
    if (participantIndex < 0) return;

    final participant = order.participants[participantIndex];
    final existingItemIndex = participant.items.indexWhere(
      (item) => item.menuItemName == menuItem.name,
    );

    List<GroupOrderItem> updatedItems;
    if (existingItemIndex >= 0) {
      // Miktarı artır
      updatedItems = List.from(participant.items);
      final existingItem = updatedItems[existingItemIndex];
      updatedItems[existingItemIndex] = GroupOrderItem(
        menuItemName: existingItem.menuItemName,
        quantity: existingItem.quantity + 1,
        price: existingItem.price,
      );
    } else {
      // Yeni ürün ekle
      updatedItems = [
        ...participant.items,
        GroupOrderItem(
          menuItemName: menuItem.name,
          quantity: 1,
          price: menuItem.price,
        ),
      ];
    }

    final updatedParticipant = participant.copyWith(items: updatedItems);
    final updatedParticipants = List<GroupOrderParticipant>.from(order.participants);
    updatedParticipants[participantIndex] = updatedParticipant;

    final updatedOrder = order.copyWith(participants: updatedParticipants);

    // Firestore güncelle
    await _groupOrdersCollection.doc(order.id).update({
      'participants': updatedParticipants.map((p) => p.toMap()).toList(),
    });

    state = state.copyWith(currentOrder: updatedOrder);
  }

  /// Katılımcının sepetinden ürün çıkar
  Future<void> removeItemFromCart({
    required String participantId,
    required String menuItemName,
  }) async {
    final order = state.currentOrder;
    if (order == null) return;

    final participantIndex = order.participants.indexWhere((p) => p.oderId == participantId);
    if (participantIndex < 0) return;

    final participant = order.participants[participantIndex];
    final existingItemIndex = participant.items.indexWhere(
      (item) => item.menuItemName == menuItemName,
    );

    if (existingItemIndex < 0) return;

    List<GroupOrderItem> updatedItems = List.from(participant.items);
    final existingItem = updatedItems[existingItemIndex];

    if (existingItem.quantity > 1) {
      // Miktarı azalt
      updatedItems[existingItemIndex] = GroupOrderItem(
        menuItemName: existingItem.menuItemName,
        quantity: existingItem.quantity - 1,
        price: existingItem.price,
      );
    } else {
      // Ürünü tamamen kaldır
      updatedItems.removeAt(existingItemIndex);
    }

    final updatedParticipant = participant.copyWith(items: updatedItems);
    final updatedParticipants = List<GroupOrderParticipant>.from(order.participants);
    updatedParticipants[participantIndex] = updatedParticipant;

    final updatedOrder = order.copyWith(participants: updatedParticipants);

    // Firestore güncelle
    await _groupOrdersCollection.doc(order.id).update({
      'participants': updatedParticipants.map((p) => p.toMap()).toList(),
    });

    state = state.copyWith(currentOrder: updatedOrder);
  }

  /// "Siparişim Tamam" durumunu değiştir
  Future<void> toggleParticipantReady({required String participantId}) async {
    final order = state.currentOrder;
    if (order == null) return;

    final participantIndex = order.participants.indexWhere((p) => p.oderId == participantId);
    if (participantIndex < 0) return;

    final participant = order.participants[participantIndex];
    final updatedParticipant = participant.copyWith(isReady: !participant.isReady);
    
    final updatedParticipants = List<GroupOrderParticipant>.from(order.participants);
    updatedParticipants[participantIndex] = updatedParticipant;

    var updatedOrder = order.copyWith(participants: updatedParticipants);

    // Tüm katılımcılar hazır mı kontrol et
    if (updatedOrder.allParticipantsReady) {
      updatedOrder = updatedOrder.copyWith(status: GroupOrderStatus.readyToOrder);
    } else {
      updatedOrder = updatedOrder.copyWith(status: GroupOrderStatus.collecting);
    }

    // Firestore güncelle
    await _groupOrdersCollection.doc(order.id).update({
      'participants': updatedParticipants.map((p) => p.toMap()).toList(),
      'status': updatedOrder.status.name,
    });

    state = state.copyWith(currentOrder: updatedOrder);
  }

  /// Teslimat ve ödeme bilgilerini ayarla (sadece host)
  Future<void> setDeliveryAndPayment({
    required GroupOrderDelivery delivery,
    required PaymentMethod paymentMethod,
  }) async {
    final order = state.currentOrder;
    if (order == null) return;

    final updatedOrder = order.copyWith(
      delivery: delivery,
      paymentMethod: paymentMethod,
    );

    await _groupOrdersCollection.doc(order.id).update({
      'delivery': delivery.toMap(),
      'paymentMethod': paymentMethod.name,
    });

    state = state.copyWith(currentOrder: updatedOrder);
  }

  /// Siparişi tamamla (sadece host)
  Future<bool> completeOrder() async {
    final order = state.currentOrder;
    if (order == null) return false;

    try {
      final updatedOrder = order.copyWith(status: GroupOrderStatus.ordered);

      await _groupOrdersCollection.doc(order.id).update({
        'status': GroupOrderStatus.ordered.name,
      });

      state = state.copyWith(currentOrder: updatedOrder);
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  /// Grup siparişini yükle (ID ile)
  Future<void> loadGroupOrder(String orderId) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final doc = await _groupOrdersCollection.doc(orderId).get();
      
      if (!doc.exists) {
        state = state.copyWith(isLoading: false, error: 'Sipariş bulunamadı');
        return;
      }

      final order = KermesGroupOrder.fromDocument(doc);
      state = state.copyWith(currentOrder: order, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Real-time listener başlat
  void startListening(String orderId) {
    _groupOrdersCollection.doc(orderId).snapshots().listen((snapshot) {
      if (snapshot.exists) {
        final order = KermesGroupOrder.fromDocument(snapshot);
        state = state.copyWith(currentOrder: order);
      }
    });
  }

  /// Mevcut siparişi temizle
  void clearOrder() {
    state = GroupOrderState();
  }
}

/// Grup siparişi provider
final groupOrderProvider = NotifierProvider<GroupOrderNotifier, GroupOrderState>(() {
  return GroupOrderNotifier();
});

/// Belirli bir grup siparişini dinleyen stream provider
final groupOrderStreamProvider = StreamProvider.family<KermesGroupOrder?, String>((ref, orderId) {
  return _groupOrdersCollection.doc(orderId).snapshots().map((snapshot) {
    if (snapshot.exists) {
      return KermesGroupOrder.fromDocument(snapshot);
    }
    return null;
  });
});
