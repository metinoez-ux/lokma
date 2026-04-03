import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/screens/kermes/kermes_menu_screen.dart';

class KermesMenuWrapper extends StatefulWidget {
  final String kermesId;
  final int initialDeliveryMode;
  final String? initialTableId;

  const KermesMenuWrapper({
    super.key,
    required this.kermesId,
    this.initialDeliveryMode = 0,
    this.initialTableId,
  });

  @override
  State<KermesMenuWrapper> createState() => _KermesMenuWrapperState();
}

class _KermesMenuWrapperState extends State<KermesMenuWrapper> {
  KermesEvent? _event;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchEvent();
  }

  Future<void> _fetchEvent() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .get();

      if (doc.exists && doc.data() != null) {
        // Mock parsing. Need to import kermes_model parser logic or just construct from doc
        // Wait, how does KermesListScreen process it? It manually creates `KermesEvent`
        final data = doc.data()!;

        DateTime startDate;
        if (data['startDate'] != null) {
          startDate = (data['startDate'] as Timestamp).toDate();
        } else if (data['date'] != null) {
          startDate = (data['date'] as Timestamp).toDate();
        } else {
          startDate = DateTime.now();
        }

        DateTime endDate;
        if (data['endDate'] != null) {
          endDate = (data['endDate'] as Timestamp).toDate();
        } else {
          endDate = startDate.add(const Duration(days: 1));
        }

        List<KermesMenuItem> menuItems = [];
        final itemsData = data['items'] ?? data['menuItems'];
        if (itemsData is List) {
          menuItems = itemsData
              .map((e) => KermesMenuItem(
                    name: e['title'] ?? e['name'] ?? '',
                    price: (e['price'] is num)
                        ? (e['price'] as num).toDouble()
                        : 0.0,
                    description: e['description']?.toString(),
                    imageUrl: e['imageUrl']?.toString(),
                    category: e['category']?.toString(),
                    categoryData: e['categoryData'] is Map
                        ? Map<String, dynamic>.from(e['categoryData'])
                        : null,
                  ))
              .toList();
        }

        final List<String> features = (data['features'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList();

        final event = KermesEvent(
          id: doc.id,
          title: data['name'] ?? data['title'] ?? '',
          address: data['address'] ?? '',
          city: data['city'] ?? '',
          phoneNumber: data['phoneNumber'] ?? '',
          startDate: startDate,
          endDate: endDate,
          latitude: data['latitude']?.toDouble() ?? 0.0,
          longitude: data['longitude']?.toDouble() ?? 0.0,
          menu: menuItems,
          parking: [],
          weatherForecast: [],
          openingTime: data['openingTime'] ?? '08:00',
          closingTime: data['closingTime'] ?? '22:00',
          flyers: data['imageUrl'] != null ? [data['imageUrl']] : [],
          hasTakeaway: features.contains('takeaway'),
          hasDelivery: features.contains('delivery'),
          hasDineIn: features.contains('dine_in') || features.contains('masa'),
          isMenuOnly: data['isMenuOnly'] ?? false,
          hasKidsActivities: features.contains('kids') || features.contains('kids_area'),
          activeBadgeIds: (data['activeBadgeIds'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
          selectedDonationFundId: data['selectedDonationFundId']?.toString(),
        );

        if (mounted) {
          setState(() {
            _event = event;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _error = 'Kermes not found';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Error loading kermes';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_error != null || _event == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Text(_error ?? 'An unknown error occurred'),
        ),
      );
    }

    return KermesMenuScreen(
      event: _event!,
      initialDeliveryMode: widget.initialDeliveryMode,
      initialTableId: widget.initialTableId,
    );
  }
}
