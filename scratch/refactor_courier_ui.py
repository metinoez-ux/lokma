import sys

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "r") as f:
    code = f.read()

# 1. Update Map TileLayer
code = code.replace(
    "urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',",
    "urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',\n                      subdomains: const ['a', 'b', 'c', 'd'],"
)

# 2. Extract Courier Info and Timing Info from _buildTrackingView
# We will just replace the `return Column(...)` structure.
old_tracking_view_start = """    return Column(
      children: [
        // Courier info header
        Container("""

# I'll just replace the entire _buildTrackingView and _buildCollapsibleOrderPanel 
# because it's easier and guarantees no structural syntax errors.
