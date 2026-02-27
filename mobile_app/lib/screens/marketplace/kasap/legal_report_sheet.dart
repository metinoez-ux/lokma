import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Lieferando-style "Rechtliche Bedenken melden" bottom sheet.
///
/// Allows users to report legal/safety concerns about a product or business.
/// Writes to the `legal_reports` Firestore collection.
class LegalReportSheet extends StatefulWidget {
  final String businessId;
  final String businessName;
  final String? productId;
  final String? productName;
  final String? productCategory;

  const LegalReportSheet({
    super.key,
    required this.businessId,
    required this.businessName,
    this.productId,
    this.productName,
    this.productCategory,
  });

  @override
  State<LegalReportSheet> createState() => _LegalReportSheetState();
}

class _LegalReportSheetState extends State<LegalReportSheet> {
  // 🎨 LOKMA brand color
  static const Color _brandColor = Color(0xFFFB335B);
  String? _selectedTopic;
  String? _selectedReason;
  final _descriptionController = TextEditingController();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  bool _confirmed = false;
  bool _sending = false;
  bool _sent = false;

  // Topic keys
  static const _topics = [
    'food_safety',
    'description',
    'images',
    'allergens',
    'forbidden',
    'other',
  ];

  // Reason keys per topic
  static const Map<String, List<String>> _reasonsByTopic = {
    'food_safety': ['counterfeit', 'spoiled', 'contaminated', 'unsafe'],
    'description': ['misleading', 'wrong_price', 'wrong_ingredients'],
    'images': ['wrong_image', 'offensive_image', 'misleading_image'],
    'allergens': ['missing_allergens', 'wrong_allergens'],
    'forbidden': ['illegal_substance', 'restricted_product'],
    'other': ['other_reason'],
  };

  @override
  void initState() {
    super.initState();
    // Pre-fill email if logged in
    final user = FirebaseAuth.instance.currentUser;
    if (user?.email != null) _emailController.text = user!.email!;
    if (user?.displayName != null) _nameController.text = user!.displayName!;
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _selectedTopic != null &&
      _selectedReason != null &&
      _descriptionController.text.trim().isNotEmpty &&
      _nameController.text.trim().isNotEmpty &&
      _emailController.text.trim().isNotEmpty &&
      _confirmed &&
      !_sending;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _sending = true);

    try {
      final docRef = await FirebaseFirestore.instance.collection('legal_reports').add({
        'status': 'new',
        'businessId': widget.businessId,
        'businessName': widget.businessName,
        'productId': widget.productId,
        'productName': widget.productName,
        'category': widget.productCategory,
        'topic': _selectedTopic,
        'reason': _selectedReason,
        'description': _descriptionController.text.trim(),
        'reporterName': _nameController.text.trim(),
        'reporterEmail': _emailController.text.trim(),
        'reporterUserId': FirebaseAuth.instance.currentUser?.uid,
        'confirmed': true,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Send email notification (fire-and-forget)
      try {
        http.post(
          Uri.parse('https://lokma.web.app/api/legal-report'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'reportId': docRef.id,
            'businessName': widget.businessName,
            'productName': widget.productName,
            'topic': _selectedTopic,
            'reason': _selectedReason,
            'description': _descriptionController.text.trim(),
            'reporterName': _nameController.text.trim(),
            'reporterEmail': _emailController.text.trim(),
            'category': widget.productCategory,
          }),
        );
      } catch (_) { /* non-critical */ }

      if (mounted) setState(() => _sent = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('marketplace.legal_report_error'.tr())),
        );
      }
    }

    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white70 : Colors.black54;
    final surfaceColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final chipBg = isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFF5F5F5);

    if (_sent) return _buildSuccess(textPrimary, textSecondary);

    return Container(
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: textSecondary.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.flag_outlined, color: _brandColor, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'marketplace.report_legal_concerns'.tr(),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(Icons.close, color: textSecondary, size: 22),
                ),
              ],
            ),
          ),

          // Context info
          if (widget.productName != null || widget.businessName.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: chipBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.store_outlined, size: 18, color: textSecondary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.businessName,
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: textPrimary),
                        ),
                        if (widget.productName != null)
                          Text(
                            widget.productName!,
                            style: TextStyle(fontSize: 12, color: textSecondary),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 8),

          // Scrollable form
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Topic Dropdown
                  _buildLabel('marketplace.legal_report_topic'.tr(), textPrimary),
                  const SizedBox(height: 6),
                  _buildPicker(
                    value: _selectedTopic != null
                        ? 'marketplace.legal_report_topic_$_selectedTopic'.tr()
                        : null,
                    hint: 'marketplace.legal_report_select_topic'.tr(),
                    options: _topics,
                    labelBuilder: (t) => 'marketplace.legal_report_topic_$t'.tr(),
                    onSelected: (v) => setState(() {
                      _selectedTopic = v;
                      _selectedReason = null;
                    }),
                    textPrimary: textPrimary,
                    chipBg: chipBg,
                    isDark: isDark,
                  ),

                  const SizedBox(height: 16),

                  // Reason Dropdown
                  _buildLabel('marketplace.legal_report_reason'.tr(), textPrimary),
                  const SizedBox(height: 6),
                  _buildPicker(
                    value: _selectedReason != null
                        ? 'marketplace.legal_report_reason_$_selectedReason'.tr()
                        : null,
                    hint: 'marketplace.legal_report_select_reason'.tr(),
                    options: _selectedTopic != null
                        ? _reasonsByTopic[_selectedTopic!] ?? []
                        : <String>[],
                    labelBuilder: (r) => 'marketplace.legal_report_reason_$r'.tr(),
                    onSelected: (v) => setState(() => _selectedReason = v),
                    textPrimary: textPrimary,
                    chipBg: chipBg,
                    isDark: isDark,
                  ),

                  const SizedBox(height: 16),

                  // Description
                  _buildLabel('marketplace.legal_report_description'.tr(), textPrimary),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _descriptionController,
                    minLines: 4,
                    maxLines: 6,
                    maxLength: 500,
                    textInputAction: TextInputAction.done,
                    onChanged: (_) => setState(() {}),
                    style: TextStyle(fontSize: 14, color: textPrimary),
                    decoration: InputDecoration(
                      hintText: 'marketplace.legal_report_description_hint'.tr(),
                      hintStyle: TextStyle(fontSize: 13, color: textSecondary),
                      filled: true,
                      fillColor: chipBg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.all(14),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Name
                  _buildLabel('marketplace.legal_report_name'.tr(), textPrimary),
                  const SizedBox(height: 6),
                  _buildTextField(
                    controller: _nameController,
                    hint: 'marketplace.legal_report_name_hint'.tr(),
                    textPrimary: textPrimary,
                    textSecondary: textSecondary,
                    chipBg: chipBg,
                  ),

                  const SizedBox(height: 12),

                  // Email
                  _buildLabel('marketplace.legal_report_email'.tr(), textPrimary),
                  const SizedBox(height: 6),
                  _buildTextField(
                    controller: _emailController,
                    hint: 'marketplace.legal_report_email_hint'.tr(),
                    keyboardType: TextInputType.emailAddress,
                    textPrimary: textPrimary,
                    textSecondary: textSecondary,
                    chipBg: chipBg,
                  ),

                  const SizedBox(height: 16),

                  // Confirmation checkbox
                  GestureDetector(
                    onTap: () => setState(() => _confirmed = !_confirmed),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 22,
                          height: 22,
                          child: Checkbox(
                            value: _confirmed,
                            onChanged: (v) => setState(() => _confirmed = v ?? false),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                            activeColor: _brandColor,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'marketplace.legal_report_confirm_text'.tr(),
                            style: TextStyle(fontSize: 12, color: textSecondary, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Privacy notice
                  Text(
                    'marketplace.legal_report_privacy'.tr(),
                    style: TextStyle(fontSize: 11, color: textSecondary.withValues(alpha: 0.7), height: 1.4),
                  ),

                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Submit button
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _canSubmit ? _submit : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _brandColor,
                    disabledBackgroundColor: _brandColor.withValues(alpha: 0.3),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          'marketplace.legal_report_submit'.tr(),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess(Color textPrimary, Color textSecondary) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('✅', style: TextStyle(fontSize: 48)),
          const SizedBox(height: 16),
          Text(
            'marketplace.legal_report_success_title'.tr(),
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'marketplace.legal_report_success_body'.tr(),
            style: TextStyle(fontSize: 14, color: textSecondary, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: _brandColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: Text(
                'common.close'.tr(),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildLabel(String text, Color color) {
    return Text(
      text,
      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color),
    );
  }

  /// Picker that opens a bottom sheet instead of overlapping dropdown.
  Widget _buildPicker({
    required String? value,
    required String hint,
    required List<String> options,
    required String Function(String) labelBuilder,
    required ValueChanged<String> onSelected,
    required Color textPrimary,
    required Color chipBg,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: options.isEmpty ? null : () {
        showModalBottomSheet(
          context: context,
          backgroundColor: isDark ? const Color(0xFF2A2A2A) : Colors.white,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          builder: (_) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 16),
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      color: textPrimary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                ...options.map((opt) {
                  final label = labelBuilder(opt);
                  final isSelected = value == label;
                  return ListTile(
                    title: Text(
                      label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                        color: isSelected ? _brandColor : textPrimary,
                      ),
                    ),
                    trailing: isSelected
                        ? const Icon(Icons.check_circle, color: _brandColor, size: 22)
                        : null,
                    onTap: () {
                      Navigator.pop(context);
                      onSelected(opt);
                    },
                  );
                }),
                const SizedBox(height: 12),
              ],
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        decoration: BoxDecoration(
          color: chipBg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                value ?? hint,
                style: TextStyle(
                  fontSize: 14,
                  color: value != null ? textPrimary : textPrimary.withValues(alpha: 0.5),
                ),
              ),
            ),
            Icon(Icons.keyboard_arrow_down, color: textPrimary.withValues(alpha: 0.5)),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboardType,
    required Color textPrimary,
    required Color textSecondary,
    required Color chipBg,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      onChanged: (_) => setState(() {}),
      style: TextStyle(fontSize: 14, color: textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(fontSize: 13, color: textSecondary),
        filled: true,
        fillColor: chipBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}
