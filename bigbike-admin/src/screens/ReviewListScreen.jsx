import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviews, updateReviewStatus } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
const STATUS_TONES = { APPROVED: 'success', PENDING: 'warning', SPAM: 'muted', TRASH: 'muted' }

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

function ReviewStatusBadge({ review, t }) {
  return (
    <Badge variant={STATUS_TONES[review.status] || 'muted'}>
      {t(`reviews.status${review.status.charAt(0) + review.status.slice(1).toLowerCase()}`, {
        defaultValue: review.status,
      })}
    </Badge>
  )
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
          warning: result.mode === 'mock' ? result.warning : '',
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

  const handleOpenProduct = useCallback((productId) => {
    if (!productId) return
    navigate(`/admin/products/${productId}`)
  }, [navigate])

  const handleOpenReview = useCallback((reviewId) => {
    if (!reviewId) return
    navigate(`/admin/reviews/${reviewId}`)
  }, [navigate])

  const columns = useMemo(() => [
    {
      key: 'author',
      label: t('reviews.colAuthor'),
      render: (review) => review.authorName || '(---)',
    },
    {
      key: 'product',
      label: t('reviews.colProduct'),
      render: (review) => {
        const productLabel = formatText(review.productName, review.productId || t('reviews.unknownProduct'))
        const productMeta = review.productSlug ? `/${review.productSlug}` : review.productId

        return (
          <div className="flex flex-col gap-0.5 items-start">
            {review.productId ? (
              <button
                type="button"
                onClick={() => handleOpenProduct(review.productId)}
                className="p-0 border-none bg-transparent text-primary cursor-pointer font-bold text-left"
              >
                {productLabel}
              </button>
            ) : (
              <strong>{productLabel}</strong>
            )}
            <span className="text-xs text-muted-foreground">
              {formatText(productMeta, t('reviews.unknownProduct'))}
            </span>
          </div>
        )
      },
    },
    { key: 'rating', label: t('reviews.colRating'), render: (review) => review.rating },
    {
      key: 'body',
      label: t('reviews.colContent'),
      render: (review) => (
        <span className="text-sm">
          {review.body?.slice(0, 80)}
          {review.body?.length > 80 ? '...' : ''}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('reviews.colStatus'),
      render: (review) => <ReviewStatusBadge review={review} t={t} />,
    },
    { key: 'createdAt', label: t('reviews.colDate'), render: (review) => formatDateTime(review.createdAt) },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (review) => (
        <div className="row-actions">
          <Button variant="outline" size="sm" onClick={() => handleOpenReview(review.id)}>
            {t('reviews.view')}
          </Button>
          {canUpdate && review.status !== 'APPROVED' ? (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange(review, 'APPROVED')}>
              {t('reviews.approve')}
            </Button>
          ) : null}
          {canUpdate && review.status !== 'SPAM' ? (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange(review, 'SPAM')}>
              {t('reviews.spam')}
            </Button>
          ) : null}
          {canUpdate ? (
            <Button variant="danger" size="sm" onClick={() => handleDelete(review.id)}>
              {t('common.delete')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ], [canUpdate, handleDelete, handleOpenProduct, handleOpenReview, handleStatusChange, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((prev) => {
      const next = { ...prev, ...partial }
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

      {actionError ? (
        <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      ) : null}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('reviews.searchPlaceholder')}
           />
        </label>
        <label>
          {t('reviews.filterStatus')}
          <Select
            value={query.status}
            onValueChange={(val) => updateQuery({ status: val }, { resetPage: true })}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === 'ALL'
                  ? t('common.all')
                  : t(`reviews.status${status.charAt(0) + status.slice(1).toLowerCase()}`, { defaultValue: status })}
              </SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('reviews.error')}
          description={state.error}
          actionLabel={t('common.retry')}
          onAction={() => setQuery((prev) => ({ ...prev }))}
        />
      ) : null}

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('reviews.empty')}
          description={t('reviews.emptyDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={() => {
            setSearchInput('')
            setQuery(INITIAL_QUERY)
          }}
        />
      ) : null}

      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('reviews.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' ? (
            <PaginationControls pagination={state.pagination} onPageChange={(page) => updateQuery({ page })} />
          ) : null}
        </>
      ) : null}
    </section>
  )
}
