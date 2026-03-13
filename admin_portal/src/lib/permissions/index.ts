/**
 * LOKMA RBAC 2.0 — Permission System
 * 
 * Usage:
 *   import { hasPermission, canAccess, DEFAULT_PERMISSION_GROUPS } from '@/lib/permissions';
 *   
 *   // In React components:
 *   import { usePermission } from '@/hooks/usePermission';
 *   const { can, canAny } = usePermission();
 *   if (can('revenue', 'view')) { ... }
 */

// Core checker
export {
  hasPermission,
  canAccess,
  hasAllPermissions,
  hasAnyPermission,
  getEffectivePermissions,
  isSuperAdmin,
  diffPermissions,
  clearPermissionCache,
  type PermissionSubject,
  type PermissionDiff,
} from './checker';

// Module registry
export {
  PERMISSION_MODULES,
  PERMISSION_CATEGORY_LABELS,
  getAllPermissionKeys,
  getModulesByCategory,
  type PermissionModule,
  type PermissionCategory,
  type PermissionKey,
  type PermissionMap,
  type ModuleActions,
} from './modules';

// Groups
export {
  DEFAULT_PERMISSION_GROUPS,
  getAvailableGroups,
  getDefaultGroupForAdminType,
  type PermissionGroup,
} from './groups';
