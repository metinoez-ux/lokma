import re

with open('mobile_app/lib/screens/profile/notification_history_screen.dart', 'r') as f:
    code = f.read()

# 1. Add missing imports
imports = """import '../../models/kermes_order_model.dart';
import '../../services/kermes_order_service.dart';
import '../../widgets/kermes/order_qr_dialog.dart';
import '../../widgets/kermes/payment_method_dialog.dart';
import '../../providers/unpaid_kermes_orders_provider.dart';

class NotificationHistoryScreen extends ConsumerStatefulWidget {"""
code = re.sub(
    r"import '../../models/kermes_order_model\.dart';\nimport '../../services/kermes_order_service\.dart';\nimport '../../widgets/kermes/order_qr_dialog\.dart';\nimport '../../widgets/kermes/payment_method_dialog\.dart';\n\nclass NotificationHistoryScreen extends ConsumerStatefulWidget {",
    imports, code
)

# 2. Fix the order! compilation errors
code = code.replace("buildOrderTypeInlineGlobal(order, isDark)", "buildOrderTypeInlineGlobal(order!, isDark)")
code = code.replace("_reorderItems(ctx, order);", "_reorderItems(ctx, order!);")

# 3. Add orderNumber Fallback in getOrder
old_get_order = """    try {
      LokmaOrder? order = await OrderService().getOrder(orderId);
      KermesOrder? kermesOrder;

      if (order == null) {
        kermesOrder = await KermesOrderService().getOrder(orderId);"""

new_get_order = """    try {
      LokmaOrder? order = await OrderService().getOrder(orderId);

      // Fallback for short ID (orderNumber)
      if (order == null && orderId.length <= 6) {
        final snap = await FirebaseFirestore.instance.collection('meat_orders').where('orderNumber', isEqualTo: orderId).limit(1).get();
        if (snap.docs.isNotEmpty) {
          order = LokmaOrder.fromFirestore(snap.docs.first);
        }
      }

      KermesOrder? kermesOrder;

      if (order == null) {
        kermesOrder = await KermesOrderService().getOrder(orderId);

        // Fallback for Kermes short ID (orderNumber)
        if (kermesOrder == null && orderId.length <= 6) {
          final snap = await FirebaseFirestore.instance.collection('kermes_orders').where('orderNumber', isEqualTo: orderId).limit(1).get();
          if (snap.docs.isNotEmpty) {
            kermesOrder = KermesOrder.fromDocument(snap.docs.first);
          }
        }"""
code = code.replace(old_get_order, new_get_order)

# 4. Add QR button inside the Action Buttons Row
old_action_row = """                Expanded(
                  child: SizedBox(
                    height: 40,
                    child: TextButton.icon(
                      onPressed: () {
                          final pendingEntry = group.statuses.firstWhere(
                            (s) => s['status'] == 'pending',
                            orElse: () => group.statuses.first,
                          );
                          final pendingTs = pendingEntry['createdAt'] as Timestamp?;
                          showOrderDetailGlobal(context, group.orderId, pendingTs?.toDate());
                        },
                      icon: const Icon(Icons.receipt_long_rounded, size: 16),
                      label: Text(
                        'orders.view_order'.tr(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: isDark
                            ? const Color(0xFFEA184A).withOpacity(0.85)
                            : const Color(0xFF3A3A3C),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),"""

new_action_row = """                Expanded(
                  child: SizedBox(
                    height: 40,
                    child: TextButton.icon(
                      onPressed: () {
                          final pendingEntry = group.statuses.firstWhere(
                            (s) => s['status'] == 'pending',
                            orElse: () => group.statuses.first,
                          );
                          final pendingTs = pendingEntry['createdAt'] as Timestamp?;
                          showOrderDetailGlobal(context, group.orderId, pendingTs?.toDate());
                        },
                      icon: const Icon(Icons.receipt_long_rounded, size: 16),
                      label: Text(
                        'orders.view_order'.tr(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: isDark
                            ? const Color(0xFFEA184A).withOpacity(0.85)
                            : const Color(0xFF3A3A3C),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ),
                // QR Kod Butonu (Unpaid Kermes Orders)
                Consumer(
                  builder: (context, ref, child) {
                    final unpaidState = ref.watch(unpaidKermesOrdersProvider);
                    return unpaidState.when(
                      data: (orders) {
                        try {
                          final pOrder = orders.firstWhere(
                            (o) => o.id == group.orderId || o.orderNumber == group.rawOrderNumber || o.orderNumber == group.orderId
                          );
                          return Padding(
                            padding: const EdgeInsets.only(left: 8.0),
                            child: SizedBox(
                              height: 40,
                              child: TextButton.icon(
                                onPressed: () {
                                  HapticFeedback.mediumImpact();
                                  showOrderQRDialog(
                                    context,
                                    orderId: pOrder.id,
                                    orderNumber: pOrder.orderNumber,
                                    kermesId: pOrder.kermesId,
                                    kermesName: pOrder.kermesName,
                                    totalAmount: pOrder.totalAmount,
                                    isPaid: pOrder.isPaid,
                                  );
                                },
                                icon: const Icon(Icons.qr_code_2, size: 18),
                                label: const Text('QR Kodu', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: -0.2)),
                                style: TextButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  backgroundColor: const Color(0xFFEA184A),
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                            ),
                          );
                        } catch (e) {
                          return const SizedBox.shrink(); // Not found / no QR needed
                        }
                      },
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    );
                  },
                ),
              ],
            ),
          ),"""
code = code.replace(old_action_row, new_action_row)

with open('mobile_app/lib/screens/profile/notification_history_screen.dart', 'w') as f:
    f.write(code)
