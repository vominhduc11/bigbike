import { useState, useEffect } from 'react'
import { Shield, Edit2, Check, X, AlertTriangle, ChevronLeft, Info, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchRoles, fetchPermissionCatalog, updateRolePermissions, createRole, deleteRole } from '../lib/adminApi'

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
      { key: 'pos.price_override',           sensitive: true  },
      { key: 'receivables.read',             sensitive: false },
      { key: 'receivables.create',           sensitive: false },
      { key: 'receivables.record_payment',   sensitive: false },
      { key: 'receivables.write_off',        sensitive: true  },
      { key: 'receivables.override_limit',   sensitive: true  },
      { key: 'receivables.export',           sensitive: false },
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
  'pos.price_override':         'roles.permPosPriceOverride',
  'receivables.read':           'roles.permReceivablesRead',
  'receivables.create':         'roles.permReceivablesCreate',
  'receivables.record_payment': 'roles.permReceivablesRecordPayment',
  'receivables.write_off':      'roles.permReceivablesWriteOff',
  'receivables.override_limit': 'roles.permReceivablesOverrideLimit',
  'receivables.export':         'roles.permReceivablesExport',
  'reports.read':               'roles.permReportsRead',
  'reports.export':             'roles.permReportsExport',
  'products.read':              'roles.permProductsRead',
  'products.update':            'roles.permProductsUpdate',
  'catalog.read':               'roles.permCatalogRead',
  'catalog.update':             'roles.permCatalogUpdate',
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
      style={{
        position: 'fixed', top: 80, right: 24, zIndex: 9000,
        padding: '12px 20px', borderRadius: 'var(--admin-radius-sm)', maxWidth: 380,
        background: isSuccess
          ? 'var(--admin-color-status-success-bg)'
          : 'var(--admin-color-status-danger-bg)',
        color: isSuccess
          ? 'var(--admin-color-status-success-text)'
          : 'var(--admin-color-status-danger-text)',
        border: `1px solid ${isSuccess
          ? 'var(--admin-color-status-success-border)'
          : 'var(--admin-color-status-danger-border)'}`,
        fontSize: 'var(--admin-text-sm)', fontWeight: 500,
        boxShadow: 'var(--admin-shadow-md)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
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
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 8px', borderRadius: 'var(--admin-radius-full)',
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
      background: isSystem
        ? 'var(--admin-color-brand-red-muted)'
        : 'var(--admin-color-surface-raised)',
      color: isSystem
        ? 'var(--admin-color-brand-red)'
        : 'var(--admin-color-text-muted)',
      border: `1px solid ${isSystem
        ? 'rgba(232,40,30,0.25)'
        : 'var(--admin-color-border-default)'}`,
    }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={20} style={{ color: 'var(--admin-color-status-warning-text)', flexShrink: 0 }} aria-hidden />
          <strong id="sensitive-dialog-title" style={{ fontSize: 'var(--admin-text-base)', color: 'var(--admin-color-text-primary)' }}>
            {t('roles.sensitivePermTitle')}
          </strong>
        </div>
        <p style={{
          fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-secondary)',
          margin: '0 0 20px', whiteSpace: 'pre-line', lineHeight: 1.65,
        }}>
          {msg}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t('roles.cancelBtn')}</button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm}>{t('roles.confirmBtn')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Pre-save summary dialog ──────────────────────────────────────────────────

function SaveSummaryDialog({ pending, roleName, permLabels, sensitiveKeys, onConfirm, onCancel, saving }) {
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
      <div className="roles-confirm-dialog" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Shield size={20} style={{ color: 'var(--admin-color-brand-red)', flexShrink: 0 }} aria-hidden />
          <strong id="save-summary-title" style={{ fontSize: 'var(--admin-text-base)', color: 'var(--admin-color-text-primary)' }}>
            {t('roles.saveSummaryTitle')}
          </strong>
        </div>
        <p style={{ fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-muted)', margin: '0 0 16px' }}>
          {t('roles.saveSummaryRole', { name: roleName })}
        </p>

        {added.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 'var(--admin-text-xs)', fontWeight: 700, color: 'var(--admin-color-status-success-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              + {t('roles.saveSummaryAdding')}
            </div>
            {added.map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 'var(--admin-text-sm)' }}>
                <Check size={12} style={{ color: 'var(--admin-color-status-success-text)', flexShrink: 0 }} aria-hidden />
                <span style={{ color: 'var(--admin-color-text-primary)' }}>{permLabels[k] || k}</span>
                {sensitiveKeys.has(k) && (
                  <AlertTriangle size={12} style={{ color: 'var(--admin-color-status-warning-text)', flexShrink: 0 }} aria-label={t('roles.sensitivePermNote')} />
                )}
              </div>
            ))}
          </div>
        )}

        {removed.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 'var(--admin-text-xs)', fontWeight: 700, color: 'var(--admin-color-status-danger-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              − {t('roles.saveSummaryRemoving')}
            </div>
            {removed.map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 'var(--admin-text-sm)' }}>
                <X size={12} style={{ color: 'var(--admin-color-status-danger-text)', flexShrink: 0 }} aria-hidden />
                <span style={{ color: 'var(--admin-color-text-primary)' }}>{permLabels[k] || k}</span>
                {sensitiveKeys.has(k) && (
                  <AlertTriangle size={12} style={{ color: 'var(--admin-color-status-warning-text)', flexShrink: 0 }} aria-label={t('roles.sensitivePermNote')} />
                )}
              </div>
            ))}
          </div>
        )}

        {hasSensitive && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--admin-radius-xs)', marginBottom: 16,
            background: 'var(--admin-color-status-warning-bg)',
            border: '1px solid var(--admin-color-status-warning-border)',
            fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-status-warning-text)',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
            <span>{t('roles.saveSensitiveWarning')}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>{t('roles.cancelBtn')}</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onConfirm}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? t('roles.saving') : t('roles.confirmSaveBtn')}
          </button>
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
      <form className="roles-confirm-dialog" style={{ maxWidth: 460 }} onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Plus size={18} style={{ color: 'var(--admin-color-brand-red)', flexShrink: 0 }} aria-hidden />
          <strong id="create-role-title" style={{ fontSize: 'var(--admin-text-base)', color: 'var(--admin-color-text-primary)' }}>
            {t('roles.createRoleTitle')}
          </strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="create-role-name" style={{ display: 'block', fontSize: 'var(--admin-text-sm)', fontWeight: 600, marginBottom: 4, color: 'var(--admin-color-text-primary)' }}>
              {t('roles.createRoleNameLabel')} <span style={{ color: 'var(--admin-color-status-danger-text)' }}>*</span>
            </label>
            <input
              id="create-role-name"
              type="text"
              className="control-input"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={t('roles.createRoleNamePlaceholder')}
              autoFocus
            />
          </div>

          {/* Technical ID — hidden by default, auto-generated from name */}
          {!showId && id && (
            <div style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{t('roles.createRoleIdAutoLabel')}: </span>
              <code style={{ fontFamily: 'var(--admin-font-mono)', color: 'var(--admin-color-text-secondary)' }}>{id}</code>
              <button
                type="button"
                onClick={() => setShowId(true)}
                style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                {t('roles.createRoleIdCustomize')}
              </button>
            </div>
          )}

          {showId && (
            <div>
              <label htmlFor="create-role-id" style={{ display: 'block', fontSize: 'var(--admin-text-sm)', fontWeight: 600, marginBottom: 4, color: 'var(--admin-color-text-primary)' }}>
                {t('roles.createRoleIdLabel')} <span style={{ color: 'var(--admin-color-status-danger-text)' }}>*</span>
              </label>
              <input
                id="create-role-id"
                type="text"
                className="control-input"
                value={id}
                onChange={e => handleIdChange(e.target.value)}
                placeholder={t('roles.createRoleIdPlaceholder')}
                style={{ fontFamily: 'var(--admin-font-mono)' }}
              />
              <div style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', marginTop: 4 }}>
                {t('roles.createRoleIdHint')}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="create-role-desc" style={{ display: 'block', fontSize: 'var(--admin-text-sm)', fontWeight: 600, marginBottom: 4, color: 'var(--admin-color-text-primary)' }}>
              {t('roles.createRoleDescLabel')}
            </label>
            <input
              id="create-role-desc"
              type="text"
              className="control-input"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder={t('roles.createRoleDescPlaceholder')}
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-status-danger-text)' }} role="alert">
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? t('common.saving') : t('roles.createRoleBtn')}
          </button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Trash2 size={20} style={{ color: 'var(--admin-color-status-danger-text)', flexShrink: 0 }} aria-hidden />
          <strong id="delete-role-title" style={{ fontSize: 'var(--admin-text-base)', color: 'var(--admin-color-text-primary)' }}>
            {t('roles.deleteRoleTitle')}
          </strong>
        </div>
        <p style={{
          fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-secondary)',
          margin: '0 0 20px', lineHeight: 1.65, whiteSpace: 'pre-line',
        }}>
          {t('roles.deleteRoleConfirm', { name: getRoleDisplayName(role, t) })}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </button>
          <button
            className="btn btn-sm"
            style={{
              background: 'var(--admin-color-status-danger-text)',
              color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.6 : 1,
            }}
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? t('common.deleting') : t('roles.deleteRoleBtn')}
          </button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
              <Shield size={13} style={{ color: 'var(--admin-color-text-muted)', flexShrink: 0 }} aria-hidden />
              <span style={{ fontWeight: 600, fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-primary)' }}>
                {displayName}
              </span>
              <Badge isSystem={role.isSystem} />
            </div>
            {showDesc && (
              <div style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', paddingLeft: 21, marginTop: 2 }}>
                {desc}
              </div>
            )}
          </button>
        )
      })}

      {canUpdate && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--admin-color-border-subtle)' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onCreateRole}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
          >
            <Plus size={14} aria-hidden />
            {t('roles.createRoleBtn')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Permission group ─────────────────────────────────────────────────────────

function PermGroup({ group, activePerms, editMode, onToggle, isSuperAdmin }) {
  const { t } = useTranslation()
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--admin-color-text-muted)',
        padding: '6px 0', borderBottom: '2px solid var(--admin-color-border-subtle)',
        marginBottom: 4,
      }}>
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
              <input
                type="checkbox"
                id={permId}
                checked={granted}
                onChange={() => onToggle(perm.key, label)}
                style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
              />
            ) : (
              <div
                style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
                aria-hidden="true"
              >
                {granted
                  ? <Check size={14} style={{ color: 'var(--admin-color-status-success-text)' }} />
                  : <X size={14} style={{ color: 'var(--admin-color-border-default)' }} />
                }
              </div>
            )}

            <label
              htmlFor={canEdit ? permId : undefined}
              style={{
                flex: 1,
                fontSize: 'var(--admin-text-sm)',
                cursor: canEdit ? 'pointer' : 'default',
                color: granted ? 'var(--admin-color-text-primary)' : 'var(--admin-color-text-muted)',
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0,
              }}
            >
              <span>{label}</span>
              {isSensitive && (
                <span
                  title={t('roles.sensitivePermNote')}
                  aria-label={t('roles.sensitivePermNote')}
                  style={{ color: 'var(--admin-color-status-warning-text)', display: 'inline-flex', alignItems: 'center' }}
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
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 16,
      padding: '10px 0', marginBottom: 16,
      borderBottom: '1px solid var(--admin-color-border-subtle)',
      fontSize: 'var(--admin-text-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Shield size={14} style={{ color: 'var(--admin-color-brand-red)', flexShrink: 0 }} aria-hidden />
        <span style={{ color: 'var(--admin-color-text-muted)' }}>
          {t('roles.summaryPermCount', { count: permCount })}
        </span>
      </div>
      {hasSensitive ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} style={{ color: 'var(--admin-color-status-warning-text)', flexShrink: 0 }} aria-hidden />
          <span style={{ color: 'var(--admin-color-status-warning-text)', fontWeight: 500 }}>
            {t('roles.summaryHasSensitive')}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} style={{ color: 'var(--admin-color-status-success-text)', flexShrink: 0 }} aria-hidden />
          <span style={{ color: 'var(--admin-color-text-muted)' }}>
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
    <div className="roles-detail" style={{ padding: '20px 24px' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 8, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--admin-color-text-primary)' }}>
              {displayName}
            </h2>
            <Badge isSystem={role.isSystem} />
          </div>
          {showDesc && (
            <p style={{ margin: 0, fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-muted)' }}>
              {desc}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {!editMode && canUpdate && !isSuperAdmin && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onStartEdit}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit2 size={14} aria-hidden />
                {t('roles.editBtn')}
              </button>
              {!role.isSystem && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={onDeleteRole}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--admin-color-status-danger-text)' }}
                >
                  <Trash2 size={14} aria-hidden />
                  {t('roles.deleteRoleBtn')}
                </button>
              )}
            </>
          )}
          {editMode && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={onCancelEdit} disabled={saving}>
                {t('roles.cancelBtn')}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={onRequestSave}
                disabled={saving || !isDirty}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? t('roles.saving') : t('roles.saveBtn')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <RoleSummaryCard activePerms={activePerms} isSuperAdmin={isSuperAdmin} sensitiveKeys={SENSITIVE_PERMS} />

      {/* Unsaved-changes banner */}
      {editMode && isDirty && (
        <div style={{
          padding: '8px 12px', marginBottom: 14, borderRadius: 'var(--admin-radius-xs)',
          background: 'var(--admin-color-status-warning-bg)',
          border: '1px solid var(--admin-color-status-warning-border)',
          fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-status-warning-text)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Info size={13} style={{ flexShrink: 0 }} aria-hidden />
          {t('common.dirty')}
        </div>
      )}

      {/* View-only note */}
      {!canUpdate && !isSuperAdmin && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--admin-radius-xs)',
          background: 'var(--admin-color-surface-muted)',
          border: '1px solid var(--admin-color-border-default)',
          fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-muted)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Info size={14} style={{ flexShrink: 0 }} aria-hidden />
          {t('roles.noEditPermission')}
        </div>
      )}

      {/* Super admin — business-friendly explanation */}
      {isSuperAdmin && (
        <div style={{
          padding: '10px 14px', marginBottom: 20, borderRadius: 'var(--admin-radius-xs)',
          background: 'var(--admin-color-brand-red-muted)',
          border: '1px solid rgba(232,40,30,0.25)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Shield size={14} style={{ color: 'var(--admin-color-brand-red)', flexShrink: 0, marginTop: 2 }} aria-hidden />
          <p style={{ margin: 0, fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-secondary)', lineHeight: 1.6 }}>
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
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'var(--admin-color-status-warning-text)',
              padding: '6px 0', borderBottom: '2px solid var(--admin-color-border-subtle)',
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertTriangle size={11} aria-hidden />
              {t('roles.otherPermsLabel')}
            </div>
            <div style={{
              padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--admin-radius-xs)',
              background: 'var(--admin-color-status-warning-bg)',
              border: '1px solid var(--admin-color-status-warning-border)',
              fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-status-warning-text)',
            }}>
              {t('roles.otherPermsNote')}
            </div>
            {unknown.map(perm => (
              <div key={perm} className="roles-perm-row">
                <Check size={14} style={{ color: 'var(--admin-color-status-success-text)', flexShrink: 0, marginTop: 2 }} aria-hidden />
                <span style={{ flex: 1, fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-primary)', fontFamily: 'var(--admin-font-mono)' }}>
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
        <div style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', marginTop: 8 }}>
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

export function RolesScreen({ canUpdate = false }) {
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
  const originalPerms = selected ? new Set(selected.permissions) : new Set()
  const isDirty       = editMode && draft ? !setsEqual(draft, originalPerms) : false

  // Build label lookup for summary dialogs
  const permLabels = {}
  catalog.forEach(g => g.permissions.forEach(p => {
    const lk = PERM_LABEL_KEY_MAP[p.key]
    permLabels[p.key] = lk ? t(lk, { defaultValue: p.key }) : p.key
  }))

  const selectedDisplayName = selected ? getRoleDisplayName(selected, t) : ''

  function handleSelectRole(id) {
    if (editMode && isDirty) {
      if (!window.confirm(t('roles.discardChanges'))) return
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
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-color-text-muted)' }}>
          {t('roles.loading')}
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <div style={{
          padding: 24, borderRadius: 'var(--admin-radius-sm)',
          border: '1px solid var(--admin-color-status-danger-border)',
          background: 'var(--admin-color-status-danger-bg)',
          color: 'var(--admin-color-status-danger-text)', fontSize: 'var(--admin-text-sm)',
        }}>
          {loadError}
        </div>
      )}

      {/* Empty */}
      {!loading && !loadError && roles.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-color-text-muted)' }}>
          <Shield size={40} style={{ marginBottom: 12, opacity: 0.3 }} aria-hidden />
          <p style={{ margin: 0, fontWeight: 600 }}>{t('roles.empty')}</p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--admin-text-sm)' }}>{t('roles.emptyDesc')}</p>
        </div>
      )}

      {/* Two-panel layout */}
      {!loading && !loadError && roles.length > 0 && (
        <>
          {/* Mobile: back to list */}
          {mobileShowDetail && selected && (
            <button
              className="roles-back-btn btn btn-ghost btn-sm"
              style={{ alignItems: 'center', gap: 6, marginBottom: 12 }}
              onClick={() => { setMobileShowDetail(false); setEditMode(false); setDraft(null) }}
            >
              <ChevronLeft size={16} aria-hidden />
              {t('roles.backToList')}
            </button>
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
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 48, color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-sm)',
              }}>
                {t('roles.selectRole')}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
