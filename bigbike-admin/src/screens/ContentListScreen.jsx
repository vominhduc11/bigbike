import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, FileText, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { AdminTable } from '../components/AdminTable'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { PublishStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { StatePanel } from '../components/StatePanel'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import {
  deleteContent,
  fetchContent,
  fetchContentDetail,
  permanentDeleteContent,
  restoreContent,
  updateContent,
} from '../lib/adminApi'
import { allowedPublishOptions } from '../lib/contentPublishTransitions'
import { showConfirm } from '../lib/confirm'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { publishRowAccent } from '../lib/statusTone'
import {
  CONTENT_SORT_OPTIONS,
  INITIAL_CONTENT_QUERY,
  contentDetailPath,
  isContentActionEligible,
} from './content-list/constants'
import { buildFormFromItem, toPayload } from './content-detail/constants'

export function ContentListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_CONTENT_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_CONTENT_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState(null)
  const recentContentItems = useRecentItems('recent:content')
  const state = useAdminList(['content', query, contentLang], () => fetchContent(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_CONTENT_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setSelected(new Set())
    setQuery((previous) => ({ ...previous, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const items = useMemo(() => state.items || [], [state.items])
  const pagination = state.pagination

  useEffect(() => {
    if (state.status !== 'success' || state.isFetching || !pagination) return
    const lastPage = Math.max(1, Number(pagination.totalPages) || 1)
    if (query.page <= lastPage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set())
    setQuery((previous) => ({ ...previous, page: lastPage }))
  }, [pagination, query.page, state.isFetching, state.status])

  function updateQuery(partial, options = { resetPage: false }) {
    setSelected(new Set())
    setQuery((previous) => {
      const next = { ...previous, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_CONTENT_QUERY.search)
    setSelected(new Set())
    setQuery(INITIAL_CONTENT_QUERY)
  }

  async function refreshContent(item) {
    await queryClient.invalidateQueries({ queryKey: ['content'] })
    if (item?.id) {
      await queryClient.invalidateQueries({ queryKey: ['content', item.type, item.id] })
    }
  }

  async function runSingle({
    item,
    action,
    confirmKey,
    titleKey,
    confirmLabel,
    variant,
    successKey,
  }) {
    const confirmed = await showConfirm(t(confirmKey, { title: item.title }), t(titleKey), {
      confirmLabel: t(confirmLabel),
      variant,
    })
    if (!confirmed) return
    setRowBusy(`${action}:${item.id}`)
    try {
      if (action === 'trash') await deleteContent(item.type, item.id)
      if (action === 'restore') await restoreContent(item.type, item.id)
      if (action === 'permanent') await permanentDeleteContent(item.type, item.id)
      await refreshContent(item)
      toast.success(t(successKey))
    } catch (error) {
      toast.error(error?.message || t('common.error'))
    } finally {
      setRowBusy(null)
    }
  }

  const handleSoftDelete = (item) =>
    runSingle({
      item,
      action: 'trash',
      confirmKey: 'content.deleteConfirm',
      titleKey: 'common.moveToTrashTitle',
      confirmLabel: 'common.moveToTrash',
      variant: 'default',
      successKey: 'content.deleteSuccess',
    })

  const handleRestore = (item) =>
    runSingle({
      item,
      action: 'restore',
      confirmKey: 'content.restoreConfirm',
      titleKey: 'content.restoreConfirmTitle',
      confirmLabel: 'content.restore',
      variant: 'default',
      successKey: 'content.restoreSuccess',
    })

  const handlePermanentDelete = (item) =>
    runSingle({
      item,
      action: 'permanent',
      confirmKey: 'content.permanentDeleteConfirm',
      titleKey: 'common.permanentDeleteTitle',
      confirmLabel: 'common.permanentDelete',
      variant: 'danger',
      successKey: 'content.permanentDeleteSuccess',
    })

  async function publishFullArticle(item) {
    const detail = await fetchContentDetail(item.type, item.id)
    const form = buildFormFromItem(item.type, detail.item)
    await updateContent(
      item.type,
      item.id,
      toPayload({ ...form, publishStatus: 'PUBLISHED' }, false),
    )
  }

  async function runBulk({ action, confirmKey, titleKey, confirmLabel, variant }) {
    const selectedRows = items.filter((item) => selected.has(item.id))
    const eligible = selectedRows.filter((item) => {
      if (action === 'publish') {
        return allowedPublishOptions(item.publishStatus).includes('PUBLISHED')
      }
      return isContentActionEligible(item, action)
    })
    const skipped = selected.size - eligible.length
    if (eligible.length === 0) {
      toast.warning(t('content.bulkNothingEligible', { skipped }))
      return
    }
    const confirmed = await showConfirm(t(confirmKey, { count: eligible.length }), t(titleKey), {
      confirmLabel: t(confirmLabel),
      variant,
    })
    if (!confirmed) return

    setBulkBusy(true)
    const successfulIds = []
    let failed = 0
    for (const item of eligible) {
      try {
        if (action === 'publish') await publishFullArticle(item)
        if (action === 'trash') await deleteContent(item.type, item.id)
        if (action === 'restore') await restoreContent(item.type, item.id)
        if (action === 'permanent') await permanentDeleteContent(item.type, item.id)
        successfulIds.push(item.id)
      } catch {
        failed += 1
      }
    }
    await refreshContent()
    setSelected((previous) => {
      const next = new Set(previous)
      successfulIds.forEach((id) => next.delete(id))
      return next
    })
    setBulkBusy(false)

    if (failed === 0 && skipped === 0) {
      toast.success(t('content.bulkSuccess', { count: successfulIds.length }))
    } else {
      toast.warning(
        t('content.bulkPartial', {
          ok: successfulIds.length,
          fail: failed,
          skipped,
        }),
      )
    }
  }

  const isTrashView = query.publishStatus === 'TRASH'
  const isFiltered = Boolean(query.search) || query.publishStatus !== 'ALL'
  const totalItems = pagination?.totalItems ?? items.length
  const createPath = '/admin/content/articles/new'
  const [sortField, sortDir] = (query.sort || '').split(':')
  const anyBusy = bulkBusy || Boolean(rowBusy)

  const bulkActions = canUpdate
    ? isTrashView
      ? [
          {
            label: t('content.bulkRestore'),
            disabled: anyBusy,
            onClick: () =>
              runBulk({
                action: 'restore',
                confirmKey: 'content.bulkRestoreConfirm',
                titleKey: 'content.bulkRestoreTitle',
                confirmLabel: 'content.restore',
              }),
          },
          {
            label: t('content.bulkHardDelete'),
            tone: 'danger',
            disabled: anyBusy,
            onClick: () =>
              runBulk({
                action: 'permanent',
                confirmKey: 'content.bulkHardDeleteConfirm',
                titleKey: 'common.permanentDeleteTitle',
                confirmLabel: 'common.permanentDelete',
                variant: 'danger',
              }),
          },
        ]
      : [
          {
            label: t('content.bulkPublish'),
            disabled: anyBusy,
            onClick: () =>
              runBulk({
                action: 'publish',
                confirmKey: 'content.bulkPublishConfirm',
                titleKey: 'content.bulkPublishTitle',
                confirmLabel: 'content.bulkPublishCta',
              }),
          },
          {
            label: t('content.bulkTrash'),
            tone: 'danger',
            disabled: anyBusy,
            onClick: () =>
              runBulk({
                action: 'trash',
                confirmKey: 'content.bulkTrashConfirm',
                titleKey: 'common.moveToTrashTitle',
                confirmLabel: 'common.moveToTrash',
                variant: 'default',
              }),
          },
        ]
    : []

  const filterChips = useMemo(() => {
    const chips = []
    if (query.search) {
      chips.push({
        key: 'search',
        label: `${t('common.search')}: ${query.search}`,
        onRemove: () => setSearchInput(INITIAL_CONTENT_QUERY.search),
      })
    }
    if (query.publishStatus !== 'ALL') {
      chips.push({
        key: 'publish',
        label: `${t('content.filterPublish')}: ${t(`status.publish.${query.publishStatus}`)}`,
        onRemove: () => updateQuery({ publishStatus: 'ALL' }, { resetPage: true }),
      })
    }
    return chips
  }, [query.publishStatus, query.search, t])

  function renderRowActions(item) {
    const isTrashed = item.publishStatus === 'TRASH'
    const isBusy = rowBusy?.endsWith(`:${item.id}`)
    const detailLabel = canUpdate && !isTrashed ? t('common.edit') : t('common.view')
    return (
      <div
        className="flex items-center justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="min-h-11 min-w-11"
          disabled={isBusy}
          title={detailLabel}
          aria-label={detailLabel}
          onClick={() => navigate(contentDetailPath(item))}
        >
          {canUpdate && !isTrashed ? (
            <Pencil size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </Button>
        {canUpdate && !isTrashed ? (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="min-h-11 min-w-11 text-destructive hover:text-destructive"
            loading={rowBusy === `trash:${item.id}`}
            disabled={isBusy}
            title={t('content.moveToTrash')}
            aria-label={t('content.moveToTrash')}
            onClick={() => handleSoftDelete(item)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        ) : null}
        {canUpdate && isTrashed ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11"
              loading={rowBusy === `restore:${item.id}`}
              disabled={isBusy}
              title={t('content.restore')}
              aria-label={t('content.restore')}
              onClick={() => handleRestore(item)}
            >
              <Undo2 size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11 text-destructive hover:text-destructive"
              loading={rowBusy === `permanent:${item.id}`}
              disabled={isBusy}
              title={t('common.permanentDelete')}
              aria-label={t('common.permanentDelete')}
              onClick={() => handlePermanentDelete(item)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </>
        ) : null}
      </div>
    )
  }

  const columns = [
    {
      key: 'title',
      label: t('content.colContent'),
      sortable: true,
      skeletonWidth: '80%',
      render: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="bb-product-thumb h-10 w-10 shrink-0">
            {item.coverImage?.url ? (
              <img
                src={item.coverImage.url}
                alt={item.coverImage.alt || item.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <FileText size={18} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {formatText(item.title)}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              /{formatText(item.slug)}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'publishStatus',
      label: t('content.colPublish'),
      sortable: true,
      render: (item) => <PublishStatusBadge value={item.publishStatus} />,
    },
    {
      key: 'updatedAt',
      label: t('content.colUpdated'),
      sortable: true,
      render: (item) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: renderRowActions,
    },
  ]

  function mobileCard(item) {
    return {
      title: formatText(item.title),
      selectionLabel: t('common.selectNamedRow', { name: formatText(item.title) }),
      subtitle: `/${formatText(item.slug)}`,
      status: <PublishStatusBadge value={item.publishStatus} />,
      meta: [{ label: t('content.colUpdated'), value: formatDateTime(item.updatedAt) }],
      actions: renderRowActions(item),
      onClick: () => navigate(contentDetailPath(item)),
    }
  }

  const emptyState = isTrashView
    ? {
        title: t('content.emptyTrash'),
        description: t('content.emptyTrashDesc'),
      }
    : isFiltered
      ? {
          title: t('content.empty'),
          description: t('content.emptyDesc'),
        }
      : {
          title: t('content.emptyNoData'),
          description: t('content.emptyNoDataDesc'),
        }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('content.eyebrow')}
        title={t('content.title')}
        description={t('content.description')}
        actions={
          <Button
            type="button"
            disabled={!canUpdate}
            title={!canUpdate ? t('content.requireUpdatePermission') : undefined}
            onClick={() => navigate(createPath)}
          >
            <Plus size={16} aria-hidden="true" />
            {canUpdate ? t('content.newArticle') : t('common.noPermission')}
          </Button>
        }
      />

      <RecentItemsChips
        items={recentContentItems}
        onSelect={(item) => navigate(`/admin/content/article/${item.id}`)}
      />

      {!canUpdate ? (
        <ReadOnlyBanner warning={t('content.readOnly')} />
      ) : state.warning ? (
        <ReadOnlyBanner warning={state.warning} />
      ) : null}

      <FilterBar ariaLabel={t('content.filterAria')} className="mt-4">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('content.searchPlaceholder')}
          wrapperClassName="min-w-52 flex-1"
        />
        <FilterSelect
          value={query.publishStatus}
          onValueChange={(value) => updateQuery({ publishStatus: value }, { resetPage: true })}
          ariaLabel={t('content.filterPublish')}
          options={[
            { value: 'ALL', label: t('content.filterAll') },
            { value: 'DRAFT', label: t('status.publish.DRAFT') },
            { value: 'PUBLISHED', label: t('status.publish.PUBLISHED') },
            { value: 'TRASH', label: t('status.publish.TRASH') },
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(value) => updateQuery({ sort: value }, { resetPage: true })}
          ariaLabel={t('content.filterSort')}
          options={CONTENT_SORT_OPTIONS.map(([value, key]) => ({ value, label: t(key) }))}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(pageSize) => updateQuery({ pageSize }, { resetPage: true })}
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={state.isFetching || anyBusy}
          onClick={() => state.refetch()}
        >
          <RefreshCw
            size={16}
            className={state.isFetching ? 'animate-spin' : undefined}
            aria-hidden="true"
          />
          {t('common.refresh')}
        </Button>
        {state.isFetching && state.status === 'success' ? (
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('content.refreshing')}
          </span>
        ) : null}
      </FilterBar>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? resetFilters : undefined}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.resetFilters')}
        ariaLabel={t('content.activeFilters')}
      />

      <span className="sr-only" role="status" aria-live="polite">
        {state.status === 'success' ? t('content.resultsAnnounce', { count: totalItems }) : ''}
      </span>

      {canUpdate ? (
        <BulkActionBar
          selectedCount={selected.size}
          onClear={() => setSelected(new Set())}
          actions={bulkActions}
        />
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('content.loadError')}
          description={state.error || t('common.unknownError')}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={emptyState.title}
          description={emptyState.description}
          actionLabel={
            isFiltered ? t('common.resetFilters') : canUpdate ? t('content.newArticle') : undefined
          }
          onAction={isFiltered ? resetFilters : canUpdate ? () => navigate(createPath) : undefined}
        />
      ) : null}

      {state.status === 'loading' || (state.status === 'success' && items.length > 0) ? (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={(item) => navigate(contentDetailPath(item))}
              rowHref={contentDetailPath}
              mobileCard={mobileCard}
              rowClassName={(item) => publishRowAccent(item.publishStatus)}
              sortKey={sortField}
              sortDir={sortDir}
              onSortChange={(key, direction) =>
                updateQuery({ sort: `${key}:${direction}` }, { resetPage: true })
              }
              selectable={canUpdate}
              selectedIds={[...selected]}
              onSelectionChange={(ids) => setSelected(new Set(ids))}
            />
          </div>
          {state.status === 'success' && pagination ? (
            <PaginationControls
              pagination={pagination}
              disabled={state.isFetching || anyBusy}
              onPageChange={(page) => updateQuery({ page })}
            />
          ) : null}
        </div>
      ) : null}
    </Screen>
  )
}
