const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib/screens/staff/tabs/shift_dashboard_tab.dart');
let content = fs.readFileSync(file, 'utf8');

// Update _renderAssignmentCardInner signature
content = content.replace(
  /Widget _renderAssignmentCardInner\(StaffCapabilities capabilities, bool isDark, \{List<Map<String, dynamic>> dynamicRoles = const \[\], List<String> kermesAdmins = const \[\], DateTime\? startDate, DateTime\? endDate\}\) \{/,
  "Widget _renderAssignmentCardInner(StaffCapabilities capabilities, bool isDark, {List<Map<String, dynamic>> dynamicRoles = const [], List<String> kermesAdmins = const [], DateTime? startDate, DateTime? endDate, String? openingTime, String? closingTime}) {"
);

// Update Date row
content = content.replace(
  "_buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}', isDark),",
  "if (openingTime != null && closingTime != null) _buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}  |  $openingTime - $closingTime', isDark) else _buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}', isDark)," // simple formatting
);

// Update invocation inside _buildAssignmentCard
// Find the return _renderAssignmentCardInner(...)
content = content.replace(
  "final endDateTs = data['endDate'] as Timestamp?;",
  "final endDateTs = data['endDate'] as Timestamp?;\n        final opTime = data['openingTime']?.toString();\n        final clTime = data['closingTime']?.toString();"
);

content = content.replace(
  "endDate: endDateTs?.toDate(),",
  "endDate: endDateTs?.toDate(),\n          openingTime: opTime,\n          closingTime: clTime,"
);

fs.writeFileSync(file, content);
console.log('Fixed shift dash hours.');
