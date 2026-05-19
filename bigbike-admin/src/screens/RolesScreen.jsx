import { useState, useEffect } from 'react'
import { Shield, Edit2, Check, X, AlertTriangle, ChevronLeft, Info, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchRoles, fetchPermissionCatalog, updateRolePermissions, createRole, deleteRole } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert } from '@/components/ui/alert'

// Fallback catalog used when the backend /admin/permissions API is unavailable.
// Keep in sync with PermissionCatalog.java groups.
const BUILTIN_CATALOG = [
  {
    groupKey: 'roles.groupSales',
    permissions: [
      { key: 'orders.read',                  sensitive: false },
      { key: 'orders.write',                 sensitive: false },
      { key: 'customers.read',               sensitive: false },
      { key: 'customers.write',              sensitive: false },
      { key: 'coupons.read',                 sensitive: false },
      { key: 'coupons.write',                sensitive: false },
      { key: 'shipping.read',                sensitive: false },
      { key: 'shipping.write',               sensitive: false },
      { key: 'reviews.read',                 sensitive: false },
      { key: 'reviews.write',                sensitive: false },
      { key: 'pos.read',                     sensitive: false },
      { key: 'pos.write',                    sensitive: false },
      { key: 'pos.refund',                   sensitive: true  },
      { key: 'pos.price_override',           sensitive: true  },
      { key: 'receivables.read',             sensitive: false },
      { key: 'receivables.create',           sensitive: false },
      { key: 'receivables.record_payment',   sensitive: false },
      { key: 'receivables.write_off',        sensitive: true  },
      { key: 'receivables.override_limit',   sensitive: true  },
      { key: 'reports.read',                 sensitive: false },
      { key: 'reports.export',               sensitive: false },
    ],
  },
  {
    groupKey: 'roles.groupProducts',
    permissions: [
      { key: 'products.read',    sensitive: false },
      { key: 'products.update',  sensitive: false },
      { key: 'catalog.read',     sensitive: false },
      { key: 'catalog.update',   sensitive: false },
      { key: 'inventory.read',   sensitive: false },
      { key: 'inventory.write',  sensitive: false },
      { key: 'warranty.read',    sensitive: false },
      { key: 'warranty.write',   sensitive: false },
    ],
  },
  {
    groupKey: 'roles.groupContent',
    permissions: [
      { key: 'content.read',      sensitive: false },
      { key: 'content.update',    sensitive: false },
      { key: 'media.read',        sensitive: false },
      { key: 'media.write',       sensitive: false },
      { key: 'menus.read',        sensitive: false },
      { key: 'menus.write',       sensitive: false },
      { key: 'sliders.read',      sensitive: false },
      { key: 'sliders.write',     sensitive: false },
      { key: 'home_videos.read',  sensitive: false },
      { key: 'home_videos.write', sensitive: false },
      { key: 'redirects.read',    sensitive: false },
      { key: 'redirects.write',   sensitive: false },
    ],
  },
  {
    groupKey: 'roles.groupSystem',
    permissions: [
      { key: 'settings.read',     sensitive: false },
      { key: 'settings.write',    sensitive: true  },
      { key: 'admin-users.read',  sensitive: false },
      { key: 'admin-users.write', sensitive: true  },
      { key: 'roles.read',        sensitive: false },
      { key: 'roles.write',       sensitive: true  },
      { key: 'audit-logs.read',   sensitive: true  },
    ],
  },
]

// i18n label key map — covers all keys from PermissionCatalog.GROUPS
const PERM_LABEL_KEY_MAP = {
  'orders.read':                'roles.permOrdersRead',
  'orders.write':               'roles.permOrdersWrite',
  'customers.read':             'roles.permCustomersRead',
  'customers.write':            'roles.permCustomersWrite',
  'coupons.read':               'roles.permCouponsRead',
  'coupons.write':              'roles.permCouponsWrite',
  'shipping.read':              'roles.permShippingRead',
  'shipping.write':             'roles.permShippingWrite',
  'reviews.read':               'roles.permReviewsRead',
  'reviews.write':              'roles.permReviewsWrite',
  'pos.read':                   'roles.permPosRead',
  'pos.write':                  'roles.permPosWrite',
  'pos.refund':                 'roles.permPosRefund',
  'pos.price_override':         'roles.permPosPriceOverride',
  'receivables.read':           'roles.permReceivablesRead',
  'receivables.create':         'roles.permReceivablesCreate',
  'receivables.record_payment': 'roles.permReceivablesRecordPayment',
  'receivables.write_off':      'roles.permReceivablesWriteOff',
  'receivables.override_limit': 'roles.permReceivablesOverrideLimit',
  'reports.read':               'roles.permReportsRead',
  'reports.export':             'roles.permReportsExport',
  'products.read':              'roles.permProductsRead',
  'products.update':            'roles.permProductsUpdate',
  'catalog.read':               'roles.permCatalogRead',
  'catalog.update':             'roles.permCatalogUpdate',
  'inventory.read':             'roles.permInventoryRead',
  'inventory.write':            'roles.permInventoryWrite',
  'warranty.read':              'roles.permWarrantyRead',
  'warranty.write':             'roles.permWarrantyWrite',
  'content.read':               'roles.permContentRead',
  'content.update':             'roles.permContentUpdate',
  'media.read':                 'roles.permMediaRead',
  'media.write':                'roles.permMediaWrite',
  'menus.read':                 'roles.permMenusRead',
  'menus.write':                'roles.permMenusWrite',
  'sliders.read':               'roles.permSlidersRead',
  'sliders.write':              'roles.permSlidersWrite',
  'home_videos.read':           'roles.permHomeVideosRead',
  'home_videos.write':          'roles.permHomeVideosWrite',
  'redirects.read':             'roles.permRedirectsRead',
  'redirects.write':            'roles.permRedirectsWrite',
  'settings.read':              'roles.permSettingsRead',
  'settings.write':             'roles.permSettingsWrite',
  'admin-users.read':           'roles.permAdminUsersRead',
  'admin-users.write':          'roles.permAdminUsersWrite',
  'roles.read':                 'roles.permRolesRead',
  'roles.write':                'roles.permRolesWrite',
  'audit-logs.read':            'roles.permAuditLogsRead',
}

// Permissions an admin must never be able to strip from their OWN role —
// removing these would lock them out of role management entirely.
const SELF_PROTECTED_PERMS = new Set(['roles.read', 'roles.write'])

// Derived from catalog; rebuilt whenever catalog changes.
function buildCatalogHelpers(catalog) {
  const knownKeys = new Set(catalog.flatMap(g => g.permissions.map(p => p.key)))
  const sensitiveKeys = new Set(
    catalog.flatMap(g => g.permissions.filter(p => p.sensitive).map(p => p.key))
  )
  return { knownKeys, sensitiveKeys }
}

function formatRoleName(id) {
  if (!id) return ''
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getRoleDisplayName(role, t) {
  return t(`roles.roleLabel_${role.id}`, { defaultValue: role.name || formatRoleName(role.id) })
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null
  const isSuccess = toast.kind === 'success'
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-20 right-6 z-[9000] flex items-center gap-2 max-w-sm px-5 py-3 rounded-sm text-sm font-medium shadow-md border',
        isSuccess
          ? 'bg-success-bg text-success border-success-border'
          : 'bg-danger-bg text-danger border-danger-border'
      )}
    >
      {isSuccess ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
      {toast.msg}
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Badge({ isSystem }) {
  const { t } = useTranslation()
  const label = isSystem ? t('roles.systemBadge') : t('roles.customBadge')
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-px rounded-full text-xs font-bold tracking-wide border',
      isSystem
        ? 'bg-primary/10 text-primary border-primary/25'
        : 'bg-surface-raised text-muted-foreground border-border'
    )}>
      {label}
    </span>
  )
}

// ── Sensitive permission confirm ─────────────────────────────────────────────

function ConfirmSensitiveDialog({ pending, roleName, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!pending) return null
  const permLabelKey = PERM_LABEL_KEY_MAP[pending.key]
  const permLabel = permLabelKey ? t(permLabelKey) : pending.label
  const msg = pending.willAdd
    ? t('roles.sensitivePermAdd', { perm: permLabel, role: roleName })
    : t('roles.sensitivePermRemove', { perm: permLabel, role: roleName })
  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensitive-dialog-title"
      onClick={onCancel}
    >
      <div className="roles-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <AlertTriangle size={20} className="text-warning shrink-0" aria-hidden />
          <strong id="sensitive-dialog-title" className="text-base text-foreground">
            {t('roles.sensitivePermTitle')}
          </strong>
        </div>
        <p className="m-0 mb-5 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {msg}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>{t('roles.cancelBtn')}</Button>
          <Button size="sm" onClick={onConfirm}>{t('roles.confirmBtn')}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Pre-save summary dialog ──────────────────────────────────────────────────

function SaveSummaryDialog({ pending, roleName, permLabels, sensitiveKeys, isOwnRole, onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  if (!pending) return null
  const { added, removed } = pending
  const sensitiveAdded   = added.filter(k => sensitiveKeys.has(k))
  const sensitiveRemoved = removed.filter(k => sensitiveKeys.has(k))
  const hasSensitive = sensitiveAdded.length > 0 || sensitiveRemoved.length > 0
  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-summary-title"
      onClick={onCancel}
    >
      <div className="roles-confirm-dialog max-w-[500px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <Shield size={20} className="text-primary shrink-0" aria-hidden />
          <strong id="save-summary-title" className="text-base text-foreground">
            {t('roles.saveSummaryTitle')}
          </strong>
        </div>
        <p className="m-0 mb-4 text-sm text-muted-foreground">
          {t('roles.saveSummaryRole', { name: roleName })}
        </p>

        {added.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-success mb-1.5 uppercase tracking-wider">
              + {t('roles.saveSummaryAdding')}
            </div>
            {added.map(k => (
              <div key={k} className="flex items-center gap-1.5 py-0.5 text-sm">
                <Check size={12} className="text-success shrink-0" aria-hidden />
                <span className="text-foreground">{permLabels[k] || k}</span>
                {sensitiveKeys.has(k) && (
                  <AlertTriangle size={12} className="text-warning shrink-0" aria-label={t('roles.sensitivePermNote')} />
                )}
              </div>
            ))}
          </div>
        )}

        {removed.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-danger mb-1.5 uppercase tracking-wider">
              − {t('roles.saveSummaryRemoving')}
            </div>
            {removed.map(k => (
              <div key={k} className="flex items-center gap-1.5 py-0.5 text-sm">
                <X size={12} className="text-danger shrink-0" aria-hidden />
                <span className="text-foreground">{permLabels[k] || k}</span>
                {sensitiveKeys.has(k) && (
                  <AlertTriangle size={12} className="text-warning shrink-0" aria-label={t('roles.sensitivePermNote')} />
                )}
              </div>
            ))}
          </div>
        )}

        {hasSensitive && (
          <Alert tone="warning" size="sm" className="mb-4">
            {t('roles.saveSensitiveWarning')}
          </Alert>
        )}

        {isOwnRole && removed.length > 0 && (
          <Alert tone="danger" size="sm" className="mb-4">
            {t('roles.saveOwnRoleWarning', {
              defaultValue: 'Bạn đang sửa role của chính mình. Gỡ quyền ở đây sẽ ảnh hưởng trực tiếp tới quyền truy cập của bạn.',
            })}
          </Alert>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>{t('roles.cancelBtn')}</Button>
          <Button size="sm" onClick={onConfirm} loading={saving} className="flex items-center gap-1.5">
            {t('roles.confirmSaveBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Create role dialog ───────────────────────────────────────────────────────

function CreateRoleDialog({ onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [id, setId]   = useState('')
  const [desc, setDesc] = useState('')
  const [idManual, setIdManual] = useState(false)
  const [showId, setShowId] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(v) {
    setName(v)
    if (!idManual) {
      setId(v.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))
    }
  }

  function handleIdChange(v) {
    setIdManual(true)
    setId(v.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError(t('roles.createRoleErrorName')); return }
    if (!id.trim())   { setError(t('roles.createRoleErrorId'));   return }
    setError('')
    onConfirm({ id: id.trim(), name: name.trim(), description: desc.trim(), permissions: [] })
  }

  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-role-title"
      onClick={onCancel}
    >
      <form className="roles-confirm-dialog max-w-[460px]" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-5">
          <Plus size={18} className="text-primary shrink-0" aria-hidden />
          <strong id="create-role-title" className="text-base text-foreground">
            {t('roles.createRoleTitle')}
          </strong>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="create-role-name" className="block text-sm font-semibold mb-1 text-foreground">
              {t('roles.createRoleNameLabel')} <span className="text-danger">*</span>
            </label>
            <Input
              id="create-role-name"
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={t('roles.createRoleNamePlaceholder')}
              autoFocus
             />
          </div>

          {/* Technical ID — hidden by default, auto-generated from name */}
          {!showId && id && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t('roles.createRoleIdAutoLabel')}: </span>
              <code className="font-mono text-foreground">{id}</code>
              <button
                type="button"
                onClick={() => setShowId(true)}
                className="text-xs text-muted-foreground bg-transparent border-none cursor-pointer underline p-0"
              >
                {t('roles.createRoleIdCustomize')}
              </button>
            </div>
          )}

          {showId && (
            <div>
              <label htmlFor="create-role-id" className="block text-sm font-semibold mb-1 text-foreground">
                {t('roles.createRoleIdLabel')} <span className="text-danger">*</span>
              </label>
              <Input
                id="create-role-id"
                type="text"
                value={id}
                onChange={e => handleIdChange(e.target.value)}
                placeholder={t('roles.createRoleIdPlaceholder')}
                className="font-mono"
               />
              <div className="text-xs text-muted-foreground mt-1">
                {t('roles.createRoleIdHint')}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="create-role-desc" className="block text-sm font-semibold mb-1 text-foreground">
              {t('roles.createRoleDescLabel')}
            </label>
            <Input
              id="create-role-desc"
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder={t('roles.createRoleDescPlaceholder')}
             />
          </div>
        </div>

        {error && (
          <div className="mt-2.5 text-sm text-danger" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </Button>
          <Button size="sm" type="submit" loading={saving} className="flex items-center gap-1.5">
            {t('roles.createRoleBtn')}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── Delete role confirm ──────────────────────────────────────────────────────

function DeleteRoleDialog({ role, onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  if (!role) return null
  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-role-title"
      onClick={onCancel}
    >
      <div className="roles-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <Trash2 size={20} className="text-danger shrink-0" aria-hidden />
          <strong id="delete-role-title" className="text-base text-foreground">
            {t('roles.deleteRoleTitle')}
          </strong>
        </div>
        <p className="m-0 mb-5 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {t('roles.deleteRoleConfirm', { name: getRoleDisplayName(role, t) })}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={saving}>
            {t('roles.deleteRoleBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Role sidebar list ────────────────────────────────────────────────────────

function RoleSidebar({ roles, selectedId, onSelect, editMode, isDirty, canUpdate, onCreateRole }) {
  const { t } = useTranslation()
  return (
    <div className="roles-sidebar">
      {roles.map(role => {
        const isActive = role.id === selectedId
        const displayName = getRoleDisplayName(role, t)
        const descKey = `roles.roleDesc_${role.id}`
        const desc = t(descKey, { defaultValue: role.description || '' })
        const showDesc = desc && desc !== displayName
        return (
          <button
            key={role.id}
            className={`roles-role-item${isActive ? ' active' : ''}`}
            onClick={() => onSelect(role.id)}
            title={editMode && isDirty && !isActive ? t('roles.discardChanges') : undefined}
            aria-current={isActive ? 'true' : undefined}
          >
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <Shield size={13} className="text-muted-foreground shrink-0" aria-hidden />
              <span className="font-semibold text-sm text-foreground">
                {displayName}
              </span>
              <Badge isSystem={role.isSystem} />
            </div>
            {showDesc && (
              <div className="text-xs text-muted-foreground pl-[21px] mt-0.5">
                {desc}
              </div>
            )}
          </button>
        )
      })}

      {canUpdate && (
        <div className="px-3 py-2.5 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onCreateRole}
            className="w-full flex items-center gap-1.5 justify-center">
            <Plus size={14} aria-hidden />
            {t('roles.createRoleBtn')}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Permission group ─────────────────────────────────────────────────────────

function PermGroup({ group, activePerms, editMode, onToggle, isSuperAdmin }) {
  const { t } = useTranslation()
  return (
    <div className="mb-6">
      <div className="text-xs font-bold tracking-wider uppercase text-muted-foreground py-1.5 border-b-2 border-border mb-1">
        {t(group.groupKey)}
      </div>

      {group.permissions.map(perm => {
        const granted = isSuperAdmin || activePerms.has(perm.key)
        const isSensitive = perm.sensitive
        const labelKey = PERM_LABEL_KEY_MAP[perm.key]
        const label = labelKey ? t(labelKey, { defaultValue: perm.key }) : perm.key
        const permId = `perm-${perm.key.replace(/[^a-z0-9]/gi, '-')}`
        const canEdit = editMode && !isSuperAdmin

        return (
          <div key={perm.key} className="roles-perm-row">
            {canEdit ? (
              <Checkbox
                id={permId}
                checked={granted}
                onCheckedChange={() => onToggle(perm.key, label)}
                className="w-4 h-4 cursor-pointer shrink-0 mt-0.5"
               />
            ) : (
              <div
                className="w-4 h-4 shrink-0 flex items-center justify-center mt-0.5"
                aria-hidden="true"
              >
                {granted
                  ? <Check size={14} className="text-success" />
                  : <X size={14} className="text-border" />
                }
              </div>
            )}

            <label
              htmlFor={canEdit ? permId : undefined}
              className={cn(
                'flex-1 text-sm flex items-center gap-1.5 flex-wrap min-w-0',
                canEdit ? 'cursor-pointer' : 'cursor-default',
                granted ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <span>{label}</span>
              {isSensitive && (
                <span
                  title={t('roles.sensitivePermNote')}
                  aria-label={t('roles.sensitivePermNote')}
                  className="text-warning inline-flex items-center"
                >
                  <AlertTriangle size={12} aria-hidden />
                </span>
              )}
            </label>

            {/* Technical code — for developers; secondary visual weight */}
            <span className="roles-perm-code" title={`${t('roles.permCode')}: ${perm.key}`}>
              {perm.key}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Role summary card ────────────────────────────────────────────────────────

function RoleSummaryCard({ activePerms, isSuperAdmin, sensitiveKeys }) {
  const { t } = useTranslation()
  const permCount = isSuperAdmin ? '∞' : activePerms.size
  const hasSensitive = isSuperAdmin || [...sensitiveKeys].some(p => activePerms.has(p))

  return (
    <div className="flex flex-wrap gap-4 py-2.5 mb-4 border-b border-border text-sm">
      <div className="flex items-center gap-1.5">
        <Shield size={14} className="text-primary shrink-0" aria-hidden />
        <span className="text-muted-foreground">
          {t('roles.summaryPermCount', { count: permCount })}
        </span>
      </div>
      {hasSensitive ? (
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-warning shrink-0" aria-hidden />
          <span className="text-warning font-medium">
            {t('roles.summaryHasSensitive')}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Check size={14} className="text-success shrink-0" aria-hidden />
          <span className="text-muted-foreground">
            {t('roles.summaryNoSensitive')}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Role detail panel ────────────────────────────────────────────────────────

function RoleDetail({
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
                <Edit2 size={14} aria-hidden />
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
        <div className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xs bg-surface-muted border border-border text-sm text-muted-foreground">
          <Info size={14} className="shrink-0" aria-hidden />
          {t('roles.noEditPermission')}
        </div>
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
        const unknown = role.permissions.filter(p => !KNOWN_PERM_KEYS.has(p))
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

// ── Main screen ──────────────────────────────────────────────────────────────

export function RolesScreen({ canUpdate = false, currentUserRoles = [] }) {
  const { t } = useTranslation()

  const [roles, setRoles]                 = useState([])
  const [catalog, setCatalog]             = useState(BUILTIN_CATALOG)
  const [loading, setLoading]             = useState(true)
  const [loadError, setLoadError]         = useState(null)
  const [selectedId, setSelectedId]       = useState(null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [draft, setDraft]                 = useState(null)
  const [saving, setSaving]               = useState(false)
  const [toast, setToast]                 = useState(null)
  const [pendingToggle, setPendingToggle] = useState(null)
  const [savePending, setSavePending]     = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createSaving, setCreateSaving]   = useState(false)
  const [deletingRole, setDeletingRole]   = useState(null)
  const [deleteSaving, setDeleteSaving]   = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [rolesResult, catalogResult] = await Promise.all([
          fetchRoles(),
          fetchPermissionCatalog(),
        ])
        if (!cancelled) {
          setRoles(rolesResult.items)
          if (rolesResult.items.length > 0) setSelectedId(rolesResult.items[0].id)
          if (catalogResult) setCatalog(catalogResult)
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message || t('roles.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [t])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const { knownKeys: KNOWN_PERM_KEYS, sensitiveKeys: SENSITIVE_PERMS } =
    buildCatalogHelpers(catalog)

  const selected      = roles.find(r => r.id === selectedId) || null
  // True when the admin is editing a role they themselves are assigned —
  // removing role-management perms here would lock them out.
  const isOwnRole     = !!selected && Array.isArray(currentUserRoles) && currentUserRoles.includes(selected.id)
  const originalPerms = selected ? new Set(selected.permissions) : new Set()
  const isDirty       = editMode && draft ? !setsEqual(draft, originalPerms) : false

  // Build label lookup for summary dialogs
  const permLabels = {}
  catalog.forEach(g => g.permissions.forEach(p => {
    const lk = PERM_LABEL_KEY_MAP[p.key]
    permLabels[p.key] = lk ? t(lk, { defaultValue: p.key }) : p.key
  }))

  const selectedDisplayName = selected ? getRoleDisplayName(selected, t) : ''

  async function handleSelectRole(id) {
    if (editMode && isDirty) {
      if (!await showConfirm(t('roles.discardChanges'), t('roles.discardChangesTitle', { defaultValue: 'Huỷ thay đổi?' }))) return
    }
    setSelectedId(id)
    setEditMode(false)
    setDraft(null)
    setMobileShowDetail(true)
  }

  function handleStartEdit() {
    if (!selected) return
    setDraft(new Set(selected.permissions))
    setEditMode(true)
  }

  function handleCancelEdit() {
    setDraft(null)
    setEditMode(false)
  }

  function handleToggle(permKey, permLabel) {
    if (!editMode || !draft) return
    const willAdd = !draft.has(permKey)
    // Self-lockout guard: block removing role-management perms from your own role.
    if (!willAdd && isOwnRole && SELF_PROTECTED_PERMS.has(permKey)) {
      setToast({
        kind: 'error',
        msg: t('roles.selfLockoutBlocked', {
          defaultValue: 'Không thể gỡ quyền quản lý phân quyền khỏi role của chính bạn — sẽ khiến bạn mất quyền truy cập.',
        }),
      })
      return
    }
    if (SENSITIVE_PERMS.has(permKey)) {
      setPendingToggle({ key: permKey, label: permLabel, willAdd })
      return
    }
    applyToggle(permKey)
  }

  function applyToggle(permKey) {
    setDraft(prev => {
      const next = new Set(prev)
      if (next.has(permKey)) next.delete(permKey)
      else next.add(permKey)
      return next
    })
  }

  function handleConfirmSensitive() {
    if (pendingToggle) applyToggle(pendingToggle.key)
    setPendingToggle(null)
  }

  function handleRequestSave() {
    if (!selected || !draft) return
    const added   = [...draft].filter(k => !originalPerms.has(k))
    const removed = [...originalPerms].filter(k => !draft.has(k))
    setSavePending({ added, removed })
  }

  async function handleSave() {
    if (!selected || !draft) return
    setSaving(true)
    try {
      const result = await updateRolePermissions(selected.id, Array.from(draft))
      setRoles(prev => prev.map(r => r.id === selected.id ? result.item : r))
      setEditMode(false)
      setDraft(null)
      setSavePending(null)
      setToast({ kind: 'success', msg: t('roles.saveSuccess') })
    } catch (e) {
      setToast({ kind: 'error', msg: e.message || t('roles.saveError') })
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateRole(input) {
    setCreateSaving(true)
    try {
      const result = await createRole(input)
      setRoles(prev => [...prev, result.item])
      setSelectedId(result.item.id)
      setMobileShowDetail(true)
      setShowCreateDialog(false)
      setToast({ kind: 'success', msg: t('roles.createRoleSuccess', { name: result.item.name }) })
    } catch (e) {
      setToast({ kind: 'error', msg: e.message || t('roles.createRoleError') })
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleDeleteRole() {
    if (!deletingRole) return
    setDeleteSaving(true)
    try {
      await deleteRole(deletingRole.id)
      const deletedName = getRoleDisplayName(deletingRole, t)
      const remaining = roles.filter(r => r.id !== deletingRole.id)
      setRoles(remaining)
      if (selectedId === deletingRole.id) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : null)
        setMobileShowDetail(false)
      }
      setDeletingRole(null)
      setToast({ kind: 'success', msg: t('roles.deleteRoleSuccess', { name: deletedName }) })
    } catch (e) {
      setToast({ kind: 'error', msg: e.message || t('roles.deleteRoleError') })
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('roles.eyebrow')}</p>
          <h1>{t('roles.title')}</h1>
          <p>{t('roles.description')}</p>
        </div>
      </header>

      <Toast toast={toast} />

      <ConfirmSensitiveDialog
        pending={pendingToggle}
        roleName={selectedDisplayName}
        onConfirm={handleConfirmSensitive}
        onCancel={() => setPendingToggle(null)}
      />

      <SaveSummaryDialog
        pending={savePending}
        roleName={selectedDisplayName}
        permLabels={permLabels}
        sensitiveKeys={SENSITIVE_PERMS}
        isOwnRole={isOwnRole}
        onConfirm={handleSave}
        onCancel={() => setSavePending(null)}
        saving={saving}
      />

      {showCreateDialog && (
        <CreateRoleDialog
          onConfirm={handleCreateRole}
          onCancel={() => setShowCreateDialog(false)}
          saving={createSaving}
        />
      )}

      <DeleteRoleDialog
        role={deletingRole}
        onConfirm={handleDeleteRole}
        onCancel={() => setDeletingRole(null)}
        saving={deleteSaving}
      />

      {/* Loading */}
      {loading && (
        <div className="p-10 text-center text-muted-foreground">
          {t('roles.loading')}
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <Alert tone="danger" className="p-6">
          {loadError}
        </Alert>
      )}

      {/* Empty */}
      {!loading && !loadError && roles.length === 0 && (
        <div className="p-12 text-center text-muted-foreground">
          <Shield size={40} className="mb-3 opacity-30" aria-hidden />
          <p className="m-0 font-semibold">{t('roles.empty')}</p>
          <p className="mt-1 m-0 text-sm">{t('roles.emptyDesc')}</p>
        </div>
      )}

      {/* Two-panel layout */}
      {!loading && !loadError && roles.length > 0 && (
        <>
          {/* Mobile: back to list */}
          {mobileShowDetail && selected && (
            <Button variant="ghost" size="sm"
              className="roles-back-btn flex items-center gap-1.5 mb-3"
              onClick={() => { setMobileShowDetail(false); setEditMode(false); setDraft(null) }}
            >
              <ChevronLeft size={16} aria-hidden />
              {t('roles.backToList')}
            </Button>
          )}

          <div className={`roles-layout${mobileShowDetail ? ' detail-open' : ''}`}>
            <RoleSidebar
              roles={roles}
              selectedId={selectedId}
              onSelect={handleSelectRole}
              editMode={editMode}
              isDirty={isDirty}
              canUpdate={canUpdate}
              onCreateRole={() => setShowCreateDialog(true)}
            />

            {selected ? (
              <RoleDetail
                role={selected}
                canUpdate={canUpdate}
                editMode={editMode}
                draft={draft}
                isDirty={isDirty}
                saving={saving}
                catalog={catalog}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onRequestSave={handleRequestSave}
                onToggle={handleToggle}
                onDeleteRole={() => setDeletingRole(selected)}
              />
            ) : (
              <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
                {t('roles.selectRole')}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
