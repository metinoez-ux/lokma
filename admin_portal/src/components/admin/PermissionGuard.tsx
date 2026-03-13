/**
 * LOKMA RBAC 2.0 — PermissionGuard Component
 * 
 * Conditionally renders children based on the current user's permissions.
 * 
 * Usage:
 *   <PermissionGuard module="revenue" action="view">
 *     <RevenueChart />
 *   </PermissionGuard>
 * 
 *   <PermissionGuard module="orders" action="refund" fallback={<p>Yetkisiz</p>}>
 *     <RefundButton />
 *   </PermissionGuard>
 * 
 *   <PermissionGuard anyOf={[['orders', 'cancel'], ['orders', 'refund']]}>
 *     <CancelOrRefundArea />
 *   </PermissionGuard>
 */

'use client';

import React from 'react';
import { usePermission } from '@/hooks/usePermission';

type PermissionGuardProps = {
  children: React.ReactNode;
  /** What to render when access is denied. Default: null (hidden) */
  fallback?: React.ReactNode;
  /** Show a "locked" visual overlay instead of hiding */
  showLocked?: boolean;
} & (
  // Single permission check
  | { module: string; action: string; anyOf?: never; allOf?: never }
  // Any of multiple permissions
  | { anyOf: [string, string][]; module?: never; action?: never; allOf?: never }
  // All of multiple permissions
  | { allOf: [string, string][]; module?: never; action?: never; anyOf?: never }
);

export default function PermissionGuard({
  children,
  fallback = null,
  showLocked = false,
  ...props
}: PermissionGuardProps) {
  const { can, canAny, canAll } = usePermission();

  let hasAccess = false;

  if ('module' in props && props.module && props.action) {
    hasAccess = can(props.module, props.action);
  } else if ('anyOf' in props && props.anyOf) {
    hasAccess = canAny(props.anyOf);
  } else if ('allOf' in props && props.allOf) {
    hasAccess = canAll(props.allOf);
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (showLocked) {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/5 dark:bg-gray-900/20 rounded-xl">
          <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="text-xs font-medium">Erişim yetkiniz yok</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
}
