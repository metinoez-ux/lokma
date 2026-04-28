import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../models/kermes_order_model.dart';
import '../../utils/currency_utils.dart';
import '../../widgets/kermes/order_qr_dialog.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import '../kermes/kermes_courier_tracking_screen.dart';

class KermesOrderCard extends StatelessWidget {
  final KermesOrder order;
  final bool isDark;
  final bool autoOpen;

  const KermesOrderCard({
    Key? key,
    required this.order,
    required this.isDark,
    this.autoOpen = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (autoOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
         showGeneralDialog(
            context: context,
            barrierDismissible: true,
            barrierLabel: 'OrderQRDialog',
            transitionDuration: const Duration(milliseconds: 300),
            pageBuilder: (ctx, anim1, anim2) => OrderQRDialog(
              orderId: order.id,
              orderNumber: order.orderNumber ?? order.id.substring(0,6),
              kermesId: order.kermesId,
              kermesName: order.kermesName ?? 'Kermes Siparişi',
              totalAmount: order.totalAmount,
              isPaid: order.isPaid,
            ),
          );
      });
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEA184A),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('KERMES', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        order.kermesName.isNotEmpty ? order.kermesName : 'Kermes Siparişi',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: order.isPaid ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      order.isPaid ? 'Ödendi' : 'Ödeme Bekliyor',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: order.isPaid ? Colors.green : Colors.orange,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '${order.deliveryTypeLabel} • ${order.createdAt.day.toString().padLeft(2, '0')}.${order.createdAt.month.toString().padLeft(2, '0')}.${order.createdAt.year}',
                style: TextStyle(color: Colors.grey[500], fontSize: 13),
              ),
              const SizedBox(height: 8),
              Text(
                '${order.items.length} ürün • ${CurrencyUtils.formatCurrency(order.totalAmount)}',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () {
                    showGeneralDialog(
                      context: context,
                      barrierDismissible: true,
                      barrierLabel: 'OrderQRDialog',
                      transitionDuration: const Duration(milliseconds: 300),
                      pageBuilder: (ctx, anim1, anim2) => OrderQRDialog(
                        orderId: order.id,
                        orderNumber: order.orderNumber ?? order.id.substring(0,6),
                        kermesId: order.kermesId,
                        kermesName: order.kermesName.isNotEmpty ? order.kermesName : 'Kermes Siparişi',
                        totalAmount: order.totalAmount,
                        isPaid: order.isPaid,
                      ),
                    );
                  },
                  icon: const Icon(Icons.qr_code, size: 18),
                  label: const Text('QR Kodu Göster / Siparişi Görüntüle'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFEA184A),
                    backgroundColor: const Color(0xFFEA184A).withOpacity(0.1),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              if (order.deliveryType == DeliveryType.kurye && order.status == KermesOrderStatus.onTheWay) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => KermesCourierTrackingScreen(orderId: order.id),
                        ),
                      );
                    },
                    icon: const Icon(Icons.location_on, size: 18, color: Colors.white),
                    label: const Text('Kuryemi Takip Et', style: TextStyle(color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA184A),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
