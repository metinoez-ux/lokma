const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib/screens/staff/kermes_supply_screen.dart');
let content = fs.readFileSync(file, 'utf8');

// Update _submitRequest signature and payload
content = content.replace(
  /Future<void> _submitRequest\(String itemName, \{String category = 'custom'\}\) async \{/,
  "Future<void> _submitRequest(String itemName, {String category = 'custom', String urgency = 'normal'}) async {"
);

content = content.replace(
  /'status': 'pending',/,
  "'status': 'pending',\n             'urgency': urgency,"
);

// Insert _askUrgencyAndSubmit
const askUrgencyFunc = `
  Future<void> _askUrgencyAndSubmit(String itemName, {String category = 'custom'}) async {
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final dIsDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: dIsDark ? const Color(0xFF222222) : Colors.white,
          title: Text('Aciliyet Durumu', style: TextStyle(color: dIsDark ? Colors.white : Colors.black, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
               Text('$itemName siparişiniz için aciliyet belirleyin:', style: const TextStyle(fontSize: 15)),
               const SizedBox(height: 20),
               ElevatedButton.icon(
                 style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                 icon: const Icon(Icons.local_fire_department),
                 label: const Text('Hemen Gelsin (Süper Acil)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                 onPressed: () => Navigator.pop(ctx, 'super_urgent'),
               ),
               const SizedBox(height: 12),
               OutlinedButton.icon(
                 style: OutlinedButton.styleFrom(foregroundColor: dIsDark ? Colors.white : Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                 icon: const Icon(Icons.hourglass_bottom),
                 label: const Text('1-2 Saat İçinde Olur'),
                 onPressed: () => Navigator.pop(ctx, 'normal'),
               ),
            ]
          )
        );
      }
    );

    if (result != null) {
      await _submitRequest(itemName, category: category, urgency: result);
    }
  }

`;

content = content.replace(
  /Widget _buildStatusBadge\(String status\) \{/,
  askUrgencyFunc + "  Widget _buildStatusBadge(String status) {"
);

// Replace button calls
content = content.replace(
  /onTap: \(\) => _submitRequest\(item as String, category: cat\['title'\]\),/g,
  "onTap: () => _askUrgencyAndSubmit(item as String, category: cat['title']),"
);

content = content.replace(
  /_submitRequest\(_customCtrl\.text\.trim\(\)\);/g,
  "_askUrgencyAndSubmit(_customCtrl.text.trim());"
);

// Modify Quick request chips UI
content = content.replace(
  /color: isDark \? Colors\.red\.withOpacity\(0\.2\) : Colors\.red\.shade50,/g,
  "color: isDark ? const Color(0xFFE5E5E5) : Colors.white,"
);
content = content.replace(
  /border: Border\.all\(color: Colors\.red\.withOpacity\(0\.3\)\),/g,
  "border: Border.all(color: Colors.red.shade700, width: 1.5),"
);
content = content.replace(
  /child: Text\(item, style: TextStyle\(color: isDark \? Colors\.red\.shade200 : Colors\.red\.shade700, fontWeight: FontWeight\.bold\)\),/g,
  "child: Text(item, style: TextStyle(color: Colors.red.shade900, fontWeight: FontWeight.bold)),"
);

// Modify ListTile to show urgency
content = content.replace(
  /title: Text\(d\['itemName'\] \?\? '',/,
  "title: Row(\n                                  children: [\n                                    Expanded(child: Text(d['itemName'] ?? '',"
);

content = content.replace(
  /subtitle: Text\('\$\{d\['requestedByName'\]\} • \$\{d\['requestedZone'\]\}', style: const TextStyle\(fontSize: 12\)\),/,
  "subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [\n                                 Text('${d['requestedByName']} • ${d['requestedZone']}', style: const TextStyle(fontSize: 12)),\n                                 if (d['urgency'] == 'super_urgent')\n                                   Container(margin: const EdgeInsets.only(top: 4), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.red)), child: const Text('🔥 SÜPER ACİL', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)))\n                               ]),"
);

// Complete the Row mapping
content = content.replace(
  /\]\}', style: const TextStyle\(fontSize: 12\)\),/, // Already replaced subtitle, let's fix the title replacement
  ""
);

fs.writeFileSync(file, content);
console.log('Mobile app supply UI updated successfully.');
