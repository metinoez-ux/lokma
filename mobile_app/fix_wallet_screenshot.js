const fs = require('fs');
const path = require('path');

function replaceFunctions(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    /void _preventScreenshotOn\(\) async \{[\s\S]*?await ScreenProtector\.preventScreenshotOn\(\);\n  \}/g,
    'void _preventScreenshotOn() async { /* Handled centrally by staff_hub_screen */ }'
  );
  content = content.replace(
    /void _preventScreenshotOff\(\) async \{[\s\S]*?await ScreenProtector\.preventScreenshotOff\(\);\n  \}/g,
    'void _preventScreenshotOff() async { /* Handled centrally by staff_hub_screen */ }'
  );
  fs.writeFileSync(filePath, content);
}

replaceFunctions(path.join(__dirname, 'lib/screens/kermes/staff/combined_wallet_screen.dart'));
replaceFunctions(path.join(__dirname, 'lib/screens/wallet/wallet_screen.dart'));

const hubPath = path.join(__dirname, 'lib/screens/staff/staff_hub_screen.dart');
let hubContent = fs.readFileSync(hubPath, 'utf8');

if (!hubContent.includes('screen_protector.dart')) {
  hubContent = "import 'package:screen_protector/screen_protector.dart';\n" + hubContent;
}

hubContent = hubContent.replace(
  /setState\(\(\) => _selectedNavIndex = index\);/g,
  `setState(() {
                  _selectedNavIndex = index;
                  if (allDestinations[index]['label'] == 'Cüzdanım') {
                    ScreenProtector.preventScreenshotOn();
                  } else {
                    ScreenProtector.preventScreenshotOff();
                  }
               });`
);

// Add turn off to dispose as well
if (!hubContent.includes('ScreenProtector.preventScreenshotOff();')) {
   hubContent = hubContent.replace(
      /void dispose\(\) \{/,
      "void dispose() {\n    ScreenProtector.preventScreenshotOff();"
   );
   // And in initState ensure it's off initially
   hubContent = hubContent.replace(
      /void initState\(\) \{/,
      "void initState() {\n    ScreenProtector.preventScreenshotOff();\n"
   );
}

fs.writeFileSync(hubPath, hubContent);
console.log('Fixed screenshot protection leak.');
