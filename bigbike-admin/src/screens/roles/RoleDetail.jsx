import { Shield, Pencil, Check, AlertTriangle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Badge } from './Badge'
import { PermGroup } from './PermGroup'
import { RoleSummaryCard } from './RoleSummaryCard'
import { buildCatalogHelpers, getRoleDisplayName } from './constants'

export function RoleDetail({
  role, canUpdate, editMode, draft, isDirty, saving, catalog,
  onStartEdit, onCancelEdit, onRequestSave, onToggle, onDeleteRole,
}) {
  const { t } = useTranslation()
  const isSuperAdmin = role.id === 'SUPER_ADMIN'
  const activePerms = (editMode && draft) ? draft : new Set(role.permissions)
  const { knownKeys: KNOWN_PERM_KEYS, sensitiveKeys: SENSITIVE_PERMS } = buildCatalogHelpers(catalog)
  const descKey = `roles.roleDesc_${role.id}`
  const desc = t(descKey, { defaultValue: role.description || '' })
  const displayName = getRoleDisplayName(role, t)
  const showDesc = desc && desc !== displayName

  return (
    <div className="roles-detail px-6 py-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
            <h2 className="m-0 text-base font-bold text-foreground">
              {displayName}
            </h2>
            <Badge isSystem={role.isSystem} />
          </div>
          {showDesc && (
            <p className="m-0 text-sm text-muted-foreground">
              {desc}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0 flex-wrap">
          {!editMode && canUpdate && !isSuperAdmin && (
            <>
              <Button variant="secondary" size="sm" onClick={onStartEdit}
                className="flex items-center gap-1.5">
                <Pencil size={14} aria-hidden />
                {t('roles.editBtn')}
              </Button>
              {!role.isSystem && (
                <Button variant="ghost" size="sm" onClick={onDeleteRole}
                  className="flex items-center gap-1.5 text-danger">
                  <Trash2 size={14} aria-hidden />
                  {t('roles.deleteRoleBtn')}
                </Button>
              )}
            </>
          )}
          {editMode && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelEdit} disabled={saving}>
                {t('roles.cancelBtn')}
              </Button>
              <Button size="sm" onClick={onRequestSave} loading={saving} disabled={!isDirty}
                className="flex items-center gap-1.5">
                {t('roles.saveBtn')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <RoleSummaryCard activePerms={activePerms} isSuperAdmin={isSuperAdmin} sensitiveKeys={SENSITIVE_PERMS} />

      {/* Unsaved-changes banner */}
      {editMode && isDirty && (
        <Alert tone="warning" size="sm" className="mb-3.5">
          {t('common.dirty')}
        </Alert>
      )}

      {/* View-only note */}
      {!canUpdate && !isSuperAdmin && (
        <Alert tone="info" size="sm" className="mb-4">
          {t('roles.noEditPermission')}
        </Alert>
      )}

      {/* Super admin — business-friendly explanation */}
      {isSuperAdmin && (
        <div className="flex items-start gap-2 px-3.5 py-2.5 mb-5 rounded-xs bg-primary/10 border border-primary/25">
          <Shield size={14} className="text-primary shrink-0 mt-0.5" aria-hidden />
          <p className="m-0 text-sm text-muted-foreground leading-relaxed">
            {t('roles.superAdminBanner')}
          </p>
        </div>
      )}

      {/* Permission groups */}
      {catalog.map(group => (
        <PermGroup
          key={group.groupKey}
          group={group}
          activePerms={activePerms}
          editMode={editMode}
          onToggle={onToggle}
          isSuperAdmin={isSuperAdmin}
        />
      ))}

      {/* Unknown permissions (backend has them but frontend catalog doesn't) */}
      {(() => {
        // '*' is the super-admin wildcard ("all permissions"), not a real
        // labelable permission — exclude it so it doesn't trip the warning.
        const unknown = role.permissions.filter(p => p !== '*' && !KNOWN_PERM_KEYS.has(p))
        if (unknown.length === 0) return null
        return (
          <div className="mb-6">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-warning py-1.5 border-b-2 border-border mb-2">
              <AlertTriangle size={11} aria-hidden />
              {t('roles.otherPermsLabel')}
            </div>
            <Alert tone="warning" size="sm" className="mb-2">
              {t('roles.otherPermsNote')}
            </Alert>
            {unknown.map(perm => (
              <div key={perm} className="roles-perm-row">
                <Check size={14} className="text-success shrink-0 mt-0.5" aria-hidden />
                <span className="flex-1 text-sm text-foreground font-mono">
                  {perm}
                </span>
                <span className="roles-perm-code">{perm}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Timestamp */}
      {role.updatedAt && (
        <div className="text-xs text-muted-foreground mt-2">
          {t('common.lastUpdated')}{' '}
          {new Date(role.updatedAt).toLocaleString(undefined, {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}
    </div>
  )
}
