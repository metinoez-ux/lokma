import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/kermes/staff/kermes_admin_roster_screen.dart"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update State Variables to include Genders and Admin info
state_search = """class _KermesAdminRosterScreenState extends State<KermesAdminRosterScreen> {
  bool _isLoading = true;
  List<KermesRoster> _allRosters = [];
  Map<String, String> _userNames = {};"""

state_replace = """class _KermesAdminRosterScreenState extends State<KermesAdminRosterScreen> {
  bool _isLoading = true;
  List<KermesRoster> _allRosters = [];
  Map<String, String> _userNames = {};
  Map<String, String> _userGenders = {};
  bool _isSuperAdmin = false;
  String _adminGender = '';"""

content = content.replace(state_search, state_replace)

# 2. Update _fetchData to handle chunking, genders, and index-less sorting
fetch_data_search = r"""  Future<void> _fetchData\(\) async \{.*?\s*if \(mounted\) \{"""
fetch_data_replace = """  Future<void> _fetchData() async {
    try {
      // 1. Get current admin roles/gender
      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null) {
         final adminDoc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
         if (adminDoc.exists) {
            final ad = adminDoc.data()!;
            _adminGender = (ad['gender'] ?? ad['profile']?['gender'] ?? '').toString().toLowerCase();
            final roles = List<String>.from(ad['roles'] ?? []);
            _isSuperAdmin = roles.contains('super_admin');
         }
      }

      List<dynamic> staffIds = widget.assignedStaffIds;
      if (staffIds.isEmpty) {
        final kSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
        if (kSnap.exists) {
           final d = kSnap.data()!;
           final List<dynamic> s = d['assignedStaff'] ?? [];
           final List<dynamic> d_ = d['assignedDrivers'] ?? [];
           final List<dynamic> w = d['assignedWaiters'] ?? [];
           staffIds = [...s, ...d_, ...w].toSet().toList();
        }
      }
      
      // Fetch names & genders for assigned staff (chunking for >30)
      final Map<String, String> names = {};
      final Map<String, String> genders = {};
      if (staffIds.isNotEmpty) {
        for (var i = 0; i < staffIds.length; i += 30) {
          final chunk = staffIds.sublist(i, i + 30 > staffIds.length ? staffIds.length : i + 30);
          final snap = await FirebaseFirestore.instance.collection('users')
              .where(FieldPath.documentId, whereIn: chunk)
              .get();
          for (final doc in snap.docs) {
            final data = doc.data();
            names[doc.id] = (data['name'] ?? data['profile']?['name'] ?? 'İsimsiz Görevli').toString();
            genders[doc.id] = (data['gender'] ?? data['profile']?['gender'] ?? '').toString().toLowerCase();
          }
        }
      }
      
      // Fetch all rosters (without double orderBy to prevent Firebase index errors)
      final snap = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('rosters')
          .get();
          
      final list = snap.docs.map((d) => KermesRoster.fromFirestore(d)).toList();
      
      // Memory Sorting (First by date, then by startTime)
      list.sort((a, b) {
        final dateCmp = a.date.compareTo(b.date);
        if (dateCmp != 0) return dateCmp;
        return a.startTime.compareTo(b.startTime);
      });

      if (mounted) {"""
content = re.sub(fetch_data_search, fetch_data_replace, content, flags=re.DOTALL)

# Also fix the assignment inside the set state block
fetch_end_search = """        setState(() {
          _allRosters = list;
          _userNames = names;
          _isLoading = false;
        });"""
fetch_end_replace = """        setState(() {
          _allRosters = list;
          _userNames = names;
          _userGenders = genders;
          _isLoading = false;
        });"""
content = content.replace(fetch_end_search, fetch_end_replace)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Dart script updated step 1")
