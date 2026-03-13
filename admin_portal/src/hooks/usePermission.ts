/**
 * LOKMA RBAC 2.0 — usePermission Hook
 *
 * React hook that provides permission checking at the component level.
 * Reads admin data from AdminProvider context and resolves permissions.
 *
 * Usage:
 *   const { can, canAny, canAll, canAccessModule } = usePermission();
 *   
 *   // Single check
 *   if (can('revenue', 'view')) { ... }
 *   
 *   // Module-level check (any action)
 *   if (canAccessModule('revenue')) { ... }
 *   
 *   // Multiple checks
 *   if (canAny([['orders', 'cancel'], ['orders', 'refund']])) { ... }
 */

'use client';

import { useMemo } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import {
  hasPermission,
  canAccess,
  hasAllPermissions,
  hasAnyPermission,
  getEffectivePermissions,
  isSuperAdmin as checkSuperAdmin,
  type PermissionSubject,
  type PermissionKey,
  type PermissionMap,
} from '@/lib/permissions';

export interface UsePermissionReturn {
  /** Check if user has a specific module.action permission */
  can: (module: string, action: string) => boolean;

  /** Check if user has ANY action for a module (show/hide tab) */
  canAccessModule: (module: string) => boolean;

  /** Check if user has ANY of the listed permissions */
  canAny: (checks: [string, string][]) => boolean;

  /** Check if user has ALL of the listed permissions */
  canAll: (checks: [string, string][]) => boolean;

  /** Whether the current user is a Super Admin (bypasses everything) */
  isSuperAdmin: boolean;

  /** The full resolved permission map */
  permissions: PermissionMap;
}

export function usePermission(): UsePermissionReturn {
  const { admin } = useAdmin();

  // Build the permission subject from admin context
  const subject: PermissionSubject = useMemo(() => ({
    adminType: admin?.adminType,
    permissionGroupId: admin?.permissionGroupId,
    permissions: admin?.permissionMap as PermissionMap | undefined,
    permissionOverrides: admin?.permissionOverrides as Partial<PermissionMap> | undefined,
  }), [admin?.adminType, admin?.permissionGroupId, admin?.permissionMap, admin?.permissionOverrides]);

  const superAdmin = useMemo(() => checkSuperAdmin(subject), [subject]);

  const permissions = useMemo(
    () => getEffectivePermissions(subject),
    [subject]
  );

  const can = useMemo(
    () => (module: string, action: string) => hasPermission(subject, module, action),
    [subject]
  );

  const canAccessModule = useMemo(
    () => (module: string) => canAccess(subject, module),
    [subject]
  );

  const canAny = useMemo(
    () => (checks: [string, string][]) =>
      hasAnyPermission(
        subject,
        checks.map(([m, a]) => `${m}.${a}` as PermissionKey)
      ),
    [subject]
  );

  const canAll = useMemo(
    () => (checks: [string, string][]) =>
      hasAllPermissions(
        subject,
        checks.map(([m, a]) => `${m}.${a}` as PermissionKey)
      ),
    [subject]
  );

  return {
    can,
    canAccessModule,
    canAny,
    canAll,
    isSuperAdmin: superAdmin,
    permissions,
  };
}
