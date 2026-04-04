---
title: "Kermes Staff Assignment Overhaul Audit"
date: "2026-04-05"
status: "Completed"
---

# LOKMA Kermes Staff Assignment Overhaul Audit

**Issue 1**: The "Assign Role" (Ata) button inside the Add Assignments modal in the `WorkspaceAssignmentsList` was invisible/rendered as plain text. The user did not realize it was a button and thus failed to correctly assign staff to a Kermes.
**Resolution 1**: Changed the tailwind classes from the generic/missing `bg-primary` to the platform standard `bg-pink-600 text-white shadow-md hover:bg-pink-700` to make it prominently visible as a primary action button.

**Issue 2**: While assigning/removing staff to Kermes roles (Staff, Waiter, Driver, Admin) during User Creation or User Updates, the underlying `kermes_events` documents were not being synchronized reliably. Specifically, creations did not sync at all, and updates only added roles but never removed them.
**Resolution 2**:
- In `handleCreateUser` (`page.tsx`), integrated a new loop that updates `assignedStaff`, `assignedDrivers`, `assignedWaiters`, and `kermesAdmins` instantly in the target `kermes_events` document upon successful user creation.
- In `handleSaveUser` (`page.tsx`), overhauled the sync block. It now evaluates both `oldKermesAssignments` and `newKermesAssignments` to correctly identify any removed roles. It scrubs the user from the Kermes document arrays entirely and pushes the user back only to the arrays corresponding to their current roles.

All personnel role changes are now strictly enforced and accurately reflected on the Kermes staff dashboards.
