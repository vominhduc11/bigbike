import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchRoles, fetchPermissionCatalog, updateRolePermissions, createRole, deleteRole } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatePanel } from '@/components/StatePanel'
import {
  BUILTIN_CATALOG,
  PERM_LABEL_KEY_MAP,
  SELF_PROTECTED_PERMS,
  buildCatalogHelpers,
  closePermissionDependencies,
  dependentClosure,
  getRoleDisplayName,
  groupCatalogByModule,
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
  const [catalog, setCatalog]             = useState(() => groupCatalogByModule(BUILTIN_CATALOG))
  const [loading, setLoading]             = useState(true)
  const [loadError, setLoadError]         = useState(null)
  // Lỗi tải RIÊNG danh mục quyền — không chặn cả trang (vẫn dùng danh mục mặc định).
  const [catalogError, setCatalogError]   = useState(false)
  const [selectedId, setSelectedId]       = useState(null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [draft, setDraft]                 = useState(null)
  const [autoAdded, setAutoAdded]         = useState(() => new Set())
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
    // allSettled: danh mục quyền lỗi KHÔNG được kéo sập cả trang. Danh sách vai trò là
    // thiết yếu (lỗi → error state); danh mục quyền không tải được thì lùi về danh mục
    // mặc định (BUILTIN_CATALOG) và chỉ báo cảnh báo mềm.
    Promise.allSettled([fetchRoles(), fetchPermissionCatalog()])
      .then(([rolesRes, catalogRes]) => {
        if (cancelled) return
        if (rolesRes.status === 'rejected') {
          setLoadError(rolesRes.reason?.message || t('roles.loadError'))
          return
        }
        const rolesResult = rolesRes.value
        setRoles(rolesResult.items)
        if (rolesResult.items.length > 0) setSelectedId(rolesResult.items[0].id)
        if (catalogRes.status === 'fulfilled' && catalogRes.value) {
          setCatalog(groupCatalogByModule(catalogRes.value))
          setCatalogError(false)
        } else {
          setCatalog(groupCatalogByModule(BUILTIN_CATALOG))
          setCatalogError(true)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t, reloadKey])

  function handleRetryLoad() {
    setLoading(true)
    setLoadError(null)
    setCatalogError(false)
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
    setAutoAdded(new Set())
    setMobileShowDetail(true)
  }

  async function handleMobileBack() {
    if (editMode && isDirty) {
      if (!await showConfirm(t('roles.discardChanges'), t('roles.discardChangesTitle', { defaultValue: 'Huỷ thay đổi?' }))) return
    }
    setMobileShowDetail(false)
    setEditMode(false)
    setDraft(null)
    setAutoAdded(new Set())
  }

  function handleStartEdit() {
    if (!selected) return
    const closed = closePermissionDependencies(selected.permissions, catalog)
    setDraft(closed.permissions)
    setAutoAdded(new Set(closed.autoAdded.keys()))
    setEditMode(true)
  }

  async function handleCancelEdit() {
    // Dirty guard: bấm Hủy khi có thay đổi chưa lưu phải xác nhận, tránh mất draft.
    if (isDirty) {
      if (!await showConfirm(t('roles.discardChanges'), t('roles.discardChangesTitle', { defaultValue: 'Huỷ thay đổi?' }))) return
    }
    setDraft(null)
    setAutoAdded(new Set())
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
    void applyToggle(permKey)
  }

  async function applyToggle(permKey) {
    if (!draft) return
    if (!draft.has(permKey)) {
      const requested = new Set(draft)
      requested.add(permKey)
      const closed = closePermissionDependencies(requested, catalog)
      const dependenciesAdded = [...closed.permissions]
        .filter(key => !requested.has(key) && !draft.has(key))
      setDraft(closed.permissions)
      setAutoAdded(prev => {
        const next = new Set(prev)
        next.delete(permKey)
        dependenciesAdded.forEach(key => next.add(key))
        return next
      })
      if (dependenciesAdded.length > 0) {
        setToast({
          kind: 'info',
          msg: `Đã tự thêm ${dependenciesAdded.map(key => permLabels[key] || key).join(', ')} vì là quyền bắt buộc.`,
        })
      }
      return
    }

    const removals = dependentClosure(permKey, draft, catalog)
    if (isOwnRole && [...removals].some(key => SELF_PROTECTED_PERMS.has(key))) {
      setToast({
        kind: 'error',
        msg: t('roles.selfLockoutBlocked', {
          defaultValue: 'Không thể gỡ quyền quản lý phân quyền khỏi role của chính bạn — sẽ khiến bạn mất quyền truy cập.',
        }),
      })
      return
    }
    const dependents = [...removals].filter(key => key !== permKey)
    if (dependents.length > 0) {
      const confirmed = await showConfirm(
        `Quyền này đang được dùng bởi: ${dependents.map(key => permLabels[key] || key).join(', ')}. Tiếp tục sẽ gỡ tất cả các quyền trên.`,
        'Gỡ quyền bắt buộc?',
        { variant: 'danger', confirmLabel: 'Gỡ tất cả' },
      )
      if (!confirmed) return
    }
    setDraft(prev => {
      const next = new Set(prev)
      removals.forEach(key => next.delete(key))
      return next
    })
    setAutoAdded(prev => {
      const next = new Set(prev)
      removals.forEach(key => next.delete(key))
      return next
    })
  }

  function handleConfirmSensitive() {
    if (pendingToggle) void applyToggle(pendingToggle.key)
    setPendingToggle(null)
  }

  function handleRequestSave() {
    if (!selected || !draft) return
    const added   = [...draft].filter(k => !originalPerms.has(k))
    const removed = [...originalPerms].filter(k => !draft.has(k))
    setSavePending({
      added,
      removed,
      autoAdded: added.filter(key => autoAdded.has(key)),
      userAdded: added.filter(key => !autoAdded.has(key)),
    })
  }

  function handleRequestDelete(role) {
    if (!role || Number(role.assignedUserCount) > 0) return
    setDeletingRole(role)
  }

  async function handleSave() {
    if (!selected || !draft) return
    setSaving(true)
    try {
      const result = await updateRolePermissions(selected.id, Array.from(draft))
      setRoles(prev => prev.map(r => r.id === selected.id ? result.item : r))
      setEditMode(false)
      setDraft(null)
      setAutoAdded(new Set())
      setSavePending(null)
      setToast({
        kind: 'success',
        msg: t('roles.accessApplied', { count: result.item.assignedUserCount }),
      })
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
    if (!deletingRole || Number(deletingRole.assignedUserCount) > 0) return
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
        assignedUserCount={selected?.assignedUserCount}
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
          sensitiveKeys={SENSITIVE_PERMS}
          catalog={catalog}
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
              <div key={i} className="bb-skeleton-block h-11" />
            ))}
          </div>
          <div className="roles-detail px-6 py-5 flex flex-col gap-3">
            <div className="bb-skeleton-block h-7 w-2/5" />
            <div className="bb-skeleton-block h-14" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bb-skeleton-block h-16" />
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

      {/* Danh mục quyền tải lỗi từng phần — cảnh báo mềm, trang vẫn dùng được */}
      {!loading && !loadError && catalogError && (
        <Alert tone="warning" size="sm" className="mb-3">
          {t('roles.catalogLoadWarning', { defaultValue: 'Không tải được danh mục quyền mới nhất — đang dùng danh sách quyền mặc định, một số quyền có thể chưa đầy đủ. Hãy thử tải lại.' })}
        </Alert>
      )}

      {/* Empty */}
      {!loading && !loadError && roles.length === 0 && (
        <StatePanel
          tone="neutral"
          title={t('roles.empty')}
          description={t('roles.emptyDesc')}
          actionLabel={canUpdate ? t('roles.createRoleBtn') : undefined}
          onAction={canUpdate ? () => setShowCreateDialog(true) : undefined}
        />
      )}

      {/* Two-panel layout */}
      {!loading && !loadError && roles.length > 0 && (
        <>
          {/* Mobile: back to list */}
          {mobileShowDetail && selected && (
            <Button variant="ghost" size="sm"
              className="roles-back-btn flex items-center gap-1.5 mb-3"
              onClick={handleMobileBack}
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
                onDeleteRole={() => handleRequestDelete(selected)}
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
