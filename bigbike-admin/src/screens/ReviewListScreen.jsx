import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, MessageSquare, Search } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviews, updateReviewStatus } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Alert } from '@/components/ui/alert'
import { PaginationControls } from '../components/PaginationControls'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
const STATUS_BADGE = { APPROVED: 'bb-badge-success', PENDING: 'bb-badge-warning', SPAM: 'bb-badge-neutral', TRASH: 'bb-badge-neutral' }
const AVATAR_VARIANTS = ['', 'b', 'c', 'd', 'e', 'f']

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

// Five-star row — filled stars in amber, the rest in the muted border colour.
function Stars({ n, of = 5 }) {
  return (
    <span className="stars">
      {Array.from({ length: of }).map((_, i) => (
        <span key={i} style={{ color: i < n ? '#fbbf24' : 'var(--admin-color-border-default)' }}>★</span>
      ))}
    </span>
  )
}

function statusLabel(status, t) {
  return t(`reviews.status${status.charAt(0) + status.slice(1).toLowerCase()}`, { defaultValue: status })
}

export function ReviewListScreen({ navigate, canUpdate }) {
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
      .then((result) => {
        if (!active) return
        setState({
          status: 'success',
          items: result.items,
          pagination: result.pagination,
          warning: '',
        })
      })
      .catch((error) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: error.message })
      })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const handleStatusChange = useCallback(async (review, newStatus) => {
    setActionError('')
    try {
      const result = await updateReviewStatus(review.id, newStatus)
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === review.id ? result.item : item)),
      }))
    } catch (error) {
      setActionError(error.message || t('reviews.approveError'))
    }
  }, [t])

  const handleDelete = useCallback(async (reviewId) => {
    const confirmed = await showConfirm(t('reviews.deleteConfirm'), t('reviews.deleteConfirmTitle'))
    if (!confirmed) return
    try {
      await deleteReview(reviewId)
      setState((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== reviewId) }))
    } catch (error) {
      setActionError(error.message || t('reviews.deleteError'))
    }
  }, [t])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  // Rating distribution + average — computed from the visible page so the
  // summary card always reflects real data, never a fabricated number.
  const dist = useMemo(() => (
    [5, 4, 3, 2, 1].map((s) => ({
      s, n: state.items.filter((r) => Math.round(r.rating) === s).length,
    }))
  ), [state.items])
  const total = dist.reduce((sum, d) => sum + d.n, 0)
  const avg = total > 0
    ? (dist.reduce((sum, d) => sum + d.s * d.n, 0) / total).toFixed(1)
    : '0.0'
  const pendingCount = state.items.filter((r) => r.status === 'PENDING').length
  const lowRatingPending = state.items.filter((r) => r.status === 'PENDING' && Math.round(r.rating) <= 1).length

  const items = state.items || []

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('reviews.eyebrow')}</p>
          <h1>{t('reviews.title')}</h1>
          <p className="bb-muted">{t('reviews.description')}</p>
        </div>
      </div>

      {actionError ? (
        <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      ) : null}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Summary + attention cards */}
      <div className="grid-2-1 mb-4">
        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('reviews.summaryTitle', { defaultValue: 'Tổng quan đánh giá' })}</h2></div>
          <div className="bb-card-body">
            <div className="review-summary">
              <div className="text-center">
                <div className="rating-big">{avg}</div>
                <Stars n={Math.round(Number(avg))} />
                <div className="text-xs muted mt-2">
                  {t('reviews.totalCount', { count: total, defaultValue: `${total} đánh giá` })}
                </div>
              </div>
              <div>
                {dist.map((d) => (
                  <div className="rating-row" key={d.s}>
                    <span>{d.s} ★</span>
                    <div className="rating-bar">
                      <div style={{ width: (total > 0 ? (d.n / total) * 100 : 0) + '%' }} />
                    </div>
                    <span className="text-right">{d.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('reviews.needsAction', { defaultValue: 'Cần xử lý' })}</h2></div>
          <div className="bb-card-body">
            <div className="attn-list">
              <div className="attn-item warn">
                <span className="attn-icon"><MessageSquare size={16} /></span>
                <div className="attn-body">
                  <div className="attn-title">
                    {t('reviews.pendingCount', { count: pendingCount, defaultValue: `${pendingCount} đánh giá chờ duyệt` })}
                  </div>
                  <div className="attn-desc">{t('reviews.pendingHint', { defaultValue: 'Duyệt sớm để hiển thị cho khách' })}</div>
                </div>
                <span className="attn-count">{pendingCount}</span>
              </div>
              {lowRatingPending > 0 && (
                <div className="attn-item danger">
                  <span className="attn-icon"><MessageSquare size={16} /></span>
                  <div className="attn-body">
                    <div className="attn-title">
                      {t('reviews.lowRatingPending', { count: lowRatingPending, defaultValue: `${lowRatingPending} đánh giá 1-sao cần phản hồi` })}
                    </div>
                    <div className="attn-desc">{t('reviews.lowRatingHint', { defaultValue: 'Cần liên hệ khách hàng sớm' })}</div>
                  </div>
                  <span className="attn-count">{lowRatingPending}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="bb-seg" style={{ marginBottom: 16 }} role="tablist" aria-label={t('reviews.filterStatus')}>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={query.status === status}
            className={query.status === status ? 'active' : ''}
            onClick={() => updateQuery({ status }, { resetPage: true })}
          >
            {status === 'ALL' ? t('common.all') : statusLabel(status, t)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bb-filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            className="bb-input"
            style={{ paddingLeft: 28 }}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('reviews.searchPlaceholder')}
          />
        </div>
      </div>

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('reviews.error')}
          description={state.error}
          actionLabel={t('common.retry')}
          onAction={() => setQuery((prev) => ({ ...prev }))}
        />
      )}

      {state.status === 'success' && items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={t('reviews.empty')}
          description={t('reviews.emptyDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }}
        />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="flex flex-col gap-3">
          {state.status === 'loading' && items.length === 0 && (
            [...Array(3)].map((_, i) => (
              <div className="bb-card" key={`sk-${i}`}>
                <div className="bb-card-body">
                  <div className="dash-skeleton-block" style={{ height: 72 }} />
                </div>
              </div>
            ))
          )}
          {items.map((r, i) => {
            const author = formatText(r.authorName) || t('reviews.unknownAuthor', { defaultValue: 'Khách hàng' })
            return (
              <div className="bb-card" key={r.id}>
                <div className="bb-card-body">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`avatar-text ${AVATAR_VARIANTS[i % AVATAR_VARIANTS.length]}`}>
                      {author.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{author}</div>
                      <div className="bb-muted" style={{ fontSize: 12 }}>
                        {t('reviews.colProduct')}:{' '}
                        {r.productId ? (
                          <button
                            type="button"
                            style={{ fontWeight: 600, color: 'var(--admin-color-text-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            onClick={() => navigate(`/admin/products/${r.productId}`)}
                          >
                            {formatText(r.productName, r.productId)}
                          </button>
                        ) : (
                          <span style={{ fontWeight: 600, color: 'var(--admin-color-text-primary)' }}>
                            {formatText(r.productName, t('reviews.unknownProduct'))}
                          </span>
                        )}
                        {' · '}{formatDateTime(r.createdAt)}
                      </div>
                    </div>
                    <Stars n={Math.round(r.rating)} />
                    <span className={`bb-badge ${STATUS_BADGE[r.status] || 'bb-badge-neutral'}`}>
                      {statusLabel(r.status, t)}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--admin-color-text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
                    "{r.body?.slice(0, 400)}{r.body?.length > 400 ? '…' : ''}"
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={() => navigate(`/admin/reviews/${r.id}`)}>
                      <Eye size={13} />{t('reviews.view')}
                    </button>
                    {canUpdate && r.status !== 'APPROVED' && (
                      <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" onClick={() => handleStatusChange(r, 'APPROVED')}>
                        <Check size={13} />{t('reviews.approve')}
                      </button>
                    )}
                    {canUpdate && r.status !== 'SPAM' && (
                      <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" style={{ color: 'var(--bb-danger)' }} onClick={() => handleStatusChange(r, 'SPAM')}>
                        <EyeOff size={13} />{t('reviews.spam')}
                      </button>
                    )}
                    {canUpdate && (
                      <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" style={{ color: 'var(--bb-danger)' }} onClick={() => handleDelete(r.id)}>
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {state.status === 'success' && state.pagination && (
            <div className="px-[18px] py-3 border-t border-border">
              <PaginationControls
                pagination={state.pagination}
                onPageChange={(p) => updateQuery({ page: p })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
