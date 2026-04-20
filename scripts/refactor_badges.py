import re

file_path = 'mobile_app/lib/screens/kermes/kermes_detail_screen.dart'
with open(file_path, 'r') as f:
    lines = f.readlines()

# We know the block in the Menu ve Siparis Card starts at line 1856: // Dynamic Sponsor / Certificate Badges
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '// Dynamic Sponsor / Certificate Badges' in line and start_idx == -1:
        start_idx = i
        break

# Find where it ends
brackets = 0
found_positioned = False
for i in range(start_idx, len(lines)):
    line = lines[i]
    if 'Positioned(' in line:
        found_positioned = True
    if found_positioned:
        brackets += line.count('(') - line.count(')')
        if brackets <= 0 and i > start_idx + 2:
            end_idx = i
            break

print(f"Block found from {start_idx} to {end_idx}")

# The block to extract
block_lines = lines[start_idx:end_idx+1]
# Remove it from the current location
del lines[start_idx:end_idx+1]

# Insert the helper method call at the current location
helper_call = [
    "                          // Dynamic Sponsor / Certificate Badges\n",
    "                          if (_currentEvent.activeBadgeIds.isNotEmpty && _activeBadges != null)\n",
    "                            Positioned(\n",
    "                              top: 16,\n",
    "                              left: 16,\n",
    "                              child: _buildDynamicBadges(context),\n",
    "                            ),\n"
]
for i, l in reversed(list(enumerate(helper_call))):
    lines.insert(start_idx, l)

# Create the helper method
helper_method = [
    "\n  Widget _buildDynamicBadges(BuildContext context, {CrossAxisAlignment alignment = CrossAxisAlignment.start}) {\n",
    "    bool isTurkey = false;\n",
    "    if (widget.currentPosition != null) {\n",
    "      final lat = widget.currentPosition!.latitude;\n",
    "      final lng = widget.currentPosition!.longitude;\n",
    "      if (lat >= 35.8 && lat <= 42.1 && lng >= 25.6 && lng <= 44.8) isTurkey = true;\n",
    "    }\n",
    "    final uniqueBadges = <String, KermesBadge>{};\n",
    "    for (final badgeId in _currentEvent.activeBadgeIds) {\n",
    "      KermesBadge? badge = _activeBadges![badgeId];\n",
    "      if (badge == null || !badge.isActive) continue;\n",
    "      String bName = badge.label.toLowerCase();\n",
    "      if (bName.contains('tuna') || bName.contains('toros')) {\n",
    "        if (isTurkey) {\n",
    "          final torosBadge = _activeBadges!.values.where((b) => b.label.toLowerCase().contains('toros')).firstOrNull;\n",
    "          if (torosBadge != null) badge = torosBadge;\n",
    "        } else {\n",
    "          final tunaBadge = _activeBadges!.values.where((b) => b.label.toLowerCase().contains('tuna')).firstOrNull;\n",
    "          if (tunaBadge != null) badge = tunaBadge;\n",
    "        }\n",
    "      }\n",
    "      uniqueBadges[badge!.id] = badge;\n",
    "    }\n",
    "    return Column(\n",
    "      crossAxisAlignment: alignment,\n",
    "      mainAxisSize: MainAxisSize.min,\n",
    "      children: uniqueBadges.values.map((badge) {\n",
    "        final bgColor = Color(int.parse(badge.colorHex.replaceFirst('#', '0xFF')));\n",
    "        final textColor = Color(int.parse(badge.textColorHex.replaceFirst('#', '0xFF')));\n",
    "        final hasIcon = badge.iconUrl.isNotEmpty;\n",
    "        return GestureDetector(\n",
    "          onTap: () {\n",
    "            HapticFeedback.lightImpact();\n",
    "            final badgeLower = badge.label.toLowerCase();\n",
    "            if (badgeLower.contains('tuna')) {\n",
    "              BrandInfoSheet.show(context, forcedBrand: 'tuna');\n",
    "            } else if (badgeLower.contains('toros')) {\n",
    "              BrandInfoSheet.show(context, forcedBrand: 'toros');\n",
    "            } else {\n",
    "              _showBadgeDetailsBottomSheet(badge);\n",
    "            }\n",
    "          },\n",
    "          child: Container(\n",
    "            margin: const EdgeInsets.only(bottom: 8),\n",
    "            padding: EdgeInsets.symmetric(horizontal: hasIcon ? 4 : 14, vertical: hasIcon ? 4 : 6),\n",
    "            decoration: BoxDecoration(\n",
    "              color: hasIcon ? Colors.transparent : bgColor,\n",
    "              borderRadius: BorderRadius.circular(50),\n",
    "              border: hasIcon ? null : Border.all(color: Colors.white24, width: 0.5),\n",
    "              boxShadow: hasIcon ? null : [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 4, offset: const Offset(0, 2))],\n",
    "            ),\n",
    "            child: Row(\n",
    "              mainAxisSize: MainAxisSize.min,\n",
    "              children: [\n",
    "                if (hasIcon)\n",
    "                  ClipRRect(\n",
    "                    borderRadius: BorderRadius.circular(8),\n",
    "                    child: LokmaNetworkImage(\n",
    "                      imageUrl: badge.iconUrl,\n",
    "                      height: 33,\n",
    "                      fit: BoxFit.contain,\n",
    "                      placeholder: (context, url) => Container(color: Colors.transparent, height: 33, width: 33),\n",
    "                      errorWidget: (context, url, error) => Icon(Icons.verified, color: textColor, size: 24),\n",
    "                    ),\n",
    "                  )\n",
    "                else ...[\n",
    "                  Icon(Icons.verified, color: textColor, size: 15),\n",
    "                  const SizedBox(width: 6),\n",
    "                  Text(badge.label.toUpperCase(), style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.8)),\n",
    "                  const SizedBox(width: 8),\n",
    "                  Icon(Icons.info_outline, color: textColor.withOpacity(0.8), size: 16),\n",
    "                ],\n",
    "              ],\n",
    "            ),\n",
    "          ),\n",
    "        );\n",
    "      }).toList(),\n",
    "    );\n",
    "  }\n"
]

# Insert helper method at the end of the file before last brace
for i in range(len(lines)-1, -1, -1):
    if lines[i].strip() == '}':
        for l in reversed(helper_method):
            lines.insert(i, l)
        break

# Now add the call to helper inside _buildHeroSection at bottom: 110, right: 24
hero_insertion_str = """
          // Bottom Right: Dynamic Sponsor / Certificate Badges (Tuna)
          if (_currentEvent.activeBadgeIds.isNotEmpty && _activeBadges != null)
            Positioned(
              bottom: 110,
              right: 24,
              child: _buildDynamicBadges(context, alignment: CrossAxisAlignment.end),
            ),
"""

# Find Top Action Buttons to insert right BEFORE them
top_action_idx = -1
for i, line in enumerate(lines):
    if '// Top Action Buttons' in line:
        top_action_idx = i
        break

if top_action_idx != -1:
    lines.insert(top_action_idx, hero_insertion_str)

with open(file_path, 'w') as f:
    f.writelines(lines)
    
print("Refactor complete.")
