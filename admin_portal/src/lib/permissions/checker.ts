/**
 * LOKMA RBAC 2.0 — Permission Checker
 * 
 * Core logic for resolving and checking permissions.
 * 
 * Resolution order:
 * 1. Super Admin → ALWAYS TRUE (bypass all checks)
 * 2. Per-user overrides → highest priority
 * 3. Permission group → base permissions
 * 4. Default → DENY (fail-closed)
 * 
 * Performance: getEffectivePermissions is now cached per subject reference
 * to avoid redundant recalculations in components calling multiple can() checks.
 */

import { PermissionKey, PermissionMap } from './modules';
import { DEFAULT_PERMISSION_GROUPS } from './groups';

// ─── Admin Shape (minimal interface for permission checking) ──────────────────

export interface PermissionSubject {
 adminType?: string;
 permissionGroupId?: string;
 permissions?: PermissionMap;
 permissionOverrides?: Partial<PermissionMap>;
}

// ─── Permission Cache (O3+O4 fix) ────────────────────────────────────────────

let _cachedSubject: PermissionSubject | null = null;
let _cachedPermissions: PermissionMap | null = null;

/** Clear the permission cache. Call when admin data changes. */
export function clearPermissionCache(): void {
 _cachedSubject = null;
 _cachedPermissions = null;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check if a subject (admin/user) is a Super Admin.
 * Super Admins bypass ALL permission checks.
 */
export function isSuperAdmin(subject: PermissionSubject): boolean {
 return subject.adminType === 'super';
}

/**
 * Get the effective permission map for a subject.
 * Merges: group base → user overrides
 * 
 * Cached: returns the same object reference if the subject hasn't changed,
 * avoiding re-computation when multiple hasPermission() calls use the same subject.
 */
export function getEffectivePermissions(subject: PermissionSubject): PermissionMap {
 // Return cache hit if same subject reference
 if (_cachedSubject === subject && _cachedPermissions) {
 return _cachedPermissions;
 }

 let result: PermissionMap;

 // Super Admin → all true
 if (isSuperAdmin(subject)) {
 const allTrue: PermissionMap = {} as PermissionMap;
 const ceoGroup = DEFAULT_PERMISSION_GROUPS['ceo'];
 if (ceoGroup) {
 for (const key of Object.keys(ceoGroup.permissions)) {
 allTrue[key as PermissionKey] = true;
 }
 }
 result = allTrue;
 } else if (subject.permissions && Object.keys(subject.permissions).length > 0) {
 // If pre-computed full permissions exist, use them directly
 if (subject.permissionOverrides) {
 result = { ...subject.permissions, ...subject.permissionOverrides } as PermissionMap;
 } else {
 result = subject.permissions;
 }
 } else {
 // Resolve from group
 const groupId = subject.permissionGroupId;
 const group = groupId ? DEFAULT_PERMISSION_GROUPS[groupId] : null;
 const basePermissions = group?.permissions || ({} as PermissionMap);

 if (subject.permissionOverrides) {
 result = { ...basePermissions, ...subject.permissionOverrides } as PermissionMap;
 } else {
 result = basePermissions;
 }
 }

 // Cache the result
 _cachedSubject = subject;
 _cachedPermissions = result;
 return result;
}

/**
 * Check if a subject has a specific permission.
 * 
 * @param subject - The admin/user to check
 * @param module - Module ID (e.g. "orders", "revenue")
 * @param action - Action ID (e.g. "view", "edit", "delete")
 * @returns true if allowed, false if denied
 * 
 * @example
 * hasPermission(admin, 'revenue', 'view') // Can they see revenue?
 * hasPermission(admin, 'orders', 'refund') // Can they issue refunds?
 */
export function hasPermission(
 subject: PermissionSubject,
 module: string,
 action: string
): boolean {
 // Super Admin bypass
 if (isSuperAdmin(subject)) return true;

 const key = `${module}.${action}` as PermissionKey;
 const permissions = getEffectivePermissions(subject);

 // Fail-closed: if not explicitly granted, deny
 return permissions[key] === true;
}

/**
 * Check if a subject has ANY permission for a module (at least one action = true).
 * Useful for showing/hiding entire tabs or sections.
 * 
 * @example
 * canAccess(admin, 'revenue') // Should the revenue tab be visible?
 */
export function canAccess(subject: PermissionSubject, module: string): boolean {
 if (isSuperAdmin(subject)) return true;

 const permissions = getEffectivePermissions(subject);
 
 for (const [key, value] of Object.entries(permissions)) {
 if (key.startsWith(`${module}.`) && value === true) {
 return true;
 }
 }
 return false;
}

/**
 * Check if a subject has ALL of the specified permissions.
 * Useful for guarding actions that require multiple capabilities.
 * 
 * @example
 * hasAllPermissions(admin, ['orders.view', 'orders.refund'])
 */
export function hasAllPermissions(
 subject: PermissionSubject,
 permissionKeys: PermissionKey[]
): boolean {
 if (isSuperAdmin(subject)) return true;

 const permissions = getEffectivePermissions(subject);
 return permissionKeys.every(key => permissions[key] === true);
}

/**
 * Check if a subject has ANY of the specified permissions.
 * Useful for showing UI elements that require at least one capability.
 * 
 * @example
 * hasAnyPermission(admin, ['orders.cancel', 'orders.refund'])
 */
export function hasAnyPermission(
 subject: PermissionSubject,
 permissionKeys: PermissionKey[]
): boolean {
 if (isSuperAdmin(subject)) return true;

 const permissions = getEffectivePermissions(subject);
 return permissionKeys.some(key => permissions[key] === true);
}

// ─── Permission Diff (for auditing) ──────────────────────────────────────────

export interface PermissionDiff {
 key: PermissionKey;
 from: boolean;
 to: boolean;
}

/**
 * Calculate the difference between two permission maps.
 * Useful for audit logging when permissions change.
 */
export function diffPermissions(
 oldPerms: PermissionMap,
 newPerms: PermissionMap
): PermissionDiff[] {
 const diffs: PermissionDiff[] = [];
 const allKeys = new Set([...Object.keys(oldPerms), ...Object.keys(newPerms)]);

 for (const key of allKeys) {
 const k = key as PermissionKey;
 const oldVal = oldPerms[k] ?? false;
 const newVal = newPerms[k] ?? false;
 if (oldVal !== newVal) {
 diffs.push({ key: k, from: oldVal, to: newVal });
 }
 }

 return diffs;
}
