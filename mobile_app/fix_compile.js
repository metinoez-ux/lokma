const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'lib/screens/staff/kermes_supply_screen.dart');
const content = fs.readFileSync(file, 'utf8');

const updated = content.replace(
  /title: Row\([\s\S]*?subtitle: Column\(crossAxisAlignment: CrossAxisAlignment\.start, children: \[\n                                 Text\('\$\{d\['requestedByName'\]\} • \$\{d\['requestedZone'\]/g,
  \`title: Row(
                                  children: [
                                    Expanded(child: Text(d['itemName'] ?? '', style: TextStyle(fontWeight: FontWeight.bold, decoration: status == 'completed' ? TextDecoration.lineThrough : null))),
                                  ]
                               ),
                               subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                 Text('\${d['requestedByName']} • \${d['requestedZone']}'\`
);

fs.writeFileSync(file, updated);
