import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// WhatsApp / Link Kopyala paylaşım modal'ı
class GroupOrderShareSheet extends StatefulWidget {
  final String orderId;
  final String kermesName;
  final String hostName;
  final int expirationMinutes;
  final DateTime expiresAt;
  final String? groupPin;

  const GroupOrderShareSheet({
    super.key,
    required this.orderId,
    required this.kermesName,
    required this.hostName,
    required this.expirationMinutes,
    required this.expiresAt,
    this.groupPin,
  });

  @override
  State<GroupOrderShareSheet> createState() => _GroupOrderShareSheetState();
}

class _GroupOrderShareSheetState extends State<GroupOrderShareSheet> {
  bool _linkCopied = false;
  bool _whatsappOpening = false;

  String get shareLink => 'https://lokma.shop/group/${widget.orderId}';

  String get shareMessage => '${widget.kermesName}\n\n'
      '${widget.hostName} sizi grup siparisine davet ediyor!\n\n'
      'PIN: ${widget.groupPin ?? widget.orderId}\n'
      'Sure: ${widget.expirationMinutes} dakika\n'
      'Katil: $shareLink';

  @override
  void initState() {
    super.initState();
    // Sayfa açıldığında link otomatik olarak panoya kopyalanır
    _autoCopyLink();
  }

  Future<void> _autoCopyLink() async {
    await Clipboard.setData(ClipboardData(text: shareLink));
    if (mounted) {
      setState(() => _linkCopied = true);
    }
  }

  Future<void> _shareViaWhatsApp() async {
    setState(() => _whatsappOpening = true);

    // Önce link'i panoya kopyala (WhatsApp'ta yapıştırabilsin diye)
    await Clipboard.setData(ClipboardData(text: shareLink));

    final whatsappUrl = Uri.parse(
      'https://wa.me/?text=${Uri.encodeComponent(shareMessage)}',
    );

    if (await canLaunchUrl(whatsappUrl)) {
      await launchUrl(whatsappUrl, mode: LaunchMode.externalApplication);
      if (mounted) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        // Bilgilendirme mesajı göster
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.info_outline,
                    color: isDark ? const Color(0xFF1E293B) : Colors.white,
                    size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Link panoya kopyalandı! WhatsApp\'ta yapıştırabilirsiniz.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF25D366),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('kermes.whatsapp_failed_link_copied')),
            backgroundColor: Colors.amber,
          ),
        );
      }
    }

    if (mounted) {
      setState(() => _whatsappOpening = false);
    }
  }

  Future<void> _copyLink() async {
    await Clipboard.setData(ClipboardData(text: shareLink));
    if (mounted) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      setState(() => _linkCopied = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle,
                  color: isDark ? const Color(0xFF1E293B) : Colors.white,
                  size: 20),
              SizedBox(width: 8),
              Text(tr('common.link_copied')),
            ],
          ),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),

          // Title
          const Text(
            'Grup Siparişi Oluşturuldu!',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),

          // Timer Info
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.timer,
                  size: 16,
                  color: Colors.black87,
                ),
                const SizedBox(width: 4),
                Text(
                  '${widget.expirationMinutes} dakika süreniz var',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.black87,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // QR Code for Table Scanning
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  QrImageView(
                    data: shareLink,
                    version: QrVersions.auto,
                    size: 180.0,
                    backgroundColor: Colors.white,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Masadakiler bu kodu okutarak katilabilir',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock, size: 16, color: Colors.black87),
                        const SizedBox(width: 8),
                        Text(
                          'PIN: ${widget.groupPin ?? widget.orderId}',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 6,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Divider text "Veya Link ile Paylaş"
          Row(
            children: [
              Expanded(child: Divider(color: Colors.grey.shade300)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'Veya Uzaktakiler İçin Paylaş',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Expanded(child: Divider(color: Colors.grey.shade300)),
            ],
          ),
          const SizedBox(height: 16),

          // Share Buttons
          Row(
            children: [
              // WhatsApp Button
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _whatsappOpening ? null : _shareViaWhatsApp,
                  icon: _whatsappOpening
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Icon(Icons.message, size: 20),
                  label: Text(
                      _whatsappOpening ? 'Açılıyor...' : 'WhatsApp ile Paylaş'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Copy Button
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _copyLink,
                  icon: Icon(_linkCopied ? Icons.check : Icons.copy, size: 20),
                  label: Text(_linkCopied ? 'Kopyalandı!' : 'Linki Kopyala'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Continue Button
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Siparişe Devam Et',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.black87,
                ),
              ),
            ),
          ),

          // Safe area padding for bottom
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }
}
