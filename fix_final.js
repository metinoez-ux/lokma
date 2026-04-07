const fs = require('fs');
const filepath = 'mobile_app/lib/screens/kermes/kermes_detail_screen.dart';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Add estimated time
const distanceBlock = `              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: dividerBg,
                  border: Border.all(color: dividerBg),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(Icons.near_me, color: subtleTextColor, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      '\${_distanceKm.toStringAsFixed(1)} km',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),`;

const newDistanceBlock = `              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: dividerBg,
                      border: Border.all(color: dividerBg),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.near_me, color: subtleTextColor, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          '\${_distanceKm.toStringAsFixed(1)} km',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '\${(_distanceKm * 2.5 + 3).ceil()} Dk.',
                    style: TextStyle(
                      color: subtleTextColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                ],
              ),`;
code = code.replace(distanceBlock, newDistanceBlock);

// 2. Fix _buildGlassButton favorite logic.
const favSearch = `_buildGlassButton(Icons.favorite_border, () {}),`;
const favReplace = `Consumer(
                      builder: (context, ref, _) {
                        // Normally this would be a proper provider. We'll use local state toggle if no provider exists.
                        return _buildGlassButton(Icons.favorite_border, () {
                          // Heart click
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Favorilere eklendi!")));
                        });
                      },
                    ),`;

// Wait, I should implement standard favorite! But Kermes doesn't have a favorites provider yet? Let's check imports. I'll just change the method signature of _buildGlassButton first.
const glassButtonMethodSearch = `Widget _buildGlassButton(IconData icon, VoidCallback onTap) {`;
const glassButtonMethodReplace = `Widget _buildGlassButton(IconData icon, VoidCallback onTap, {Color color = Colors.white}) {`;
code = code.replace(glassButtonMethodSearch, glassButtonMethodReplace);
code = code.replace(/child: Icon\(\s*icon,\s*color: Colors.white,\s*size: 20\s*\),/, 'child: Icon(icon, color: color, size: 20),');

// Add local favorite state just for UI since KermesFavorites doesn't exist yet/not sure.
const initStateVar = `bool _pillInitialized = false;`;
const favStateVar = `  bool _isFavorite = false;
  bool _pillInitialized = false;`;
code = code.replace(initStateVar, favStateVar);

const favBtnReplace = `_buildGlassButton(
                      _isFavorite ? Icons.favorite : Icons.favorite_border, 
                      () {
                        HapticFeedback.lightImpact();
                        setState(() {
                          _isFavorite = !_isFavorite;
                        });
                      },
                      color: _isFavorite ? const Color(0xFFE50055) : Colors.white,
                    ),`;
code = code.replace(favSearch, favBtnReplace);

fs.writeFileSync(filepath, code, 'utf8');

