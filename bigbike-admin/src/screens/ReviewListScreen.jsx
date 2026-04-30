import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviews, updateReviewStatus } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
const STATUS_TONES = { APPROVED: 'success', PENDING: 'warning', SPAM: 'neutral', TRASH: 'neutral' }

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

export function ReviewListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    fetchReviews(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  async function handleStatusChange(review, newStatus) {
    setActionError('')
    try {
      const r = await updateReviewStatus(review.id, newStatus)
      setState((p) => ({ ...p, items: p.items.map((rv) => rv.id === review.id ? r.item : rv) }))
    } catch (e) { setActionError(e.message || t('reviews.approveError')) }
  }

  async function handleDelete(reviewId) {
    const confirmed = await showConfirm(t('reviews.deleteConfirm'), t('reviews.deleteConfirmTitle'))
    if (!confirmed) return
    try {
      await deleteReview(reviewId)
      setState((p) => ({ ...p, items: p.items.filter((rv) => rv.id !== reviewId) }))
    } catch (e) { setActionError(e.message || t('reviews.deleteError')) }
  }

  const columns = useMemo(() => [
    { key: 'author', label: t('reviews.colAuthor'), render: (r) => r.authorName || '(—)' },
    { key: 'productId', label: t('reviews.colProduct'), render: (r) => <code style={{ fontSize: '0.75rem' }}>{r.productId}</code> },
    { key: 'rating', label: t('reviews.colRating'), render: (r) => r.rating },
    { key: 'body', label: t('reviews.colContent'), render: (r) => <span style={{ fontSize: '0.85rem' }}>{r.body?.slice(0, 80)}{r.body?.length > 80 ? '...' : ''}</span> },
    { key: 'status', label: t('reviews.colStatus'), render: (r) => <span className={`status-badge status-${STATUS_TONES[r.status] || 'neutral'}`}>{t(`reviews.status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`, { defaultValue: r.status })}</span> },
    { key: 'createdAt', label: t('reviews.colDate'), render: (r) => formatDateTime(r.createdAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          {r.status !== 'APPROVED' && <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleStatusChange(r, 'APPROVED')}>{t('reviews.approve')}</button>}
          {r.status !== 'SPAM' && <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleStatusChange(r, 'SPAM')}>{t('reviews.spam')}</button>}
          <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDelete(r.id)}>{t('common.delete')}</button>
        </div>
      ),
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
          <p className="eyebrow">{t('reviews.eyebrow')}</p>
          <h1>{t('reviews.title')}</h1>
          <p>{t('reviews.description')}</p>
        </div>
      </header>

      {actionError && (
        <p className="inline-error">
          {actionError}
          <button type="button" onClick={() => setActionError('')}>✕</button>
        </p>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>{t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} placeholder={t('reviews.searchPlaceholder')} />
        </label>
        <label>{t('reviews.filterStatus')}
          <select className="control-select" value={query.status} onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? t('common.all') : t(`reviews.status${s.charAt(0) + s.slice(1).toLowerCase()}`, { defaultValue: s })}
              </option>
            ))}
          </select>
        </label>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('reviews.error')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('reviews.empty')} description={t('reviews.emptyDesc')} actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('reviews.tableCaption')}
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
