import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'delivery_type_dialog.dart';

/// Siparis baslangic popup sonucu
class OrderSetupResult {
  final DeliveryType deliveryType;
  final bool isGroupOrder;

  const OrderSetupResult({
    required this.deliveryType,
    required this.isGroupOrder,
  });
}

/// Siparis baslamadan once kullaniciya teslimat turu ve bireysel/grup secimini soran popup.
/// Ilk urun sepete eklenirken otomatik olarak gosterilir.
class OrderSetupDialog extends StatefulWidget {
  final String kermesName;
  final bool hasDineIn;
  final bool hasTakeaway;
  final bool hasDelivery;

  const OrderSetupDialog({
    super.key,
    required this.kermesName,
    this.hasDineIn = true,
    this.hasTakeaway = true,
    this.hasDelivery = true,
  });

  @override
  State<OrderSetupDialog> createState() => _OrderSetupDialogState();
}

class _OrderSetupDialogState extends State<OrderSetupDialog> with SingleTickerProviderStateMixin {
  DeliveryType? _selectedDelivery;
  bool _isGroupOrder = false;
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _scaleAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutBack,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lokmaPink = const Color(0xFFE50D6B);

    return ScaleTransition(
      scale: _scaleAnimation,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.25),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [lokmaPink, lokmaPink.withOpacity(0.85)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(24),
                    topRight: Radius.circular(24),
                  ),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.restaurant_menu, color: Colors.white, size: 36),
                    const SizedBox(height: 10),
                    const Text(
                      'Siparisinizi Nasil Vermek Istersiniz?',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.kermesName,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // -- ADIM 1: Teslimat Turu --
                    Text(
                      'Teslimat Turu',
                      style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black54,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
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

                    if (widget.hasDineIn) const SizedBox(height: 8),

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

                    const SizedBox(height: 18),

                    // -- ADIM 2: Bireysel / Grup --
                    Text(
                      'Siparis Tipi',
                      style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black54,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
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
                  ],
                ),
              ),

              // Butonlar
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: Row(
                  children: [
                    // Iptal
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(context, null),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
                          ),
                        ),
                        child: Text(
                          'Vazgec',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Devam Et
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: _selectedDelivery != null ? () {
                          HapticFeedback.mediumImpact();
                          Navigator.pop(context, OrderSetupResult(
                            deliveryType: _selectedDelivery!,
                            isGroupOrder: _isGroupOrder,
                          ));
                        } : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: lokmaPink,
                          disabledBackgroundColor: isDark ? Colors.grey[700] : Colors.grey[300],
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 2,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Siparise Basla',
                              style: TextStyle(
                                color: _selectedDelivery != null ? Colors.white : (isDark ? Colors.grey[500] : Colors.grey[600]),
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Icon(
                              Icons.arrow_forward,
                              size: 18,
                              color: _selectedDelivery != null ? Colors.white : (isDark ? Colors.grey[500] : Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
        setState(() => _selectedDelivery = type);
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
