const fs = require('fs');
const filepath = 'mobile_app/lib/screens/kermes/kermes_detail_screen.dart';
let code = fs.readFileSync(filepath, 'utf8');

// 1. In CustomScrollView, replace the sequence of cards
const sequenceRegex = /_buildLocationCard\(\),[\s\n]*const SizedBox\(height: 20\),[\s\n]*_buildParkingCard\(\),[\s\n]*const SizedBox\(height: 20\),[\s\n]*_buildWeatherSection\(\),[\s\n]*const SizedBox\(height: 20\),[\s\n]*_buildAdminCard\(\),[\s\n]*_buildContactCard\(\),/m;
code = code.replace(sequenceRegex, `_buildLocationCard(),\n                      const SizedBox(height: 20),\n                      _buildWeatherSection(),\n                      const SizedBox(height: 20),\n                      _buildAdminAndContactCard(),`);

// 2. We need to implement the merged _buildLocationCard and _buildAdminAndContactCard. 
// I'll just write those methods and append them after _buildLocationCard natively in the file, replacing the old ones.

const endOfLocationCardRegex = /Widget _buildWeatherSection\(\) \{/;
const newMethods = `  Widget _buildAdminAndContactCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kermes Yetkilisi Top Section
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: dividerBg, width: 2),
                  ),
                  child: ClipOval(
                    child: widget.event.managerAvatarUrl != null && widget.event.managerAvatarUrl!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: widget.event.managerAvatarUrl!,
                            fit: BoxFit.cover,
                          )
                        : Icon(Icons.person, color: subtleTextColor, size: 24),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              widget.event.managerName ?? 'Kermes Yetkilisi',
                              style: TextStyle(
                                color: textColor,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDark ? lokmaPink.withOpacity(0.2) : lokmaPink.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'YETKİLİ',
                              style: TextStyle(
                                color: isDark ? lokmaPink : const Color(0xFFE50055),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Sorularınız için iletişime geçebilirsiniz.',
                        style: TextStyle(
                          color: subtleTextColor,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Bize Ulaşın Bottom Section
          Padding(
            padding: const EdgeInsets.only(left: 24, right: 24, bottom: 24),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.03),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.phone, color: Colors.green, size: 20),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Telefon',
                          style: TextStyle(
                            color: subtleTextColor,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.event.contactPhone ?? '+49 163 123 4567',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeatherSection() {`;

code = code.replace(endOfLocationCardRegex, newMethods);

// Modify _buildLocationCard to add Parking Button next to Route Button
let locCardRegex = /const SizedBox\(height: 24\),[\s\n]*SizedBox\([\s\n]*width: double\.infinity,[\s\n]*child: FilledButton\.icon\([\s\S]*?icon: const Icon\(Icons\.directions, size: 20\),[\s\n]*label: const Text\('Yol Tarifi Al'\),[\s\S]*?\),[\s\n]*\),\s*\]\,\s*\)\,\s*\)\;/m;

let newLocBottom = `          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {},
                  style: FilledButton.styleFrom(
                    backgroundColor: isDark ? const Color(0xFF1E1E24) : Colors.black,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.directions, size: 20),
                  label: const Text('Yol Tarifi Al', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              if (widget.event.parkingInfo != null && widget.event.parkingInfo!.isNotEmpty) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      _showParkingInfo(context, widget.event.parkingInfo);
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: lokmaPink.withOpacity(0.1),
                      foregroundColor: isDark ? lokmaPink : const Color(0xFFE50055),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.local_parking, size: 20),
                    label: const Text('Park Bilgisi', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );`;
code = code.replace(locCardRegex, newLocBottom);

// Delete the old _buildParkingCard, _buildAdminCard, _buildContactCard logic entirely from the file
code = code.replace(/Widget _buildParkingCard\(\) \{[\s\S]*?return Container\([\s\S]*?\}\s*\}\s*Widget _buildWeatherSection/m, 'Widget _buildWeatherSection');
code = code.replace(/Widget _buildAdminCard\(\) \{[\s\S]*?Widget _buildContactCard\(\) \{[\s\S]*?Widget _buildFeaturesRow/m, 'Widget _buildFeaturesRow');

fs.writeFileSync(filepath, code, 'utf8');

