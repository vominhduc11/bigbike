import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { Check, Eye, EyeOff, Image as ImageIcon, Loader2, MessageSquare } from 'lucide-react'
import { BulkActionBar } from '../components/BulkActionBar'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { bulkDeleteReviews, bulkUpdateReviewStatus, deleteReview, fetchReviews, updateReviewStatus } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { formatDateTime, formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { useAdminList } from '../lib/useAdminList'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/alert'
import { PaginationControls } from '../components/PaginationControls'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
const STATUS_BADGE = { APPROVED: 'bb-badge-success', PENDING: 'bb-badge-warning', SPAM: 'bb-badge-neutral', TRASH: 'bb-badge-neutral' }
const AVATAR_COLORS = [
  'bg-primary text-primary-foreground',
  'bg-info-bg text-info',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-danger-bg text-danger',
  'bg-secondary text-secondary-foreground',
]

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

function Stars({ n, of = 5, label }) {
  const { t } = useTranslation()
  const ariaLabel = label || `${t('reviews.colRating')}: ${n}/${of}`
  return (
    <span className="inline-flex gap-px" role="img" aria-label={ariaLabel}>
      {Array.from({ length: of }).map((_, i) => (
        <span key={i} aria-hidden="true" style={{ color: i < n ? 'var(--admin-color-rating-star)' : 'var(--admin-color-border-default)' }}>★</span>
      ))}
    </span>
  )
}

function statusLabel(status, t) {
  return t(`reviews.status${status.charAt(0) + status.slice(1).toLowerCase()}`, { defaultValue: status })
}

// Extracted to its own component (module scope, mirrors ProductListScreen's ProductRow)
// so approving/spamming/deleting one review only re-renders that card — previously every
// card's JSX lived inline in ReviewListScreen's .map(), so any pendingId/selection change
// anywhere in the list re-rendered the whole list.
function ReviewCard({
  review: r,
  index: i,
  isSelected,
  isPending,
  canUpdate,
  contentLang,
  navigate,
  t,
  onToggleSelect,
  onStatusChange,
  onDelete,
}) {
  const author = formatText(r.authorName) || t('reviews.unknownAuthor', { defaultValue: 'Khách hàng' })
  return (
    <div
      className="bb-card"
      style={isSelected ? { borderColor: 'var(--bb-primary)', boxShadow: '0 0 0 1px var(--bb-primary)' } : undefined}
    >
      <div className="bb-card-body">
        <div className="flex items-center gap-3 mb-3">
          {canUpdate && (
            <span
              className={`bb-cb${isSelected ? ' checked' : ''}`}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={t('reviews.selectOne', { defaultValue: 'Chọn đánh giá này' })}
              tabIndex={0}
              onClick={() => onToggleSelect(r.id)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggleSelect(r.id) } }}
            >
              {isSelected && <Check size={11} />}
            </span>
          )}
          <span className={`inline-flex items-center justify-center size-8 rounded-full text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
            {author.charAt(0).toUpperCase()}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{author}</div>
            <div className="bb-muted" style={{ fontSize: 12 }}>
              {t('reviews.colProduct')}:{' '}
              {r.productId ? (
                <a
                  href={`/admin/products/${r.productId}`}
                  style={{ fontWeight: 600, color: 'var(--admin-color-text-primary)', textDecoration: 'none', cursor: 'pointer' }}
                  title={t('common.openInNewTab')}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                    e.preventDefault()
                    navigate(`/admin/products/${r.productId}`)
                  }}
                >
                  {formatText(contentLang === 'en' ? (r.productNameEn || r.productName) : r.productName, r.productId)}
                </a>
              ) : (
                <span style={{ fontWeight: 600, color: 'var(--admin-color-text-primary)' }}>
                  {formatText(contentLang === 'en' ? (r.productNameEn || r.productName) : r.productName, t('reviews.unknownProduct'))}
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
        {r.photos?.length > 0 ? (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <ImageIcon size={13} />
            {t('reviews.photoCount', { count: r.photos.length, defaultValue: `${r.photos.length} ảnh` })}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={() => navigate(`/admin/reviews/${r.id}`)}>
            <Eye size={13} />{t('reviews.view')}
          </button>
          {canUpdate && r.status !== 'APPROVED' && (
            <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" disabled={isPending} onClick={() => onStatusChange(r, 'APPROVED')}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t('reviews.approve')}
            </button>
          )}
          {canUpdate && r.status !== 'SPAM' && (
            <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" style={{ color: 'var(--bb-danger)' }} disabled={isPending} onClick={() => onStatusChange(r, 'SPAM')}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}{t('reviews.spam')}
            </button>
          )}
          {canUpdate && (
            <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" style={{ color: 'var(--bb-danger)' }} disabled={isPending} onClick={() => onDelete(r.id)}>
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ReviewListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  // Admin VI/EN switch: ở EN backend ẩn review của SP chưa dịch + trả productNameEn.
  const contentLang = useContentLang()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const queryClient = useQueryClient()
  // Danh sách đánh giá qua react-query: cache + dedupe + giữ trang cũ khi đổi filter.
  // Shape trả về { status, items, pagination, warning, error } khớp đúng JSX bên dưới.
  const state = useAdminList(['reviews', query, contentLang], () => fetchReviews(query))
  const [actionError, setActionError] = useState('')
  // id của review đang đổi trạng thái — chặn double-click + hiện spinner trên đúng nút.
  const [pendingId, setPendingId] = useState(null)
  // Chọn nhiều để duyệt/spam/xoá hàng loạt cho hàng chờ kiểm duyệt.
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  // Tiến trình xử lý hàng loạt: { done, total } khi đang chạy, null khi rảnh.
  const [bulkProgress, setBulkProgress] = useState(null)

  // Đồng bộ filter/trang vào URL để back/popstate khôi phục đúng trạng thái đã chọn.
  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setSelected(new Set())
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const handleStatusChange = useCallback(async (review, newStatus) => {
    if (pendingId) return
    setActionError('')
    setPendingId(review.id)
    // Cập nhật lạc quan: đổi badge ngay trên trang đang xem, rollback nếu server lỗi.
    const queryKey = ['reviews', query, contentLang]
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, (old) => (
      old?.items
        ? { ...old, items: old.items.map((r) => (r.id === review.id ? { ...r, status: newStatus } : r)) }
        : old
    ))
    try {
      await updateReviewStatus(review.id, newStatus)
      toast.success(t('reviews.detail.statusUpdated'))
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    } catch (error) {
      if (previous !== undefined) queryClient.setQueryData(queryKey, previous)
      setActionError(error.message || t('reviews.approveError'))
    } finally {
      setPendingId(null)
    }
  }, [t, queryClient, pendingId, query, contentLang])

  const handleDelete = useCallback(async (reviewId) => {
    const confirmed = await showConfirm(t('reviews.deleteConfirm'), t('reviews.deleteConfirmTitle'))
    if (!confirmed) return
    try {
      await deleteReview(reviewId)
      toast.success(t('reviews.detail.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    } catch (error) {
      setActionError(error.message || t('reviews.deleteError'))
    }
  }, [t, queryClient])

  function updateQuery(partial, options = { resetPage: false }) {
    setSelected(new Set())
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  // Xoá toàn bộ bộ lọc (trạng thái + từ khoá) về mặc định trong một thao tác.
  const resetFilters = useCallback(() => {
    setSelected(new Set())
    setSearchInput('')
    setQuery(INITIAL_QUERY)
  }, [])

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

  const items = useMemo(() => state.items || [], [state.items])
  const isFiltered = !!query.search || query.status !== 'ALL'

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const allChecked = items.length > 0 && selected.size === items.length
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((r) => r.id))))
  }, [items])

  // Áp dụng một hành động cho mọi review đang chọn (duyệt / spam / xoá hàng loạt) — 1 request
  // bulk ở backend thay vì N request PATCH/DELETE tuần tự (mỗi request trước đây là 1 round-trip
  // network riêng từ trình duyệt admin, xem AdminReviewController.bulkUpdateStatus/bulkDeleteReviews).
  const runBulk = useCallback(async (kind) => {
    if (bulkBusy) return
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (kind === 'DELETE') {
      const confirmed = await showConfirm(
        t('reviews.bulkDeleteConfirm', { count: ids.length, defaultValue: `Xoá ${ids.length} đánh giá đã chọn?` }),
        t('reviews.deleteConfirmTitle'),
      )
      if (!confirmed) return
    }
    const total = ids.length
    setActionError('')
    setBulkBusy(true)
    setBulkProgress({ total })
    try {
      const affected = kind === 'DELETE'
        ? await bulkDeleteReviews(ids)
        : await bulkUpdateReviewStatus(ids, kind)
      toast.success(t('reviews.bulkDone', { count: affected, defaultValue: `Đã xử lý ${affected} đánh giá.` }))
      setSelected(new Set())
    } catch (error) {
      const detail = error.message || t('reviews.bulkError', { defaultValue: 'Một số đánh giá xử lý không thành công.' })
      setActionError(detail)
    } finally {
      setBulkBusy(false)
      setBulkProgress(null)
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    }
  }, [bulkBusy, selected, t, queryClient])

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
      <div className="bb-grid-2-1 mb-4">
        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('reviews.summaryTitle', { defaultValue: 'Tổng quan đánh giá' })}</h2></div>
          <div className="bb-card-body">
            <div className="flex gap-4 items-start">
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold text-primary leading-none">{avg}</div>
                <Stars n={Math.round(Number(avg))} />
                <div className="text-xs text-muted-foreground mt-2">
                  {t('reviews.totalCount', { count: total, defaultValue: `${total} đánh giá` })}
                </div>
              </div>
              <div className="flex-1">
                {dist.map((d) => (
                  <div className="flex items-center gap-2 text-xs mb-1" key={d.s}>
                    <span>{d.s} ★</span>
                    <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: (total > 0 ? (d.n / total) * 100 : 0) + '%' }} />
                    </div>
                    <span className="w-4 text-right">{d.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('reviews.needsAction', { defaultValue: 'Cần xử lý' })}</h2></div>
          <div className="bb-card-body">
            <div className="dash-attention-list">
              <div className="dash-attention-item dash-attention-item--warning">
                <span className="dash-attention-icon"><MessageSquare size={16} /></span>
                <div className="dash-attention-body">
                  <div className="dash-attention-label">
                    {t('reviews.pendingCount', { count: pendingCount, defaultValue: `${pendingCount} đánh giá chờ duyệt` })}
                  </div>
                  <div className="dash-attention-hint">{t('reviews.pendingHint', { defaultValue: 'Duyệt sớm để hiển thị cho khách' })}</div>
                </div>
                <span className="dash-attention-count">{pendingCount}</span>
              </div>
              {lowRatingPending > 0 && (
                <div className="dash-attention-item dash-attention-item--danger">
                  <span className="dash-attention-icon"><MessageSquare size={16} /></span>
                  <div className="dash-attention-body">
                    <div className="dash-attention-label">
                      {t('reviews.lowRatingPending', { count: lowRatingPending, defaultValue: `${lowRatingPending} đánh giá 1-sao cần phản hồi` })}
                    </div>
                    <div className="dash-attention-hint">{t('reviews.lowRatingHint', { defaultValue: 'Cần liên hệ khách hàng sớm' })}</div>
                  </div>
                  <span className="dash-attention-count">{lowRatingPending}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bộ lọc trạng thái — nhóm nút bật/tắt (aria-pressed), không phải tab pattern. */}
      <div className="bb-seg" style={{ marginBottom: 16 }} role="group" aria-label={t('reviews.filterStatus')}>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={query.status === status}
            className={query.status === status ? 'active' : ''}
            onClick={() => updateQuery({ status }, { resetPage: true })}
          >
            {status === 'ALL' ? t('common.all') : statusLabel(status, t)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('reviews.searchPlaceholder')}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
        {isFiltered && (
          <button
            type="button"
            className="bb-btn bb-btn-ghost bb-btn-sm"
            onClick={resetFilters}
          >
            {t('common.resetFilters')}
          </button>
        )}
      </div>

      {canUpdate && (
        <BulkActionBar
          selectedCount={bulkProgress
            ? t('reviews.bulkProgress', {
                total: bulkProgress.total,
                defaultValue: `Đang xử lý ${bulkProgress.total} đánh giá…`,
              })
            : selected.size}
          onClear={() => setSelected(new Set())}
          actions={[
            {
              label: t('reviews.approve'),
              onClick: () => runBulk('APPROVED'),
              disabled: bulkBusy,
            },
            {
              label: t('reviews.spam'),
              onClick: () => runBulk('SPAM'),
              disabled: bulkBusy,
            },
            {
              label: t('common.delete'),
              tone: 'danger',
              onClick: () => runBulk('DELETE'),
              disabled: bulkBusy,
            },
          ]}
        />
      )}

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('reviews.error')}
          description={state.error}
          actionLabel={t('common.retry')}
          onAction={() => queryClient.invalidateQueries({ queryKey: ['reviews'] })}
        />
      )}

      {state.status === 'success' && items.length === 0 && (
        isFiltered ? (
          <StatePanel
            tone="neutral"
            title={t('reviews.empty')}
            description={t('reviews.emptyDesc')}
            actionLabel={t('common.resetFilters')}
            onAction={resetFilters}
          />
        ) : (
          <StatePanel
            tone="neutral"
            title={t('reviews.emptyAll', { defaultValue: 'Chưa có đánh giá nào' })}
            description={t('reviews.emptyAllDesc', { defaultValue: 'Đánh giá sẽ xuất hiện ở đây khi khách hàng để lại nhận xét cho sản phẩm trên website.' })}
          />
        )
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="flex flex-col gap-3">
          {canUpdate && state.status === 'success' && items.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <span
                className={`bb-cb${allChecked ? ' checked' : ''}`}
                role="checkbox"
                aria-checked={allChecked}
                tabIndex={0}
                onClick={toggleSelectAll}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSelectAll() } }}
              >
                {allChecked && <Check size={11} />}
              </span>
              <span onClick={toggleSelectAll}>{t('reviews.selectAllOnPage', { defaultValue: 'Chọn tất cả trên trang này' })}</span>
            </label>
          )}
          {state.status === 'loading' && items.length === 0 && (
            [...Array(3)].map((_, i) => (
              <div className="bb-card" key={`sk-${i}`}>
                <div className="bb-card-body">
                  <div className="dash-skeleton-block" style={{ height: 72 }} />
                </div>
              </div>
            ))
          )}
          {items.map((r, i) => (
            <ReviewCard
              key={r.id}
              review={r}
              index={i}
              isSelected={selected.has(r.id)}
              isPending={pendingId === r.id}
              canUpdate={canUpdate}
              contentLang={contentLang}
              navigate={navigate}
              t={t}
              onToggleSelect={toggleSelect}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}

          {state.status === 'success' && state.pagination && (
            <div className="px-5 py-3 border-t border-border">
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
