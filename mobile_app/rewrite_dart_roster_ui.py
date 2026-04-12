import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/kermes/staff/kermes_admin_roster_screen.dart"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace everything from `@override Widget build(BuildContext context)` to the end.
build_search = r"""  @override\n  Widget build\(BuildContext context\) \{.*\}"""

build_replace = """  Color _getRoleColor(String role) {
    switch ((role).toLowerCase()) {
      case 'genel sorumlu': return Colors.purple;
      case 'garson': return Colors.teal;
      case 'sürücü / nakliye': return Colors.amber;
      case 'ocakbaşı - kumpir': return Colors.orange;
      case 'güvenlik': return Colors.blueGrey;
      case 'temizlik': return Colors.cyan;
      case 'tatlı standı': return Colors.pink;
      case 'içecek standı': return Colors.blue;
      case 'gözleme': return Colors.yellow.shade700;
      default: return Colors.grey;
    }
  }

  String _getInitials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ').where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // 1. Gender Filter
    final bool isMaleAdmin = _adminGender == 'male' || _adminGender == 'erkek';
    final bool isFemaleAdmin = _adminGender == 'female' || _adminGender == 'kadin';

    final allowedRosters = _allRosters.where((r) {
      if (_isSuperAdmin) return true;
      final staffGender = _userGenders[r.userId] ?? '';
      final isMaleStaff = staffGender == 'male' || staffGender == 'erkek';
      final isFemaleStaff = staffGender == 'female' || staffGender == 'kadin';
      
      if (isFemaleAdmin && isMaleStaff) return false;
      if (isMaleAdmin && isFemaleStaff) return false;
      return true;
    }).toList();

    // 2. Group by Date -> Role
    final Map<String, Map<String, List<KermesRoster>>> grouped = {};
    for (final r in allowedRosters) {
      if (!grouped.containsKey(r.date)) grouped[r.date] = {};
      if (!grouped[r.date]!.containsKey(r.role)) grouped[r.date]![r.role] = [];
      grouped[r.date]![r.role]!.add(r);
    }

    final sortedDates = grouped.keys.toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vardiya Yönetimi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddModal,
        backgroundColor: Colors.blue.shade600,
        elevation: 4,
        icon: const Icon(Icons.add_task, color: Colors.white),
        label: const Text('Vardiya Ekle', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : allowedRosters.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.event_busy, size: 64, color: Colors.grey.withOpacity(0.5)),
                  const SizedBox(height: 16),
                  const Text('Henüz vardiya atanmadı.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.only(top: 16, bottom: 120, left: 16, right: 16),
              itemCount: sortedDates.length,
              itemBuilder: (context, index) {
                final dateStr = sortedDates[index];
                final rolesMap = grouped[dateStr]!;
                final sortedRoles = rolesMap.keys.toList()..sort();
                
                DateTime? d;
                try { d = DateTime.parse(dateStr); } catch (_) {}
                final formattedDate = d != null ? DateFormat('EEEE, d MMMM', 'tr_TR').format(d) : dateStr;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // DATE HEADER
                      Row(
                        children: [
                          Expanded(child: Divider(color: Colors.grey.withOpacity(0.3))),
                          Container(
                            margin: const EdgeInsets.symmetric(horizontal: 12),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.blue.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.blue.withOpacity(0.2)),
                            ),
                            child: Text(
                              formattedDate,
                              style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.blue.shade300 : Colors.blue.shade700, fontSize: 13),
                            ),
                          ),
                          Expanded(child: Divider(color: Colors.grey.withOpacity(0.3))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      
                      // ROLES GROUP
                      ...sortedRoles.map((role) {
                        final list = rolesMap[role]!;
                        final roleColor = _getRoleColor(role);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey.shade900 : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.withOpacity(0.15)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Role Header
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                decoration: BoxDecoration(
                                  border: Border(bottom: BorderSide(color: Colors.grey.withOpacity(0.1))),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: roleColor.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(Icons.assignment_ind, size: 16, color: roleColor),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(role, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                          Text('${list.length} Personel Görevlendirildi', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              
                              // Staff Cards Array
                              ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: list.length,
                                separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.withOpacity(0.1)),
                                itemBuilder: (context, idx) {
                                  final roster = list[idx];
                                  final staffName = _userNames[roster.userId] ?? 'Bilinmiyor';
                                  
                                  return InkWell(
                                    onLongPress: () => _deleteRoster(roster.id),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                      child: Row(
                                        children: [
                                          // Avatar
                                          Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              gradient: LinearGradient(
                                                colors: [roleColor.withOpacity(0.2), roleColor.withOpacity(0.05)],
                                                begin: Alignment.topLeft,
                                                end: Alignment.bottomRight,
                                              ),
                                              border: Border.all(color: roleColor.withOpacity(0.3)),
                                            ),
                                            alignment: Alignment.center,
                                            child: Text(
                                              _getInitials(staffName),
                                              style: TextStyle(fontWeight: FontWeight.bold, color: roleColor, fontSize: 13),
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          
                                          // Details
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(staffName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                                const SizedBox(height: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: roleColor.withOpacity(0.1),
                                                    borderRadius: BorderRadius.circular(12),
                                                    border: Border.all(color: roleColor.withOpacity(0.2)),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(Icons.schedule, size: 12, color: roleColor.withOpacity(0.8)),
                                                      const SizedBox(width: 4),
                                                      Text(
                                                        '${roster.startTime} - ${roster.endTime}',
                                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isDark ? roleColor.withOpacity(0.9) : roleColor),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          
                                          // Delete Button
                                          IconButton(
                                            icon: const Icon(Icons.delete_outline, size: 20),
                                            color: Colors.red.withOpacity(0.7),
                                            onPressed: () => _deleteRoster(roster.id),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ],
                  ),
                );
              },
            ),
    );
  }
}"""

content = re.sub(build_search, build_replace, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Dart script updated step 2")
