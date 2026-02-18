import 'package:flutter/material.dart';

class KermesScreen extends StatelessWidget {
  const KermesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFE8E8EC),
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        title: Row(
          children: [
            const Text('🎪 ', style: TextStyle(fontSize: 24)),
            Text('Kermes', style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.bold,
            )),
          ],
        ),
      ),
      body: Center(
        child: Text(
          'Kermes etkinlikleri\nStantlar & ön sipariş',
          style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
