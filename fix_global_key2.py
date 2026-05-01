import re

file_path = "mobile_app/lib/screens/marketplace/kasap/business_detail_screen.dart"

with open(file_path, "r") as f:
    content = f.read()

# 1. Remove _scrollChipBarToSelected
content = re.sub(
    r"  /// Auto-scroll the horizontal chip bar so the selected chip is fully visible and centered\n.*?    \);\n  \}\n\n",
    "",
    content,
    flags=re.DOTALL
)

# 2. Remove _updatePillPosition
content = re.sub(
    r"  /// Measure selected chip position and update pill indicator\n.*?setState\(\{\n.*?_pillInitialized = true;\n.*?\}\);\n  \}\n",
    "",
    content,
    flags=re.DOTALL
)

with open(file_path, "w") as f:
    f.write(content)

print("Done")
