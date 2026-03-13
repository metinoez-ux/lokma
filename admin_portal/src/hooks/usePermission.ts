/**
 * LOKMA RBAC 2.0 — usePermission Hook
 *
 * React hook that provides permission checking at the component level.
 * Reads admin data from AdminProvider context and resolves permissions.
 *
 * Usage:
 *   const { can, canAny, canAll, canAccess } = usePermission();
 *   if (can('revenue', 'view')) { ... }
 *
 * Performance: The PermissionSubject is memoized via JSON serialization
 * to avoid unnecessary re-computations when admin object reference changes
 * but the actual permission data hasn't. (O5 fix)
 */

'use client';

import { useMemo, useCallback } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canAccess as canAccessFn,
  isSuperAdmin as isSuperAdminFn,
  type PermissionSubject,
  type PermissionKey,
} from '@/lib/permissions';

export function usePermission() {
  const { admin } = useAdmin();

  // O5 fix: Memoize subject using stable serialized key
  const subjectKey = useMemo(() => {
    if (!admin) return '';
    return JSON.stringify({
      t: admin.adminType,
      g: admin.permissionGroupId,
      p: admin.permissionMap,
      o: admin.permissionOverrides,
    });
  }, [admin?.adminType, admin?.permissionGroupId, admin?.permissionMap, admin?.permissionOverrides]);

  const subject: PermissionSubject = useMemo(() => {
    if (!admin) return {};
    return {
      adminType: admin.adminType,
      permissionGroupId: admin.permissionGroupId,
      permissions: admin.permissionMap as Record<string, boolean> | undefined,
      permissionOverrides: admin.permissionOverrides as Partial<Record<string, boolean>> | undefined,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey]);

  const isSuperAdminUser = useMemo(() => isSuperAdminFn(subject), [subject]);

  /** Check a single permission: can('orders', 'refund') */
  const can = useCallback((module: string, action: string): boolean => {
    return hasPermission(subject, module, action);
  }, [subject]);

  /** Check if ANY of the given permissions is granted */
  const canAny = useCallback((permissions: [string, string][]): boolean => {
    const keys = permissions.map(([m, a]) => `${m}.${a}` as PermissionKey);
    return hasAnyPermission(subject, keys);
  }, [subject]);

  /** Check if ALL of the given permissions are granted */
  const canAll = useCallback((permissions: [string, string][]): boolean => {
    const keys = permissions.map(([m, a]) => `${m}.${a}` as PermissionKey);
    return hasAllPermissions(subject, keys);
  }, [subject]);

  /** Check if user can access any action in a module */
  const canAccess = useCallback((module: string): boolean => {
    return canAccessFn(subject, module);
  }, [subject]);

  return {
    can,
    canAny,
    canAll,
    canAccess,
    isSuperAdmin: isSuperAdminUser,
  };
}
