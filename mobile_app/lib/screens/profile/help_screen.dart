import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  static const Color lokmaRed = Color(0xFFEA184A);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF000000) : const Color(0xFFF5F5F5);
    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey.shade600;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey.shade200;

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: scaffoldBg,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(tr('profile.help'), style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Logo and Title
          Center(
            child: Column(
              children: [
                Image.asset(
                  isDark
                      ? 'assets/images/logo_lokma_white.png'
                      : 'assets/images/logo_lokma_red.png',
                  height: 40,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Text(
                    'LOKMA',
                    style: TextStyle(
                      color: isDark ? Colors.white : lokmaRed,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  tr('profile.faq'),
                  style: TextStyle(color: textPrimary, fontSize: 20, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // FAQ Items
          _FAQItem(
            question: tr('profile.faq_what_is_lokma'),
            answer: tr('profile.faq_what_is_lokma_answer'),
          ),
          _FAQItem(
            question: tr('profile.faq_how_to_order'),
            answer: tr('profile.faq_how_to_order_answer'),
          ),
          _FAQItem(
            question: tr('profile.faq_delivery_time'),
            answer: tr('profile.faq_delivery_time_answer'),
          ),
          _FAQItem(
            question: tr('profile.faq_payment'),
            answer: tr('profile.faq_payment_answer'),
          ),
          _FAQItem(
            question: tr('profile.faq_cancel_order'),
            answer: tr('profile.faq_cancel_order_answer'),
          ),
          _FAQItem(
            question: tr('profile.faq_minimum_order'),
            answer: tr('profile.faq_minimum_order_answer'),
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
                Icon(Icons.support_agent, color: isDark ? Colors.grey[400] : Colors.grey[700], size: 40),
                const SizedBox(height: 12),
                Text(
                  tr('profile.need_help'),
                  style: TextStyle(color: textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  tr('profile.contact_us'),
                  style: TextStyle(color: textSubtle, fontSize: 14),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Clipboard.setData(const ClipboardData(text: 'info@lokma.shop'));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(tr('common.email_copied')), backgroundColor: Colors.green),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: lokmaRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.email, color: lokmaRed, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'info@lokma.shop',
                          style: TextStyle(color: lokmaRed, fontWeight: FontWeight.w600),
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

  static const Color lokmaRed = Color(0xFFEA184A);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey.shade600;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey.shade200;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _isExpanded ? lokmaRed.withValues(alpha: 0.5) : borderSubtle),
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
                      style: TextStyle(
                        color: textPrimary,
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
