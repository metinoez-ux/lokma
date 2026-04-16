const fs = require('fs');
const path = require('path');

const dash = path.join(__dirname, 'lib/screens/staff/tabs/shift_dashboard_tab.dart');
let dashContent = fs.readFileSync(dash, 'utf8');

// Ensure import
if (!dashContent.includes('easy_localization.dart')) {
  dashContent = "import 'package:easy_localization/easy_localization.dart';\n" + dashContent;
}

dashContent = dashContent.replace(/context\.l10n\.supply_btn_title/g, "'supply_btn_title'.tr()");
fs.writeFileSync(dash, dashContent);

const screen = path.join(__dirname, 'lib/screens/staff/kermes_supply_screen.dart');
let content = fs.readFileSync(screen, 'utf8');
if (!content.includes('easy_localization.dart')) {
  content = "import 'package:easy_localization/easy_localization.dart';\n" + content;
}

// Replace context.l10n.key with 'key'.tr() properly for strings
content = content.replace(/\$\{context\.l10n\.supply_already_requested\}/g, "${'supply_already_requested'.tr()}");
content = content.replace(/\$\{context\.l10n\.supply_request_sent\}/g, "${'supply_request_sent'.tr()}");

// Replace raw context.l10n.key with 'key'.tr()
function replaceRaw(content, key) {
   let re = new RegExp(`context\\.l10n\\.${key}`, 'g');
   return content.replace(re, `'${key}'.tr()`);
}

const keys = [
  "supply_status_completed", "supply_status_on_the_way", "supply_status_pending", "supply_alarm_title",
  "supply_quick_request", "supply_categories", "supply_custom_item_hint", "supply_request_btn",
  "supply_no_items", "supply_live_list", "supply_already_requested", "supply_request_sent"
];

for(const k of keys) {
  content = replaceRaw(content, k);
}

fs.writeFileSync(screen, content);
console.log("Dart TS replaced to tr()");
