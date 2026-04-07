const fs = require('fs');
const filepath = 'mobile_app/lib/screens/kermes/kermes_detail_screen.dart';
let code = fs.readFileSync(filepath, 'utf8');

code = code.replace(/widget\.event\.managerAvatarUrl/g, "null"); // Just don't show the avatar image since it doesn't exist
code = code.replace(/widget\.event\.managerName \?\? 'Kermes Yetkilisi'/g, "'Kermes Yetkilisi'");
code = code.replace(/widget\.event\.contactPhone \?\? '\+49 163 123 4567'/g, "widget.event.phoneNumber");
code = code.replace(/widget\.event\.parkingInfo != null && widget\.event\.parkingInfo!\.isNotEmpty/g, "widget.event.parking.isNotEmpty");
code = code.replace(/_showParkingInfo\(context, widget\.event\.parkingInfo\);/g, "_showParkingInfo(context, widget.event.parking);");

fs.writeFileSync(filepath, code, 'utf8');
