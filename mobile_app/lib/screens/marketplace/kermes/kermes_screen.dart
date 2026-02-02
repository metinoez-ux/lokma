import 'package:flutter/material.dart';

class KermesScreen extends StatelessWidget {
  const KermesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Row(
          children: [
            Text('🎪 ', style: TextStyle(fontSize: 24)),
            Text('Kermes', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
      body: const Center(
        child: Text(
          'Kermes etkinlikleri\nStantlar & ön sipariş',
          style: TextStyle(color: Colors.grey),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
