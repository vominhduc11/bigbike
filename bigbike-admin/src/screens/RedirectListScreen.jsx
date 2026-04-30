import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { createRedirect, deleteRedirect, fetchRedirects, toggleRedirect } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const REDIRECT_TYPE_OPTIONS = ['EXACT', 'PREFIX', 'REGEX']
const STATUS_CODE_OPTIONS = [301, 302, 307, 308]
const EMPTY_FORM = { sourcePattern: '', targetUrl: '', redirectType: 'EXACT', statusCode: '301', notes: '' }
const INITIAL_QUERY = { search: '', page: 1, pageSize: 20, enabled: '', statusCode: '' }

export function RedirectListScreen({ canUpdate, navigate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    const apiQuery = {
      ...query,
      enabled: query.enabled !== '' ? query.enabled === 'true' : undefined,
      statusCode: query.statusCode !== '' ? Number(query.statusCode) : undefined,
    }
    fetchRedirects(apiQuery)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  async function handleToggle(redirect) {
    setActionError('')
    try {
      const r = await toggleRedirect(redirect.id, !redirect.isEnabled)
      setState((p) => ({ ...p, items: p.items.map((rd) => rd.id === redirect.id ? r.item : rd) }))
    } catch (e) { setActionError(e.message || t('redirects.toggleError')) }
  }

  async function handleDelete(redirectId) {
    const confirmed = await showConfirm(t('redirects.deleteConfirm'), t('redirects.deleteConfirmTitle'))
    if (!confirmed) return
    try {
      await deleteRedirect(redirectId)
      setState((p) => ({ ...p, items: p.items.filter((rd) => rd.id !== redirectId) }))
    } catch (e) { setActionError(e.message || t('redirects.deleteError')) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.sourcePattern.trim() || !form.targetUrl.trim()) { setFormError(t('redirects.formRequired')); return }
    setFormSaving(true)
    setFormError('')
    try {
      await createRedirect({
        sourcePattern: form.sourcePattern.trim(),
        targetUrl: form.targetUrl.trim(),
        redirectType: form.redirectType,
        statusCode: Number(form.statusCode),
        notes: form.notes.trim() || undefined,
        enabled: true,
      })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setQuery((p) => ({ ...p }))
    } catch (e) {
      setFormError(e.message || t('redirects.createError'))
    } finally {
      setFormSaving(false)
    }
  }

  const columns = useMemo(() => [
    { key: 'source', label: t('redirects.colSource'), render: (rd) => <code style={{ fontSize: '0.8rem' }}>{rd.sourcePattern}</code> },
    { key: 'target', label: t('redirects.colTarget'), render: (rd) => <code style={{ fontSize: '0.8rem' }}>{rd.targetUrl}</code> },
    {
      key: 'type', label: t('redirects.colType'), render: (rd) => (
        <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span className="status-badge status-info">{rd.statusCode}</span>
          <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>{rd.redirectType}</span>
        </span>
      ),
    },
    { key: 'enabled', label: t('redirects.colEnabled'), render: (rd) => <span className={`status-badge status-${rd.isEnabled ? 'success' : 'neutral'}`}>{rd.isEnabled ? t('common.on') : t('common.off')}</span> },
    { key: 'hits', label: t('redirects.colHits'), render: (rd) => rd.hitCount > 0 ? rd.hitCount.toLocaleString() : <span style={{ color: 'var(--c-text-muted)' }}>0</span> },
    { key: 'updatedAt', label: t('common.lastUpdated'), render: (rd) => formatDateTime(rd.updatedAt || rd.createdAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (rd) => (
        <span style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {navigate && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => navigate(`/admin/redirects/${rd.id}`)}>
              {t('common.edit')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleToggle(rd)}>
            {rd.isEnabled ? t('common.disable') : t('common.enable')}
          </button>
          <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDelete(rd.id)}>
            {t('common.delete')}
          </button>
        </span>
      ),
    } : null,
  ].filter(Boolean), [canUpdate, navigate, t])

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
          <p className="eyebrow">{t('redirects.eyebrow')}</p>
          <h1>{t('redirects.title')}</h1>
          <p>{t('redirects.description')}</p>
        </div>
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('redirects.addBtn')}
          </button>
        )}
      </header>

      {actionError && (
        <p className="inline-error">
          {actionError}
          <button type="button" onClick={() => setActionError('')}>✕</button>
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('redirects.formTitle')}</h3>
          {formError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{formError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '1rem' }}>
            <label>{t('redirects.formSource')}
              <input className="control-input" required value={form.sourcePattern}
                onChange={(e) => setForm((p) => ({ ...p, sourcePattern: e.target.value }))}
                placeholder="/duong-dan-cu" />
            </label>
            <label>{t('redirects.formTarget')}
              <input className="control-input" required value={form.targetUrl}
                onChange={(e) => setForm((p) => ({ ...p, targetUrl: e.target.value }))}
                placeholder="/duong-dan-moi/" />
            </label>
            <label>{t('redirects.formStatusCode')}
              <select className="control-select" value={form.statusCode} onChange={(e) => setForm((p) => ({ ...p, statusCode: e.target.value }))}>
                <option value="301">{t('redirects.code301')}</option>
                <option value="302">{t('redirects.code302')}</option>
                <option value="307">{t('redirects.code307')}</option>
                <option value="308">{t('redirects.code308')}</option>
              </select>
            </label>
            <label>{t('redirects.formMatchType')}
              <select className="control-select" value={form.redirectType} onChange={(e) => setForm((p) => ({ ...p, redirectType: e.target.value }))}>
                {REDIRECT_TYPE_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <label>{t('redirects.formNotes')}
              <input className="control-input" value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t('redirects.formNotesPlaceholder')} />
            </label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={formSaving}>{formSaving ? t('redirects.creating') : t('redirects.createBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>{t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('redirects.searchPlaceholder')} />
        </label>
        <label>{t('redirects.filterEnabled')}
          <select className="control-select" value={query.enabled}
            onChange={(e) => updateQuery({ enabled: e.target.value, page: 1 })}>
            <option value="">{t('common.all')}</option>
            <option value="true">{t('common.on')}</option>
            <option value="false">{t('common.off')}</option>
          </select>
        </label>
        <label>{t('redirects.filterStatusCode')}
          <select className="control-select" value={query.statusCode}
            onChange={(e) => updateQuery({ statusCode: e.target.value, page: 1 })}>
            <option value="">{t('common.all')}</option>
            {STATUS_CODE_OPTIONS.map((c) => <option key={c} value={String(c)}>{c}</option>)}
          </select>
        </label>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('redirects.error')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('redirects.empty')} description={t('redirects.emptyDesc')} actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('redirects.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && (
            <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
          )}
        </>
      ) : null}
    </section>
  )
}
