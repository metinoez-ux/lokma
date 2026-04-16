const fs = require('fs');
const path = require('path');

const dash = path.join(__dirname, 'lib/screens/staff/tabs/shift_dashboard_tab.dart');
let dashContent = fs.readFileSync(dash, 'utf8');
dashContent = dashContent.replace(/'Malzeme Belirt \/ Alarm Ver'/g, "context.l10n.supply_btn_title");
fs.writeFileSync(dash, dashContent);

const screen = path.join(__dirname, 'lib/screens/staff/kermes_supply_screen.dart');
let content = fs.readFileSync(screen, 'utf8');

content = content.replace(/'\$itemName zaten az .nce istendi!'/g, "'''$itemName ${context.l10n.supply_already_requested}'''");
content = content.replace(/'Talebiniz iletildi: \$itemName'/g, "'''${context.l10n.supply_request_sent} $itemName'''");
content = content.replace(/'Tamamland.'/g, "context.l10n.supply_status_completed");
content = content.replace(/'Yola Ç.kt.'/g, "context.l10n.supply_status_on_the_way");
content = content.replace(/'Acil Bekliyor'/g, "context.l10n.supply_status_pending");
content = content.replace(/'Malzeme Alarm.'/g, "context.l10n.supply_alarm_title");
content = content.replace(/'H.zl. Malzeme İste'/g, "context.l10n.supply_quick_request");
content = content.replace(/'Mutfak\/Tedarik Kategorileri'/g, "context.l10n.supply_categories");
content = content.replace(/'Özel Malzeme Yaz.n\.\.\.'/g, "context.l10n.supply_custom_item_hint");
content = content.replace(/'Talep Et'/g, "context.l10n.supply_request_btn");
content = content.replace(/'Sisteme hen.z haz.r malzeme tan.mlanmam.ş\.'/g, "context.l10n.supply_no_items");
content = content.replace(/'Canl. İhtiya. Listesi'/g, "context.l10n.supply_live_list");

// Update Text('text') to Text(text)
function unquote(fileContent) {
   fileContent = fileContent.replace(/Text\(context\.l10n\.([^)]+)\)/g, 'Text(context.l10n.$1)');
   // Some matches could be inside const Text('..') which would become const Text(context.l10n..)
   fileContent = fileContent.replace(/const Text\(context\.l10n/g, 'Text(context.l10n');
   return fileContent;
}

content = unquote(content);
fs.writeFileSync(screen, content);
console.log("Dart TS updated.");

