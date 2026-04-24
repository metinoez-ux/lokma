# Kermes Event Title Usage Audit Report

## Objective
Systematically map and verify the implementation of the `event.title` property across the Kermes module to ensure UI consistency, functional accuracy, and proper localization standards within the LOKMA platform.

## Audit Findings

A comprehensive search of the `mobile_app` codebase identified the `event.title` property being actively utilized across **7 core files** within the Kermes module.

### 1. `kermes_card.dart`
- **UI Rendering:** Serves as the primary headline on the Kermes discovery card. Implemented with `GoogleFonts.inter(fontSize: 15.5, fontWeight: FontWeight.w600)` with `maxLines: 2` and `TextOverflow.ellipsis` to ensure it doesn't break the layout.
- **Deep Linking (Navigation):** Encoded via `Uri.encodeComponent(widget.event.title)` to serve as the destination label query parameter (`&q=`) when opening Apple Maps for driving directions. 

### 2. `kermes_detail_screen.dart`
- **Social Sharing (WhatsApp/General):** Serves as the primary header text in the dynamically generated share payload (`*${event.title}*`).
- **Share Subject:** Passed natively to the OS-level sharing dialog as the subject line (`Share.share(text, subject: event.title)` and `Share.shareXFiles(...)`).

### 3. `kermes_checkout_sheet.dart`
- **Analytics & State:** Passed into cart actions and logging functions explicitly as `kermesName: widget.event.title`.
- **Donation Module (Dr. Hep Şahin Vakfı / Round-Up):** Used as a fallback display name in the checkout summary if a specific donation fund name isn't provided (`_donationTarget == 'fund' && widget.event.selectedDonationFundName != null ? widget.event.selectedDonationFundName! : widget.event.title`). Truncated safely with `TextOverflow.ellipsis` inside a Flexible widget.
- **Receipt/Internal:** Stored locally as `final String kermesOrgName = widget.event.title;` for downstream processing.

### 4. `kermes_list_screen.dart`
- **Search & Normalization:** Passed through the `_normalizeTurkish(event.title.toLowerCase())` helper, enabling robust, accent-agnostic client-side searching.
- **Micro-UI Truncation:** In some specific compressed views, it implements manual character clamping: `event.title.length > 13 ? '${event.title.substring(0, 12)}...' : (event.title)`. 

### 5. `kermes_parking_screen.dart`
- **Contextual Subtitles:** Rendered as a secondary contextual label (`TextStyle(fontSize: 12, color: Colors.grey[500])`) to keep users oriented while managing parking.
- **Location Strings:** Combined dynamically as `'${widget.event.title} - ${widget.event.city}'` for display purposes.

### 6. `kermes_pos_screen.dart`
- **State Management:** Passed as `kermesName: widget.event.title` to correctly attribute POS orders to the respective Kermes event in the cart provider.

### 7. `kermes_extended_info.dart`
- **Safe Fallbacks:** Wrapped in safe access checks (`widget.event.title.isNotEmpty ? widget.event.title : ...`) when rendering extended metadata blocks.

## Conclusion & Validation

The `event.title` property is implemented robustly across the Kermes module. 
- **UI Consistency:** The text truncation protocols (both native `TextOverflow` and manual string slicing) are correctly applied to prevent layout shifts.
- **Functional Accuracy:** Data encoding (`Uri.encodeComponent`) ensures URL safety for external map routing.
- **Localization:** Turkish character normalization is effectively implemented for search functions.

No structural or rendering hazards were identified during this audit. The current implementation fully complies with LOKMA platform standards.
