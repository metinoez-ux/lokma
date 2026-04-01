import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../services/order_service.dart';
import '../../../models/order_model.dart';

class CourierTab extends ConsumerWidget {
  final List<String> businessIds;
  final String userId;
  final bool isDark;

  const CourierTab({
    super.key,
    required this.businessIds,
    required this.userId,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (businessIds.isEmpty) {
      return const Center(child: Text('Aktif kurye yetkiniz yok.'));
    }

    return StreamBuilder<List<LokmaOrder>>(
      stream: OrderService().getDriverDeliveriesStream(businessIds, courierId: userId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final orders = snapshot.data ?? [];
        final pending = orders.where((o) => o.status == OrderStatus.pending).toList();
        final preparing = orders.where((o) => o.status == OrderStatus.preparing).toList();
        final ready = orders.where((o) => o.status == OrderStatus.ready).toList();
        final onWay = orders.where((o) => o.status == OrderStatus.onTheWay || o.status == OrderStatus.accepted).toList();

        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status counts
              Row(
                children: [
                  _orderStatCard('Bekleyen', pending.length, Icons.hourglass_bottom, Colors.amber),
                  const SizedBox(width: 8),
                  _orderStatCard('Hazırlanan', preparing.length, Icons.local_fire_department, Colors.orange),
                  const SizedBox(width: 8),
                  _orderStatCard('Hazır', ready.length, Icons.check_circle, Colors.green, dominant: true),
                  const SizedBox(width: 8),
                  _orderStatCard('Yolda', onWay.length, Icons.local_shipping, Colors.blue),
                ],
              ),
              const SizedBox(height: 20),
              
              if (ready.isNotEmpty) 
                _buildReadySection(context, ready),

              const SizedBox(height: 20),
              // Gelen Siparişleri Görevlen Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => context.push('/driver-deliveries'),
                  icon: const Icon(Icons.delivery_dining, size: 28),
                  label: const Text('Tüm Siparişleri Görevlen'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    backgroundColor: Colors.blueAccent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReadySection(BuildContext context, List<LokmaOrder> readyOrders) {
    return GestureDetector(
      onTap: () => context.push('/driver-deliveries'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.green.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.green.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.green),
                const SizedBox(width: 8),
                const Text(
                  'Teslim Edilecek Siparişler',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(12)),
                  child: Text('${readyOrders.length}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...readyOrders.map((o) => Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, size: 16, color: Colors.green),
                  const SizedBox(width: 8),
                  Text('#${o.id.substring(0, 5)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Text('${o.total.toStringAsFixed(2)} €'),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _orderStatCard(String label, int count, IconData icon, Color color, {bool dominant = false}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: dominant ? color : color.withOpacity(isDark ? 0.2 : 0.1),
          borderRadius: BorderRadius.circular(12),
          border: dominant ? null : Border.all(color: color.withOpacity(0.5)),
        ),
        child: Column(
          children: [
            Icon(icon, color: dominant ? Colors.white : color, size: 24),
            const SizedBox(height: 6),
            Text(
              '$count',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: dominant ? Colors.white : color),
            ),
            Text(
              label,
              style: TextStyle(fontSize: 10, color: dominant ? Colors.white : (isDark ? Colors.grey[300] : Colors.grey[700])),
              textAlign: TextAlign.center,
              maxLines: 1,
            ),
          ],
        ),
      ),
    );
  }
}
