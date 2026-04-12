import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';

class KermesRoster {
  final String id;
  final String kermesId;
  final String userId;
  final String role;
  final String date;
  final String startTime;
  final String endTime;

  KermesRoster({
    required this.id,
    required this.kermesId,
    required this.userId,
    required this.role,
    required this.date,
    required this.startTime,
    required this.endTime,
  });

  factory KermesRoster.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return KermesRoster(
      id: doc.id,
      kermesId: data['kermesId'] ?? '',
      userId: data['userId'] ?? '',
      role: data['role'] ?? '',
      date: data['date'] ?? '',
      startTime: data['startTime'] ?? '',
      endTime: data['endTime'] ?? '',
    );
  }
}

class KermesScheduleScreen extends StatefulWidget {
  final String kermesId;
  final String kermesTitle;

  const KermesScheduleScreen({
    Key? key,
    required this.kermesId,
    required this.kermesTitle,
  }) : super(key: key);

  @override
  State<KermesScheduleScreen> createState() => _KermesScheduleScreenState();
}

class _KermesScheduleScreenState extends State<KermesScheduleScreen> {
  bool _isLoading = true;
  List<KermesRoster> _myRosters = [];
  Map<String, List<KermesRoster>> _groupedRosters = {};

  @override
  void initState() {
    super.initState();
    initializeDateFormatting('tr_TR', null).then((_) {
      _fetchMySchedule();
    });
  }

  Future<void> _fetchMySchedule() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    try {
      final snap = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('rosters')
          .where('userId', isEqualTo: user.uid)
          .get();
          
      final list = snap.docs.map((d) => KermesRoster.fromFirestore(d)).toList();
      
      // Sort by date and time
      list.sort((a, b) {
        int dateCmp = a.date.compareTo(b.date);
        if (dateCmp != 0) return dateCmp;
        return a.startTime.compareTo(b.startTime);
      });

      // Group
      final Map<String, List<KermesRoster>> grouped = {};
      for (final r in list) {
        if (!grouped.containsKey(r.date)) grouped[r.date] = [];
        grouped[r.date]!.add(r);
      }

      if (mounted) {
        setState(() {
          _myRosters = list;
          _groupedRosters = grouped;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching rosters: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Mesai ve Görev Planım', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.kermesTitle, style: TextStyle(fontSize: 12, fontWeight: FontWeight.normal, color: Colors.white.withOpacity(0.8))),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : _myRosters.isEmpty
          ? _buildEmptyState(isDark)
          : _buildScheduleList(isDark),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.event_busy, size: 64, color: isDark ? Colors.white24 : Colors.black26),
          const SizedBox(height: 16),
          Text(
            'Henüz Atanmış Vardiyanız Yok',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Bu kermes için yetkililer tarafından size atanmış bir görev saati veya vardiya bulunmuyor.',
              textAlign: TextAlign.center,
              style: TextStyle(color: isDark ? Colors.white54 : Colors.black54),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleList(bool isDark) {
    final dates = _groupedRosters.keys.toList();
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: dates.length,
      itemBuilder: (context, index) {
        final dateStr = dates[index];
        final rosters = _groupedRosters[dateStr]!;
        
        DateTime? dateObj;
        try {
          dateObj = DateTime.parse(dateStr);
        } catch (_) {}
        
        final formattedDate = dateObj != null 
            ? DateFormat('EEEE, d MMMM', 'tr_TR').format(dateObj)
            : dateStr;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date Header
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.blue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.blue.withOpacity(0.2)),
                    ),
                    child: Text(
                      formattedDate.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.blue,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  const Expanded(child: Divider(indent: 12, color: Colors.blueGrey, endIndent: 16)),
                ],
              ),
            ),
            
            // Rosters for this date
            ...rosters.map((roster) => _buildRosterCard(roster, isDark)).toList(),
            const SizedBox(height: 16),
          ],
        );
      },
    );
  }

  Widget _buildRosterCard(KermesRoster roster, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2C2C2C) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
        border: Border.all(color: isDark ? Colors.white10 : Colors.black.withOpacity(0.05)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            children: [
              // Time Bar
              Container(
                width: 80,
                color: Colors.blue.withOpacity(0.1),
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      roster.startTime,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.blue.shade300 : Colors.blue.shade700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Icon(Icons.arrow_downward, size: 14, color: isDark ? Colors.white38 : Colors.black26),
                    const SizedBox(height: 2),
                    Text(
                      roster.endTime,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white54 : Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              const VerticalDivider(width: 1, thickness: 1, color: Colors.transparent),
              // Details
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.pink.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          roster.role,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.pink.shade300 : Colors.pink.shade700,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Bu saat aralığında yukarıdaki görevden sorumlusunuz.',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.white54 : Colors.black54,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
