import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:timeago/timeago.dart' as timeago;

class NotificationTrashScreen extends StatefulWidget {
  const NotificationTrashScreen({super.key});

  @override
  State<NotificationTrashScreen> createState() => _NotificationTrashScreenState();
}

class _NotificationTrashScreenState extends State<NotificationTrashScreen> {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  bool _isEditMode = false;
  final Set<String> _selectedDocIds = {};

  // ── Restore a single notification ─────────────────────────────────────
  Future<void> _restore(String docId) async {
    final user = _auth.currentUser;
    if (user == null) return;
    await FirebaseFirestore.instance
        .collection('users').doc(user.uid).collection('notifications').doc(docId)
        .update({'trashedAt': FieldValue.delete()});
  }

  // ── Permanently delete a single notification ──────────────────────────
  Future<void> _deletePermanently(String docId) async {
    final user = _auth.currentUser;
    if (user == null) return;
    await FirebaseFirestore.instance
        .collection('users').doc(user.uid).collection('notifications').doc(docId)
        .delete();
  }

  // ── Bulk restore selected ─────────────────────────────────────────────
  Future<void> _restoreSelected() async {
    final user = _auth.currentUser;
    if (user == null || _selectedDocIds.isEmpty) return;
    final batch = FirebaseFirestore.instance.batch();
    for (final docId in _selectedDocIds) {
      batch.update(
        FirebaseFirestore.instance.collection('users').doc(user.uid).collection('notifications').doc(docId),
        {'trashedAt': FieldValue.delete()},
      );
    }
    await batch.commit();
    setState(() { _selectedDocIds.clear(); _isEditMode = false; });
  }

  // ── Bulk delete selected ──────────────────────────────────────────────
  Future<void> _deleteSelected() async {
    final user = _auth.currentUser;
    if (user == null || _selectedDocIds.isEmpty) return;
    final confirmed = await _confirmDelete(
      'notifications.delete_confirm'.tr(),
    );
    if (confirmed != true) return;
    final batch = FirebaseFirestore.instance.batch();
    for (final docId in _selectedDocIds) {
      batch.delete(
        FirebaseFirestore.instance.collection('users').doc(user.uid).collection('notifications').doc(docId),
      );
    }
    await batch.commit();
    setState(() { _selectedDocIds.clear(); _isEditMode = false; });
  }

  // ── Empty all trash ───────────────────────────────────────────────────
  Future<void> _emptyTrash() async {
    final user = _auth.currentUser;
    if (user == null) return;
    final confirmed = await _confirmDelete(
      'notifications.empty_trash_confirm'.tr(),
    );
    if (confirmed != true) return;
    final snap = await FirebaseFirestore.instance
        .collection('users').doc(user.uid).collection('notifications')
        .where('trashedAt', isNull: false)
        .get();
    final batch = FirebaseFirestore.instance.batch();
    for (final doc in snap.docs) {
      batch.delete(doc.reference);
    }
    await batch.commit();
  }

  Future<bool?> _confirmDelete(String message) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'notifications.delete_permanently'.tr(),
          style: TextStyle(
            color: Theme.of(ctx).colorScheme.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
        content: Text(
          message,
          style: TextStyle(
            color: isDark ? Colors.grey[400] : Colors.grey[600],
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'notifications.cancel'.tr(),
              style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              'notifications.delete'.tr(),
              style: const TextStyle(color: Color(0xFFFB335B), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _auth.currentUser;
    if (user == null) return const Scaffold(body: SizedBox.shrink());

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? Theme.of(context).scaffoldBackgroundColor : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? Theme.of(context).scaffoldBackgroundColor : Colors.white,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        title: _isEditMode
          ? Text(
              _selectedDocIds.isEmpty
                ? 'notifications.select_all'.tr()
                : 'notifications.items_selected'.tr().replaceAll('{}', '${_selectedDocIds.length}'),
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 17,
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.delete_outline_rounded, size: 20, color: Theme.of(context).colorScheme.onSurface),
                const SizedBox(width: 6),
                Text(
                  'notifications.trash'.tr(),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w600,
                    fontSize: 17,
                  ),
                ),
              ],
            ),
        centerTitle: !_isEditMode,
        leading: _isEditMode
          ? IconButton(
              icon: Icon(Icons.close, color: Theme.of(context).iconTheme.color),
              onPressed: () => setState(() { _isEditMode = false; _selectedDocIds.clear(); }),
            )
          : IconButton(
              padding: const EdgeInsets.all(12),
              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
              icon: Icon(Icons.arrow_back_ios, color: Theme.of(context).iconTheme.color),
              onPressed: () => Navigator.pop(context),
            ),
        actions: [
          if (!_isEditMode) ...[
            // ── Empty trash ──
            IconButton(
              icon: Icon(Icons.delete_sweep_outlined, color: Theme.of(context).iconTheme.color),
              tooltip: 'notifications.empty_trash'.tr(),
              onPressed: _emptyTrash,
            ),
            // ── Edit mode ──
            IconButton(
              icon: Icon(Icons.checklist_rounded, color: Theme.of(context).iconTheme.color),
              onPressed: () => setState(() { _isEditMode = true; }),
            ),
          ],
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('users').doc(user.uid).collection('notifications')
            .where('trashedAt', isNull: false)
            .orderBy('trashedAt', descending: true)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
          }

          final docs = snapshot.data?.docs ?? [];

          if (docs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.delete_outline_rounded,
                    size: 80,
                    color: isDark ? Colors.grey[700] : Colors.grey[300],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'notifications.trash_empty'.tr(),
                    style: TextStyle(
                      fontSize: 18,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          }

          return Stack(
            children: [
              ListView.separated(
                padding: EdgeInsets.only(left: 16, right: 16, top: 12, bottom: _isEditMode ? 80 : 12),
                itemCount: docs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final doc = docs[index];
                  final data = doc.data() as Map<String, dynamic>;
                  final docId = doc.id;
                  final card = _TrashNotificationCard(data: data, isDark: isDark);

                  if (_isEditMode) {
                    return _buildSelectableCard(docId: docId, isDark: isDark, child: card);
                  }

                  // Swipe right to restore, swipe left to permanently delete
                  return Dismissible(
                    key: Key('trash_$docId'),
                    background: Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 24),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.restore, color: Color(0xFF4CAF50), size: 24),
                          const SizedBox(height: 2),
                          Text(
                            'notifications.restore'.tr(),
                            style: const TextStyle(color: Color(0xFF4CAF50), fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    secondaryBackground: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 24),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFB335B).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.delete_forever_rounded, color: Color(0xFFFB335B), size: 24),
                          const SizedBox(height: 2),
                          Text(
                            'notifications.delete'.tr(),
                            style: const TextStyle(color: Color(0xFFFB335B), fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    confirmDismiss: (direction) async {
                      if (direction == DismissDirection.startToEnd) {
                        // Restore
                        await _restore(docId);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('notifications.restored'.tr()),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          );
                        }
                      } else {
                        // Permanently delete
                        final confirmed = await _confirmDelete('notifications.delete_confirm'.tr());
                        if (confirmed == true) {
                          await _deletePermanently(docId);
                        }
                      }
                      return false; // Firestore stream handles UI update
                    },
                    child: card,
                  );
                },
              ),
              // ── Floating bottom bar for edit mode ──
              if (_isEditMode && _selectedDocIds.isNotEmpty)
                Positioned(
                  left: 16, right: 16, bottom: 16,
                  child: SafeArea(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.15),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Text(
                            'notifications.items_selected'.tr().replaceAll('{}', '${_selectedDocIds.length}'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const Spacer(),
                          // Restore
                          IconButton(
                            onPressed: _restoreSelected,
                            icon: const Icon(Icons.restore, color: Color(0xFF4CAF50), size: 22),
                            tooltip: 'notifications.restore'.tr(),
                          ),
                          const SizedBox(width: 4),
                          // Delete permanently
                          IconButton(
                            onPressed: _deleteSelected,
                            icon: const Icon(Icons.delete_forever_rounded, color: Color(0xFFFB335B), size: 22),
                            tooltip: 'notifications.delete_permanently'.tr(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSelectableCard({
    required String docId,
    required bool isDark,
    required Widget child,
  }) {
    final selected = _selectedDocIds.contains(docId);
    return GestureDetector(
      onTap: () => setState(() {
        if (selected) { _selectedDocIds.remove(docId); } else { _selectedDocIds.add(docId); }
      }),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? const Color(0xFFFB335B) : Colors.transparent,
              border: Border.all(
                color: selected ? const Color(0xFFFB335B) : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                width: 2,
              ),
            ),
            child: selected
                ? const Icon(Icons.check, color: Colors.white, size: 16)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(child: child),
        ],
      ),
    );
  }
}

// ── Trash notification card ─────────────────────────────────────────────────
class _TrashNotificationCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final bool isDark;

  const _TrashNotificationCard({required this.data, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final type = data['type'] as String? ?? '';
    final status = data['status'] as String? ?? '';
    final businessName = data['businessName'] as String? ?? '';
    final orderId = data['orderId'] as String? ?? '';
    final rawOrderNumber = data['rawOrderNumber'] as String? ?? '';
    final body = data['body'] as String? ?? data['message'] as String? ?? '';
    final createdAt = data['createdAt'] as Timestamp?;
    final trashedAt = data['trashedAt'] as Timestamp?;

    // Determine title and subtitle
    String title;
    String subtitle;
    IconData icon;
    Color iconColor;

    if (type == 'order_status' && orderId.isNotEmpty) {
      final orderNum = rawOrderNumber.isNotEmpty ? '#$rawOrderNumber' : '';
      title = businessName.isNotEmpty ? '$businessName $orderNum' : 'notifications.order_number'.tr() + orderNum;
      subtitle = body.isNotEmpty ? body : status;
      icon = Icons.receipt_long_rounded;
      iconColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    } else {
      title = data['title'] as String? ?? 'notifications.notification'.tr();
      subtitle = body;
      icon = Icons.notifications_rounded;
      iconColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    }

    // Format trashed time
    String trashedTimeStr = '';
    if (trashedAt != null) {
      trashedTimeStr = timeago.format(
        trashedAt.toDate(),
        locale: context.locale.languageCode,
      );
    }

    final cardColor = isDark ? const Color(0xFF1C1C1E) : const Color(0xFFF8F8F8);
    final borderColor = isDark ? Colors.grey[800]! : Colors.grey[200]!;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 0.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                      fontSize: 13,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (trashedTimeStr.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    trashedTimeStr,
                    style: TextStyle(
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
