import { useState, useEffect } from 'react'
import { Shield, ChevronLeft, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchRoles, fetchPermissionCatalog, updateRolePermissions, createRole, deleteRole } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { Button } from '@/components/ui/button'
import { StatePanel } from '@/components/StatePanel'
import {
  BUILTIN_CATALOG,
  PERM_LABEL_KEY_MAP,
  SELF_PROTECTED_PERMS,
  buildCatalogHelpers,
  getRoleDisplayName,
  setsEqual,
} from './roles/constants'
import { Toast } from './roles/Toast'
import { ConfirmSensitiveDialog } from './roles/ConfirmSensitiveDialog'
import { SaveSummaryDialog } from './roles/SaveSummaryDialog'
import { CreateRoleDialog } from './roles/CreateRoleDialog'
import { DeleteRoleDialog } from './roles/DeleteRoleDialog'
import { RoleSidebar } from './roles/RoleSidebar'
import { RoleDetail } from './roles/RoleDetail'

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
  // Tăng để buộc tải lại (nút "Thử lại" khi tải danh sách vai trò thất bại).
  const [reloadKey, setReloadKey]         = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchRoles(), fetchPermissionCatalog()])
      .then(([rolesResult, catalogResult]) => {
        if (cancelled) return
        setRoles(rolesResult.items)
        if (rolesResult.items.length > 0) setSelectedId(rolesResult.items[0].id)
        if (catalogResult) setCatalog(catalogResult)
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || t('roles.loadError')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t, reloadKey])

  function handleRetryLoad() {
    setLoading(true)
    setLoadError(null)
    setReloadKey(k => k + 1)
  }

  useEffect(() => {
    // Chỉ tự ẩn toast thành công; toast lỗi giữ lại để người dùng đọc và tự đóng.
    if (!toast || toast.kind === 'error') return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const { sensitiveKeys: SENSITIVE_PERMS } = buildCatalogHelpers(catalog)

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
      const msg = e?.status === 409
        ? t('roles.deleteRoleConflict')
        : (e.message || t('roles.deleteRoleError'))
      setToast({ kind: 'error', msg })
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('roles.eyebrow')}</p>
          <h1>{t('roles.title')}</h1>
          <p className="bb-muted">{t('roles.description')}</p>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />

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
          roles={roles}
        />
      )}

      <DeleteRoleDialog
        role={deletingRole}
        onConfirm={handleDeleteRole}
        onCancel={() => setDeletingRole(null)}
        saving={deleteSaving}
      />

      {/* Loading — skeleton mirroring the two-panel roles-layout */}
      {loading && (
        <div className="roles-layout" aria-hidden="true">
          <div className="roles-sidebar p-3 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bb-skeleton-block" style={{ height: 44 }} />
            ))}
          </div>
          <div className="roles-detail px-6 py-5 flex flex-col gap-3">
            <div className="bb-skeleton-block" style={{ height: 28, width: '40%' }} />
            <div className="bb-skeleton-block" style={{ height: 56 }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bb-skeleton-block" style={{ height: 64 }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <StatePanel
          tone="danger"
          title={t('roles.loadError')}
          description={loadError !== t('roles.loadError') ? loadError : undefined}
          actionLabel={t('common.retry')}
          onAction={handleRetryLoad}
        />
      )}

      {/* Empty */}
      {!loading && !loadError && roles.length === 0 && (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
          <Shield size={40} className="mb-3 opacity-30" aria-hidden />
          <p className="m-0 font-semibold">{t('roles.empty')}</p>
          <p className="mt-1 m-0 text-sm">{t('roles.emptyDesc')}</p>
          {canUpdate && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)}
              className="mt-4 flex items-center gap-1.5">
              <Plus size={14} aria-hidden />
              {t('roles.createRoleBtn')}
            </Button>
          )}
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
    </div>
  )
}
