const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib/screens/staff/tabs/shift_dashboard_tab.dart');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "if (openingTime != null && closingTime != null) _buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}  |  $openingTime - $closingTime', isDark) else _buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}', isDark),",
  "_buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}', isDark),\n            const SizedBox(height: 15),\n            if (openingTime != null && closingTime != null) ...[\n              _buildInfoRow('Saatler:', '$openingTime - $closingTime', isDark),\n            ],"
);

fs.writeFileSync(file, content);
console.log('Fixed hours row.');
