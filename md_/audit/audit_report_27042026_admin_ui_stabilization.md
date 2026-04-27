# Audit Report: Admin Portal Certificate & Badge Synchronization Remediation
**Date:** 2026-04-27
**Issue:** Super Admin disabled the 'TUNA' certificate in the business settings, but it remained visible and active when a business admin logged in simultaneously.
**Root Causes:**
1. **Lack of Real-Time Sync:** The business form only loaded data on mount (`getDoc`). If a standard admin had the page open, they wouldn't see the badge removed unless they manually refreshed.
2. **Stale Form Data Overwrite:** Standard business admins, despite not having permission to manage certificates, were inadvertently overwriting the database when they clicked "Speichern" because the old `activeBrandIds` array from their local `formData` state was unconditionally included in the save payload.
3. **Legacy Field Desync:** Disabling the badge in the new `activeBrandIds` array did not automatically disable the legacy `isTunaPartner` and `sellsTunaProducts` flags, which the mobile app could still use.

## Remediation Steps
1. **Real-Time Badge Sync (onSnapshot):** Implemented a targeted `onSnapshot` listener specifically for `activeBrandIds` in `admin/business/[id]/page.tsx`. When a Super Admin updates the badge, it instantly pushes the update to all active admin UI sessions without overriding other form inputs.
2. **Super Admin Guarding:** Hardened the `handleSave` function by adding an `isSuperAdmin` guard. Sensitive fields (`activeBrandIds`, `brand`, `brandLabelActive`, legacy flags) are now conditionally excluded from standard admin saves, preventing unauthorized or accidental overwrites.
3. **Legacy Flag Sync:** Updated the checkbox `onChange` handler to automatically synchronize `isTunaPartner`, `sellsTunaProducts`, and `sellsTorosProducts` whenever the TUNA or Toros badges are toggled.

## Verification
- Modifying a badge as a Super Admin now instantly triggers a UI update for any concurrent business admin sessions.
- Standard business admins can freely update their opening hours or other settings without risking restoring a revoked certificate.
- Mobile application reads are protected due to the legacy flag sync.
