import re
import os

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/profile/notification_history_screen.dart'
dest_dir = '/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/profile/widgets/notification'
os.makedirs(dest_dir, exist_ok=True)

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def write_widget(filename, start_line, end_line, class_replacements):
    filepath = os.path.join(dest_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("import 'package:flutter/material.dart';\n")
        f.write("import 'package:flutter_riverpod/flutter_riverpod.dart';\n")
        f.write("import 'package:cloud_firestore/cloud_firestore.dart';\n")
        f.write("import 'package:timeago/timeago.dart' as timeago;\n")
        f.write("import 'package:flutter_svg/flutter_svg.dart';\n")
        f.write("import '../../../../services/order_service.dart';\n")
        f.write("import '../../../../utils/currency_utils.dart';\n")
        f.write("import '../../../../providers/cart_provider.dart';\n")
        f.write("import '../../../../models/butcher_product.dart';\n")
        f.write("import '../../../../models/product_option.dart';\n\n")

        for line in lines[start_line-1:end_line]:
            modified_line = line
            for old, new in class_replacements.items():
                modified_line = modified_line.replace(old, new)
            f.write(modified_line)

replacements = {
    '_OrderTimelineCard': 'OrderTimelineCard',
    '_OrderStatusRow': 'OrderStatusRow',
    '_GenericNotificationCard': 'GenericNotificationCard',
    '_ChatBottomSheetContent': 'ChatBottomSheetContent',
    '_ReservationCard': 'ReservationCard',
    '_HeartOverlayWidget': 'HeartOverlayWidget',
}

write_widget('order_timeline_card.dart', 2372, 4303, replacements)
write_widget('order_status_row.dart', 4304, 4366, replacements)
write_widget('generic_notification_card.dart', 4367, 4547, replacements)
write_widget('chat_bottom_sheet_content.dart', 4548, 4928, replacements)
write_widget('reservation_card.dart', 4929, 5150, replacements)
write_widget('heart_overlay_widget.dart', 5151, len(lines), replacements)

# Create the shortened screen file
with open(file_path, 'w', encoding='utf-8') as f:
    # First, insert imports to the new widgets
    for i, line in enumerate(lines[:20]):
        f.write(line)
        
    f.write("import 'widgets/notification/order_timeline_card.dart';\n")
    f.write("import 'widgets/notification/order_status_row.dart';\n")
    f.write("import 'widgets/notification/generic_notification_card.dart';\n")
    f.write("import 'widgets/notification/chat_bottom_sheet_content.dart';\n")
    f.write("import 'widgets/notification/reservation_card.dart';\n")
    f.write("import 'widgets/notification/heart_overlay_widget.dart';\n")
    
    # Write from line 21 up to 2371 (before _OrderTimelineCard)
    for line in lines[20:2371]:
        modified = line
        for old, new in replacements.items():
            modified = modified.replace(old, new)
        f.write(modified)
