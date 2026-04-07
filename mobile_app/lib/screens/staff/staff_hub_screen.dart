import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/driver_provider.dart';
import 'providers/staff_hub_provider.dart';
import 'tabs/shift_dashboard_tab.dart';
import 'tabs/courier_tab.dart';
import 'tabs/waiter_tables_tab.dart';
import 'tabs/finance_wallet_tab.dart';
import 'staff_reservations_screen.dart';
import '../../widgets/qr_scanner_screen.dart';
import 'providers/staff_notifications_provider.dart';
import 'staff_notifications_screen.dart';
import 'widgets/shift_action_pill.dart';
import '../kermes/kermes_unified_kds_screen.dart';
import '../kermes/kermes_tezgah_screen.dart';
import 'tabs/staff_pos_wrapper_tab.dart';

class StaffHubScreen extends ConsumerStatefulWidget {
  const StaffHubScreen({super.key});

  @override
  ConsumerState<StaffHubScreen> createState() => _StaffHubScreenState();
}

class _StaffHubScreenState extends ConsumerState<StaffHubScreen> {
  int _selectedNavIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(staffCapabilitiesProvider.notifier).reload();
    });
  }

  @override
  Widget build(BuildContext context) {
    final capabilities = ref.watch(staffCapabilitiesProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final driverState = ref.watch(driverProvider);
    final unreadCountAsync = ref.watch(staffUnreadNotificationsCountProvider);
    final unreadCount = unreadCountAsync.value ?? 0;

    List<Widget> tabs = [];
    List<BottomNavigationBarItem> navItems = [];

    // 1. Shift Dashboard (Always present)
    tabs.add(const ShiftDashboardTab());
    navItems.add(const BottomNavigationBarItem(
      icon: Icon(Icons.timer),
      label: 'Mesai',
    ));

    // 2. KDS / Mutfak Tab (If prepZones exist)
    if (capabilities.kermesPrepZones.isNotEmpty && capabilities.businessId != null) {
      tabs.add(KermesUnifiedKdsScreen(
        kermesId: capabilities.businessId!,
        kermesName: capabilities.businessName,
        allowedSections: capabilities.kermesAllowedSections,
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.kitchen),
        label: 'Mutfak',
      ));
    }

    // 2b. Tezgah Tab (If user has tezgah role)
    if (capabilities.hasTezgahRole && capabilities.businessId != null) {
      tabs.add(KermesTezgahScreen(
        kermesId: capabilities.businessId!,
        kermesName: capabilities.businessName,
        tezgahName: capabilities.tezgahName.isNotEmpty ? capabilities.tezgahName : 'T1',
        allowedSections: capabilities.kermesAllowedSections,
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.storefront),
        label: 'Tezgah',
      ));
    }

    // 2c. POS Tab (If user has POS role - kermes staff)
    if (capabilities.hasPosRole && capabilities.businessId != null) {
      tabs.add(StaffPosWrapperTab(
        kermesId: capabilities.businessId!,
        staffId: capabilities.userId,
        staffName: capabilities.staffName,
        allowedSections: capabilities.kermesAllowedSections,
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.point_of_sale),
        label: 'POS',
      ));
    }

    // 3. Courier Tab
    if (capabilities.isDriver && capabilities.businessId != null) {
      tabs.add(CourierTab(
        businessIds: [capabilities.businessId!],
        userId: capabilities.userId,
        isDark: isDark,
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.delivery_dining),
        label: 'Kurye',
      ));
    }

    // 4. Waiter Tab
    if (capabilities.hasTablesRole && capabilities.businessId != null) {
      tabs.add(WaiterTablesTab(
        businessId: capabilities.businessId!,
        isDark: isDark,
        onTableSelected: (session, num) {
          final query = Uri(path: '/waiter-order', queryParameters: {
            'businessId': capabilities.businessId,
            'businessName': capabilities.businessName,
            'tableNumber': num.toString(),
          }).toString();
          context.push(query);
        },
        onEmptyTableSelected: (num) {
          final query = Uri(path: '/waiter-order', queryParameters: {
            'businessId': capabilities.businessId,
            'businessName': capabilities.businessName,
            'tableNumber': num.toString(),
          }).toString();
          context.push(query);
        },
        onWalkinOrderSelected: () {
          final query = Uri(path: '/waiter-order', queryParameters: {
            'businessId': capabilities.businessId,
            'businessName': capabilities.businessName,
          }).toString();
          context.push(query);
        },
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.table_restaurant),
        label: 'Masalar',
      ));
    }

    // 5. Reservations Tab
    if (capabilities.hasReservation && capabilities.businessId != null) {
      tabs.add(const StaffReservationsScreen(hideAppBar: true));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.book_online),
        label: 'Rezervasyon',
      ));
    }

    final bool showQr = capabilities.kermesAllowedSections.isNotEmpty || capabilities.hasFinanceRole;
    if (showQr) {
      tabs.add(const SizedBox.shrink()); // Dummy tab for QR
      navItems.add(BottomNavigationBarItem(
        icon: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.green.withOpacity(0.15),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.qr_code_scanner, color: Colors.green),
        ),
        label: 'QR',
      ));
    }

    // 6. Finance Tab
    if (capabilities.hasFinanceRole && capabilities.businessId != null) {
      tabs.add(FinanceWalletTab(
        userId: capabilities.userId,
        isDark: isDark,
        driverState: driverState,
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.account_balance_wallet),
        label: 'Kasa',
      ));
    }

    if (_selectedNavIndex >= tabs.length) {
      _selectedNavIndex = 0;
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              capabilities.staffName.isNotEmpty ? capabilities.staffName : 'Personel Paneli',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
            if (capabilities.phoneNumber.isNotEmpty)
              Text(
                capabilities.phoneNumber,
                style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black54),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
          ],
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const StaffNotificationsScreen(),
                  ));
                },
                tooltip: 'Bildirimler',
              ),
              if (unreadCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.redAccent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 14,
                      minHeight: 14,
                    ),
                    child: Text(
                      unreadCount > 99 ? '99+' : unreadCount.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          const ShiftActionPill(),
        ],
      ),
      body: tabs.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : tabs.length == 1
              ? tabs.first
              : IndexedStack(
                  index: _selectedNavIndex,
                  children: tabs,
                ),
      bottomNavigationBar: navItems.length >= 2
          ? BottomNavigationBar(
              currentIndex: _selectedNavIndex,
              onTap: (index) {
                if (navItems[index].label == 'QR') {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (context) => const QRScannerScreen(
                      prompt: 'Sipariş / Fatura QR Oku',
                    ),
                  )).then((scannedText) {
                    if (scannedText != null && scannedText is String && scannedText.isNotEmpty) {
                      final query = Uri(path: '/kermesler', queryParameters: {
                        'scannedOrder': scannedText,
                        'businessId': capabilities.businessId,
                      }).toString();
                      context.push(query);
                    }
                  });
                  return;
                }
                setState(() => _selectedNavIndex = index);
              },
              type: BottomNavigationBarType.fixed,
              items: navItems,
              backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              selectedItemColor: Colors.blueAccent,
              unselectedItemColor: Colors.grey,
            )
          : null,
    );
  }
}
