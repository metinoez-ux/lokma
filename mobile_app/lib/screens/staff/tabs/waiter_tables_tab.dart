import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../services/table_session_service.dart';
import 'package:easy_localization/easy_localization.dart';

class WaiterTablesTab extends ConsumerWidget {
  final String businessId;
  final bool isDark;
  final bool isKermes;
  final Function(TableSession, int) onTableSelected;
  final Function(int) onEmptyTableSelected;
  final Function()? onWalkinOrderSelected;

  const WaiterTablesTab({
    super.key,
    required this.businessId,
    required this.isDark,
    this.isKermes = false,
    required this.onTableSelected,
    required this.onEmptyTableSelected,
    this.onWalkinOrderSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (businessId.isEmpty) {
      return Center(child: Text('staff.no_active_table_permission'.tr()));
    }

    // Modern Table Grid Implementation
    return StreamBuilder<List<TableSession>>(
      stream: TableSessionService().getActiveSessionsStream(businessId, isKermes: isKermes),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text('Masa bilgileri alınırken hata oluştu:\n${snapshot.error}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
            ),
          );
        }
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        
        final sessions = snapshot.data ?? [];
        
        return Padding(
          padding: const EdgeInsets.all(20),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (onWalkinOrderSelected != null) ...[
                        ElevatedButton.icon(
                          onPressed: onWalkinOrderSelected,
                          icon: const Icon(Icons.shopping_bag_outlined),
                          label: const Text('Masa Bağımsız Sipariş Al', style: TextStyle(fontSize: 16)),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            backgroundColor: Colors.blueAccent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],
                      Text(
                        'staff.active_tables_count'.tr(namedArgs: {'count': sessions.length.toString()}),
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ],
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
          ),
        );
      },
    );
  }

  Widget _buildTableItem(BuildContext context, int tableNum, TableSession? session) {
    final bool isActive = session != null && session.isActive;
    
    final Color bgColor = isActive 
        ? Colors.blue.withOpacity(0.15)
        : (isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.02));
        
    final Color borderColor = isActive
        ? Colors.blue.withOpacity(0.5)
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
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'staff.table'.tr(),
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
                  color: isActive ? Colors.blue : (isDark ? Colors.white : Colors.black),
                ),
              ),
              if (isActive) ...[
                const SizedBox(height: 8),
                Text(
                  'staff.busy'.tr(),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue,
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
