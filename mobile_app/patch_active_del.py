import re

def patch_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Import the proof_of_delivery_sheet.dart
    if "import 'proof_of_delivery_sheet.dart';" not in content:
        content = content.replace("import '../../services/chat_service.dart';", "import '../../services/chat_service.dart';\nimport 'proof_of_delivery_sheet.dart';")

    old_pod = """    // Complete delivery with PoD option
    final confirmPhoto = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Teslimat Kanıtı (PoD)'),
        content: const Text('Teslimatı tamamlamak için kanıt fotoğrafı çekmek ister misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hayır, Atla')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Evet, Fotoğraf Çek', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    String? photoUrl;
    if (confirmPhoto == true) {
      photoUrl = await _captureProofPhoto();
    }

    await _orderService.completeDeliveryWithProof(
      widget.orderId,
      deliveryType: orderSnapshot.orderType.name ?? 'delivery',
      proofPhotoUrl: photoUrl,
    );"""

    new_pod = """    // Complete delivery with PoD option via Bottom Sheet
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ProofOfDeliverySheet(orderId: widget.orderId),
    );

    if (result == null) return; // User cancelled

    final deliveryType = result['deliveryType'] as String;
    final photoUrl = result['photoUrl'] as String?;

    await _orderService.completeDeliveryWithProof(
      widget.orderId,
      deliveryType: deliveryType,
      proofPhotoUrl: photoUrl,
    );"""

    content = content.replace(old_pod, new_pod)
    
    with open(filepath, "w") as f:
        f.write(content)

patch_file("lib/screens/driver/active_delivery_screen.dart")
