import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/kermes/staff/kermes_admin_roster_screen.dart"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace _deleteRoster entirely with the new implementation
delete_func_search = r"  Future<void> _deleteRoster\(String id\) async \{[\s\S]*?\}\n    \}\n  \}"

delete_func_replace = """  void _showDeleteOptions(KermesRoster roster) {
    final staffName = _userNames[roster.userId] ?? 'Bu Personel';
    final userRosters = _allRosters.where((r) => r.userId == roster.userId).toList();
    final count = userRosters.length;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (modalContext) {
        final isDark = Theme.of(modalContext).brightness == Brightness.dark;
        return Container(
          decoration: BoxDecoration(
            color: isDark ? Colors.grey.shade900 : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.only(top: 12, bottom: 32, left: 24, right: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pull Handle
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 24),
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              
              const Icon(Icons.cancel_schedule_send, size: 48, color: Colors.orange),
              const SizedBox(height: 16),
              const Text('Vardiya İptal Seçenekleri', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: TextStyle(fontSize: 14, color: isDark ? Colors.grey.shade400 : Colors.grey.shade600, height: 1.5),
                  children: [
                    const TextSpan(text: 'Sistemde '),
                    TextSpan(text: staffName, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
                    const TextSpan(text: ' adlı personelin aktif '),
                    TextSpan(text: '$count adet', style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: ' vardiyası bulunuyor.'),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Single Delete
              InkWell(
                onTap: () {
                  Navigator.pop(modalContext);
                  _deleteSingle(roster.id);
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.withOpacity(0.2)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Colors.grey.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.close, color: Colors.grey),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Sadece Bu Vardiyayı Sil', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('${roster.date} tarihindeki görevi siler.', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.grey),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 12),

              // Bulk Delete
              InkWell(
                onTap: () {
                  Navigator.pop(modalContext);
                  _deleteBulk(roster.userId, count);
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.05),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.delete_sweep, color: Colors.red),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Tüm Atamaları Temizle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.red)),
                            const SizedBox(height: 4),
                            Text('Bu kermesteki $count görevi anında iptal eder.', style: TextStyle(fontSize: 12, color: Colors.red.shade300)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.red),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  Future<void> _deleteSingle(String id) async {
    try {
      await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('rosters')
          .doc(id)
          .delete();
      _fetchData();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hata oluştu'), backgroundColor: Colors.red));
    }
  }

  Future<void> _deleteBulk(String userId, int count) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Toplu Silme Onayı', style: TextStyle(color: Colors.red)),
        content: Text('Bu personelin $count adet görevini tek seferde silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('İptal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true), 
            child: const Text('Tümünü Sil', style: TextStyle(color: Colors.white)),
          ),
        ],
      )
    );

    if (confirm != true) return;

    try {
      final userRosters = _allRosters.where((r) => r.userId == userId).toList();
      final batch = FirebaseFirestore.instance.batch();
      
      for (final r in userRosters) {
        final ref = FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).collection('rosters').doc(r.id);
        batch.delete(ref);
      }
      
      await batch.commit();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$count adet görev başarıyla silindi.'), backgroundColor: Colors.green));
        _fetchData();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Toplu silme başarısız.'), backgroundColor: Colors.red));
    }
  }"""

content = re.sub(delete_func_search, delete_func_replace, content)

# 2. Modify JSX equivalent in Flutter. Change `_deleteRoster(roster.id)` to `_showDeleteOptions(roster)`
content = content.replace("onLongPress: () => _deleteRoster(roster.id)", "onLongPress: () => _showDeleteOptions(roster)")
content = content.replace("onPressed: () => _deleteRoster(roster.id)", "onPressed: () => _showDeleteOptions(roster)")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Mobile app updated successfully")
