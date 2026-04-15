import 'package:flutter/material.dart';
import 'cash_drawer_screen.dart';
import 'kermes_admin_vault_screen.dart';

class CombinedWalletScreen extends StatelessWidget {
  final String kermesId;
  final String staffId;
  final bool isAdmin;

  const CombinedWalletScreen({
    super.key,
    required this.kermesId,
    required this.staffId,
    required this.isAdmin,
  });

  @override
  Widget build(BuildContext context) {
    if (!isAdmin) {
      // Normal personel sadece kendi cüzdanını görür.
      return CashDrawerScreen(kermesId: kermesId, staffId: staffId, isEmbedded: false);
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Admin ise her iki kasayı (Kendi cüzdanı + Personelden toplanan) sekmeli (tab) bir yapıda görür.
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Kasa & Tahsilat'),
          bottom: TabBar(
            labelColor: isDark ? Colors.white : Colors.black,
            unselectedLabelColor: Colors.grey,
            indicatorColor: isDark ? Colors.tealAccent : Colors.teal,
            tabs: const [
              Tab(text: 'Kendi Cüzdanım', icon: Icon(Icons.wallet_outlined)),
              Tab(text: 'Personel Kasası (Admin)', icon: Icon(Icons.account_balance_wallet)),
            ],
          ),
          backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        ),
        body: TabBarView(
          children: [
            // Kendi cüzdanı (appbar'ı gizlenmiş olarak yükleyeceğiz, o yüzden isEmbedded = true)
            CashDrawerScreen(kermesId: kermesId, staffId: staffId, isEmbedded: true),
            // Admin kasası (appbar'ı gizli olmalı)
            const KermesAdminVaultScreen(isEmbedded: true),
          ],
        ),
      ),
    );
  }
}
