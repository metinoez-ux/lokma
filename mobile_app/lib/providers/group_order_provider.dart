import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/models/kermes_group_order_model.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import '../models/kermes_model.dart';

/// Persistence keys
const _kActiveGroupOrderId = 'active_kermes_group_order_id';
const _kActiveParticipantId = 'active_kermes_participant_id';

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

  /// Aktif oturumu SharedPreferences'e kaydet
  Future<void> _persistSession(String orderId, String participantId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kActiveGroupOrderId, orderId);
    await prefs.setString(_kActiveParticipantId, participantId);
  }

  /// Kaydedilmis oturum bilgisini sil
  Future<void> _clearPersistedSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kActiveGroupOrderId);
    await prefs.remove(_kActiveParticipantId);
  }

  /// Daha once kaydedilmis aktif oturumu geri yukle
  /// Basarili olursa orderId doner, yoksa null
  Future<String?> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final orderId = prefs.getString(_kActiveGroupOrderId);
    final participantId = prefs.getString(_kActiveParticipantId);

    if (orderId == null || participantId == null) return null;

    try {
      final doc = await _groupOrdersCollection.doc(orderId).get();
      if (!doc.exists) {
        await _clearPersistedSession();
        return null;
      }

      final order = KermesGroupOrder.fromDocument(doc);

      // Suresi dolmus veya tamamlanmis oturumlari temizle
      if (order.status == GroupOrderStatus.ordered ||
          order.status == GroupOrderStatus.cancelled ||
          (order.expiresAt != null && DateTime.now().isAfter(order.expiresAt!))) {
        await _clearPersistedSession();
        return null;
      }

      state = state.copyWith(
        currentOrder: order,
        currentParticipantId: participantId,
      );

      // Realtime listener baslat
      startListening(orderId);

      return orderId;
    } catch (_) {
      await _clearPersistedSession();
      return null;
    }
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
      final orderId = _uuid.v4().substring(0, 8).toUpperCase(); // Kisa ID: ABC12345
      final participantId = _uuid.v4();
      final now = DateTime.now();
      final generatedHostUserId = hostUserId ?? 'anon_${_uuid.v4().substring(0, 8)}';

      // 4 haneli guvenlik PIN'i uret
      final random = Random();
      final pin = (1000 + random.nextInt(9000)).toString(); // 1000-9999

      final order = KermesGroupOrder(
        id: orderId,
        kermesId: kermesId,
        kermesName: kermesName,
        hostUserId: generatedHostUserId,
        hostName: hostName,
        status: GroupOrderStatus.collecting,
        createdAt: now,
        expiresAt: now.add(Duration(minutes: expirationMinutes)),
        groupPin: pin,
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

      // Oturumu persist et
      await _persistSession(orderId, participantId);

      return orderId;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  /// Mevcut grup siparisine katil
  /// [requirePin] true ise (QR ile katilim), PIN dogrulamasi yapilir
  /// Link ile katilimda PIN gerekmez
  Future<bool> joinGroupOrder({
    required String orderId,
    required String userId,
    required String userName,
    String? enteredPin, // QR katilimda girilecek PIN
    bool requirePin = false, // QR = true, Link = false
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final doc = await _groupOrdersCollection.doc(orderId).get();
      
      if (!doc.exists) {
        state = state.copyWith(isLoading: false, error: 'Siparis bulunamadi');
        return false;
      }

      final order = KermesGroupOrder.fromDocument(doc);

      // Sure dolmus mu kontrol et
      if (order.expiresAt != null && DateTime.now().isAfter(order.expiresAt!)) {
        state = state.copyWith(isLoading: false, error: 'Siparis suresi dolmus');
        return false;
      }

      // PIN dogrulamasi (sadece QR ile katilimda)
      if (requirePin && order.groupPin != null && order.groupPin!.isNotEmpty) {
        if (enteredPin == null || enteredPin != order.groupPin) {
          state = state.copyWith(isLoading: false, error: 'Yanlis PIN kodu');
          return false;
        }
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

      // Oturumu persist et
      await _persistSession(orderId, participantId);

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
      // 1. Generate real order number using KermesOrderService
      final orderService = KermesOrderService();
      
      // Determine tableSection for sequential numbering logic
      String? section;
      if (order.delivery?.type == DeliveryType.masada) {
        section = 'masa'; // This is a general flag, service handles actual section mapping
      }

      final orderNum = await orderService.generateSequentialOrderId(
        order.kermesId,
        tableSection: section,
      );
      
      final fullOrderId = '${order.kermesId}_$orderNum';

      // 2. Convert to KermesOrder and save
      final kermesOrder = order.toKermesOrder(
        orderNumber: orderNum,
        fullId: fullOrderId,
      );

      await orderService.createOrder(kermesOrder);

      // 3. Update group order status in Firestore
      final updatedOrder = order.copyWith(status: GroupOrderStatus.ordered);

      await _groupOrdersCollection.doc(order.id).update({
        'status': GroupOrderStatus.ordered.name,
        'kermesOrderId': fullOrderId, // Link to the real order
      });

      // 4. Optionally: Notify other participants? 
      // (For now, creating the kermesOrder will trigger host notification via Cloud Functions)

      state = state.copyWith(currentOrder: updatedOrder);
      await _clearPersistedSession();
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
    _clearPersistedSession();
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
