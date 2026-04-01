import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/order_service.dart';
import '../../providers/driver_provider.dart';
import 'providers/courier_provider.dart';

/// Modernized Staff Delivery Screen - Uses Riverpod and sleek UI guidelines
class StaffDeliveryScreen extends ConsumerWidget {
  final String businessId;

  const StaffDeliveryScreen({super.key, required this.businessId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driverState = ref.watch(driverProvider);
    final courierState = ref.watch(courierProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Check Driver Authorization
    if (!driverState.isDriver || driverState.driverInfo == null) {
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF9FAFB),
        appBar: _buildAppBar(context, isDark),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.warning_amber_rounded, size: 80, color: Colors.orangeAccent),
              SizedBox(height: 16),
              Text(
                'Sürücü yetkisi bulunamadı',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                'Lütfen yöneticinize başvurun',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    if (courierState.status == CourierStatus.activeDelivery && courierState.activeOrder != null) {
      return ActiveDeliveryWidget(order: courierState.activeOrder!);
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF9FAFB),
      appBar: _buildAppBar(context, isDark),
      body: SafeArea(
        child: DefaultTabController(
          length: 2,
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[900] : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: TabBar(
                  indicator: BoxDecoration(
                    color: Colors.blueAccent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  labelColor: Colors.white,
                  unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
                  dividerColor: Colors.transparent,
                  tabs: const [
                    Tab(text: 'Bekleyenler'),
                    Tab(text: 'Tamamlananlar'),
                  ],
                ),
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _PendingDeliveriesList(businessId: businessId, userId: driverState.driverInfo!.id),
                    _CompletedDeliveriesList(businessId: businessId, userId: driverState.driverInfo!.id),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, bool isDark) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black87),
        onPressed: () => context.pop(),
      ),
      title: Text(
        'Sipariş Teslimatları',
        style: TextStyle(
          color: isDark ? Colors.white : Colors.black87,
          fontWeight: FontWeight.w700,
        ),
      ),
      centerTitle: true,
    );
  }
}

class _PendingDeliveriesList extends ConsumerWidget {
  final String businessId;
  final String userId;

  const _PendingDeliveriesList({required this.businessId, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return StreamBuilder(
      stream: OrderService().getDriverDeliveriesStream([businessId], courierId: userId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final orders = snapshot.data ?? [];
        final readyOrders = orders.where((o) => o.status == OrderStatus.ready).toList();

        if (readyOrders.isEmpty) {
          return Center(
            child: Text(
              'Teslimata hazır sipariş yok',
              style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: readyOrders.length,
          itemBuilder: (context, index) {
            final order = readyOrders[index];
            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[900] : Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('#\${order.id.substring(0, 5)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                          child: const Text('HAZIR', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                        )
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.person, size: 16, color: Colors.grey),
                        const SizedBox(width: 8),
                        Text('\${order.customerName}', style: const TextStyle(fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 16, color: Colors.grey),
                        const SizedBox(width: 8),
                        Expanded(child: Text('\${order.deliveryAddress}', maxLines: 2, overflow: TextOverflow.ellipsis)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blueAccent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () async {
                          try {
                            await ref.read(courierProvider.notifier).claimDelivery(order);
                            // Notifier will automatically route user to ActiveDeliveryWidget
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                            }
                          }
                        },
                        child: const Text('Görevi Al', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _CompletedDeliveriesList extends ConsumerWidget {
  final String businessId;
  final String userId;

  const _CompletedDeliveriesList({required this.businessId, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Standard implementation for history
    return const Center(child: Text('Geçmiş Teslimatlar', style: TextStyle(color: Colors.grey)));
  }
}

class ActiveDeliveryWidget extends ConsumerWidget {
  final LokmaOrder order; // Use exact package referencing if LokmaOrder is unresolved here, normally it works if imported.

  const ActiveDeliveryWidget({super.key, required this.order});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('Aktif Görev'),
        centerTitle: true,
        backgroundColor: Colors.blueAccent,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: const Icon(Icons.electric_moped), // Force them to stay on page or finish it
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[900] : Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                   BoxShadow(color: Colors.blueAccent.withValues(alpha: 0.1), blurRadius: 20, spreadRadius: 5),
                ]
              ),
              child: Column(
                children: [
                  const Text('Müşteri:', style: TextStyle(color: Colors.grey)),
                  Text('\${order.customerName}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Text('\${order.deliveryAddress}', textAlign: TextAlign.center),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _ActionButton(icon: Icons.navigation, label: 'Yol Tarifi', color: Colors.blue, onTap: () {
                         // _openNavigation...
                      }),
                      _ActionButton(icon: Icons.phone, label: 'Ara', color: Colors.green, onTap: () {
                         // launchUrl('tel:\${order.customerPhone}');
                      }),
                    ],
                  )
                ],
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.check_circle_outline, size: 28),
                label: const Text('Teslimatı Tamamla', style: TextStyle(fontSize: 18)),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: () async {
                   try {
                     await ref.read(courierProvider.notifier).completeDelivery(order);
                     if (context.mounted) {
                       ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Teslimat başarıyla tamamlandı!')));
                     }
                   } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                      }
                   }
                },
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: color.withValues(alpha: 0.1),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
