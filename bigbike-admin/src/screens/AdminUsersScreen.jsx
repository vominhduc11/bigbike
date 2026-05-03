import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createAdminUser, fetchAdminUsers, fetchRoles, updateAdminUser } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20, role: '', status: '' }

// Static metadata for built-in roles (label i18n key + badge color)
const ROLE_META = {
  SUPER_ADMIN:  { labelKey: 'adminUsers.roleSuperAdmin',  color: '#c0392b', bg: '#fdecea' },
  ADMIN:        { labelKey: 'adminUsers.roleAdmin',        color: '#1a56db', bg: '#ebf5ff' },
  SHOP_MANAGER: { labelKey: 'adminUsers.roleShopManager',  color: '#0770a2', bg: '#e1f0fa' },
  EDITOR:       { labelKey: 'adminUsers.roleEditor',       color: '#6741d9', bg: '#f0ebff' },
  AUTHOR:       { labelKey: 'adminUsers.roleAuthor',       color: '#1e6091', bg: '#e8f4fd' },
  CONTRIBUTOR:  { labelKey: 'adminUsers.roleContributor',  color: '#495057', bg: '#f1f3f5' },
  SEO_EDITOR:   { labelKey: 'adminUsers.roleSeoEditor',    color: '#087f5b', bg: '#e6fcf5' },
}

const STATUS_META = {
  ACTIVE:    { labelKey: 'adminUsers.statusActive',    color: 'var(--admin-color-status-success-text)', bg: 'var(--admin-color-status-success-bg)' },
  DISABLED:  { labelKey: 'adminUsers.statusDisabled',  color: 'var(--admin-color-status-danger-text)',  bg: 'var(--admin-color-status-danger-bg)' },
  SUSPENDED: { labelKey: 'adminUsers.statusSuspended', color: 'var(--admin-color-status-warning-text)', bg: 'var(--admin-color-status-warning-bg)' },
}

function RoleBadge({ role, t }) {
  const meta = ROLE_META[role]
  const label = meta ? t(meta.labelKey) : role
  return (
    <span className="au-badge" style={meta ? { color: meta.color, background: meta.bg } : {}}>
      {label || '—'}
    </span>
  )
}

function StatusBadge({ status, t }) {
  const meta = STATUS_META[status]
  const label = meta ? t(meta.labelKey) : status
  return (
    <span className="au-badge" style={meta ? { color: meta.color, background: meta.bg } : {}}>
      {label || '—'}
    </span>
  )
}

function PasswordField({ value, onChange, placeholder, label, hint }) {
  const [show, setShow] = useState(false)
  return (
    <label className="au-field">
      <span className="au-field-label">{label}</span>
      <div className="au-field-row">
        <input
          className="control-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShow((s) => !s)}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
      {hint && <span className="au-field-hint">{hint}</span>}
    </label>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel, t }) {
  return (
    <div className="au-modal-overlay" onClick={onCancel}>
      <div className="au-modal au-modal--sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="au-modal-title">{title}</h3>
        <p className="au-modal-body">{message}</p>
        <div className="au-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('adminUsers.confirmNo')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {t('adminUsers.confirmYes')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminUsersScreen({ canUpdate }) {
  const { t } = useTranslation()

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
  const [createSaving, setCreateSaving] = useState(false)

  // ── Confirm dialog state ────────────────────────────────────────────────
  const [confirm, setConfirm] = useState(null) // { title, message, onConfirm }

  // ── Load list ───────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setListState((p) => ({ ...p, status: 'loading' }))
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
  }

  function handleFilterChange(field, value) {
    const next = { role: roleFilter, status: statusFilter, [field]: value }
    setRoleFilter(next.role)
    setStatusFilter(next.status)
    setQuery((p) => ({ ...p, role: next.role, status: next.status, page: 1 }))
  }

  // Submit edit — with confirmation for sensitive changes
  function requestEditSubmit() {
    const statusChanged = editForm.status !== editUser.status
    const roleChanged = editForm.role !== editUser.role
    const sensitiveStatus = statusChanged && editForm.status !== 'ACTIVE'
    const sensitiveRole = roleChanged

    if (sensitiveStatus) {
      setConfirm({
        title: t('adminUsers.confirmSensitiveTitle'),
        message: t('adminUsers.confirmDisable'),
        onConfirm: () => { setConfirm(null); submitEdit() },
      })
      return
    }
    if (sensitiveRole) {
      setConfirm({
        title: t('adminUsers.confirmSensitiveTitle'),
        message: t('adminUsers.confirmRoleChange'),
        onConfirm: () => { setConfirm(null); submitEdit() },
      })
      return
    }
    submitEdit()
  }

  const submitEdit = useCallback(async () => {
    if (!editUser) return
    setEditSaving(true)
    setEditError('')
    setEditSuccess(false)
    try {
      const payload = {
        displayName: editForm.displayName.trim() || undefined,
        status: editForm.status || undefined,
        role: editForm.role || undefined,
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
  }, [editUser, editForm, t])

  async function handleCreate(e) {
    e.preventDefault()
    setCreateSaving(true)
    setCreateError('')
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
      setCreateError(err.message || t('common.error'))
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
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.displayName || u.email}</div>
          {u.displayName && <div style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-secondary)' }}>{u.email}</div>}
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
      render: (u) => u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span style={{ color: 'var(--admin-color-text-muted)' }}>{t('adminUsers.notLastLogin')}</span>,
    },
    canUpdate ? {
      key: 'actions',
      label: '',
      align: 'right',
      render: (u) => (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>
          {t('common.edit')}
        </button>
      ),
    } : null,
  ].filter(Boolean), [canUpdate, t])

  // ── Derived ──────────────────────────────────────────────────────────────
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
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              {t('adminUsers.createBtn')}
            </button>
          </div>
        )}
      </header>

      {listState.warning ? <ReadOnlyBanner warning={listState.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input
            className="control-input"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminUsers.searchPlaceholder')}
          />
        </label>
        <label>
          {t('adminUsers.filterRole')}
          <select
            className="control-select"
            value={roleFilter}
            onChange={(e) => handleFilterChange('role', e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {roleOptions.map((r) => {
              const meta = ROLE_META[r]
              return (
                <option key={r} value={r}>
                  {meta ? t(meta.labelKey) : r}
                </option>
              )
            })}
          </select>
        </label>
        <label>
          {t('adminUsers.filterStatus')}
          <select
            className="control-select"
            value={statusFilter}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{t(meta.labelKey)}</option>
            ))}
          </select>
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
      {editUser && (
        <div className="audit-drawer-overlay" onClick={closeEdit}>
          <div className="audit-drawer" onClick={(e) => e.stopPropagation()}>
            <header className="audit-drawer-header">
              <h2 className="audit-drawer-title">{t('adminUsers.editTitle')}</h2>
              <button type="button" className="btn-icon" onClick={closeEdit} aria-label={t('common.close')}>✕</button>
            </header>
            <div className="audit-drawer-body" style={{ gap: 0 }}>
              {editError && (
                <p style={{ color: 'var(--c-danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{editError}</p>
              )}
              {editSuccess && !editError && (
                <p style={{ color: 'var(--c-success)', marginBottom: '1rem', fontSize: '0.875rem' }}>{t('adminUsers.saveSuccess')}</p>
              )}

              <div className="au-drawer-section">
                <h3 className="au-drawer-section-title">{t('adminUsers.sectionAccount')}</h3>
                <div className="au-form-grid">
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formDisplayName')}</span>
                    <input
                      className="control-input"
                      value={editForm.displayName}
                      onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                    />
                  </label>
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formRole')}</span>
                    <select
                      className="control-select"
                      value={editForm.role}
                      onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                    >
                      {roleOptions.map((r) => {
                        const meta = ROLE_META[r]
                        return (
                          <option key={r} value={r}>
                            {meta ? t(meta.labelKey) : r}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formStatus')}</span>
                    <select
                      className="control-select"
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      {Object.entries(STATUS_META).map(([key, meta]) => (
                        <option key={key} value={key}>{t(meta.labelKey)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="au-drawer-section" style={{ marginTop: '1.5rem' }}>
                <h3 className="au-drawer-section-title">{t('adminUsers.sectionPassword')}</h3>
                <PasswordField
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder={t('adminUsers.formPasswordHint')}
                  label={t('adminUsers.formPasswordNew')}
                  hint={t('adminUsers.formPasswordStrengthHint')}
                />
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={editSaving}
                  onClick={requestEditSubmit}
                >
                  {editSaving ? t('common.saving') : t('adminUsers.saveBtn')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeEdit}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {createOpen && (
        <div className="au-modal-overlay" onClick={closeCreate}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()}>
            <header className="au-modal-header">
              <h2 className="au-modal-title">{t('adminUsers.createTitle')}</h2>
              <button type="button" className="btn-icon" onClick={closeCreate} aria-label={t('common.close')}>✕</button>
            </header>
            <form onSubmit={handleCreate}>
              <div className="au-modal-body">
                {createError && (
                  <p style={{ color: 'var(--c-danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{createError}</p>
                )}
                <div className="au-form-grid">
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formEmail')}</span>
                    <input
                      className="control-input"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formDisplayName')}</span>
                    <input
                      className="control-input"
                      value={createForm.displayName}
                      onChange={(e) => setCreateForm((p) => ({ ...p, displayName: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="au-field">
                    <span className="au-field-label">{t('adminUsers.formRole')}</span>
                    <select
                      className="control-select"
                      value={createForm.role}
                      onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                    >
                      {roleOptions.map((r) => {
                        const meta = ROLE_META[r]
                        return (
                          <option key={r} value={r}>
                            {meta ? t(meta.labelKey) : r}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <PasswordField
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    label={t('adminUsers.formPassword')}
                    hint={t('adminUsers.formPasswordStrengthHint')}
                  />
                </div>
              </div>
              <div className="au-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeCreate}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={createSaving}>
                  {createSaving ? t('common.saving') : t('adminUsers.createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog ───────────────────────────────────────────────── */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          t={t}
        />
      )}
    </section>
  )
}
