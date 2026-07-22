import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, Image as ImageIcon, Loader2, MessageSquare, RefreshCw, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { AdminTable } from '../components/AdminTable'
import { BulkActionBar } from '../components/BulkActionBar'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { PaginationControls } from '../components/PaginationControls'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import { showConfirm } from '../lib/confirm'
import {
  bulkDeleteReviews,
  bulkUpdateReviewStatus,
  deleteReview,
  fetchReviewSummary,
  fetchReviews,
  updateReviewStatus,
} from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { formatDateTime, formatText } from '../lib/formatters'
import { resolveDisplayUrl } from '../lib/contracts'
import { useDebounce } from '../lib/useDebounce'
import { useAdminList } from '../lib/useAdminList'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { toast } from '@/lib/toast'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
const RATING_OPTIONS = ['', '5', '4', '3', '2', '1']
const AVATAR_COLORS = [
  'bg-primary text-primary-foreground',
  'bg-info-bg text-info',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-danger-bg text-danger',
  'bg-secondary text-secondary-foreground',
]
const INITIAL_QUERY = { search: '', status: 'ALL', rating: '', page: 1, pageSize: 20 }

function statusLabel(status, t) {
  const safeStatus = String(status || '')
  return t(`reviews.status${safeStatus.charAt(0) + safeStatus.slice(1).toLowerCase()}`, {
    defaultValue: t('common.unknown'),
  })
}

function stableHash(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash) + value.charCodeAt(index)
  return Math.abs(hash)
}

function authorKey(review) {
  return String(review.authorEmail || review.authorName || review.id || 'unknown').trim().toLowerCase()
}

function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
  return (words[0]?.charAt(0) || '?').toUpperCase()
}

function Stars({ rating, label }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return (
    <span className="inline-flex gap-px" role="img" aria-label={label || `${rounded}/5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} aria-hidden="true" className={index < rounded ? 'text-warning' : 'text-muted-foreground'}>★</span>
      ))}
    </span>
  )
}

function AuthorIdentity({ review, t }) {
  const name = formatText(review.authorName, t('reviews.unknownAuthor'))
  const color = AVATAR_COLORS[stableHash(authorKey(review)) % AVATAR_COLORS.length]
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`} aria-hidden="true">
        {initials(name)}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{formatText(review.authorEmail, t('reviews.detail.emailMissing'))}</div>
      </div>
    </div>
  )
}

function PhotoThumb({ review, t }) {
  const [failed, setFailed] = useState(false)
  const url = review.photos?.[0]
  if (!url || failed) {
    return <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-muted text-muted-foreground" aria-label={t('reviews.photoUnavailable')}><ImageIcon size={16} /></span>
  }
  return (
    <img
      src={resolveDisplayUrl(url)}
      alt={t('reviews.photoAlt', { count: 1, author: formatText(review.authorName, t('reviews.unknownAuthor')) })}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-10 shrink-0 rounded-sm border border-border object-cover"
    />
  )
}

function ProductLink({ review, contentLang, navigate, t }) {
  const name = formatText(contentLang === 'en' ? (review.productNameEn || review.productName) : review.productName, t('reviews.unknownProduct'))
  if (!review.productId) return <span className="font-medium text-muted-foreground">{name}</span>
  return (
    <a
      href={`/admin/products/${review.productId}`}
      title={t('reviews.productLinkHint')}
      className="font-semibold text-primary underline-offset-4 hover:underline"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return
        event.preventDefault()
        navigate(`/admin/products/${review.productId}`)
      }}
    >
      {name}
    </a>
  )
}

export function ReviewListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const recentReviewItems = useRecentItems('recent:reviews')
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [selected, setSelected] = useState([])
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const searchRender = useRef(true)
  const queryClient = useQueryClient()
  const debouncedSearch = useDebounce(searchInput, 300)
  const state = useAdminList(['reviews', query, contentLang], () => fetchReviews(query))
  const summaryQuery = useQuery({
    queryKey: ['review-summary'],
    queryFn: fetchReviewSummary,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/reviews', () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-summary'] })
    })
    return unsubscribe
  }, [queryClient])

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    try { sessionStorage.setItem('reviews:listQuery', window.location.search) } catch { /* browser storage is optional */ }
  }, [query])

  useEffect(() => {
    if (searchRender.current) {
      searchRender.current = false
      return
    }
    setSelected([])
    setQuery((current) => ({ ...current, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const updateQuery = useCallback((partial) => {
    setSelected([])
    setQuery((current) => ({ ...current, ...partial, page: 1 }))
  }, [])

  const resetFilters = useCallback(() => {
    setSelected([])
    setSearchInput('')
    setQuery(INITIAL_QUERY)
  }, [])

  const items = useMemo(() => state.items || [], [state.items])
  const visibleSelected = useMemo(() => selected.filter((id) => items.some((item) => item.id === id)), [items, selected])
  const isFiltered = Boolean(query.search) || query.status !== 'ALL' || Boolean(query.rating)
  const summary = summaryQuery.data
  const ratingBreakdown = summary?.approved?.ratingBreakdown || {}

  const refetchReviews = state.refetch
  const refetchSummary = summaryQuery.refetch
  const refresh = useCallback(async () => {
    await Promise.all([refetchReviews(), refetchSummary()])
  }, [refetchReviews, refetchSummary])

  const confirmSpam = useCallback(async (count) => showConfirm(
    t('reviews.spamConfirmMany', { count, defaultValue: `Đánh dấu ${count} đánh giá là spam? Đánh giá và ảnh sẽ không còn hiển thị công khai.` }),
    t('reviews.spamConfirmTitle'),
    { variant: 'danger', confirmLabel: t('reviews.spam') },
  ), [t])

  const confirmDelete = useCallback(async (count) => showConfirm(
    t('reviews.deleteConfirmPermanent', { count, defaultValue: `Xóa vĩnh viễn ${count} đánh giá? Không thể hoàn tác; đánh giá và ảnh đính kèm sẽ bị xóa.` }),
    t('reviews.deleteConfirmTitle'),
    { variant: 'danger', confirmLabel: t('reviews.deletePermanent'), cancelLabel: t('common.cancel') },
  ), [t])

  const handleStatusChange = useCallback(async (review, nextStatus) => {
    if (pendingId || bulkBusy) return
    if (nextStatus === 'SPAM' && !(await confirmSpam(1))) return
    setActionError('')
    setPendingId(review.id)
    try {
      await updateReviewStatus(review.id, nextStatus)
      toast.success(t('reviews.detail.statusUpdated'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
      ])
    } catch (error) {
      setActionError(error.message || t('reviews.approveError'))
    } finally {
      setPendingId(null)
    }
  }, [bulkBusy, confirmSpam, pendingId, queryClient, t])

  const handleDelete = useCallback(async (review) => {
    if (pendingId || bulkBusy || !(await confirmDelete(1))) return
    setActionError('')
    setPendingId(review.id)
    try {
      await deleteReview(review.id)
      toast.success(t('reviews.detail.deleteSuccess'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
      ])
    } catch (error) {
      setActionError(error.message || t('reviews.deleteError'))
    } finally {
      setPendingId(null)
    }
  }, [bulkBusy, confirmDelete, pendingId, queryClient, t])

  const runBulk = useCallback(async (kind) => {
    const ids = visibleSelected
    if (bulkBusy || ids.length === 0) return
    if (kind === 'DELETE' && !(await confirmDelete(ids.length))) return
    if (kind === 'SPAM' && !(await confirmSpam(ids.length))) return
    setActionError('')
    setBulkBusy(true)
    try {
      const affected = kind === 'DELETE'
        ? await bulkDeleteReviews(ids)
        : await bulkUpdateReviewStatus(ids, kind)
      toast.success(t('reviews.bulkDone', { count: affected, defaultValue: `Đã xử lý ${affected} đánh giá.` }))
      setSelected([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
      ])
    } catch (error) {
      setActionError(error.message || t('reviews.bulkError'))
    } finally {
      setBulkBusy(false)
    }
  }, [bulkBusy, confirmDelete, confirmSpam, t, queryClient, visibleSelected])

  const columns = useMemo(() => [
    {
      key: 'author',
      label: t('reviews.colAuthor'),
      skeletonWidth: '24%',
      render: (review) => <AuthorIdentity review={review} t={t} />,
    },
    {
      key: 'product',
      label: t('reviews.colProduct'),
      skeletonWidth: '22%',
      render: (review) => <ProductLink review={review} contentLang={contentLang} navigate={navigate} t={t} />,
    },
    {
      key: 'rating',
      label: t('reviews.colRating'),
      render: (review) => <div className="flex items-center gap-2"><Stars rating={review.rating} /><span className="text-sm">{review.rating}/5</span></div>,
    },
    {
      key: 'content',
      label: t('reviews.colContent'),
      skeletonWidth: '28%',
      render: (review) => <p className="m-0 max-w-sm truncate text-sm text-muted-foreground">{formatText(review.body, t('reviews.contentMissing'))}</p>,
    },
    {
      key: 'photos',
      label: t('reviews.colPhotos'),
      render: (review) => review.photos?.length ? <div className="flex items-center gap-2"><PhotoThumb review={review} t={t} /><span className="text-xs text-muted-foreground">{review.photos.length}</span></div> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status',
      label: t('reviews.colStatus'),
      render: (review) => <StatusBadge type="review" status={review.status} />,
    },
    {
      key: 'createdAt',
      label: t('reviews.colDate'),
      render: (review) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(review.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (review) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => navigate(`/admin/reviews/${review.id}`)} aria-label={t('reviews.view')}>
            <Eye size={16} aria-hidden="true" />
          </Button>
          {canUpdate && review.status !== 'APPROVED' ? <Button type="button" size="sm" className="min-h-11" disabled={pendingId === review.id || bulkBusy} loading={pendingId === review.id} onClick={() => handleStatusChange(review, 'APPROVED')}>{t('reviews.approve')}</Button> : null}
          {canUpdate && review.status !== 'SPAM' ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" disabled={pendingId === review.id || bulkBusy} loading={pendingId === review.id} onClick={() => handleStatusChange(review, 'SPAM')}><EyeOff size={16} aria-hidden="true" />{t('reviews.spam')}</Button> : null}
          {canUpdate ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" disabled={pendingId === review.id || bulkBusy} loading={pendingId === review.id} onClick={() => handleDelete(review)} aria-label={t('reviews.deletePermanent')}><Trash2 size={16} aria-hidden="true" /></Button> : null}
        </div>
      ),
    },
  ], [bulkBusy, canUpdate, contentLang, handleDelete, handleStatusChange, navigate, pendingId, t])

  const mobileCard = useCallback((review) => ({
    title: <AuthorIdentity review={review} t={t} />,
    subtitle: <ProductLink review={review} contentLang={contentLang} navigate={navigate} t={t} />,
    status: <StatusBadge type="review" status={review.status} />,
    meta: [
      { label: t('reviews.colRating'), value: <div className="flex items-center gap-2"><Stars rating={review.rating} /><span>{review.rating}/5</span></div> },
      { label: t('reviews.colDate'), value: formatDateTime(review.createdAt) },
      { label: t('reviews.colPhotos'), value: review.photos?.length ? `${review.photos.length}` : '—' },
      { label: t('reviews.colContent'), value: formatText(review.body, t('reviews.contentMissing')) },
    ],
    actions: (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={() => navigate(`/admin/reviews/${review.id}`)}><Eye size={16} />{t('reviews.view')}</Button>
        {canUpdate && review.status !== 'APPROVED' ? <Button type="button" className="min-h-11 flex-1" disabled={pendingId === review.id || bulkBusy} onClick={() => handleStatusChange(review, 'APPROVED')}>{pendingId === review.id ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}{t('reviews.approve')}</Button> : null}
        {canUpdate && review.status !== 'SPAM' ? <Button type="button" variant="ghost" className="min-h-11 flex-1 text-danger" disabled={pendingId === review.id || bulkBusy} loading={pendingId === review.id} onClick={() => handleStatusChange(review, 'SPAM')}><EyeOff size={16} />{t('reviews.spam')}</Button> : null}
        {canUpdate ? <Button type="button" variant="ghost" className="min-h-11 flex-1 text-danger" disabled={pendingId === review.id || bulkBusy} loading={pendingId === review.id} onClick={() => handleDelete(review)}><Trash2 size={16} />{t('reviews.deletePermanent')}</Button> : null}
      </div>
    ),
  }), [bulkBusy, canUpdate, contentLang, handleDelete, handleStatusChange, navigate, pendingId, t])

  const summaryLoading = summaryQuery.isLoading && !summary
  const listLoading = state.status === 'loading' && items.length === 0

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('reviews.eyebrow')}
        title={t('reviews.title')}
        description={t('reviews.description')}
        actions={(
          <Button type="button" variant="secondary" className="min-h-11" onClick={refresh} disabled={state.isFetching || summaryQuery.isFetching}>
            <RefreshCw size={16} className={state.isFetching || summaryQuery.isFetching ? 'animate-spin' : ''} />
            {state.isFetching || summaryQuery.isFetching ? t('reviews.refreshing') : t('reviews.refresh')}
          </Button>
        )}
      />

      {state.isFetching || summaryQuery.isFetching ? <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite"><Loader2 size={16} className="animate-spin" />{t('reviews.refreshing')}</div> : null}
      {actionError ? <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>{actionError}</Alert> : null}
      {state.status === 'error' && items.length > 0 ? <Alert tone="danger"><div className="flex flex-wrap items-center justify-between gap-3"><span>{state.error || t('reviews.error')}</span><Button type="button" variant="ghost" className="min-h-11" onClick={state.refetch}>{t('common.retry')}</Button></div></Alert> : null}
      {!canUpdate ? <ReadOnlyBanner warning={t('reviews.readOnlyListHint')} /> : null}
      <RecentItemsChips items={recentReviewItems} onSelect={(item) => navigate(`/admin/reviews/${item.id}`)} />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-md border border-border bg-surface p-5 lg:col-span-2" aria-labelledby="review-public-score">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div><h2 id="review-public-score" className="font-display text-lg font-semibold">{t('reviews.publicScoreTitle')}</h2><p className="m-0 text-sm text-muted-foreground">{t('reviews.publicScoreHint')}</p></div>
            {summaryQuery.isError ? <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => summaryQuery.refetch()}>{t('common.retry')}</Button> : null}
          </div>
          {summaryLoading ? <div className="h-24 animate-pulse rounded-sm bg-surface-muted" aria-label={t('reviews.loading')} /> : summaryQuery.isError ? <p className="m-0 text-sm text-danger">{summaryQuery.error?.message || t('reviews.summaryError')}</p> : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-32 text-center"><div className="font-display text-4xl font-semibold text-primary">{Number(summary?.approved?.averageRating || 0).toFixed(1)}</div><Stars rating={summary?.approved?.averageRating} label={t('reviews.publicScore')} /><p className="mt-2 mb-0 text-sm text-muted-foreground">{t('reviews.publicReviewCount', { count: summary?.approved?.totalReviews || 0 })}</p></div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">{[5, 4, 3, 2, 1].map((star) => <div key={star} className="flex flex-col gap-1 text-sm"><span className="font-semibold">{star} ★</span><span className="text-muted-foreground">{Number(ratingBreakdown[String(star)] || 0).toLocaleString()}</span></div>)}</div>
            </div>
          )}
        </section>

        <section className="rounded-md border border-border bg-surface p-5" aria-labelledby="review-queue">
          <h2 id="review-queue" className="mb-1 font-display text-lg font-semibold">{t('reviews.needsAction')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('reviews.queueHint')}</p>
          {summaryLoading ? <div className="h-20 animate-pulse rounded-sm bg-surface-muted" /> : (
            <div className="grid gap-2">
              <Button type="button" variant="outline" className="flex min-h-11 items-center justify-between gap-3 px-3 text-left" onClick={() => updateQuery({ status: 'PENDING', rating: '' })}>
                <span className="flex items-center gap-2"><MessageSquare size={16} />{t('reviews.pendingCount', { count: summary?.pending?.totalReviews || 0 })}</span><span className="font-semibold text-warning">{summary?.pending?.totalReviews || 0}</span>
              </Button>
              <Button type="button" variant="outline" className="flex min-h-11 items-center justify-between gap-3 border-danger-border px-3 text-left" onClick={() => updateQuery({ status: 'PENDING', rating: '1' })}>
                <span className="flex items-center gap-2"><MessageSquare size={16} />{t('reviews.lowRatingPending', { count: summary?.pending?.oneStarReviews || 0 })}</span><span className="font-semibold text-danger">{summary?.pending?.oneStarReviews || 0}</span>
              </Button>
            </div>
          )}
        </section>
      </div>

      <FilterBar ariaLabel={t('reviews.filterStatus')} className="mb-4">
        <div className="min-w-56 flex-1"><label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="review-search">{t('reviews.searchLabel')}</label><FilterSearchInput value={searchInput} onChange={setSearchInput} placeholder={t('reviews.searchPlaceholder')} ariaLabel={t('reviews.searchLabel')} /></div>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{t('reviews.filterStatus')}<FilterSelect value={query.status} onValueChange={(status) => updateQuery({ status })} ariaLabel={t('reviews.filterStatus')} options={STATUS_OPTIONS.map((status) => ({ value: status, label: status === 'ALL' ? t('common.all') : statusLabel(status, t) }))} /></label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{t('reviews.filterRating')}<FilterSelect value={query.rating} onValueChange={(rating) => updateQuery({ rating })} ariaLabel={t('reviews.filterRating')} options={RATING_OPTIONS.map((rating) => ({ value: rating, label: rating ? t('reviews.ratingOption', { rating }) : t('reviews.allRatings') }))} /></label>
        <PageSizeSelect value={query.pageSize} onChange={(pageSize) => updateQuery({ pageSize })} disabled={state.isFetching} />
        {isFiltered ? <Button type="button" variant="ghost" className="min-h-11" onClick={resetFilters}>{t('common.resetFilters')}</Button> : null}
      </FilterBar>

      {canUpdate ? <BulkActionBar selectedCount={visibleSelected.length} onClear={() => setSelected([])} actions={[{ label: t('reviews.approve'), onClick: () => runBulk('APPROVED'), disabled: bulkBusy, loading: bulkBusy }, { label: t('reviews.spam'), onClick: () => runBulk('SPAM'), disabled: bulkBusy, loading: bulkBusy }, { label: t('reviews.deletePermanent'), tone: 'danger', onClick: () => runBulk('DELETE'), disabled: bulkBusy, loading: bulkBusy }]} /> : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="m-0 text-sm text-muted-foreground" aria-live="polite">{t('reviews.filteredResults', { count: state.pagination?.totalItems || 0 })}</p>{state.pagination?.totalItems ? <p className="m-0 text-xs text-muted-foreground">{t('reviews.pageOf', { page: state.pagination.page, total: state.pagination.totalPages })}</p> : null}</div>

      {state.status === 'error' && items.length === 0 ? <StatePanel tone="danger" title={t('reviews.error')} description={state.error} actionLabel={t('common.retry')} onAction={state.refetch} /> : null}
      {state.status !== 'error' && state.status === 'success' && items.length === 0 ? <StatePanel tone="neutral" title={isFiltered ? t('reviews.empty') : t('reviews.emptyAll')} description={isFiltered ? t('reviews.emptyDesc') : t('reviews.emptyAllDesc')} actionLabel={isFiltered ? t('common.resetFilters') : undefined} onAction={isFiltered ? resetFilters : undefined} /> : null}
      {state.status !== 'error' && (items.length > 0 || listLoading) ? <AdminTable columns={columns} rows={items} loading={listLoading} pageSize={query.pageSize} selectable={canUpdate} selectedIds={visibleSelected} onSelectionChange={setSelected} onRowClick={(review) => navigate(`/admin/reviews/${review.id}`)} mobileCard={mobileCard} caption={t('reviews.tableCaption')} /> : null}
      <PaginationControls pagination={state.pagination} disabled={state.isFetching} onPageChange={(page) => { setSelected([]); setQuery((current) => ({ ...current, page })) }} />
    </Screen>
  )
}
