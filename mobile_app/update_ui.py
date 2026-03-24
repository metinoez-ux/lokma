import re

file_path = "lib/screens/marketplace/kasap/business_detail_screen.dart"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace infoCardColor
content = re.sub(
    r"final infoCardColor = isSuccess\s*\?\s*\(isDark \? const Color\(0xFF1B3A1B\) : const Color\(0xFFE8F5E9\)\)\s*:\s*\(isDark \? const Color\(0xFF222222\) : const Color\(0xFFD8D8D8\)\)[^\n]+",
    "final infoCardColor = isSuccess\n          ? (isDark ? const Color(0xFF67C973) : const Color(0xFF67C973))\n          : (isDark ? const Color(0xFF4A4A4A) : const Color(0xFFE0E0E0));",
    content
)

# Replace shadowStripColor
content = re.sub(
    r"final shadowStripColor = isDark\s*\?\s*const Color\(0xFF2A2A2C\)\s*:\s*const Color\(0xFFF5F5F5\)[^\n]+",
    "final shadowStripColor = Theme.of(context).scaffoldBackgroundColor;",
    content
)

# Heights
content = re.sub(
    r"final textRowHeight = 36\.0;\s*final frontLipHeight = 16\.0;",
    "final textRowHeight = 44.0;\n      final frontLipHeight = 16.0;",
    content
)

# Text translation
content = re.sub(
    r"'marketplace\.min_order_remaining'\.tr\(namedArgs: \{\s*'amount': remaining\.toStringAsFixed\(2\),\s*'currency': currency,\s*\}\)",
    "'marketplace.min_order_add_text'.tr(namedArgs: {\n                                'amount': remaining.toStringAsFixed(2),\n                                'currency': currency,\n                                'minOrder': minOrder.toStringAsFixed(0),\n                              })",
    content
)

# Top overlap for front lip
content = re.sub(
    r"top: textRowHeight \+ 16, // Starts right below the text area",
    "top: textRowHeight, // Lets the text peek out",
    content
)

# Border Radii for Lip
content = re.sub(
    r"borderRadius: const BorderRadius\.vertical\(top: Radius\.circular\(16\)\),",
    "borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated business_detail_screen.dart")
