import 'package:flutter/material.dart';
import '../widgets/wallet_business_card.dart';

class KermesScreen extends StatelessWidget {
  const KermesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Dummy data for visual verification of wallet card in Kermes
    final Map<String, dynamic> dummyKermesData1 = {
      'businessName': 'Büyük Bahar Kermesi',
      'brandLabel': 'TUNA',
      'rating': 4.9,
      'reviewCount': 120,
    };

    final Map<String, dynamic> dummyKermesData2 = {
      'businessName': 'Okul Aile Birliği Kermesi',
      'rating': 4.5,
      'reviewCount': 45,
    };

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF1C1B18) : const Color(0xFFE8E8EC),
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
        title: Row(
          children: [
            const Text('🎪 ', style: TextStyle(fontSize: 24)),
            Text('Kermes', style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.w600,
            )),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          WalletBusinessCard(
            data: dummyKermesData1,
            id: 'dummy_kermes_1',
            name: 'Büyük Bahar Kermesi',
            logoUrl: null,
            imageUrl: 'https://images.unsplash.com/photo-1533174000255-83f5c9077e68?q=80&w=2070&auto=format&fit=crop',
            isAvailable: true,
            unavailableReason: 'Şu an kapalı',
            isTunaPartner: true,
            deliveryMode: 'al-gotur',
            rating: 4.9,
            reviewText: '(120)',
            typeLabel: 'Etkinlik',
            cuisineType: 'Kermes',
            distance: 2.4,
            onTap: () {},
            showClosedDialog: (ctx, name, reason, data) {},
          ),
          WalletBusinessCard(
            data: dummyKermesData2,
            id: 'dummy_kermes_2',
            name: 'Okul Aile Birliği Kermesi',
            logoUrl: null,
            imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1974&auto=format&fit=crop',
            isAvailable: false,
            unavailableReason: 'Kermes 15 Mayıs\'ta Başlayacak (Ön Sipariş Aktif)',
            isTunaPartner: false,
            deliveryMode: 'al-gotur',
            rating: 4.5,
            reviewText: '(45)',
            typeLabel: 'Etkinlik',
            cuisineType: 'Okul',
            distance: 5.1,
            onTap: () {},
            showClosedDialog: (ctx, name, reason, data) {},
          ),
        ],
      ),
    );
  }
}
