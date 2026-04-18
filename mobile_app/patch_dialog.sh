sed -i '' 's/final rootNav = Navigator.of(context, rootNavigator: true);/if (onClearCart != null) onClearCart!();/g' lib/widgets/order_confirmation_dialog.dart
sed -i '' 's/rootNav.popUntil((route) => route.isFirst);/Navigator.of(context, rootNavigator: true).pop();/g' lib/widgets/order_confirmation_dialog.dart
sed -i '' '/\/\/ Clear cart after navigation is complete/,/}/d' lib/widgets/order_confirmation_dialog.dart
sed -i '' 's/Navigator.of(context, rootNavigator: true).pop();/Navigator.of(context, rootNavigator: true).pop();\n                    if (onDismiss != null) onDismiss!();/g' lib/widgets/order_confirmation_dialog.dart
