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
 */
export function getEffectivePermissions(subject: PermissionSubject): PermissionMap {
  // Super Admin → all true
  if (isSuperAdmin(subject)) {
    const allTrue: PermissionMap = {} as PermissionMap;
    // Get all known keys from all groups and set them to true
    const ceoGroup = DEFAULT_PERMISSION_GROUPS['ceo'];
    if (ceoGroup) {
      for (const key of Object.keys(ceoGroup.permissions)) {
        allTrue[key as PermissionKey] = true;
      }
    }
    return allTrue;
  }

  // If pre-computed full permissions exist, use them directly
  if (subject.permissions && Object.keys(subject.permissions).length > 0) {
    // Apply overrides on top
    if (subject.permissionOverrides) {
      return { ...subject.permissions, ...subject.permissionOverrides } as PermissionMap;
    }
    return subject.permissions;
  }

  // Resolve from group
  const groupId = subject.permissionGroupId;
  const group = groupId ? DEFAULT_PERMISSION_GROUPS[groupId] : null;
  const basePermissions = group?.permissions || ({} as PermissionMap);

  // Apply overrides
  if (subject.permissionOverrides) {
    return { ...basePermissions, ...subject.permissionOverrides } as PermissionMap;
  }

  return basePermissions;
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
 * hasPermission(admin, 'revenue', 'view')  // Can they see revenue?
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
 * canAccess(admin, 'revenue')  // Should the revenue tab be visible?
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
