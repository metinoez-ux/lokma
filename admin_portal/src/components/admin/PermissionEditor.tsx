/**
 * LOKMA RBAC 2.0 — Permission Editor Component
 * 
 * A tree-view UI for managing staff permissions.
 * Inspired by JTL Wawi's Benutzerrechte permission tree.
 * 
 * Features:
 * - Expandable category groups
 * - Per-module toggle (all actions)
 * - Per-action granular toggle
 * - Permission group template selector
 * - Visual indicator for overridden permissions
 * - Full i18n via next-intl (perm.* namespace)
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  PERMISSION_MODULES,
  PERMISSION_CATEGORY_LABELS,
  getModulesByCategory,
  type PermissionCategory,
  type PermissionMap,
  type PermissionKey,
  type PermissionModule,
} from '@/lib/permissions/modules';
import {
  DEFAULT_PERMISSION_GROUPS,
  getAvailableGroups,
} from '@/lib/permissions/groups';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PermissionEditorProps {
  /** Current permission group ID */
  groupId: string;
  /** Current effective permissions */
  permissions: PermissionMap;
  /** Per-user overrides (highlighted differently) */
  overrides?: Partial<PermissionMap>;
  /** Whether the viewer is a super admin (can see platform modules) */
  isSuperAdmin?: boolean;
  /** Called when group changes */
  onGroupChange: (groupId: string) => void;
  /** Called when an individual permission is toggled */
  onPermissionToggle: (key: PermissionKey, value: boolean) => void;
  /** Called to save all changes */
  onSave: (groupId: string, permissions: PermissionMap, overrides: Partial<PermissionMap>) => void;
  /** Read-only mode (for staff viewing their own permissions) */
  readOnly?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermissionToggle({
  checked,
  onChange,
  disabled,
  isOverride,
  label,
  description,
  overrideLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  isOverride?: boolean;
  label: string;
  description?: string;
  overrideLabel: string;
}) {
  return (
    <label
      className={`flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-card'}
        ${isOverride ? 'ring-1 ring-amber-400/50' : ''}
      `}
    >
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors
            ${checked
              ? 'bg-green-500 dark:bg-green-600'
              : 'bg-gray-300 dark:bg-gray-600'
            }
            ${disabled ? '' : 'peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-700'}
          `}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          {label}
          {isOverride && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-normal">
              {overrideLabel}
            </span>
          )}
        </div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-muted-foreground truncate">{description}</div>
        )}
      </div>
    </label>
  );
}

function ModuleSection({
  moduleId,
  module,
  permissions,
  overrides,
  onToggle,
  readOnly,
  t,
}: {
  moduleId: string;
  module: PermissionModule;
  permissions: PermissionMap;
  overrides?: Partial<PermissionMap>;
  onToggle: (key: PermissionKey, value: boolean) => void;
  readOnly?: boolean;
  t: (key: string) => string;
}) {
  const actions = Object.entries(module.actions);
  const allChecked = actions.every(([actionId]) => 
    permissions[`${moduleId}.${actionId}` as PermissionKey] === true
  );
  const someChecked = actions.some(([actionId]) => 
    permissions[`${moduleId}.${actionId}` as PermissionKey] === true
  );

  const handleToggleAll = () => {
    const newValue = !allChecked;
    actions.forEach(([actionId]) => {
      onToggle(`${moduleId}.${actionId}` as PermissionKey, newValue);
    });
  };

  return (
    <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden">
      {/* Module Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors
          ${someChecked
            ? 'bg-green-50 dark:bg-green-900/20'
            : 'bg-gray-50 dark:bg-card/50'
          }
        `}
        onClick={() => !readOnly && handleToggleAll()}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{module.icon}</span>
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {t(module.labelKey)}
          </span>
          <span className="text-xs text-gray-500 dark:text-muted-foreground ml-1">
            ({actions.filter(([actionId]) => permissions[`${moduleId}.${actionId}` as PermissionKey] === true).length}/{actions.length})
          </span>
        </div>
        {!readOnly && (
          <div className={`w-3 h-3 rounded-full border-2 transition-colors
            ${allChecked ? 'bg-green-500 border-green-500' : someChecked ? 'bg-amber-400 border-amber-400' : 'border-gray-300 dark:border-gray-600'}
          `} />
        )}
      </div>

      {/* Action Toggles */}
      <div className="px-3 py-2 space-y-0.5 bg-white dark:bg-background">
        {actions.map(([actionId, actionDef]) => {
          const key = `${moduleId}.${actionId}` as PermissionKey;
          const isOverride = overrides ? key in overrides : false;
          return (
            <PermissionToggle
              key={key}
              checked={permissions[key] === true}
              onChange={(value) => onToggle(key, value)}
              disabled={readOnly}
              isOverride={isOverride}
              label={t(actionDef.labelKey)}
              description={actionDef.descriptionKey ? t(actionDef.descriptionKey) : undefined}
              overrideLabel={t('perm.override_badge')}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PermissionEditor({
  groupId,
  permissions,
  overrides,
  isSuperAdmin = false,
  onGroupChange,
  onPermissionToggle,
  onSave,
  readOnly = false,
}: PermissionEditorProps) {
  const t = useTranslations();
  const [expandedCategories, setExpandedCategories] = useState<Set<PermissionCategory>>(
    new Set(['operations', 'catalog', 'finance', 'hr', 'settings'])
  );
  const [localPermissions, setLocalPermissions] = useState<PermissionMap>(permissions);
  const [localOverrides, setLocalOverrides] = useState<Partial<PermissionMap>>(overrides || {});
  const [localGroupId, setLocalGroupId] = useState(groupId);
  const [hasChanges, setHasChanges] = useState(false);

  const modulesByCategory = useMemo(() => getModulesByCategory(), []);
  const availableGroups = useMemo(() => getAvailableGroups(isSuperAdmin), [isSuperAdmin]);

  const toggleCategory = (category: PermissionCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleGroupChange = useCallback((newGroupId: string) => {
    const group = DEFAULT_PERMISSION_GROUPS[newGroupId];
    if (group) {
      setLocalGroupId(newGroupId);
      setLocalPermissions({ ...group.permissions });
      setLocalOverrides({});
      setHasChanges(true);
      onGroupChange(newGroupId);
    }
  }, [onGroupChange]);

  const handleToggle = useCallback((key: PermissionKey, value: boolean) => {
    setLocalPermissions(prev => ({ ...prev, [key]: value }));
    // Track as override relative to the group base
    const group = DEFAULT_PERMISSION_GROUPS[localGroupId];
    if (group && group.permissions[key] !== value) {
      setLocalOverrides(prev => ({ ...prev, [key]: value }));
    } else {
      // Remove override if it matches group default
      setLocalOverrides(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setHasChanges(true);
    onPermissionToggle(key, value);
  }, [localGroupId, onPermissionToggle]);

  const handleSave = () => {
    onSave(localGroupId, localPermissions, localOverrides);
    setHasChanges(false);
  };

  // Count total granted permissions
  const grantedCount = Object.values(localPermissions).filter(v => v === true).length;
  const totalCount = Object.keys(localPermissions).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('perm.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">
            {t('perm.active_count', { granted: grantedCount, total: totalCount })}
          </p>
        </div>
        {!readOnly && hasChanges && (
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            {t('perm.save')}
          </button>
        )}
      </div>

      {/* Group Selector */}
      {!readOnly && (
        <div className="bg-gray-50 dark:bg-card/50 rounded-xl p-4">
          <label className="block text-xs font-semibold text-gray-600 dark:text-foreground uppercase tracking-wide mb-2">
            {t('perm.group_template_label')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {availableGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleGroupChange(group.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-sm
                  ${localGroupId === group.id
                    ? `${group.color} text-white border-transparent shadow-md scale-[1.02]`
                    : 'bg-white dark:bg-background border-gray-200 dark:border-border hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-foreground'
                  }
                `}
              >
                <span className="text-base">{group.icon}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{t(group.nameKey)}</div>
                </div>
              </button>
            ))}
          </div>
          {localGroupId && DEFAULT_PERMISSION_GROUPS[localGroupId] && (
            <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground italic">
              {t(DEFAULT_PERMISSION_GROUPS[localGroupId].descriptionKey)}
            </p>
          )}
        </div>
      )}

      {/* Permission Tree */}
      <div className="space-y-4">
        {(Object.entries(PERMISSION_CATEGORY_LABELS) as [PermissionCategory, { labelKey: string; icon: string }][]).map(
          ([category, { labelKey, icon }]) => {
            const modules = modulesByCategory[category];
            if (!modules || modules.length === 0) return null;
            
            // Hide platform modules from non-super-admin viewers
            if (category === 'platform' && !isSuperAdmin) return null;

            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="border border-gray-200 dark:border-border rounded-xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-card hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-2 font-bold text-sm text-gray-800 dark:text-gray-200">
                    <span>{icon}</span>
                    <span>{t(labelKey)}</span>
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Modules */}
                {isExpanded && (
                  <div className="p-3 space-y-3 bg-white dark:bg-background">
                    {modules.map((mod) => (
                      <ModuleSection
                        key={mod.id}
                        moduleId={mod.id}
                        module={mod}
                        permissions={localPermissions}
                        overrides={localOverrides}
                        onToggle={handleToggle}
                        readOnly={readOnly}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* Override summary */}
      {Object.keys(localOverrides).length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600 dark:text-amber-400 text-sm font-semibold">
              {t('perm.override_count', { count: Object.keys(localOverrides).length })}
            </span>
          </div>
          <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
            {t('perm.override_description')}
          </p>
        </div>
      )}
    </div>
  );
}
