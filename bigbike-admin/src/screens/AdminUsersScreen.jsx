import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createAdminUser, fetchAdminUsers, fetchRoles, updateAdminUser, mapValidationErrors } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20, role: '', status: '' }

// Static metadata for built-in roles (label i18n key + badge color)
const ROLE_META = {
  SUPER_ADMIN:  { labelKey: 'adminUsers.roleSuperAdmin'  },
  ADMIN:        { labelKey: 'adminUsers.roleAdmin'        },
  SHOP_MANAGER: { labelKey: 'adminUsers.roleShopManager'  },
  EDITOR:       { labelKey: 'adminUsers.roleEditor'       },
  AUTHOR:       { labelKey: 'adminUsers.roleAuthor'       },
  CONTRIBUTOR:  { labelKey: 'adminUsers.roleContributor'  },
  SEO_EDITOR:   { labelKey: 'adminUsers.roleSeoEditor'    },
}

const STATUS_META = {
  ACTIVE:    { labelKey: 'adminUsers.statusActive'    },
  DISABLED:  { labelKey: 'adminUsers.statusDisabled'  },
  SUSPENDED: { labelKey: 'adminUsers.statusSuspended' },
}

const ROLE_BADGE_VARIANTS = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'info',
  SHOP_MANAGER: 'info',
  EDITOR: 'secondary',
  AUTHOR: 'info',
  CONTRIBUTOR: 'muted',
  SEO_EDITOR: 'success',
}

const STATUS_BADGE_VARIANTS = {
  ACTIVE: 'success',
  DISABLED: 'danger',
  SUSPENDED: 'warning',
}

function RoleBadge({ role, t }) {
  const meta = ROLE_META[role]
  const label = meta ? t(meta.labelKey) : role
  const variant = ROLE_BADGE_VARIANTS[role] ?? 'muted'
  return (
    <Badge variant={variant}>
      {label || '—'}
    </Badge>
  )
}

function StatusBadge({ status, t }) {
  const meta = STATUS_META[status]
  const label = meta ? t(meta.labelKey) : status
  const variant = STATUS_BADGE_VARIANTS[status] ?? 'muted'
  return (
    <Badge variant={variant}>
      {label || '—'}
    </Badge>
  )
}

function PasswordField({ value, onChange, placeholder, label, hint }) {
  const [show, setShow] = useState(false)
  return (
    <label className="au-field">
      <span className="au-field-label">{label}</span>
      <div className="au-field-row">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
         />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="shrink-0 whitespace-nowrap"
        >
          {show ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        </Button>
      </div>
      {hint && <span className="au-field-hint">{hint}</span>}
    </label>
  )
}


export function AdminUsersScreen({ canUpdate, currentUserId }) {
  const { t } = useTranslation()

  // Self-edit guard: an admin must not be able to change their own role or
  // disable/suspend their own account, which would lock themselves out.
  // Editing own display name / password stays allowed.

  // ── List state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [listState, setListState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })

  // ── Dynamic roles ───────────────────────────────────────────────────────
  const [dynamicRoles, setDynamicRoles] = useState([])
  useEffect(() => {
    fetchRoles().then((r) => setDynamicRoles(r.items || [])).catch(() => {})
  }, [])

  // Merge builtin + dynamic for select options
  const roleOptions = useMemo(() => {
    const builtins = Object.keys(ROLE_META)
    const extras = dynamicRoles.filter((r) => !builtins.includes(r.id)).map((r) => r.id)
    return [...builtins, ...extras]
  }, [dynamicRoles])

  // ── Edit drawer state ───────────────────────────────────────────────────
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // ── Create modal state ──────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', displayName: '', role: 'ADMIN', password: '' })
  const [createError, setCreateError] = useState('')
  const [createFieldErrors, setCreateFieldErrors] = useState({})
  const [createSaving, setCreateSaving] = useState(false)


  // ── Load list ───────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    fetchAdminUsers(query)
      .then((r) => {
        if (!active) return
        setListState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setListState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((p) => ({ ...p, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  // ── Handlers ────────────────────────────────────────────────────────────
  function openEdit(user) {
    setEditUser(user)
    setEditForm({ displayName: user.displayName || '', status: user.status || 'ACTIVE', role: user.role || '', newPassword: '' })
    setEditError('')
    setEditSuccess(false)
  }

  function closeEdit() {
    setEditUser(null)
    setEditError('')
    setEditSuccess(false)
  }

  function openCreate() {
    setCreateForm({ email: '', displayName: '', role: 'ADMIN', password: '' })
    setCreateError('')
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    setCreateError('')
    setCreateFieldErrors({})
  }

  function handleFilterChange(field, value) {
    const next = { role: roleFilter, status: statusFilter, [field]: value }
    setRoleFilter(next.role)
    setStatusFilter(next.status)
    setQuery((p) => ({ ...p, role: next.role, status: next.status, page: 1 }))
  }

  // Submit edit — with confirmation for sensitive changes
  async function requestEditSubmit() {
    const statusChanged = editForm.status !== editUser.status
    const roleChanged = editForm.role !== editUser.role
    const sensitiveStatus = statusChanged && editForm.status !== 'ACTIVE'
    const sensitiveRole = roleChanged

    if (sensitiveStatus) {
      const ok = await showConfirm(t('adminUsers.confirmDisable'), t('adminUsers.confirmSensitiveTitle'))
      if (!ok) return
    } else if (sensitiveRole) {
      const ok = await showConfirm(t('adminUsers.confirmRoleChange'), t('adminUsers.confirmSensitiveTitle'))
      if (!ok) return
    }
    submitEdit()
  }

  const submitEdit = useCallback(async () => {
    if (!editUser) return
    setEditSaving(true)
    setEditError('')
    setEditSuccess(false)
    try {
      // Never send role/status changes for the current user's own account —
      // the form locks those fields, this is the defensive backstop.
      const editingSelf = currentUserId != null && editUser.id === currentUserId
      const payload = {
        displayName: editForm.displayName.trim() || undefined,
        status: editingSelf ? undefined : (editForm.status || undefined),
        role: editingSelf ? undefined : (editForm.role || undefined),
        newPassword: editForm.newPassword.trim() || undefined,
      }
      const r = await updateAdminUser(editUser.id, payload)
      setListState((p) => ({ ...p, items: p.items.map((u) => (u.id === editUser.id ? r.item : u)) }))
      setEditUser(r.item)
      setEditSuccess(true)
      if (r.item.role !== editForm.role && editForm.role) {
        setEditError(t('adminUsers.roleIgnored'))
      }
    } catch (err) {
      setEditError(err.message || t('common.error'))
    } finally {
      setEditSaving(false)
    }
  }, [editUser, editForm, currentUserId, t])

  async function handleCreate(e) {
    e.preventDefault()
    setCreateSaving(true)
    setCreateError('')
    setCreateFieldErrors({})
    try {
      const r = await createAdminUser({
        email: createForm.email.trim(),
        displayName: createForm.displayName.trim(),
        role: createForm.role,
        password: createForm.password,
      })
      setListState((p) => ({ ...p, items: [r.item, ...p.items] }))
      closeCreate()
    } catch (err) {
      const fieldErrs = mapValidationErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setCreateFieldErrors(fieldErrs)
      } else {
        setCreateError(err.message || t('common.error'))
      }
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'user',
      label: t('adminUsers.colUser'),
      render: (u) => (
        <div>
          <div className="text-sm font-semibold">{u.displayName || u.email}</div>
          {u.displayName && <div className="text-xs text-muted-foreground">{u.email}</div>}
        </div>
      ),
    },
    {
      key: 'role',
      label: t('adminUsers.colRole'),
      render: (u) => <RoleBadge role={u.role} t={t} />,
    },
    {
      key: 'status',
      label: t('adminUsers.colStatus'),
      render: (u) => <StatusBadge status={u.status} t={t} />,
    },
    {
      key: 'lastLoginAt',
      label: t('adminUsers.colLastLogin'),
      render: (u) => u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-muted-foreground">{t('adminUsers.notLastLogin')}</span>,
    },
    canUpdate ? {
      key: 'actions',
      label: '',
      align: 'right',
      render: (u) => (
        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
          {t('common.edit')}
        </Button>
      ),
    } : null,
  ].filter(Boolean), [canUpdate, t])

  // ── Derived ──────────────────────────────────────────────────────────────
  const isSelf = editUser != null && currentUserId != null && editUser.id === currentUserId
  const hasFilters = searchInput.trim() !== '' || roleFilter !== '' || statusFilter !== ''
  const isEmptyResult = listState.status === 'success' && listState.items.length === 0

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('adminUsers.eyebrow')}</p>
          <h1>{t('adminUsers.title')}</h1>
          <p>{t('adminUsers.description')}</p>
        </div>
        {canUpdate && (
          <div className="screen-actions">
            <Button onClick={openCreate}>
              {t('adminUsers.createBtn')}
            </Button>
          </div>
        )}
      </header>

      {listState.warning ? <ReadOnlyBanner warning={listState.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminUsers.searchPlaceholder')}
           />
        </label>
        <label>
          {t('adminUsers.filterRole')}
          <Select
            value={roleFilter || '__all__'}
            onValueChange={(val) => handleFilterChange('role', val === '__all__' ? '' : val)}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="__all__">{t('common.all')}</SelectItem>
            {roleOptions.map((r) => {
              const meta = ROLE_META[r]
              return (
                <SelectItem key={r} value={r}>
                  {meta ? t(meta.labelKey) : r}
                </SelectItem>
              )
            })}
          </SelectContent></Select>
        </label>
        <label>
          {t('adminUsers.filterStatus')}
          <Select
            value={statusFilter || '__all__'}
            onValueChange={(val) => handleFilterChange('status', val === '__all__' ? '' : val)}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="__all__">{t('common.all')}</SelectItem>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>{t(meta.labelKey)}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {listState.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('adminUsers.error')}
          description={listState.error}
          actionLabel={t('common.retry')}
          onAction={() => setQuery((p) => ({ ...p }))}
        />
      )}

      {isEmptyResult && !hasFilters && (
        <StatePanel tone="neutral" title={t('adminUsers.empty')} description={t('adminUsers.emptyDesc')} />
      )}

      {isEmptyResult && hasFilters && (
        <StatePanel
          tone="neutral"
          title={t('adminUsers.emptySearch')}
          description={t('adminUsers.emptySearchDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={() => {
            setSearchInput('')
            setRoleFilter('')
            setStatusFilter('')
            setQuery(INITIAL_QUERY)
          }}
        />
      )}

      {(listState.status === 'loading' || (listState.status === 'success' && listState.items.length > 0)) && (
        <>
          <AdminTable
            caption={t('adminUsers.tableCaption')}
            columns={columns}
            rows={listState.items}
            loading={listState.status === 'loading'}
            pageSize={query.pageSize}
          />
          {listState.status === 'success' && (
            <PaginationControls
              pagination={listState.pagination}
              onPageChange={(p) => setQuery((prev) => ({ ...prev, page: p }))}
            />
          )}
        </>
      )}

      {/* ── Edit Drawer ──────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editUser)}
        title={t('adminUsers.editTitle')}
        onClose={closeEdit}
        wide
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={closeEdit}>
              {t('common.cancel')}
            </Button>
            <Button type="button" size="sm" loading={editSaving} onClick={requestEditSubmit}>
              {t('adminUsers.saveBtn')}
            </Button>
          </>
        }
      >
        {editUser && (
          <>
            <div className="audit-drawer-body !gap-0">
              {editError && (
                <p className="mb-4 text-sm text-danger">{editError}</p>
              )}
              {editSuccess && !editError && (
                <p className="mb-4 text-sm text-success">{t('adminUsers.saveSuccess')}</p>
              )}

              <div className="au-drawer-section">
                <h3 className="au-drawer-section-title">{t('adminUsers.sectionAccount')}</h3>
                {isSelf && (
                  <Alert tone="warning" size="sm" className="mb-3">
                    {t('adminUsers.selfEditLocked')}
                  </Alert>
                )}
                <div className="au-form-grid">
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formDisplayName')}</span>
                    <Input
                      value={editForm.displayName}
                      onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                     />
                  </label>
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formRole')}</span>
                    <Select
                      value={editForm.role}
                      disabled={isSelf}
                      onValueChange={(val) => setEditForm((p) => ({ ...p, role: val }))}
                    ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      {roleOptions.map((r) => {
                        const meta = ROLE_META[r]
                        return (
                          <SelectItem key={r} value={r}>
                            {meta ? t(meta.labelKey) : r}
                          </SelectItem>
                        )
                      })}
                    </SelectContent></Select>
                  </label>
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formStatus')}</span>
                    <Select
                      value={editForm.status}
                      disabled={isSelf}
                      onValueChange={(val) => setEditForm((p) => ({ ...p, status: val }))}
                    ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      {Object.entries(STATUS_META).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>{t(meta.labelKey)}</SelectItem>
                      ))}
                    </SelectContent></Select>
                  </label>
                </div>
              </div>

              <div className="au-drawer-section mt-6">
                <h3 className="au-drawer-section-title">{t('adminUsers.sectionPassword')}</h3>
                <PasswordField
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder={t('adminUsers.formPasswordHint')}
                  label={t('adminUsers.formPasswordNew')}
                  hint={t('adminUsers.formPasswordStrengthHint')}
                />
              </div>

            </div>
          </>
        )}
      </Modal>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        title={t('adminUsers.createTitle')}
        onClose={closeCreate}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={closeCreate}>{t('common.cancel')}</Button>
            <Button type="submit" form="create-user-form" size="sm" loading={createSaving}>
              {t('adminUsers.createBtn')}
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreate} className="flex flex-col gap-3">
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('adminUsers.formEmail')}</label>
            <Input type="email" value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} required />
            {createFieldErrors.email && <p className="text-xs text-destructive">{createFieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('adminUsers.formDisplayName')}</label>
            <Input value={createForm.displayName}
              onChange={(e) => setCreateForm((p) => ({ ...p, displayName: e.target.value }))} required />
            {createFieldErrors.displayName && <p className="text-xs text-destructive">{createFieldErrors.displayName}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('adminUsers.formRole')}</label>
            <Select value={createForm.role} onValueChange={(val) => setCreateForm((p) => ({ ...p, role: val }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => {
                  const meta = ROLE_META[r]
                  return <SelectItem key={r} value={r}>{meta ? t(meta.labelKey) : r}</SelectItem>
                })}
              </SelectContent>
            </Select>
          </div>
          <PasswordField
            value={createForm.password}
            onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
            label={t('adminUsers.formPassword')}
            hint={createFieldErrors.password || t('adminUsers.formPasswordStrengthHint')}
          />
        </form>
      </Modal>

    </section>
  )
}
