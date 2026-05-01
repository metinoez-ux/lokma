import re

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "r") as f:
    code = f.read()

# 1. Update Map TileLayer
code = code.replace(
    "urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',",
    "urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',\n                      subdomains: const ['a', 'b', 'c', 'd'],"
)

# 2. Extract Courier Info blocks
old_courier_info = """        // Courier info header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Courier avatar
              CircleAvatar(
                radius: 28,
                backgroundColor: _brandColor.withOpacity(0.15),
                child: const Icon(Icons.person, color: _brandColor, size: 32),
              ),
              const SizedBox(width: 16),
              
              // Courier info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatCourierName(order.courierName),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.green.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.delivery_dining, 
                                   size: 16, color: Colors.green.shade700),
                              const SizedBox(width: 4),
                              Text(
                                tr('orders.on_the_way'),
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.green.shade700,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (order.etaMinutes != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '~${order.etaMinutes} dk',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                    // Distance & ETA info
                    if (distanceKm != null && etaMinutes != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.route, size: 13, color: Colors.blue.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  '${distanceKm.toStringAsFixed(1)} km',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.blue.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.timer_outlined, size: 13, color: Colors.amber.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  '~$etaMinutes dk',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.amber.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              
              // Call button
              if (order.courierPhone != null && order.courierPhone!.isNotEmpty)
                IconButton(
                  onPressed: () => _callCourier(order.courierPhone!),
                  icon: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: const Icon(Icons.phone, color: Colors.white),
                  ),
                ),
            ],
          ),
        ),
        
        // Timing Info Banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: isDark ? Colors.grey[850] : Colors.grey[100],
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (order.claimedAt != null)
                Text(
                  'Yola Çıkış: ${_formatDateAndTime(order.claimedAt!)}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.grey[300] : Colors.grey[800],
                  ),
                ),
              if (order.lastLocationUpdate != null)
                Text(
                  'Son güncelleme: ${_formatTime(order.lastLocationUpdate!)}',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
            ],
          ),
        ),"""

code = code.replace(old_courier_info, "")

# 3. Add FAB and update _buildCollapsibleOrderPanel signature inside _buildTrackingView
old_tracking_bottom = """              // Info banner when courier location is not available
              if (!hasLocation)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade700,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: Colors.white, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            tr('orders.courier_location_unavailable'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),

        // Collapsible order details panel
        _buildCollapsibleOrderPanel(order, isDark),
      ],
    );"""

new_tracking_bottom = """              // Info banner when courier location is not available
              if (!hasLocation)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade700,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: Colors.white, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            tr('orders.courier_location_unavailable'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
              // Re-center button
              Positioned(
                right: 16,
                bottom: 16,
                child: FloatingActionButton(
                  mini: true,
                  backgroundColor: Colors.white,
                  onPressed: _centerMapOnAvailablePositions,
                  child: Icon(Icons.my_location, color: Colors.blue.shade700),
                ),
              ),
            ],
          ),
        ),

        // Collapsible order details panel
        _buildCollapsibleOrderPanel(order, isDark, distanceKm, etaMinutes),
      ],
    );"""

code = code.replace(old_tracking_bottom, new_tracking_bottom)

# 4. Insert Courier info inside _buildCollapsibleOrderPanel
old_panel_start = """  Widget _buildCollapsibleOrderPanel(LokmaOrder order, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 6,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: ["""

new_panel_start = """  Widget _buildCollapsibleOrderPanel(LokmaOrder order, bool isDark, double? distanceKm, int? etaMinutes) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Courier info header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                // Courier avatar
                CircleAvatar(
                  radius: 24,
                  backgroundColor: _brandColor.withOpacity(0.15),
                  child: const Icon(Icons.person, color: _brandColor, size: 28),
                ),
                const SizedBox(width: 16),
                
                // Courier info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _formatCourierName(order.courierName),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.delivery_dining, 
                                     size: 14, color: Colors.green.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  tr('orders.on_the_way'),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.green.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Distance & ETA info
                          if (distanceKm != null && etaMinutes != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '~${etaMinutes} dk (${distanceKm.toStringAsFixed(1)} km)',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                
                // Call button
                if (order.courierPhone != null && order.courierPhone!.isNotEmpty)
                  IconButton(
                    onPressed: () => _callCourier(order.courierPhone!),
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(Icons.phone, color: Colors.white, size: 18),
                    ),
                  ),
              ],
            ),
          ),
          
          Divider(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
"""

code = code.replace(old_panel_start, new_panel_start)

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "w") as f:
    f.write(code)
