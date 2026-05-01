import re

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "r") as f:
    content = f.read()

target = """
                    ),
                  ],
                ),
              ),
"""

replacement = """
                    ),
                  ],
                ),
              ),
              // Floating Buttons for Map
              Positioned(
                right: 16,
                bottom: 16,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    FloatingActionButton(
                      heroTag: 'refresh_map',
                      mini: true,
                      backgroundColor: Colors.white,
                      onPressed: () {
                        // ignore: invalid_use_of_protected_member
                        setState(() => _refreshKey++);
                      },
                      child: const Icon(Icons.refresh, color: Colors.black87),
                    ),
                    const SizedBox(height: 8),
                    FloatingActionButton(
                      heroTag: 'center_map',
                      backgroundColor: Colors.white,
                      onPressed: () {
                        _centerMapOnAvailablePositions();
                      },
                      child: const Icon(Icons.my_location, color: Colors.blue),
                    ),
                  ],
                ),
              ),
"""

content = content.replace(target, replacement)

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "w") as f:
    f.write(content)

