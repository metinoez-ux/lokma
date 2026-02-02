import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class OrganizationSearchSheet extends StatefulWidget {
  final Function(Map<String, dynamic>) onSelect;

  const OrganizationSearchSheet({
    super.key,
    required this.onSelect,
  });

  @override
  State<OrganizationSearchSheet> createState() =>
      _OrganizationSearchSheetState();
}

class _OrganizationSearchSheetState extends State<OrganizationSearchSheet> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _organizations = [];
  List<Map<String, dynamic>> _filteredOrganizations = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadOrganizations();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadOrganizations() async {
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('organizations')
          .orderBy('name')
          .get();

      setState(() {
        _organizations = snapshot.docs
            .map((doc) => {
                  'id': doc.id,
                  ...doc.data(),
                })
            .toList();
        _filteredOrganizations = _organizations;
        _loading = false;
      });
    } catch (e) {
      print('Error loading organizations: $e');
      setState(() {
        _loading = false;
      });
    }
  }

  void _filterOrganizations(String query) {
    if (query.isEmpty) {
      setState(() {
        _filteredOrganizations = _organizations;
      });
      return;
    }

    final lowerQuery = query.toLowerCase();
    setState(() {
      _filteredOrganizations = _organizations.where((org) {
        final name = (org['name'] as String? ?? '').toLowerCase();
        final shortName = (org['shortName'] as String? ?? '').toLowerCase();
        final city = (org['city'] as String? ?? '').toLowerCase();
        final postalCode = org['postalCode'] as String? ?? '';

        return name.contains(lowerQuery) ||
            shortName.contains(lowerQuery) ||
            city.contains(lowerQuery) ||
            postalCode.contains(query);
      }).toList();
    });
  }

  String _getTypeBadgeLabel(String? type) {
    switch (type) {
      case 'vikz':
        return 'VIKZ';
      case 'ditib':
        return 'DİTİB';
      case 'diyanet':
        return 'Diyanet';
      case 'igmg':
        return 'IGMG';
      case 'bagimsiz':
        return 'Bağımsız';
      default:
        return 'Diğer';
    }
  }

  Color _getTypeBadgeColor(String? type) {
    switch (type) {
      case 'vikz':
        return Colors.blue;
      case 'ditib':
        return Colors.green;
      case 'diyanet':
        return Colors.purple;
      case 'igmg':
        return Colors.orange;
      case 'bagimsiz':
        return Colors.grey;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: const BoxDecoration(
        color: Color(0xFF1F2937),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.grey[800]!),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      '🕌 Dernek Seç',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.grey),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Search Input
                TextField(
                  controller: _searchController,
                  onChanged: _filterOrganizations,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'İsim, şehir veya posta kodu ile ara...',
                    hintStyle: TextStyle(color: Colors.grey[500]),
                    filled: true,
                    fillColor: const Color(0xFF111827),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[700]!),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[700]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.blue),
                    ),
                    prefixIcon: const Icon(Icons.search, color: Colors.grey),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _loading
                      ? 'Yükleniyor...'
                      : '${_filteredOrganizations.length} dernek bulundu',
                  style: TextStyle(color: Colors.grey[400], fontSize: 12),
                ),
              ],
            ),
          ),

          // Organization List
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.blue),
                  )
                : _filteredOrganizations.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Sonuç bulunamadı',
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 18,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Farklı bir arama terimi deneyin',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _filteredOrganizations.length,
                        itemBuilder: (context, index) {
                          final org = _filteredOrganizations[index];
                          return _buildOrganizationCard(org);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrganizationCard(Map<String, dynamic> org) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        border: Border.all(color: Colors.grey[800]!),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            widget.onSelect(org);
            Navigator.pop(context);
          },
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Organization Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name
                      Text(
                        org['name'] ?? '',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      // Short Name
                      if (org['shortName'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            org['shortName'],
                            style: TextStyle(
                              color: Colors.grey[400],
                              fontSize: 14,
                            ),
                          ),
                        ),
                      // Location
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            const Text(
                              '📍',
                              style: TextStyle(fontSize: 14),
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${org['postalCode'] ?? ''} ${org['city'] ?? ''}${org['state'] != null ? ', ${org['state']}' : ''}',
                                style: TextStyle(
                                  color: Colors.grey[400],
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Address
                      if (org['address'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            org['address'],
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 12,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      // Phone
                      if (org['phone'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              const Text(
                                '📞',
                                style: TextStyle(fontSize: 12),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                org['phone'],
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                // Type Badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getTypeBadgeColor(org['type']),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _getTypeBadgeLabel(org['type']),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
