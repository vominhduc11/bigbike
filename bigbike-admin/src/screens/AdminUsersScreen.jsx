import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAdminUsers, updateAdminUser } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20 }

export function AdminUsersScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchAdminUsers(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function openEdit(user) {
    setEditUser(user)
    setEditForm({ displayName: user.displayName || '', status: user.status || '', role: user.role || '', newPassword: '' })
    setEditError('')
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const payload = {
        displayName: editForm.displayName,
        status: editForm.status.trim() || undefined,
        role: editForm.role.trim() || undefined,
        newPassword: editForm.newPassword.trim() || undefined,
      }
      const r = await updateAdminUser(editUser.id, payload)
      if (r.item.role !== editForm.role.trim() && editForm.role.trim()) {
        setEditError(t('adminUsers.roleIgnored'))
        setState((p) => ({ ...p, items: p.items.map((u) => u.id === editUser.id ? r.item : u) }))
        return
      }
      setState((p) => ({ ...p, items: p.items.map((u) => u.id === editUser.id ? r.item : u) }))
      setEditUser(null)
    } catch (err) {
      setEditError(err.message || t('common.error'))
    } finally {
      setEditSaving(false)
    }
  }

  const columns = useMemo(() => [
    { key: 'email', label: t('adminUsers.colEmail'), render: (u) => u.email },
    { key: 'displayName', label: t('adminUsers.formDisplayName'), render: (u) => u.displayName },
    { key: 'role', label: t('adminUsers.colRole'), render: (u) => u.role || '—' },
    { key: 'status', label: t('adminUsers.formStatus'), render: (u) => <span style={{ color: u.status === 'ACTIVE' ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{u.status}</span> },
    { key: 'lastLoginAt', label: t('common.lastUpdated'), render: (u) => formatDateTime(u.lastLoginAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (u) => <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => openEdit(u)}>{t('common.edit')}</button>,
    } : null,
  ].filter(Boolean), [canUpdate, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('adminUsers.eyebrow')}</p>
          <h1>{t('adminUsers.title')}</h1>
          <p>{t('adminUsers.description')}</p>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {editUser && (
        <form onSubmit={handleEdit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-primary)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('adminUsers.editTitle', { name: editUser.email })}</h3>
          {editError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{editError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>{t('adminUsers.formDisplayName')} <input className="control-input" value={editForm.displayName} onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))} /></label>
            <label>{t('adminUsers.formStatus')}
              <select className="control-select" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </label>
            <label>{t('adminUsers.colRole')}
              <select className="control-select" value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                {['SUPER_ADMIN','ADMIN','EDITOR','SHOP_MANAGER','AUTHOR','CONTRIBUTOR','SEO_EDITOR'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>{t('adminUsers.formPassword')} <input className="control-input" type="password" value={editForm.newPassword} placeholder={t('adminUsers.formPasswordHint')} onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? t('common.saving') : t('adminUsers.saveBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      <section className="filter-bar">
        <label>{t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} placeholder={t('adminUsers.searchPlaceholder')} />
        </label>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('adminUsers.error')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('adminUsers.empty')} description={t('adminUsers.emptyDesc')} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable caption={t('adminUsers.tableCaption')} columns={columns} rows={state.items} loading={state.status === 'loading'} pageSize={query.pageSize} />
          {state.status === 'success' && <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />}
        </>
      ) : null}
    </section>
  )
}
