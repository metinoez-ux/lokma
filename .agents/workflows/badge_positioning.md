---
description: How to maintain consistent badge and button positions on Business Cards
---
# Badge Positioning Workflow

To ensure that the structure of business cards (like `WalletBusinessCard`) doesn't break when new badges are added or removed (e.g., TUNA, Sponsored, Açılış Saatleri, Group Order, vs.), **do not use individual `Positioned` widgets with hardcoded or dynamic offsets** for each badge.

Instead, adhere to the **Four-Corner Grid Architecture**:

When layering overlays on the image (inside an `AspectRatio` + `Stack`), structure your widgets into 4 strict corner groups:

1. **Top-Left (Brand & Status Badges)**
   Use for: TUNA partner, Sponsored, Open/Close status, Promos.
   ```dart
   Positioned(
     top: 12, left: 12,
     child: Column(
       crossAxisAlignment: CrossAxisAlignment.start,
       children: [
         // Badges go here, separated by SizedBox(height: 6)
       ],
     ),
   )
   ```

2. **Top-Right (Action Buttons)**
   Use for: Favorite toggles, Share buttons, quick actions.
   ```dart
   Positioned(
     top: 12, right: 12,
     child: Column(
       crossAxisAlignment: CrossAxisAlignment.end,
       children: [
         // Action buttons go here, separated by SizedBox(height: 6)
       ],
     ),
   )
   ```

3. **Bottom-Right (Checkout & Event Badges)**
   Use for: Group Order, Masa Rezervasyonu, Cart indicators. Stack these upwards from the bottom.
   ```dart
   Positioned(
     bottom: 12, right: 12,
     child: Column(
       mainAxisSize: MainAxisSize.min,
       crossAxisAlignment: CrossAxisAlignment.end,
       children: [
         // Badges go here, separated by SizedBox(height: 8)
       ],
     ),
   )
   ```

4. **Bottom-Left (Business Identity)**
   Use for: Business Logo, Secondary identifiers.
   ```dart
   Positioned(
     bottom: 12, left: 12,
     child: LogoWidget(),
   )
   ```

By grouping items in `Column`s, multiple badges will push each other automatically, preventing overlapping and eliminating the need for complex, fragile `top` and `bottom` logic.
