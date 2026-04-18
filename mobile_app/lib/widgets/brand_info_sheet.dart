import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/user_location_provider.dart';

class BrandInfoSheet extends ConsumerWidget {
  final String? forcedBrand;
  const BrandInfoSheet({super.key, this.forcedBrand});

  static void show(BuildContext context, {String? forcedBrand}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) => BrandInfoSheet(forcedBrand: forcedBrand),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userLocation = ref.watch(userLocationProvider).value;
    
    // Determine which brand to show based on forced override OR user's location
    bool isTurkeyRegion = false;
    if (forcedBrand == 'toros') {
      isTurkeyRegion = true;
    } else if (forcedBrand == 'tuna') {
      isTurkeyRegion = false;
    } else {
      isTurkeyRegion = userLocation?.isTurkeyRegion == true;
    }
    
    final brandColor = isTurkeyRegion ? const Color(0xFF69B445) : const Color(0xFF9F1C20); 
    final brandWebsite = isTurkeyRegion ? 'https://akdeniztoros.com.tr/blog/' : 'https://tunafood.com';
    final logoAsset = isTurkeyRegion ? 'assets/images/akdeniz_toros_logo_pill.png' : 'assets/images/tuna_logo_pill.png';
    final prefix = isTurkeyRegion ? 'toros' : 'tuna';
    final brandFallback = isTurkeyRegion ? 'AKDENİZ TOROS' : 'TUNA';
    final legalEntityName = isTurkeyRegion ? 'Akdeniz Toros' : 'TUNA FOOD GmbH';
    final fallbackFontSize = isTurkeyRegion ? 32.0 : 55.0;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // 1. Red/Green Brand Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
              decoration: BoxDecoration(
                color: brandColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Container(
                    width: 40, height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                  ),
                  Image.asset(
                    logoAsset, 
                    height: 85, 
                    errorBuilder: (_,__,___) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(40),
                      ),
                      child: Text(
                        brandFallback, 
                        style: TextStyle(fontFamily: 'Cursive', fontSize: fallbackFontSize, color: brandColor, fontWeight: FontWeight.w800)
                      )
                    )
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'marketplace.${prefix}_subtitle'.tr(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            
             Expanded(
              child: isTurkeyRegion
                  ? _buildTorosContent(controller, brandWebsite, legalEntityName)
                  : _buildTunaContent(controller, prefix, brandWebsite, legalEntityName),
             ),
           ],
         ),
       ),
     );
   }

  Widget _buildTorosContent(ScrollController controller, String brandWebsite, String legalEntityName) {
    return ListView(
      controller: controller,
      padding: const EdgeInsets.all(24),
      children: [
        // IMPORTANT: DISCLAIMER BOX
        Container(
          margin: const EdgeInsets.only(bottom: 24),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF231414),
            border: Border.all(color: const Color(0xFF4A2A2A)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline, color: Colors.white54, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'marketplace.brand_disclaimer'.tr(namedArgs: {'brandName': legalEntityName}),
                  style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                ),
              ),
            ],
          ),
        ),
        
        const Text(
          "Akdeniz Toros, çiftlikten sofraya %100 helal ve sağlıklı gıda prensibiyle hareket eder.\n\nKırşehir ve Balıkesir yöresinde %100 yerli ve tamamen bitkisel yemle beslenen büyükbaş, ve üretimin her aşamasında denetim altındaki kanatlı etlerimizle; sofralarınıza her zaman sağlıklı ve güvenilir bir lezzet ulaştırıyoruz.",
          style: TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildBrandIconElement(Icons.verified, 'Helal Kesim', Colors.green),
            _buildBrandIconElement(Icons.eco, 'Yerli ve Doğal', Colors.amber),
            _buildBrandIconElement(Icons.health_and_safety, 'Gıda Güvenliği', Colors.amber),
          ],
        ),
        const SizedBox(height: 32),
        const Text('Neden Akdeniz Toros?', style: TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _buildCheckItem('Helal ve Sağlıklı', 'Besmele ile uzman kasaplar tarafından, İslami usullere tamamen uygun kesim güvencesi.'),
        _buildCheckItem('Yerli ve Bitkisel Besi', 'Hayvanlarımız doğal yöre çiftliklerinde sadece %100 bitkisel yemlerle sağlığa uygun yetiştirilir.'),
        _buildCheckItem('Sağlıklı Üretim Süreci', 'Üretimin her adımında gıda mühendisleri ve mikrobiyologlar tarafından çok sıkı güvenlik denetimi.'),
        _buildCheckItem('Çocuk Gelişimi İçin Protein', 'Zengin vitamin ve minerale sahip, yüksek besin değerli ürünlerle çocuklarınız için güvenli tüketim.'),
        const SizedBox(height: 24),
        Center(
          child: TextButton.icon(
            onPressed: () async {
              final uri = Uri.parse(brandWebsite);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            icon: const Icon(Icons.open_in_new, color: Colors.blueAccent, size: 16),
            label: const Text(
              'Akdeniz Toros Hakkında Daha Fazla Bilgi',
              style: TextStyle(
                color: Colors.blueAccent, 
                fontSize: 14,
                decoration: TextDecoration.underline,
                decorationColor: Colors.blueAccent,
              ),
            ),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildTunaContent(ScrollController controller, String prefix, String brandWebsite, String legalEntityName) {
    return ListView(
      controller: controller,
      padding: const EdgeInsets.all(24),
      children: [
        // IMPORTANT: DISCLAIMER BOX
        Container(
          margin: const EdgeInsets.only(bottom: 24),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF231414),
            border: Border.all(color: const Color(0xFF4A2A2A)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline, color: Colors.white54, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'marketplace.brand_disclaimer'.tr(namedArgs: {'brandName': legalEntityName}),
                  style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                ),
              ),
            ],
          ),
        ),
        
        // Intro Text
        Text(
          '${'marketplace.${prefix}_description_1'.tr()}\n\n${'marketplace.${prefix}_description_2'.tr()}',
          style: const TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
        ),
        const SizedBox(height: 24),
        
        // Icons Row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildBrandIconElement(Icons.verified, 'marketplace.helal_kesim'.tr(), Colors.green),
            _buildBrandIconElement(Icons.bolt, 'marketplace.soksuz_kesim'.tr(), Colors.amber),
            _buildBrandIconElement(Icons.clean_hands, 'marketplace.kuru_yolum'.tr(), Colors.amber),
          ],
        ),
        const SizedBox(height: 32),
        
        // Standards List
        Text('marketplace.supply_standards'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _buildCheckItem('marketplace.helal_kesim'.tr(), 'marketplace.helal_kesim_desc'.tr()),
        _buildCheckItem('marketplace.elle_kesim'.tr(), 'marketplace.elle_kesim_desc'.tr()),
        _buildCheckItem('marketplace.soksuz_kesim'.tr(), 'marketplace.soksuz_kesim_desc'.tr()),
        _buildCheckItem('marketplace.kuru_yolum'.tr(), 'marketplace.kuru_yolum_desc'.tr()),

        const SizedBox(height: 24),
        
        // Kuru Yolum Info Box
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF2C1B1B), // Dark Reddish Tint
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF4A2A2A)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.amber[800], size: 20),
                  const SizedBox(width: 8),
                  Text('${'marketplace.kuru_yolum'.tr()}?', style: TextStyle(color: Colors.amber[800], fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'marketplace.kuru_yolum_full_desc'.tr(),
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 24),
        Text('marketplace.production_standards'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        _buildCheckItem('marketplace.yuksek_et_orani'.tr(), 'marketplace.yuksek_et_orani_desc'.tr()),
        _buildCheckItem('marketplace.without_e621'.tr(), 'marketplace.no_msg'.tr()),
        _buildCheckItem('marketplace.without_mms'.tr(), 'marketplace.pure_meat'.tr()),
        _buildCheckItem('marketplace.gluten_free'.tr(), 'marketplace.no_wheat'.tr()),
        
        const SizedBox(height: 24),
        Center(
          child: TextButton.icon(
            onPressed: () async {
              final uri = Uri.parse(brandWebsite);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            icon: const Icon(Icons.open_in_new, color: Colors.blueAccent, size: 16),
            label: Text(
              tr('marketplace.brand_more_info'),
              style: const TextStyle(
                color: Colors.blueAccent, 
                fontSize: 14,
                decoration: TextDecoration.underline,
                decorationColor: Colors.blueAccent,
              ),
            ),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildBrandIconElement(IconData icon, String label, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(0.3), width: 2),
          ),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildCheckItem(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Color(0xFFE0E0E0), fontWeight: FontWeight.w600, fontSize: 15)),
                Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
