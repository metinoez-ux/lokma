import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Kermes QR Scanner - Bottom sheet olarak acilir
/// Okutunca otomatik algilar:
/// - Grup siparisi QR kodu ise gruba katilim baslatir
/// - Masa QR kodu ise masa siparisini baslatir
class KermesQrScannerSheet extends StatefulWidget {
  const KermesQrScannerSheet({super.key});

  @override
  State<KermesQrScannerSheet> createState() => _KermesQrScannerSheetState();
}

class _KermesQrScannerSheetState extends State<KermesQrScannerSheet> {
  bool _isScanned = false;
  static const Color lokmaPink = Color(0xFFF41C54);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenHeight = MediaQuery.of(context).size.height;

    return FractionallySizedBox(
      heightFactor: 0.85,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Baslik
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Row(
              children: [
                Icon(Icons.qr_code_scanner_rounded, color: lokmaPink, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'QR Kod Okut',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Grup veya masa QR kodunu okutun, otomatik alglanir',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withOpacity(0.08)
                          : Colors.grey.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.close, size: 18,
                        color: isDark ? Colors.white70 : Colors.grey[600]),
                  ),
                ),
              ],
            ),
          ),

          // Kamera alani
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  children: [
                    MobileScanner(
                      onDetect: (capture) {
                        if (_isScanned) return;
                        final List<Barcode> barcodes = capture.barcodes;
                        for (final barcode in barcodes) {
                          if (barcode.rawValue != null) {
                            _isScanned = true;
                            HapticFeedback.mediumImpact();
                            Navigator.pop(context, barcode.rawValue);
                            break;
                          }
                        }
                      },
                    ),
                    // Scanner frame overlay
                    Center(
                      child: Container(
                        width: 220,
                        height: 220,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: lokmaPink.withOpacity(0.7),
                            width: 2.5,
                          ),
                        ),
                      ),
                    ),
                    // Alt bilgi
                    Positioned(
                      bottom: 20,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.6),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'Kamerayi QR koda yoneltin',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),
        ],
      ),
    ));
  }
}
