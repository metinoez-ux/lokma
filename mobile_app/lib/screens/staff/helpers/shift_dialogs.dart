import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ShiftDialogs {
  /// Role selection sheet with masa servisi + kurye toggles
  static Future<Map<String, dynamic>?> showRoleSelectionSheet({
    required BuildContext context,
    required bool hasTables,
    required bool isDriver,
    required int maxTables,
    required List<int> assignedTables,
    required List<String> kermesPrepZones,
    bool isUpdating = false,
    bool currentMasa = false,
    bool currentKurye = false,
    bool currentDiger = false,
    List<int> currentTables = const [],
    List<String> currentPrepZones = const [],
  }) async {
    bool masaEnabled = currentMasa;
    bool kuryeEnabled = currentKurye;
    bool digerEnabled = currentDiger;
    final Set<int> selectedTables = Set<int>.from(currentTables);
    final Set<String> selectedPrepZones = Set<String>.from(currentPrepZones);
    final max = maxTables;

    final bool showKurye = isDriver;
    final bool showMasa = hasTables;
    final bool showPrepZones = kermesPrepZones.isNotEmpty;

    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            final hasAnyRole = digerEnabled || kuryeEnabled || (masaEnabled && selectedTables.isNotEmpty) || selectedPrepZones.isNotEmpty;
            final canStart = hasAnyRole;

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(ctx).size.height * 0.85,
              ),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Column(
                      children: [
                        Text(isUpdating ? 'Görevleri Güncelle' : 'Görev Seçimi', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('Bu vardiyada hangi görevleri üstleneceksiniz?', style: TextStyle(fontSize: 13, color: Colors.grey[500]), textAlign: TextAlign.center),
                      ],
                    ),
                  ),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (showMasa) ...[
                            _buildRoleToggle(
                              context: ctx,
                              icon: Icons.table_restaurant,
                              title: 'Masa Servisi',
                              subtitle: masaEnabled ? 'Masalardan gelen siparişleri alın' : 'Masalara bakmıyorum',
                              color: Colors.teal,
                              isEnabled: masaEnabled,
                              onChanged: (val) => setSheetState(() {
                                masaEnabled = val;
                                if (!val) selectedTables.clear();
                              }),
                            ),
                            AnimatedCrossFade(
                              firstChild: Padding(
                                padding: const EdgeInsets.only(top: 12, bottom: 8),
                                child: Column(
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        TextButton.icon(
                                          onPressed: () => setSheetState(() {
                                            selectedTables.clear();
                                            for (int i = 1; i <= max; i++) {
                                              selectedTables.add(i);
                                            }
                                          }),
                                          icon: const Icon(Icons.select_all, size: 16),
                                          label: const Text('Tümü', style: TextStyle(fontSize: 12)),
                                        ),
                                        const SizedBox(width: 8),
                                        TextButton.icon(
                                          onPressed: () => setSheetState(() => selectedTables.clear()),
                                          icon: const Icon(Icons.deselect, size: 16),
                                          label: const Text('Temizle', style: TextStyle(fontSize: 12)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    GridView.builder(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 5,
                                        mainAxisSpacing: 8,
                                        crossAxisSpacing: 8,
                                      ),
                                      itemCount: max,
                                      itemBuilder: (_, i) {
                                        final tableNum = i + 1;
                                        final isSelected = selectedTables.contains(tableNum);
                                        return GestureDetector(
                                          onTap: () {
                                            HapticFeedback.selectionClick();
                                            setSheetState(() {
                                              if (isSelected) {
                                                selectedTables.remove(tableNum);
                                              } else {
                                                selectedTables.add(tableNum);
                                              }
                                            });
                                          },
                                          child: AnimatedContainer(
                                            duration: const Duration(milliseconds: 200),
                                            decoration: BoxDecoration(
                                              color: isSelected ? Colors.teal : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(
                                                color: isSelected ? Colors.teal : Colors.grey.withOpacity(0.3),
                                                width: isSelected ? 2 : 1,
                                              ),
                                            ),
                                            child: Center(
                                              child: Text(
                                                '$tableNum',
                                                style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w600,
                                                  color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                                                ),
                                              ),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              secondChild: const SizedBox.shrink(),
                              crossFadeState: masaEnabled ? CrossFadeState.showFirst : CrossFadeState.showSecond,
                              duration: const Duration(milliseconds: 300),
                            ),
                            const SizedBox(height: 12),
                          ],
                          if (showPrepZones) ...[
                            const Padding(
                              padding: EdgeInsets.only(left: 4, bottom: 8, top: 4),
                              child: Text('Ocakbaşı (Hazırlık) Görevleri', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            ),
                            ...kermesPrepZones.map((zone) {
                              final isSelected = selectedPrepZones.contains(zone);
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8.0),
                                child: _buildRoleToggle(
                                  context: ctx,
                                  icon: Icons.soup_kitchen,
                                  title: zone,
                                  subtitle: isSelected ? 'Bu alanda çalışıyorsunuz' : 'Seçili değil',
                                  color: Colors.deepOrange,
                                  isEnabled: isSelected,
                                  onChanged: (val) => setSheetState(() {
                                    if (val) {
                                      selectedPrepZones.add(zone);
                                    } else {
                                      selectedPrepZones.remove(zone);
                                    }
                                  }),
                                ),
                              );
                            }).toList(),
                            const SizedBox(height: 12),
                          ],
                          if (showKurye) ...[
                            _buildRoleToggle(
                              context: ctx,
                              icon: Icons.delivery_dining,
                              title: 'Sürücü Görevi',
                              subtitle: kuryeEnabled ? 'Teslimat siparişlerini alın' : 'Kurye olarak çalışmıyorum',
                              color: Colors.amber,
                              isEnabled: kuryeEnabled,
                              onChanged: (val) => setSheetState(() => kuryeEnabled = val),
                            ),
                            const SizedBox(height: 12),
                          ],
                          _buildRoleToggle(
                            context: ctx,
                            icon: Icons.work_outline,
                            title: 'Diğer Görevler',
                            subtitle: digerEnabled ? 'Genel işletme görevleri' : 'Diğer görevlere bakmıyorum',
                            color: Colors.indigo,
                            isEnabled: digerEnabled,
                            onChanged: (val) => setSheetState(() => digerEnabled = val),
                          ),
                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        onPressed: canStart || isUpdating
                            ? () {
                                if (!hasAnyRole && isUpdating) {
                                  Navigator.pop(ctx, {'endShift': true});
                                } else {
                                  Navigator.pop(ctx, {
                                    'tables': masaEnabled ? (selectedTables.toList()..sort()) : <int>[],
                                    'isDeliveryDriver': kuryeEnabled,
                                    'isDiger': digerEnabled,
                                    'prepZones': selectedPrepZones.toList(),
                                  });
                                }
                              }
                            : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: (!hasAnyRole && isUpdating) ? Colors.red : Colors.green,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: Icon(!hasAnyRole && isUpdating ? Icons.power_settings_new : (isUpdating ? Icons.update : Icons.play_arrow)),
                        label: Text(
                          _buildStartButtonLabel(isUpdating, masaEnabled, kuryeEnabled, digerEnabled, selectedTables.length, selectedPrepZones.length),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: MediaQuery.of(ctx).padding.bottom),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static Future<List<int>?> showTableSelectionSheet({
    required BuildContext context,
    required int maxTables,
    required List<int> assignedTables,
  }) async {
    final Set<int> selected = Set<int>.from(assignedTables);
    final max = maxTables;

    return showModalBottomSheet<List<int>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(ctx).size.height * 0.7,
              ),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        const Text('Masa Seçimi', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('Bu vardiyada servis yapacağınız masaları seçin', style: TextStyle(fontSize: 13, color: Colors.grey[500]), textAlign: TextAlign.center),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            TextButton.icon(
                              onPressed: () => setSheetState(() {
                                selected.clear();
                                for (int i = 1; i <= max; i++) {
                                  selected.add(i);
                                }
                              }),
                              icon: const Icon(Icons.select_all, size: 16),
                              label: const Text('Tümü', style: TextStyle(fontSize: 12)),
                            ),
                            const SizedBox(width: 8),
                            TextButton.icon(
                              onPressed: () => setSheetState(() => selected.clear()),
                              icon: const Icon(Icons.deselect, size: 16),
                              label: const Text('Temizle', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Flexible(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: GridView.builder(
                        shrinkWrap: true,
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 5,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                        ),
                        itemCount: max,
                        itemBuilder: (_, i) {
                          final tableNum = i + 1;
                          final isSelected = selected.contains(tableNum);
                          return GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setSheetState(() {
                                if (isSelected) {
                                  selected.remove(tableNum);
                                } else {
                                  selected.add(tableNum);
                                }
                              });
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFEA184A) : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected ? const Color(0xFFEA184A) : Colors.grey.withOpacity(0.3),
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  '$tableNum',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        onPressed: selected.isEmpty
                            ? null
                            : () => Navigator.pop(ctx, selected.toList()..sort()),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.green,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.play_arrow),
                        label: Text(
                          selected.isEmpty ? 'Masa seçin' : 'Vardiyayı Başlat (${selected.length} masa)',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: MediaQuery.of(ctx).padding.bottom),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static void showShiftSummaryDialog(BuildContext context, Map<String, dynamic> summary) {
    final totalMin = summary['totalMinutes'] as int? ?? 0;
    final pauseMin = summary['pauseMinutes'] as int? ?? 0;
    final activeMin = summary['activeMinutes'] as int? ?? 0;
    final tables = summary['assignedTables'] as List<int>? ?? [];
    final orphans = summary['orphanTables'] as List<int>? ?? [];
    final startedAt = summary['startedAt'] as DateTime?;
    final endedAt = summary['endedAt'] as DateTime?;

    String formatDuration(int mins) {
      final h = mins ~/ 60;
      final m = mins % 60;
      if (h > 0) return '${h}s ${m}dk';
      return '${m}dk';
    }

    String formatTime(DateTime? dt) {
      if (dt == null) return '-';
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), shape: BoxShape.circle),
              child: const Icon(Icons.check_circle, color: Colors.green, size: 24),
            ),
            const SizedBox(width: 12),
            Text('Vardiya Tamamlandı', style: const TextStyle(fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _summaryRow('⏰', 'Başlangıç', formatTime(startedAt)),
            _summaryRow('🏁', 'Bitiş', formatTime(endedAt)),
            const Divider(height: 20),
            _summaryRow('💪', 'Çalışma Süresi', formatDuration(activeMin)),
            _summaryRow('☕', 'Mola Süresi', formatDuration(pauseMin)),
            _summaryRow('📋', 'Toplam', formatDuration(totalMin)),
            if (tables.isNotEmpty) ...[
              const Divider(height: 20),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   const Text('🪑', style: TextStyle(fontSize: 16)),
                   const SizedBox(width: 8),
                   Expanded(
                     child: Column(
                       crossAxisAlignment: CrossAxisAlignment.start,
                       children: [
                         Text('Masa Numaraları', style: TextStyle(fontSize: 13, color: Colors.grey)),
                         const SizedBox(height: 6),
                         Wrap(
                           spacing: 6, runSpacing: 6,
                           children: tables.map((t) => Container(
                             padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                             decoration: BoxDecoration(
                               color: Colors.teal.withOpacity(0.1),
                               borderRadius: BorderRadius.circular(8),
                               border: Border.all(color: Colors.teal.withOpacity(0.3)),
                             ),
                             child: Text('$t', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.teal)),
                           )).toList(),
                         ),
                       ],
                     ),
                   ),
                ],
              ),
            ],
            if (orphans.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber, color: Colors.amber, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('Sahipsiz masalar: ${orphans.join(", ")}', style: const TextStyle(fontSize: 13, color: Colors.amber)),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  static Widget _summaryRow(String emoji, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey))),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  static String _buildStartButtonLabel(bool isUp, bool masa, bool kurye, bool diger, int tableCount, int prepCount) {
    final parts = <String>[];
    if (masa && tableCount > 0) parts.add('$tableCount masa');
    if (kurye) parts.add('sürücü');
    if (diger) parts.add('diğer');
    if (prepCount > 0) parts.add('$prepCount ocakbaşı');
    if (parts.isEmpty) {
      return isUp ? 'Vardiyayı Bitir' : 'En az bir görev seçin';
    }
    return isUp ? 'Rolleri Güncelle' : 'Vardiyayı Başlat (${parts.join(' + ')})';
  }

  static Widget _buildRoleToggle({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required bool isEnabled,
    required ValueChanged<bool> onChanged,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isEnabled ? color.withOpacity(0.08) : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isEnabled ? color.withOpacity(0.4) : Colors.grey.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isEnabled ? color.withOpacity(0.15) : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: isEnabled ? color : Colors.grey, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: isEnabled ? null : Colors.grey)),
                Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
              ],
            ),
          ),
          Switch.adaptive(value: isEnabled, onChanged: onChanged, activeColor: color),
        ],
      ),
    );
  }

  static Future<String?> showEndShiftActionSheet({
    required BuildContext context,
    required List<Map<String, dynamic>> tasks,
  }) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      const Text(
                        'Hangi Görevi Bitirmek İstiyorsunuz?',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Birden fazla aktif göreviniz bulunuyor. Sadece birini veya tümünü sonlandırabilirsiniz.',
                        style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ...tasks.map((task) {
                          String subtitle = 'Bu görevi sonlandır';
                          if (task['elapsedText'] != null) {
                            subtitle = '${task['elapsedText']} süredir aktif • $subtitle';
                          }
                          return ListTile(
                            leading: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.orange.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.stop_circle_outlined, color: Colors.orange),
                            ),
                            title: Text(task['name']),
                            subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
                            onTap: () => Navigator.pop(ctx, task['id']),
                          );
                        }).toList(),
                        const Divider(height: 1),
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.power_settings_new, color: Colors.red),
                          ),
                          title: const Text('Hepsini Bitir', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Tüm görevlerden çıkış yap', style: TextStyle(fontSize: 12)),
                          onTap: () => Navigator.pop(ctx, 'all'),
                        ),
                        const SizedBox(height: 12),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
