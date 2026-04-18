#!/bin/bash
# Remove the separate Calendar modal logic from _submitOrder
sed -i '' '/if (_scheduledDeliverySlot != null) {/,/}/d' lib/screens/marketplace/kasap/cart_screen.dart
