import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'delivery_type_dialog.dart';

/// Siparis baslangic bottom sheet sonucu
class OrderSetupResult {
  final DeliveryType deliveryType;
  final bool isGroupOrder;
  final String? tableNo;
  final String? sectionId;

  const OrderSetupResult({
    required this.deliveryType,
    required this.isGroupOrder,
    this.tableNo,
    this.sectionId,
  });
}

/// Siparis baslamadan once kullaniciya teslimat turu ve bireysel/grup secimini soran bottom sheet.
/// Ilk urun sepete eklenirken otomatik olarak gosterilir.
class OrderSetupBottomSheet extends StatefulWidget {
  final String kermesName;
  final bool hasDineIn;
  final bool hasTakeaway;
  final bool hasDelivery;
  /// QR taramayi tetiklemek icin Navigator.push yapacak callback
  final Future<String?> Function(BuildContext context)? onScanQR;
  /// Deep link / QR'dan onceden bilinen teslimat turu
  final DeliveryType? preSelectedDelivery;
  /// Deep link / QR'dan onceden bilinen masa numarasi
  final String? preSelectedTable;

  const OrderSetupBottomSheet({
    super.key,
    required this.kermesName,
    this.hasDineIn = true,
    this.hasTakeaway = true,
    this.hasDelivery = true,
    this.onScanQR,
    this.preSelectedDelivery,
    this.preSelectedTable,
  });

  @override
  State<OrderSetupBottomSheet> createState() => _OrderSetupBottomSheetState();
}

class _OrderSetupBottomSheetState extends State<OrderSetupBottomSheet> {
  DeliveryType? _selectedDelivery;
  bool _isGroupOrder = false;
  String? _scannedTable;
  String? _scannedSectionId;
  final _manualTableController = TextEditingController();
  bool _showManualInput = false;

  /// QR deep link'ten gelen onceden belirli degerler var mi?
  bool get _isPreSelected => widget.preSelectedDelivery != null;

  @override
  void initState() {
    super.initState();
    // QR deep link'ten gelen degerler varsa hemen ata
    if (widget.preSelectedDelivery != null) {
      _selectedDelivery = widget.preSelectedDelivery;
    }
    if (widget.preSelectedTable != null) {
      _scannedTable = widget.preSelectedTable;
    }
  }

  @override
  void dispose() {
    _manualTableController.dispose();
    super.dispose();
  }

  String? get _effectiveTable {
    if (_scannedTable != null && _scannedTable!.isNotEmpty) return _scannedTable;
    final manual = _manualTableController.text.trim();
    if (manual.isNotEmpty) return manual;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lokmaPink = const Color(0xFFE50D6B);
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[700] : Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 4),
            child: Column(
              children: [
                Icon(Icons.restaurant_menu, color: lokmaPink, size: 32),
                const SizedBox(height: 10),
                Text(
                  _isPreSelected
                      ? 'Masaniz hazir! Siparis tipini secin.'
                      : 'Siparisinizi Nasil Vermek Istersiniz?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.kermesName,
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),

          // Scrollable content
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 16, 20, bottomPadding + 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // QR deep link'ten gelen onceden bilinen degerler varsa:
                  // Masa onay karti goster, teslimat secimini gizle
                  if (_isPreSelected && _scannedTable != null) ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.green.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44, height: 44,
                            decoration: BoxDecoration(
                              color: Colors.green.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.table_restaurant, color: Colors.green, size: 24),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Masaya Servis', style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                  fontSize: 15, fontWeight: FontWeight.w600,
                                )),
                                const SizedBox(height: 2),
                                Text('Masa $_scannedTable', style: TextStyle(
                                  color: Colors.green[700],
                                  fontSize: 13, fontWeight: FontWeight.w500,
                                )),
                              ],
                            ),
                          ),
                          const Icon(Icons.check_circle, color: Colors.green, size: 24),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Normal akis: teslimat turu secimi
                  if (!_isPreSelected) ...[
                  // -- ADIM 1: Teslimat Turu --
                  Text(
                    'TESLIMAT TURU',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.black45,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Gel Al
                  if (widget.hasTakeaway)
                    _buildDeliveryOption(
                      icon: Icons.shopping_bag_outlined,
                      iconColor: Colors.green,
                      title: 'Gel Al',
                      subtitle: 'Siparisi stanttan alin',
                      type: DeliveryType.gelAl,
                      isDark: isDark,
                      lokmaPink: lokmaPink,
                    ),

                  if (widget.hasTakeaway) const SizedBox(height: 8),

                  // Masaya Servis
                  if (widget.hasDineIn)
                    _buildDeliveryOption(
                      icon: Icons.table_restaurant_outlined,
                      iconColor: Colors.blue,
                      title: 'Masaya Servis',
                      subtitle: 'Masaniza getirelim',
                      type: DeliveryType.masada,
                      isDark: isDark,
                      lokmaPink: lokmaPink,
                    ),

                  // Masaya Servis secildiginde: QR kod okutma + masa bilgisi
                  if (_selectedDelivery == DeliveryType.masada) ...[
                    const SizedBox(height: 12),

                    // Masa bilgisi zaten tarandiysa: ozet goster
                    if (_scannedTable != null && _scannedTable!.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.green.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle, color: Colors.green, size: 22),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Masa $_scannedTable',
                                style: TextStyle(
                                  color: Colors.green[700],
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                setState(() {
                                  _scannedTable = null;
                                  _scannedSectionId = null;
                                });
                              },
                              child: Text('Degistir', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600], fontSize: 13)),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      // QR Okut butonu
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () async {
                            if (widget.onScanQR != null) {
                              final qrResult = await widget.onScanQR!(context);
                              if (qrResult != null && qrResult.isNotEmpty) {
                                _parseQRResult(qrResult);
                              }
                            }
                          },
                          icon: const Icon(Icons.qr_code_scanner, size: 20),
                          label: const Text('Masa QR Kodunu Okut'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.purple,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Manuel masa girisi linki
                      if (!_showManualInput)
                        Center(
                          child: GestureDetector(
                            onTap: () => setState(() => _showManualInput = true),
                            child: Text(
                              'QR kod yok mu? Masa numarasini girin',
                              style: TextStyle(
                                color: isDark ? Colors.grey[400] : Colors.grey[500],
                                fontSize: 12,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ),

                      // Manuel masa no girisi
                      if (_showManualInput) ...[
                        const SizedBox(height: 4),
                        TextField(
                          controller: _manualTableController,
                          keyboardType: TextInputType.text,
                          style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 15),
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: 'Masa No (orn: 5, A3)',
                            hintStyle: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400]),
                            prefixIcon: const Icon(Icons.tag, size: 18, color: Color(0xFFE50D6B)),
                            filled: true,
                            fillColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE50D6B), width: 1.5)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                        ),
                      ],
                    ],
                  ],

                  if (widget.hasDineIn && _selectedDelivery != DeliveryType.masada) const SizedBox(height: 8),

                  // Kurye
                  if (widget.hasDelivery)
                    _buildDeliveryOption(
                      icon: Icons.delivery_dining_outlined,
                      iconColor: Colors.orange,
                      title: 'Kurye ile Teslimat',
                      subtitle: 'Adresinize getirelim',
                      type: DeliveryType.kurye,
                      isDark: isDark,
                      lokmaPink: lokmaPink,
                    ),
                  ], // !_isPreSelected sonu

                  const SizedBox(height: 20),

                  // -- ADIM 2: Bireysel / Grup --
                  Text(
                    'SIPARIS TIPI',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.black45,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Bireysel / Grup Toggle
                  Container(
                    height: 48,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _isGroupOrder = false);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              height: double.infinity,
                              decoration: BoxDecoration(
                                color: !_isGroupOrder ? lokmaPink : Colors.transparent,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: !_isGroupOrder ? [
                                  BoxShadow(color: lokmaPink.withOpacity(0.3), blurRadius: 6, offset: const Offset(0, 2)),
                                ] : [],
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.person, size: 18,
                                    color: !_isGroupOrder ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                  ),
                                  const SizedBox(width: 6),
                                  Text('Bireysel', style: TextStyle(
                                    color: !_isGroupOrder ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                    fontWeight: FontWeight.w600, fontSize: 14,
                                  )),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _isGroupOrder = true);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              height: double.infinity,
                              decoration: BoxDecoration(
                                color: _isGroupOrder ? lokmaPink : Colors.transparent,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: _isGroupOrder ? [
                                  BoxShadow(color: lokmaPink.withOpacity(0.3), blurRadius: 6, offset: const Offset(0, 2)),
                                ] : [],
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.group, size: 18,
                                    color: _isGroupOrder ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                  ),
                                  const SizedBox(width: 6),
                                  Text('Grup / Aile', style: TextStyle(
                                    color: _isGroupOrder ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                    fontWeight: FontWeight.w600, fontSize: 14,
                                  )),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Grup secildiginde aciklayici bilgi
                  if (_isGroupOrder) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.blue.withOpacity(0.12) : Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isDark ? Colors.blue.withOpacity(0.3) : Colors.blue.shade200,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline, size: 18,
                            color: isDark ? Colors.blue[300] : Colors.blue[700],
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _selectedDelivery == DeliveryType.masada
                                  ? 'Masadaki QR kodu okutarak veya link paylasarak grup siparisine davet edin. Herkes kendi urununu eklesin!'
                                  : 'Link paylasarak yakinlarinizi ayni siparise davet edin. Herkes kendi urununu eklesin, tek seferde siparis verin!',
                              style: TextStyle(
                                color: isDark ? Colors.blue[200] : Colors.blue[800],
                                fontSize: 12,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Siparise Basla butonu
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _canStart ? () {
                        HapticFeedback.mediumImpact();
                        Navigator.pop(context, OrderSetupResult(
                          deliveryType: _selectedDelivery!,
                          isGroupOrder: _isGroupOrder,
                          tableNo: _effectiveTable,
                          sectionId: _scannedSectionId,
                        ));
                      } : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: lokmaPink,
                        disabledBackgroundColor: isDark ? Colors.grey[700] : Colors.grey[300],
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 2,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Siparise Basla',
                            style: TextStyle(
                              color: _canStart ? Colors.white : (isDark ? Colors.grey[500] : Colors.grey[600]),
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            Icons.arrow_forward,
                            size: 20,
                            color: _canStart ? Colors.white : (isDark ? Colors.grey[500] : Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool get _canStart {
    if (_selectedDelivery == null) return false;
    // Masaya Servis icin masa bilgisi zorunlu degil - checkout'ta da girilebilir
    return true;
  }

  void _parseQRResult(String result) {
    try {
      final uri = Uri.parse(result);
      if (uri.pathSegments.contains('table')) {
        final tableIndex = uri.pathSegments.indexOf('table');
        if (tableIndex + 1 < uri.pathSegments.length) {
          final tableLabel = uri.pathSegments[tableIndex + 1];
          final section = uri.queryParameters['section'];
          setState(() {
            _scannedTable = tableLabel;
            if (section != null && section.isNotEmpty) {
              _scannedSectionId = section;
            }
          });
        }
      } else {
        // Basit QR: duz metin olarak masa numarasi
        setState(() {
          _scannedTable = result.trim();
        });
      }
    } catch (e) {
      // Parse hatasinsa duz metin olarak al
      setState(() {
        _scannedTable = result.trim();
      });
    }
  }

  Widget _buildDeliveryOption({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required DeliveryType type,
    required bool isDark,
    required Color lokmaPink,
  }) {
    final isSelected = _selectedDelivery == type;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() {
          _selectedDelivery = type;
          // Masaya Servis'ten baska bir sey secilince masa bilgisini temizle
          if (type != DeliveryType.masada) {
            _scannedTable = null;
            _scannedSectionId = null;
            _manualTableController.clear();
            _showManualInput = false;
          }
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? lokmaPink.withOpacity(0.15) : lokmaPink.withOpacity(0.08))
              : (isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade50),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? lokmaPink : (isDark ? Colors.grey[700]! : Colors.grey.shade200),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isSelected
                    ? lokmaPink.withOpacity(0.15)
                    : iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                color: isSelected ? lokmaPink : iconColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  )),
                  const SizedBox(height: 2),
                  Text(subtitle, style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontSize: 12,
                  )),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? lokmaPink : Colors.transparent,
                border: Border.all(
                  color: isSelected ? lokmaPink : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
