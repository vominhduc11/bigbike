import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, Image as ImageIcon, Loader2, MessageSquare, Trash2, Undo2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { AdminTable } from '../components/AdminTable'
import { TableRowActions } from '../components/TableRowActions'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { BulkActionBar } from '../components/BulkActionBar'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { PaginationControls } from '../components/PaginationControls'
import { ReviewModerationNote } from '../components/ReviewModerationNote'
import { ReviewStars } from '../components/ReviewStars'
import { DetailSection } from '../components/DetailSection'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { reviewRowAccent } from '../lib/statusTone'
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
import {
  canPermanentlyDeleteReview,
  getReviewStatusTargets,
  hasReviewStatusTarget,
  toVersionedReviewItems,
} from '../lib/reviewModeration'
import { useDebounce } from '../lib/useDebounce'
import { useAdminList } from '../lib/useAdminList'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { toast } from '@/lib/toast'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
// REVIEW_RULE_008: 9 mức nửa sao (5 → 1, bước 0,5).
const RATING_OPTIONS = ['', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1']
const RATING_BREAKDOWN_LEVELS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1]
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

function skippedReasonLabel(reason, t) {
  const key = String(reason || 'UNKNOWN')
  return t(`reviews.skipReason.${key}`, { defaultValue: t('reviews.skipReason.UNKNOWN') })
}

function stableHash(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash) + value.charCodeAt(index)
  return Math.abs(hash)
}

function authorKey(review) {
  return String(review.authorName || review.id || 'unknown').trim().toLowerCase()
}

function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
  return (words[0]?.charAt(0) || '?').toUpperCase()
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
      </div>
    </div>
  )
}

function PhotoThumb({ review, t }) {
  const [failed, setFailed] = useState(false)
  const url = review.photos?.[0]
  if (!url || failed) {
    return <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xs bg-surface-muted text-muted-foreground" aria-label={t('reviews.photoUnavailable')}><ImageIcon size={16} /></span>
  }
  return (
    <img
      src={resolveDisplayUrl(url)}
      alt={t('reviews.photoAlt', { count: 1, author: formatText(review.authorName, t('reviews.unknownAuthor')) })}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-10 shrink-0 rounded-xs border border-border object-cover"
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

export function ReviewListScreen({ navigate, canUpdate, isSuperAdmin = false }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const recentReviewItems = useRecentItems('recent:reviews')
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [selected, setSelected] = useState([])
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [staleVersions, setStaleVersions] = useState({})
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

  useEffect(() => {
    const totalPages = Number(state.pagination?.totalPages || 0)
    const lastAvailablePage = Math.max(1, totalPages)
    if (state.status !== 'success' || query.page <= lastAvailablePage) return
    const timer = window.setTimeout(() => {
      setSelected([])
      setQuery((current) => ({ ...current, page: lastAvailablePage }))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [query.page, state.pagination?.totalPages, state.status])

  const updateQuery = useCallback((partial) => {
    setSelected([])
    setQuery((current) => ({ ...current, ...partial, page: 1 }))
  }, [])

  const resetFilters = useCallback(() => {
    setSelected([])
    setSearchInput('')
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
  }, [])

  const items = useMemo(() => state.items || [], [state.items])
  const visibleSelected = useMemo(() => selected.filter((id) => items.some((item) => item.id === id)), [items, selected])
  const selectedReviews = useMemo(
    () => visibleSelected.map((id) => items.find((item) => item.id === id)).filter(Boolean),
    [items, visibleSelected],
  )
  const isFiltered = Boolean(query.search) || query.status !== 'ALL' || Boolean(query.rating)
  const summary = summaryQuery.data
  const ratingBreakdown = summary?.approved?.ratingBreakdown || {}

  useEffect(() => {
    if (state.status !== 'success' || state.isFetching || Object.keys(staleVersions).length === 0) return
    const timer = window.setTimeout(() => {
      setStaleVersions((current) => {
        const next = Object.fromEntries(Object.entries(current).filter(([id, staleVersion]) => {
          const latest = items.find((item) => String(item.id) === id)
          return latest && Number(latest.version) <= Number(staleVersion)
        }))
        return Object.keys(next).length === Object.keys(current).length ? current : next
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [items, staleVersions, state.isFetching, state.status])

  const confirmStatusChange = useCallback(async (nextStatus, count) => {
    if (nextStatus === 'PENDING') return true
    const confirmation = {
      APPROVED: {
        message: t('reviews.approveConfirmMany', { count }),
        title: t('reviews.approveConfirmTitle'),
        label: t('reviews.approve'),
        variant: 'default',
      },
      SPAM: {
        message: t('reviews.spamConfirmMany', { count }),
        title: t('reviews.spamConfirmTitle'),
        label: t('reviews.spam'),
        variant: 'default',
      },
      TRASH: {
        message: t('reviews.trashConfirmMany', { count }),
        title: t('reviews.trashConfirmTitle'),
        label: t('reviews.moveToTrash'),
        variant: 'default',
      },
    }[nextStatus]
    if (!confirmation) return false
    return showConfirm(
      confirmation.message,
      confirmation.title,
      { variant: confirmation.variant, confirmLabel: confirmation.label, cancelLabel: t('common.cancel') },
    )
  }, [t])

  const confirmDelete = useCallback(async (count) => showConfirm(
    t('reviews.deleteConfirmPermanent', { count, defaultValue: `Xoá vĩnh viễn ${count} đánh giá. Không thể hoàn tác; đánh giá và ảnh đính kèm sẽ bị xoá.` }),
    t('common.permanentDeleteTitle'),
    { variant: 'danger', confirmLabel: t('common.permanentDelete'), cancelLabel: t('common.cancel') },
  ), [t])

  const handleStatusChange = useCallback(async (review, nextStatus) => {
    if (pendingId || bulkBusy || staleVersions[review.id] !== undefined) return
    if (!getReviewStatusTargets(review.status).includes(nextStatus)) return
    if (!(await confirmStatusChange(nextStatus, 1))) return
    setActionError('')
    setBulkResult(null)
    setPendingId(review.id)
    try {
      await updateReviewStatus(review.id, nextStatus, review.version)
      toast.success(t('reviews.detail.statusUpdated'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
      ])
    } catch (error) {
      if (error?.status === 409) {
        setStaleVersions((current) => ({ ...current, [review.id]: review.version }))
        setActionError(t('reviews.staleConflict'))
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reviews'] }),
          queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
        ])
      } else {
        setActionError(error.message || t('reviews.statusUpdateError'))
      }
    } finally {
      setPendingId(null)
    }
  }, [bulkBusy, confirmStatusChange, pendingId, queryClient, staleVersions, t])

  const handleDelete = useCallback(async (review) => {
    if (pendingId || bulkBusy || staleVersions[review.id] !== undefined || !canPermanentlyDeleteReview(review, isSuperAdmin) || !(await confirmDelete(1))) return
    setActionError('')
    setBulkResult(null)
    setPendingId(review.id)
    try {
      await deleteReview(review.id, review.version)
      toast.success(t('reviews.detail.deleteSuccess'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
      ])
    } catch (error) {
      if (error?.status === 409) {
        setStaleVersions((current) => ({ ...current, [review.id]: review.version }))
        setActionError(t('reviews.staleConflict'))
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reviews'] }),
          queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
        ])
      } else {
        setActionError(error.message || t('reviews.deleteError'))
      }
    } finally {
      setPendingId(null)
    }
  }, [bulkBusy, confirmDelete, isSuperAdmin, pendingId, queryClient, staleVersions, t])

  const runBulk = useCallback(async (kind) => {
    const versionedItems = toVersionedReviewItems(selectedReviews)
    if (bulkBusy || versionedItems.length === 0) return
    if (kind === 'DELETE') {
      if (!isSuperAdmin || !selectedReviews.some((review) => review.status === 'TRASH') || !(await confirmDelete(versionedItems.length))) return
    } else {
      if (!hasReviewStatusTarget(selectedReviews, kind) || !(await confirmStatusChange(kind, versionedItems.length))) return
    }
    setActionError('')
    setBulkResult(null)
    setBulkBusy(true)
    try {
      const response = kind === 'DELETE'
        ? await bulkDeleteReviews(versionedItems)
        : await bulkUpdateReviewStatus(versionedItems, kind)
      const affected = Number(typeof response === 'number' ? response : response?.affected || 0)
      const skipped = Array.isArray(response?.skipped) ? response.skipped : []
      setBulkResult({ affected, skipped })
      const skippedIds = new Set(skipped.map((item) => String(item.id)))
      setSelected(visibleSelected.filter((id) => skippedIds.has(String(id))))
      const conflicts = skipped.filter((item) => item.reason === 'VERSION_CONFLICT')
      if (conflicts.length > 0) {
        setStaleVersions((current) => {
          const next = { ...current }
          for (const conflict of conflicts) {
            const review = selectedReviews.find((item) => String(item.id) === String(conflict.id))
            if (review) next[review.id] = review.version
          }
          return next
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
      ])
      const summaryMessage = t('reviews.bulkResultSummary', { affected, skipped: skipped.length })
      if (skipped.length === 0) toast.success(summaryMessage)
      else if (affected === 0) toast.error(summaryMessage)
      else toast.warning(summaryMessage)
    } catch (error) {
      if (error?.status === 409) {
        setActionError(t('reviews.staleConflict'))
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reviews'] }),
          queryClient.invalidateQueries({ queryKey: ['review-summary'] }),
        ])
      } else {
        setActionError(error.message || t('reviews.bulkError'))
      }
    } finally {
      setBulkBusy(false)
    }
  }, [bulkBusy, confirmDelete, confirmStatusChange, isSuperAdmin, queryClient, selectedReviews, t, visibleSelected])

  const renderReviewActions = useCallback((review) => {
    const targets = getReviewStatusTargets(review.status)
    const busy = pendingId === review.id || bulkBusy || staleVersions[review.id] !== undefined
    return (
      <TableRowActions
        primaryActions={[
          {
            key: 'view',
            label: t('reviews.view'),
            icon: Eye,
            onSelect: () => navigate(`/admin/reviews/${review.id}`),
          },
          canUpdate && targets.includes('APPROVED') && {
            key: 'approve',
            label: t('reviews.approve'),
            icon: Check,
            disabled: busy,
            loading: pendingId === review.id,
            onSelect: () => handleStatusChange(review, 'APPROVED'),
          },
        ]}
        menuActions={[
          canUpdate && targets.includes('SPAM') && {
            key: 'spam',
            label: t('reviews.spam'),
            icon: EyeOff,
            tone: 'danger',
            disabled: busy,
            onSelect: () => handleStatusChange(review, 'SPAM'),
          },
          canUpdate && targets.includes('TRASH') && {
            key: 'trash',
            label: t('reviews.moveToTrash'),
            icon: Trash2,
            tone: 'danger',
            disabled: busy,
            onSelect: () => handleStatusChange(review, 'TRASH'),
          },
          canUpdate && targets.includes('PENDING') && {
            key: 'pending',
            label: review.status === 'TRASH' ? t('reviews.restore') : t('reviews.returnPending'),
            icon: Undo2,
            disabled: busy,
            onSelect: () => handleStatusChange(review, 'PENDING'),
          },
          canUpdate && canPermanentlyDeleteReview(review, isSuperAdmin) && {
            key: 'permanent-delete',
            label: t('reviews.deletePermanent'),
            icon: Trash2,
            tone: 'danger',
            separatorBefore: true,
            disabled: busy,
            onSelect: () => handleDelete(review),
          },
        ]}
      />
    )
  }, [bulkBusy, canUpdate, handleDelete, handleStatusChange, isSuperAdmin, navigate, pendingId, staleVersions, t])

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
      render: (review) => Number.isFinite(review.rating)
        ? <div className="flex items-center gap-2"><ReviewStars rating={review.rating} /><span className="text-sm">{review.rating}/5</span></div>
        : <span className="text-muted-foreground">—</span>,
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
      // Kết quả kiểm duyệt tự động nằm ngay dưới trạng thái thay vì thành cột riêng:
      // "đang ở đâu" và "vì sao ở đó" đọc cùng một chỗ, và bảng không phình thêm cột.
      render: (review) => (
        <div className="grid justify-items-start gap-2">
          <StatusBadge type="review" status={review.status} />
          <ReviewModerationNote review={review} compact />
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: t('reviews.colDate'),
      render: (review) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(review.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: <span className="sr-only">{t('common.actions')}</span>,
      align: 'right',
      render: renderReviewActions,
    },
  ], [contentLang, navigate, renderReviewActions, t])
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:reviews')

  const mobileCard = useCallback((review) => {
    const authorName = formatText(review.authorName, t('reviews.unknownAuthor'))
    return {
      title: <AuthorIdentity review={review} t={t} />,
      selectionLabel: t('common.selectNamedRow', { name: authorName }),
      subtitle: <ProductLink review={review} contentLang={contentLang} navigate={navigate} t={t} />,
      status: (
        <div className="grid justify-items-start gap-2">
          <StatusBadge type="review" status={review.status} />
          <ReviewModerationNote review={review} compact />
        </div>
      ),
      meta: [
        {
          label: t('reviews.colRating'),
          value: Number.isFinite(review.rating)
            ? <div className="flex items-center gap-2"><ReviewStars rating={review.rating} /><span>{review.rating}/5</span></div>
            : '—',
        },
        { label: t('reviews.colDate'), value: formatDateTime(review.createdAt) },
        { label: t('reviews.colPhotos'), value: review.photos?.length ? `${review.photos.length}` : '—' },
        { label: t('reviews.colContent'), value: formatText(review.body, t('reviews.contentMissing')) },
      ],
      actions: renderReviewActions(review),
    }
  }, [contentLang, navigate, renderReviewActions, t])

  const summaryLoading = summaryQuery.isLoading && !summary
  const listLoading = state.status === 'loading' && items.length === 0
  const refreshing = state.isFetching || summaryQuery.isFetching

  return (
    <Screen>
      <ScreenHeader
        group="sales"
        title={t('reviews.title')}
      />

      {refreshing ? <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite"><Loader2 size={16} className="animate-spin" />{t('reviews.refreshing')}</div> : null}
      {actionError ? <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>{actionError}</Alert> : null}
      {bulkResult ? (
        <Alert
          tone={bulkResult.skipped.length > 0 ? 'warning' : 'success'}
          dismissible
          onDismiss={() => setBulkResult(null)}
          className="mb-4"
        >
          <p className="m-0">{t('reviews.bulkResultSummary', { affected: bulkResult.affected, skipped: bulkResult.skipped.length })}</p>
          {bulkResult.skipped.length > 0 ? (
            <ul className="mt-2 mb-0 grid gap-1 pl-5">
              {bulkResult.skipped.map((item, index) => (
                <li key={`${item.id ?? 'unknown'}-${item.reason ?? 'UNKNOWN'}-${index}`}>
                  {t('reviews.bulkSkippedItem', {
                    id: item.id ?? t('common.unknown'),
                    reason: skippedReasonLabel(item.reason, t),
                  })}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state.status === 'error' && items.length > 0 ? <Alert tone="danger"><div className="flex flex-wrap items-center justify-between gap-3"><span>{state.error || t('reviews.error')}</span><Button type="button" variant="ghost" className="min-h-11" onClick={state.refetch}>{t('common.retry')}</Button></div></Alert> : null}
      {!canUpdate ? <ReadOnlyBanner warning={t('reviews.readOnlyListHint')} /> : null}
      <RecentItemsChips items={recentReviewItems} onSelect={(item) => navigate(`/admin/reviews/${item.id}`)} />

      {summaryLoading ? (
        <div className="mb-6">
          <ScreenSkeleton variant="form" count={2} showHeader={false} />
        </div>
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <DetailSection
            className="lg:col-span-2"
            title={t('reviews.publicScoreTitle')}
            description={t('reviews.publicScoreHint')}
            action={summaryQuery.isError ? <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => summaryQuery.refetch()}>{t('common.retry')}</Button> : null}
          >
          {summaryQuery.isError ? <p className="m-0 text-sm text-danger">{summaryQuery.error?.message || t('reviews.summaryError')}</p> : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-32 text-center"><div className="font-display text-4xl font-semibold text-primary">{Number(summary?.approved?.averageRating || 0).toFixed(1)}</div><ReviewStars rating={summary?.approved?.averageRating} label={t('reviews.publicScore')} /><p className="mt-2 mb-0 text-sm text-muted-foreground">{t('reviews.publicReviewCount', { count: summary?.approved?.totalReviews || 0 })}</p></div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 sm:grid-cols-5">{RATING_BREAKDOWN_LEVELS.map((star) => <div key={star} className="flex flex-col gap-1 text-sm"><span className="font-semibold">{star} ★</span><span className="text-muted-foreground">{Number(ratingBreakdown[String(star)] || 0).toLocaleString()}</span></div>)}</div>
            </div>
          )}
          </DetailSection>

          <DetailSection title={t('reviews.needsAction')} description={t('reviews.queueHint')}>
          {summaryQuery.isError ? (
            <div className="grid gap-3">
              <p className="m-0 text-sm text-danger">{t('reviews.summaryError')}</p>
              <Button type="button" variant="ghost" className="min-h-11 justify-self-start" onClick={() => summaryQuery.refetch()}>{t('common.retry')}</Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Button type="button" variant="outline" className="flex min-h-11 items-center justify-between gap-3 px-3 text-left" onClick={() => updateQuery({ status: 'PENDING', rating: '' })}>
                <span className="flex items-center gap-2"><MessageSquare size={16} />{t('reviews.pendingCount', { count: summary?.pending?.totalReviews || 0 })}</span><span className="font-semibold text-warning">{summary?.pending?.totalReviews || 0}</span>
              </Button>
              <Button type="button" variant="outline" className="flex min-h-11 items-center justify-between gap-3 border-danger-border px-3 text-left" onClick={() => updateQuery({ status: 'PENDING', rating: '1' })}>
                <span className="flex items-center gap-2"><MessageSquare size={16} />{t('reviews.lowRatingPending', { count: summary?.pending?.oneStarReviews || 0 })}</span><span className="font-semibold text-danger">{summary?.pending?.oneStarReviews || 0}</span>
              </Button>
            </div>
          )}
          </DetailSection>
        </div>
      )}

      <FilterBar ariaLabel={t('reviews.filterStatus')} className="mb-4">
        <div className="min-w-56 flex-1"><label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="review-search">{t('reviews.searchLabel')}</label><FilterSearchInput value={searchInput} onChange={setSearchInput} placeholder={t('reviews.searchPlaceholder')} ariaLabel={t('reviews.searchLabel')} /></div>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{t('reviews.filterStatus')}<FilterSelect value={query.status} onValueChange={(status) => updateQuery({ status })} ariaLabel={t('reviews.filterStatus')} options={STATUS_OPTIONS.map((status) => ({ value: status, label: status === 'ALL' ? t('common.all') : statusLabel(status, t) }))} /></label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{t('reviews.filterRating')}<FilterSelect value={query.rating} onValueChange={(rating) => updateQuery({ rating })} ariaLabel={t('reviews.filterRating')} options={RATING_OPTIONS.map((rating) => ({ value: rating, label: rating ? t('reviews.ratingOption', { rating }) : t('reviews.allRatings') }))} /></label>
        <PageSizeSelect value={query.pageSize} onChange={(pageSize) => updateQuery({ pageSize })} disabled={state.isFetching} />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        {isFiltered ? <Button type="button" variant="ghost" className="min-h-11" onClick={resetFilters}>{t('common.resetFilters')}</Button> : null}
      </FilterBar>

      {canUpdate ? (
        <BulkActionBar
          selectedCount={visibleSelected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: t('reviews.approve'), onClick: () => runBulk('APPROVED'), disabled: bulkBusy || !hasReviewStatusTarget(selectedReviews, 'APPROVED'), loading: bulkBusy },
            { label: t('reviews.spam'), onClick: () => runBulk('SPAM'), disabled: bulkBusy || !hasReviewStatusTarget(selectedReviews, 'SPAM'), loading: bulkBusy },
            { label: t('reviews.moveToTrash'), tone: 'danger', onClick: () => runBulk('TRASH'), disabled: bulkBusy || !hasReviewStatusTarget(selectedReviews, 'TRASH'), loading: bulkBusy },
            { label: t('reviews.returnPendingBulk'), onClick: () => runBulk('PENDING'), disabled: bulkBusy || !hasReviewStatusTarget(selectedReviews, 'PENDING'), loading: bulkBusy },
            isSuperAdmin
              ? { label: t('reviews.deletePermanent'), tone: 'danger', onClick: () => runBulk('DELETE'), disabled: bulkBusy || !selectedReviews.some((review) => review.status === 'TRASH'), loading: bulkBusy }
              : null,
          ].filter(Boolean)}
        />
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="m-0 text-sm text-muted-foreground" aria-live="polite">{t('reviews.filteredResults', { count: state.pagination?.totalItems || 0 })}</p>{state.pagination?.totalItems ? <p className="m-0 text-xs text-muted-foreground">{t('reviews.pageOf', { page: state.pagination.page, total: state.pagination.totalPages })}</p> : null}</div>

      {state.status === 'error' && items.length === 0 ? <StatePanel tone="danger" title={t('reviews.error')} description={state.error} actionLabel={t('common.retry')} onAction={state.refetch} /> : null}
      {state.status !== 'error' && state.status === 'success' && items.length === 0 ? <StatePanel tone="neutral" title={isFiltered ? t('reviews.empty') : t('reviews.emptyAll')} description={isFiltered ? t('reviews.emptyDesc') : t('reviews.emptyAllDesc')} actionLabel={isFiltered ? t('common.resetFilters') : undefined} onAction={isFiltered ? resetFilters : undefined} /> : null}
      {state.status !== 'error' && (items.length > 0 || listLoading) ? <AdminTable columns={visibleColumns} rows={items} loading={listLoading} pageSize={query.pageSize} selectable={canUpdate} selectedIds={visibleSelected} onSelectionChange={setSelected} onRowClick={(review) => navigate(`/admin/reviews/${review.id}`)} rowClassName={(review) => reviewRowAccent(review.status)} mobileCard={mobileCard} caption={t('reviews.tableCaption')} /> : null}
      <PaginationControls pagination={state.pagination} disabled={state.isFetching} onPageChange={(page) => { setSelected([]); setQuery((current) => ({ ...current, page })) }} />
    </Screen>
  )
}
