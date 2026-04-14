import '../../models/order_model.dart';
import '../../models/kermes_order_model.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class UnifiedOrder {
  final LokmaOrder? lokma;
  final KermesOrder? kermes;

  UnifiedOrder._({this.lokma, this.kermes});

  factory UnifiedOrder.fromLokma(LokmaOrder o) => UnifiedOrder._(lokma: o);
  factory UnifiedOrder.fromKermes(KermesOrder k) => UnifiedOrder._(kermes: k);

  bool get isActive {
    if (lokma != null) {
      return lokma!.status != OrderStatus.delivered && 
             lokma!.status != OrderStatus.cancelled && 
             lokma!.status != OrderStatus.served &&
             lokma!.status != OrderStatus.rejected;
    }
    if (kermes != null) {
      return kermes!.isPaid == false; // For kermes, active implies it's not fulfilled/paid fully, or just checking 'isPaid' is not sufficient. 
      // Actually kermes orders don't have "active status", they are event based.
      // Usually Kermes orders are considered fulfilled immediately upon payment. 
    }
    return false;
  }

  DateTime get createdAt {
    return lokma?.createdAt ?? kermes?.createdAt ?? DateTime.now();
  }
}
