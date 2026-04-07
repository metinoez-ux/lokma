const fs = require('fs');
const filepath = 'mobile_app/lib/screens/kermes/kermes_detail_screen.dart';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Move SliverAppBar to the top
const appbarRegex = /\/\/ 1\. Top Bar: Back Button & Search Bar\n\s*SliverAppBar\([\s\S]*?flexibleSpace: Column\([\s\S]*?SizedBox\([\s\S]*?Padding\([\s\S]*?Row\([\s\S]*?\/\/\s*Back\s*Button[\s\S]*?GestureDetector\([\s\S]*?Icon\(Icons.arrow_back_ios_new[\s\S]*?\),[\s\S]*?const SizedBox\(width: 12\),[\s\S]*?\/\/\s*Search\s*Bar[\s\S]*?Expanded\([\s\S]*?child: Container\([\s\S]*?TextField\([\s\S]*?\}\),[\s\S]*?\]\,[\s\S]*?\)\,[\s\S]*?\)\,[\s\S]*?\)\,[\s\S]*?\],[\s\S]*?\),[\s\S]*?\),[\s\S]*?\),[\s\S]*?\],[\s\S]*?\),[\s\S]*?\),/;
// Wait, my regex above might fail, I'll just find the exact block and slice it.

// Let's just find the index of "// 1. Top Bar: Back Button & Search Bar"
let appbarStart = code.indexOf('          // 1. Top Bar: Back Button & Search Bar');
let appbarEnd = code.indexOf('          // 2. HERO IMAGE CARD');
if (appbarStart !== -1 && appbarEnd !== -1) {
    let appbarString = code.substring(appbarStart, appbarEnd);
    code = code.substring(0, appbarStart) + code.substring(appbarEnd);
    
    // Now replace the Search Bar Expanded thing with AnimatedOpacity
    appbarString = appbarString.replace(
        /\/\/\s*Search\s*Bar\n\s*Expanded\(\s*child:\s*Container\(/,
        '// Search Bar\n                        Expanded(\n                          child: AnimatedOpacity(\n                            duration: const Duration(milliseconds: 200),\n                            opacity: _showSearchBar ? 1.0 : 0.0,\n                            child: IgnorePointer(\n                              ignoring: !_showSearchBar,\n                              child: Container('
    );
    appbarString = appbarString.replace(
        /                                \),[\s\n]*\],[\s\n]*\),[\s\n]*\),[\s\n]*\),/m,
        '                                ),\n                              ],\n                            ),\n                          ),\n                        ),\n                        ),'
    );
    
    // Insert appbar right after CustomScrollView slivers: [
    let target = 'slivers: [';
    let targetIdx = code.indexOf(target);
    if (targetIdx !== -1) {
        code = code.substring(0, targetIdx + target.length) + '\n' + appbarString + code.substring(targetIdx + target.length);
    }
}

// 2. Wrap the Menu and Sipariş inside Hero Section with onTap to _menuAnchorKey
let heroBlock = `                                Text('Menü ve Sipariş',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 28,
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),`;
let newHeroBlock = `                                GestureDetector(
                                  onTap: () {
                                    if (_menuAnchorKey.currentContext != null) {
                                      Scrollable.ensureVisible(_menuAnchorKey.currentContext!, duration: const Duration(milliseconds: 300));
                                    }
                                  },
                                  child: Row(
                                    children: [
                                      Text('Menü ve Sipariş',
                                          style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 28,
                                              fontWeight: FontWeight.bold)),
                                      const SizedBox(width: 8),
                                      const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 18),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),`;
code = code.replace(heroBlock, newHeroBlock);


fs.writeFileSync(filepath, code, 'utf8');
