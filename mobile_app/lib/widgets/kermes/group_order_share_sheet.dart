import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

/// WhatsApp / Link Kopyala paylaşım modal'ı
class GroupOrderShareSheet extends StatefulWidget {
  final String orderId;
  final String kermesName;
  final String hostName;
  final int expirationMinutes;
  final DateTime expiresAt;

  const GroupOrderShareSheet({
    super.key,
    required this.orderId,
    required this.kermesName,
    required this.hostName,
    required this.expirationMinutes,
    required this.expiresAt,
  });

  @override
  State<GroupOrderShareSheet> createState() => _GroupOrderShareSheetState();
}

class _GroupOrderShareSheetState extends State<GroupOrderShareSheet> {
  bool _linkCopied = false;
  bool _whatsappOpening = false;

  String get shareLink => 'https://lokma.shop/group/${widget.orderId}';

  String get shareMessage =>
      '🍽️ Ailecek Sipariş - ${widget.kermesName}\n\n'
      '${widget.hostName} sizi grup siparişine davet ediyor!\n\n'
      '⏰ Süre: ${widget.expirationMinutes} dakika\n'
      '📱 Katıl: $shareLink';

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
        // Bilgilendirme mesajı göster
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.info_outline, color: Colors.white, size: 20),
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
          const SnackBar(
            content: Text('WhatsApp açılamadı. Link panoya kopyalandı.'),
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
      setState(() => _linkCopied = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text('Link kopyalandı!'),
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
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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

          // Success Icon
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.check_circle,
              size: 40,
              color: Colors.green.shade600,
            ),
          ),
          const SizedBox(height: 16),

          // Title
          const Text(
            'Grup Siparişi Oluşturuldu!',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),

          // Timer Info
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.timer,
                  size: 16,
                  color: Colors.amber.shade700,
                ),
                const SizedBox(width: 4),
                Text(
                  '${widget.expirationMinutes} dakika süreniz var',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.amber.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Link Preview
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.link,
                  color: Colors.grey.shade600,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    shareLink,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade700,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                // Kopyalandı göstergesi veya kopyala butonu
                if (_linkCopied)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check, color: Colors.green.shade600, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          'Kopyalandı',
                          style: TextStyle(fontSize: 12, color: Colors.green.shade600),
                        ),
                      ],
                    ),
                  )
                else
                  IconButton(
                    onPressed: _copyLink,
                    icon: Icon(
                      Icons.copy,
                      color: Colors.grey.shade600,
                      size: 20,
                    ),
                    tooltip: 'Kopyala',
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

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
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Icon(Icons.message, size: 20),
                  label: Text(_whatsappOpening ? 'Açılıyor...' : 'WhatsApp ile Paylaş'),
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
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
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
