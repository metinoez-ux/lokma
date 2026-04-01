import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/table_model.dart';
import '../../../services/table_service.dart';

class WaiterTablesTab extends ConsumerWidget {
  final String businessId;
  final bool isDark;
  final Function(TableSession, int) onTableSelected;
  final Function(int) onEmptyTableSelected;

  const WaiterTablesTab({
    super.key,
    required this.businessId,
    required this.isDark,
    required this.onTableSelected,
    required this.onEmptyTableSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (businessId.isEmpty) {
      return const Center(child: Text('Aktif masa yetkiniz yok.'));
    }

    // Modern Table Grid Implementation
    return StreamBuilder<List<TableSession>>(
      stream: TableService().getActiveTableSessionsStream(businessId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        
        final sessions = snapshot.data ?? [];
        
        return CustomScrollView(
          padding: const EdgeInsets.all(20),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: Text(
                  'Aktif Masalar (${sessions.length})',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.1,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final tableNum = index + 1;
                  final session = sessions.cast<TableSession?>().firstWhere(
                    (s) => s?.tableNumber == tableNum,
                    orElse: () => null,
                  );

                  return _buildTableItem(context, tableNum, session);
                },
                childCount: 20, // Max 20 tables as per Lokma config
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTableItem(BuildContext context, int tableNum, TableSession? session) {
    final bool isActive = session != null && session.status != TableStatus.completed;
    final bool isReadyForPayment = isActive && session!.status == TableStatus.readyForPayment;
    
    final Color bgColor = isActive 
        ? (isReadyForPayment ? Colors.orange.withOpacity(0.15) : Colors.blue.withOpacity(0.15))
        : (isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.02));
        
    final Color borderColor = isActive
        ? (isReadyForPayment ? Colors.orange.withOpacity(0.5) : Colors.blue.withOpacity(0.5))
        : (isDark ? Colors.white10 : Colors.black12);

    return GestureDetector(
      onTap: () {
        if (isActive) {
          onTableSelected(session!, tableNum);
        } else {
          onEmptyTableSelected(tableNum);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor, width: 2),
          boxShadow: isActive ? [
            BoxShadow(
              color: borderColor.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 4),
            )
          ] : null,
        ),
        child: Stack(
          children: [
            // Internal Content
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Masa',
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                  ),
                  Text(
                    '$tableNum',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: isActive ? (isReadyForPayment ? Colors.orange : Colors.blue) : (isDark ? Colors.white : Colors.black),
                    ),
                  ),
                ],
              ),
            ),
            if (isActive) 
              Positioned(
                bottom: 12,
                left: 0,
                right: 0,
                child: Text(
                  '${session!.totalAmount.toStringAsFixed(2)} €',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isReadyForPayment ? Colors.orange : Colors.blue,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
