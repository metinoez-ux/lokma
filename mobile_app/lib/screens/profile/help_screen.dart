import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  static const Color lokmaRed = Color(0xFFEC131E);
  static const Color blackPure = Color(0xFF000000);
  static const Color surfaceCard = Color(0xFF181818);
  static const Color textSubtle = Color(0xFF888888);
  static const Color borderSubtle = Color(0xFF262626);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: blackPure,
      appBar: AppBar(
        backgroundColor: blackPure,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Yardım', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Logo and Title
          Center(
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset(
                    'assets/images/lokma_logo.png',
                    height: 80,
                    width: 80,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 80,
                      width: 80,
                      decoration: BoxDecoration(
                        color: lokmaRed,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Center(
                        child: Text('🍕', style: TextStyle(fontSize: 36)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Sıkça Sorulan Sorular',
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // FAQ Items
          _FAQItem(
            question: 'LOKMA Nedir?',
            answer: 'LOKMA, yerel kasap, restoran ve marketlerden online sipariş verebileceğiniz bir platformdur. Taze et, ev yemekleri ve market ürünlerini kapınıza kadar getiriyoruz.',
          ),
          _FAQItem(
            question: 'Nasıl Sipariş Veririm?',
            answer: 'Ana sayfadan bir kategori seçin (Kasap, Market, Restoran vb.), istediğiniz işletmeyi seçin, ürünleri sepete ekleyin ve ödeme adımına geçin.',
          ),
          _FAQItem(
            question: 'Teslimat Süresi Nedir?',
            answer: 'Teslimat süresi işletmeye ve konumunuza göre değişir. Genellikle 30-60 dakika içinde siparişiniz teslim edilir.',
          ),
          _FAQItem(
            question: 'Ödeme Nasıl Yapılır?',
            answer: 'Kapıda nakit ödeme veya kart ile ödeme yapabilirsiniz. Ödeme tercihlerinizi Profil > Ödeme Yöntemleri bölümünden değiştirebilirsiniz.',
          ),
          _FAQItem(
            question: 'Siparişimi İptal Edebilir Miyim?',
            answer: 'Siparişiniz hazırlanmaya başlamadan önce iptal edebilirsiniz. Bunun için Siparişlerim sayfasından ilgili siparişi açın ve "İptal Et" butonuna tıklayın.',
          ),
          _FAQItem(
            question: 'Minimum Sipariş Tutarı Var Mı?',
            answer: 'Minimum sipariş tutarı işletmeden işletmeye değişiklik gösterebilir. Her işletmenin detay sayfasında bu bilgiyi görebilirsiniz.',
          ),

          const SizedBox(height: 32),

          // Contact Section
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: surfaceCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderSubtle),
            ),
            child: Column(
              children: [
                const Icon(Icons.support_agent, color: lokmaRed, size: 40),
                const SizedBox(height: 12),
                const Text(
                  'Yardıma mı ihtiyacınız var?',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Bize ulaşmak için:',
                  style: TextStyle(color: textSubtle, fontSize: 14),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Clipboard.setData(const ClipboardData(text: 'info@lokma.shop'));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('E-posta kopyalandı'), backgroundColor: Colors.green),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: lokmaRed.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.email, color: lokmaRed, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'info@lokma.shop',
                          style: TextStyle(color: lokmaRed, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _FAQItem extends StatefulWidget {
  final String question;
  final String answer;

  const _FAQItem({required this.question, required this.answer});

  @override
  State<_FAQItem> createState() => _FAQItemState();
}

class _FAQItemState extends State<_FAQItem> {
  bool _isExpanded = false;

  static const Color lokmaRed = Color(0xFFEC131E);
  static const Color surfaceCard = Color(0xFF181818);
  static const Color textSubtle = Color(0xFF888888);
  static const Color borderSubtle = Color(0xFF262626);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _isExpanded ? lokmaRed.withOpacity(0.5) : borderSubtle),
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _isExpanded = !_isExpanded);
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.question,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.keyboard_arrow_down,
                      color: _isExpanded ? lokmaRed : textSubtle,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Container(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                widget.answer,
                style: TextStyle(color: textSubtle, fontSize: 14, height: 1.5),
              ),
            ),
            crossFadeState: _isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }
}
