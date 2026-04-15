void main() {
  var data = {'tableNumber': '5', 'createdByStaffName': 'Garson Ahmet'};
  final String? tableSection = data['tableSection'];
  final String? tableNumber = data['tableNumber'];
  final String? assignedTezgah = data['assignedTezgah'];
  final String? createdByStaffName = data['createdByStaffName'];

  List<String> parts = [];
  if (tableSection != null && tableSection.isNotEmpty) parts.add(tableSection);
  if (tableNumber != null && tableNumber.isNotEmpty) parts.add('Masa $tableNumber');
  if (assignedTezgah != null && assignedTezgah.isNotEmpty) parts.add('Tezgah: $assignedTezgah');
  if (parts.isEmpty && createdByStaffName != null) parts.add('Sorumlu: $createdByStaffName');

  print(parts.join(' - '));
}
