import { useState } from 'react'
import { Shield, Pencil, Check, AlertTriangle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from './Badge'
import { PermGroup } from './PermGroup'
import { RoleSummaryCard } from './RoleSummaryCard'
import { buildCatalogHelpers, getRoleDisplayName } from './constants'
import { StickyActionBar } from '@/components/layout'

export function RoleDetail({
  role, canUpdate, editMode, draft, isDirty, saving, catalog,
  onStartEdit, onCancelEdit, onRequestSave, onToggle, onDeleteRole,
}) {
  const { t } = useTranslation()
  const [showCodes, setShowCodes] = useState(false)
  // Nhóm quyền mặc định thu gọn (chỉ mở nhóm đầu) để chống ngợp — trước đây tất cả mở cùng lúc.
  const [openGroups, setOpenGroups] = useState(() => new Set(catalog[0] ? [catalog[0].groupKey] : []))
  const isSuperAdmin = role.id === 'SUPER_ADMIN'
  const activePerms = (editMode && draft) ? draft : new Set(role.permissions)
  const { knownKeys: KNOWN_PERM_KEYS, sensitiveKeys: SENSITIVE_PERMS } = buildCatalogHelpers(catalog)
  const descKey = `roles.roleDesc_${role.id}`
  const desc = t(descKey, { defaultValue: role.description || '' })
  const displayName = getRoleDisplayName(role, t)
  const showDesc = desc && desc !== displayName
  const assignedUserCount = Number.isFinite(Number(role.assignedUserCount))
    ? Math.max(0, Math.trunc(Number(role.assignedUserCount)))
    : 0

  function toggleGroup(groupKey) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  return (
    <div className="roles-detail px-6 py-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
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

      </div>

      {!editMode && canUpdate && !isSuperAdmin && !role.isSystem && assignedUserCount > 0 && (
        <Alert
          id={`delete-role-help-${role.id}`}
          tone="warning"
          size="sm"
          className="mb-4"
        >
          {t('roles.deleteRoleBlocked', {
            name: displayName,
            count: assignedUserCount,
          })}
        </Alert>
      )}

      {/* Summary bar */}
      <RoleSummaryCard activePerms={activePerms} isSuperAdmin={isSuperAdmin} sensitiveKeys={SENSITIVE_PERMS} />

      {/* Unsaved-changes banner */}
      {editMode && isDirty && (
        <Alert tone="warning" size="sm" className="mb-4">
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
        <div className="flex items-start gap-2 px-4 py-3 mb-5 rounded-xs bg-primary/10 border border-primary/25">
          <Shield size={14} className="text-primary shrink-0 mt-1" aria-hidden />
          <p className="m-0 text-sm text-muted-foreground leading-relaxed">
            {t('roles.superAdminBanner')}
          </p>
        </div>
      )}

      {/* Hiện/ẩn mã kỹ thuật (P2-7) — mặc định ẩn để bảng quyền bớt nhiễu */}
      {!isSuperAdmin && (
        <label className="flex items-center justify-end gap-2 mb-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={showCodes} onCheckedChange={(c) => setShowCodes(c === true)} className="w-3.5 h-3.5" />
          {t('roles.showPermCodes', { defaultValue: 'Hiện mã kỹ thuật' })}
        </label>
      )}

      {/* Permission groups — thu gọn, mở/đóng từng nhóm */}
      <div className="flex flex-col gap-3">
        {catalog.map(group => (
          <PermGroup
            key={group.groupKey}
            group={group}
            catalog={catalog}
            activePerms={activePerms}
            editMode={editMode}
            onToggle={onToggle}
            showCodes={showCodes}
            isSuperAdmin={isSuperAdmin}
            open={openGroups.has(group.groupKey)}
            onToggleOpen={() => toggleGroup(group.groupKey)}
          />
        ))}
      </div>

      {/* Unknown permissions (backend has them but frontend catalog doesn't) */}
      {(() => {
        // '*' is the super-admin wildcard ("all permissions"), not a real
        // labelable permission — exclude it so it doesn't trip the warning.
        const unknown = role.permissions.filter(p => p !== '*' && !KNOWN_PERM_KEYS.has(p))
        if (unknown.length === 0) return null
        return (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-warning py-2 border-b-2 border-border mb-2">
              <AlertTriangle size={11} aria-hidden />
              {t('roles.otherPermsLabel')}
            </div>
            <Alert tone="warning" size="sm" className="mb-2">
              {t('roles.otherPermsNote')}
            </Alert>
            {unknown.map(perm => (
              <div key={perm} className="roles-perm-row">
                <Check size={14} className="text-success shrink-0 mt-1" aria-hidden />
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

      {(!editMode && canUpdate && !isSuperAdmin) || editMode ? (
        <StickyActionBar
          ariaLabel={t('common.actionBarLabel', { defaultValue: 'Thanh thao tác' })}
          info={editMode && isDirty ? t('common.dirty') : undefined}
        >
          {editMode ? (
            <>
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={onCancelEdit}
                disabled={saving}
              >
                {t('roles.cancelBtn')}
              </Button>
              <Button
                className="min-h-11 flex items-center gap-2"
                onClick={onRequestSave}
                loading={saving}
                disabled={!isDirty}
              >
                {t('roles.saveBtn')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                className="min-h-11 flex items-center gap-2"
                onClick={onStartEdit}
              >
                <Pencil size={14} aria-hidden />
                {t('roles.editBtn')}
              </Button>
              {!role.isSystem && (
                <Button
                  variant="ghost"
                  onClick={onDeleteRole}
                  disabled={assignedUserCount > 0}
                  aria-describedby={assignedUserCount > 0 ? `delete-role-help-${role.id}` : undefined}
                  className="min-h-11 flex items-center gap-2 text-danger"
                >
                  <Trash2 size={14} aria-hidden />
                  {t('roles.deleteRoleBtn')}
                </Button>
              )}
            </>
          )}
        </StickyActionBar>
      ) : null}
    </div>
  )
}
