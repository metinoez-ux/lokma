import re
import os

filepath = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/auth/login_screen.dart'
with open(filepath, 'r') as f:
    code = f.read()

# 1. Inject getter helpers right after the state class declaration
getters = """
  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _textColor => _isDark ? Colors.white : Colors.black87;
  Color get _borderColor => _isDark ? Colors.grey.shade800 : Colors.grey.shade300;
  Color get _cardColor => _isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100;
  Color get _hintColor => _isDark ? Colors.white54 : Colors.black54;
"""
if "bool get _isDark" not in code:
    code = re.sub(
        r'(class _LoginScreenState extends ConsumerState<LoginScreen> \{)',
        r'\1\n' + getters,
        code,
        count=1
    )

# 2. Main Scaffold Background
# Find `color: lokmaRed` in the `build()` method but wait, it's safer to just replace it:
code = code.replace("color: lokmaRed,", "color: Theme.of(context).scaffoldBackgroundColor,")
code = code.replace("backgroundColor: lokmaRed,", "backgroundColor: Theme.of(context).scaffoldBackgroundColor,")

# 3. Logo replacement
code = code.replace("'assets/images/lokma_logo_white.png'", "_isDark ? 'assets/images/lokma_logo_white.png' : 'assets/images/logo_lokma_red.png'")

# 4. Color replacements across the file
# TextStyles with Colors.white
code = re.sub(r'color:\s*Colors\.white([^0-9A-Za-z])', r'color: _textColor\1', code)
# Fix up things that actually *need* to be white, like elevated buttons (primary button)
# In primary button:
code = code.replace("color: _textColor, fontSize: 16", "color: Colors.white, fontSize: 16") # Assuming primary button text is still white. Let's find it.
code = code.replace("const CircularProgressIndicator(color: _textColor)", "CircularProgressIndicator(color: _textColor)")

# Replace Colors.white.withOpacity(X)
code = re.sub(r'Colors\.white\.withOpacity\([0-9.]+\)', r'_textColor.withOpacity(0.6)', code)
code = code.replace("const TextStyle(color: Colors.white70", "TextStyle(color: _textColor.withOpacity(0.7)")
code = code.replace("color: Colors.white70", "color: _textColor.withOpacity(0.7)")

# Replace borders
code = code.replace("side: BorderSide(color: _textColor.withOpacity(0.6))", "side: BorderSide(color: _borderColor)")
code = code.replace("border: Border.all(color: _textColor.withOpacity(0.6))", "border: Border.all(color: _borderColor)")
# Replace pill backgrounds
code = code.replace("color: _textColor.withOpacity(0.6), // pill bg", "color: _cardColor,")

# 5. Let's fix specific widgets
# e.g., in phone input:
code = code.replace("color: _textColor.withOpacity(0.6),\n              borderRadius: BorderRadius.circular(16),", "color: _cardColor,\n              borderRadius: BorderRadius.circular(16),")
code = code.replace("color: _textColor.withOpacity(0.6),\n                      borderRadius: const BorderRadius.only(", "color: _borderColor.withOpacity(0.3),\n                      borderRadius: const BorderRadius.only(")

# Let's write the modified code back
with open(filepath, 'w') as f:
    f.write(code)

print("Replacement applied")
