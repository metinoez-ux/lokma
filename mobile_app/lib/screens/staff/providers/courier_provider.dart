import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../services/order_service.dart';
import '../../../providers/driver_provider.dart';

enum CourierStatus { idle, activeDelivery, trackingLost }

class CourierState {
  final CourierStatus status;
  final LokmaOrder? activeOrder;
  final Position? currentLocation;

  CourierState({
    this.status = CourierStatus.idle,
    this.activeOrder,
    this.currentLocation,
  });

  CourierState copyWith({
    CourierStatus? status,
    LokmaOrder? activeOrder,
    Position? currentLocation,
  }) {
    return CourierState(
      status: status ?? this.status,
      activeOrder: activeOrder ?? this.activeOrder,
      currentLocation: currentLocation ?? this.currentLocation,
    );
  }
}

class CourierNotifier extends Notifier<CourierState> {
  final OrderService _orderService = OrderService();
  StreamSubscription<Position>? _locationSubscription;
  StreamSubscription<List<LokmaOrder>>? _activeDeliverySub;

  @override
  CourierState build() {
    ref.onDispose(() {
      _stopTracking();
      _activeDeliverySub?.cancel();
    });
    
    // Automatically check for active deliveries on boot
    _checkForActiveDelivery();
    return CourierState();
  }

  Future<void> _checkForActiveDelivery() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final driverState = ref.read(driverProvider);
    if (!driverState.isDriver || driverState.driverInfo == null) return;
    
    final businessIds = driverState.driverInfo!.assignedBusinesses;

    _activeDeliverySub?.cancel();
    _activeDeliverySub = _orderService
        .getDriverDeliveriesStream(businessIds, courierId: user.uid)
        .listen((orders) {
      final active = orders.where((o) => 
          o.courierId == user.uid && 
          o.status == OrderStatus.onTheWay).toList();

      if (active.isNotEmpty) {
        state = state.copyWith(
          status: CourierStatus.activeDelivery,
          activeOrder: active.first,
        );
        _startTracking();
      } else {
        state = state.copyWith(
          status: CourierStatus.idle,
          activeOrder: null,
        );
        _stopTracking();
      }
    });
  }

  Future<void> claimDelivery(LokmaOrder order) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    try {
      await FirebaseFirestore.instance.collection('orders').doc(order.id).update({
        'courierId': user.uid,
        'status': OrderStatus.onTheWay.toString().split('.').last,
        'courierName': ref.read(driverProvider).driverInfo?.name ?? '',
        'pickedUpAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw Exception('Sipariş görevi alınamadı: \$e');
    }
  }

  Future<void> completeDelivery(LokmaOrder order, {String? proofPhotoUrl}) async {
    try {
      final updateData = <String, dynamic>{
        'status': OrderStatus.delivered.toString().split('.').last,
        'deliveredAt': FieldValue.serverTimestamp(),
      };
      
      if (proofPhotoUrl != null) {
        updateData['proofPhotoUrl'] = proofPhotoUrl;
      }

      await FirebaseFirestore.instance.collection('orders').doc(order.id).update(updateData);
      
      state = state.copyWith(status: CourierStatus.idle, activeOrder: null);
      _stopTracking();
    } catch (e) {
      throw Exception('Sipariş tamamlanamadı: \$e');
    }
  }

  Future<void> _startTracking() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }
    
    if (permission == LocationPermission.deniedForever) return;

    _locationSubscription?.cancel();
    _locationSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      )
    ).listen((Position position) {
      state = state.copyWith(currentLocation: position);
      _updateLocationInFirebase(position);
    });
  }

  void _updateLocationInFirebase(Position position) {
    final user = FirebaseAuth.instance.currentUser;
    final orderId = state.activeOrder?.id;
    if (user == null || orderId == null) return;

    // Update global driver tracking
    FirebaseFirestore.instance.collection('driver_locations').doc(user.uid).set({
      'latitude': position.latitude,
      'longitude': position.longitude,
      'timestamp': FieldValue.serverTimestamp(),
      'orderId': orderId,
    }, SetOptions(merge: true));

    // Update inside order document so user sees it in live tracking
    FirebaseFirestore.instance.collection('orders').doc(orderId).update({
      'driverLocation': {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'timestamp': FieldValue.serverTimestamp(),
      }
    });
  }

  void _stopTracking() {
    _locationSubscription?.cancel();
    _locationSubscription = null;
  }
}

final courierProvider = NotifierProvider<CourierNotifier, CourierState>(() {
  return CourierNotifier();
});
