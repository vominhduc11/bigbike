import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  ListFilter,
  RotateCcw,
  Search,
} from 'lucide-react'
import { AdminTable } from '../components/AdminTable'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { FilterChips } from '../components/FilterChips'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { FilterBar, MobileCardList, Screen, ScreenHeader } from '../components/layout'
import { fetchAuditLogs } from '../lib/adminApi'
import { formatDateTimeWithSeconds } from '../lib/formatters'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  ACTOR_OPTIONS,
  DANGEROUS_ACTIONS,
  INITIAL_QUERY,
  PRESET_KEYS,
  RESOURCE_OPTIONS,
  exportToCsv,
  getDatePreset,
  setDetailParam,
} from './audit-log-list/constants'
import { AuditCard } from './audit-log-list/AuditCard'
import { AuditDetailDrawer } from './audit-log-list/AuditDetailDrawer'
import { ActionLabel, ActorCell, ModuleBadge, ResourceCell } from './audit-log-list/cells'
import { MobileFilterDrawer } from './audit-log-list/MobileFilterDrawer'

export function AuditLogListScreen() {
  const { t, i18n } = useTranslation()
  const initialQuery = useMemo(() => readQueryFromUrl(INITIAL_QUERY), [])
  const initialDetailIdRef = useRef(new URLSearchParams(window.location.search).get('detail'))
  const [query, setQuery] = useState(initialQuery)
  const [searchInput, setSearchInput] = useState(() => initialQuery.q)
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    pagination: null,
    error: '',
    isFetching: true,
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [activePreset, setActivePreset] = useState(null)
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailNotice, setDetailNotice] = useState('')
  // API luôn trả mới nhất trước. Sắp xếp ở đây chỉ đổi thứ tự các dòng của
  // trang đang xem, không gửi thêm tham số lên máy chủ.
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const isFiltered = query.actorType !== 'ALL'
    || query.resourceType !== 'ALL'
    || Boolean(query.q)
    || Boolean(query.from)
    || Boolean(query.to)
  const dateRangeError = query.from && query.to && query.from > query.to
    ? t('auditLog.dateRangeError', {
      defaultValue: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    })
    : ''
  const activeFilterCount = [
    query.actorType !== 'ALL',
    query.resourceType !== 'ALL',
    Boolean(query.q),
    Boolean(query.from) || Boolean(query.to),
  ].filter(Boolean).length

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)

    if (dateRangeError) {
      return undefined
    }

    let active = true
    fetchAuditLogs(query)
      .then((response) => {
        if (!active) return
        setState({
          status: 'success',
          items: response.items,
          pagination: response.pagination,
          error: '',
          isFetching: false,
        })

        const initialDetailId = initialDetailIdRef.current
        if (initialDetailId) {
          initialDetailIdRef.current = null
          const match = response.items.find((item) => item.id === initialDetailId)
          if (match) {
            setSelectedLog(match)
          } else {
            setDetailParam(null)
            setDetailNotice(t('auditLog.deepLinkNotFound', {
              defaultValue: 'Hoạt động được liên kết không nằm trong trang kết quả hiện tại.',
            }))
          }
        }
      })
      .catch((error) => {
        if (!active) return
        setState((current) => ({
          ...current,
          status: 'error',
          error: error?.message || t('auditLog.errorLoadTitle'),
          isFetching: false,
        }))
      })

    return () => {
      active = false
    }
    // `t` is intentionally omitted: language changes already re-render the screen,
    // while a new translator function must not re-fetch the same server data.
  }, [query, dateRangeError, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    {
      key: 'createdAt',
      label: t('auditLog.colTime'),
      sortable: true,
      render: (log) => (
        <time
          className="whitespace-nowrap text-sm font-medium text-foreground"
          title={log.createdAt || undefined}
        >
          {formatDateTimeWithSeconds(log.createdAt)}
        </time>
      ),
    },
    {
      key: 'actor',
      label: t('auditLog.colActor'),
      sortable: true,
      render: (log) => <ActorCell log={log} />,
    },
    {
      key: 'action',
      label: t('auditLog.colAction'),
      render: (log) => <ActionLabel action={log.action} />,
    },
    {
      key: 'module',
      label: t('auditLog.colModule'),
      sortable: true,
      render: (log) => <ModuleBadge resourceType={log.resourceType} />,
    },
    {
      key: 'entity',
      label: t('auditLog.colEntity'),
      render: (log) => <ResourceCell log={log} />,
    },
  ], [t])

  const {
    visibleColumns,
    hiddenKeys,
    toggle: toggleColumn,
    allColumns,
  } = useColumnVisibility(columns, 'columns:audit-logs')

  const updateQuery = useCallback((partial, options = { resetPage: false }) => {
    setState((current) => current.status === 'success'
      ? { ...current, isFetching: true }
      : { ...current, status: 'loading', isFetching: true })
    setQuery((current) => {
      const next = { ...current, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }, [])

  const sortedItems = useMemo(() => {
    if (!sort.key) return state.items
    const sortValue = (log) => {
      if (sort.key === 'createdAt') return log.createdAt || ''
      if (sort.key === 'actor') {
        return (log.actorDisplayName || log.actorEmail || log.actorType || '').toLowerCase()
      }
      if (sort.key === 'module') return (log.resourceType || '').toLowerCase()
      return ''
    }
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...state.items].sort((left, right) => {
      const leftValue = sortValue(left)
      const rightValue = sortValue(right)
      if (leftValue < rightValue) return -1 * factor
      if (leftValue > rightValue) return factor
      return 0
    })
  }, [sort, state.items])

  function handleSearch(event) {
    event?.preventDefault()
    updateQuery({ q: searchInput.trim() }, { resetPage: true })
  }

  function handleReset() {
    setSearchInput('')
    setActivePreset(null)
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
    setState((current) => current.status === 'success'
      ? { ...current, isFetching: true }
      : { ...current, status: 'loading', isFetching: true })
  }

  function handlePreset(preset) {
    setActivePreset(preset)
    updateQuery(getDatePreset(preset), { resetPage: true })
  }

  function handleOpenDetail(log) {
    setDetailNotice('')
    setSelectedLog(log)
    setDetailParam(log.id)
  }

  function handleCloseDetail() {
    setSelectedLog(null)
    setDetailParam(null)
  }

  function handleRetry() {
    setState((current) => ({
      ...current,
      status: current.items.length > 0 ? 'success' : 'loading',
      error: '',
      isFetching: true,
    }))
    setReloadKey((current) => current + 1)
  }

  function handleExport() {
    if (sortedItems.length > 0) exportToCsv(sortedItems, t)
  }

  function handleMobileApply(filters) {
    setSearchInput(filters.q)
    setActivePreset(null)
    updateQuery(filters, { resetPage: true })
  }

  const filterChips = []
  if (query.resourceType !== 'ALL') {
    const value = t(`auditLog.module.${query.resourceType}`, {
      defaultValue: query.resourceType,
    })
    filterChips.push({
      key: 'module',
      label: t('auditLog.chipModule', {
        value,
        defaultValue: `Khu vực: ${value}`,
      }),
      onRemove: () => updateQuery({ resourceType: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.actorType !== 'ALL') {
    const value = t(`auditLog.actorType.${query.actorType}`, {
      defaultValue: query.actorType,
    })
    filterChips.push({
      key: 'actorType',
      label: t('auditLog.chipActorType', {
        value,
        defaultValue: `Người thực hiện: ${value}`,
      }),
      onRemove: () => updateQuery({ actorType: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.q) {
    filterChips.push({
      key: 'q',
      label: t('auditLog.chipSearch', {
        term: query.q,
        defaultValue: `Tìm: "${query.q}"`,
      }),
      onRemove: () => {
        setSearchInput('')
        updateQuery({ q: '' }, { resetPage: true })
      },
    })
  }
  if (query.from || query.to) {
    const range = query.from && query.to
      ? `${query.from} – ${query.to}`
      : (query.from || query.to)
    filterChips.push({
      key: 'dateRange',
      label: t('auditLog.chipDateRange', {
        range,
        defaultValue: `Thời gian: ${range}`,
      }),
      onRemove: () => {
        setActivePreset(null)
        updateQuery({ from: '', to: '' }, { resetPage: true })
      },
    })
  }

  const totalItems = state.pagination?.totalItems
  const showData = !dateRangeError
    && (state.status === 'loading' || (state.status === 'success' && state.items.length > 0))

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('auditLog.eyebrow')}
        title={t('auditLog.title')}
        description={t('auditLog.description')}
        actions={(
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={handleExport}
            disabled={state.items.length === 0}
            title={state.items.length > 0
              ? t('auditLog.exportTooltipPage', {
                count: state.items.length,
                defaultValue: 'Xuất {{count}} dòng đang hiển thị (chỉ trang này)',
              })
              : t('auditLog.exportTooltipEmpty')}
          >
            <Download size={16} aria-hidden="true" />
            {t('auditLog.exportBtn')}
          </Button>
        )}
      />

      <FilterBar
        className="mb-3 hidden lg:flex"
        ariaLabel={t('auditLog.filterBarLabel', { defaultValue: 'Bộ lọc nhật ký hoạt động' })}
      >
        <form className="flex min-w-64 flex-1 gap-2" onSubmit={handleSearch}>
          <FilterSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('auditLog.filterSearchPlaceholder')}
            ariaLabel={t('auditLog.filterSearch')}
            className="min-h-11"
            wrapperClassName="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" className="min-h-11">
            <Search size={16} aria-hidden="true" />
            {t('auditLog.filterQuickSearch')}
          </Button>
        </form>

        <FilterSelect
          value={query.resourceType}
          onValueChange={(value) => updateQuery({ resourceType: value }, { resetPage: true })}
          ariaLabel={t('auditLog.filterModule')}
          className="min-h-11"
          options={RESOURCE_OPTIONS.map((resourceType) => ({
            value: resourceType,
            label: resourceType === 'ALL'
              ? t('auditLog.filterModule')
              : t(`auditLog.module.${resourceType}`, { defaultValue: resourceType }),
          }))}
        />

        <FilterSelect
          value={query.actorType}
          onValueChange={(value) => updateQuery({ actorType: value }, { resetPage: true })}
          ariaLabel={t('auditLog.filterActorType')}
          className="min-h-11"
          options={ACTOR_OPTIONS.map((actorType) => ({
            value: actorType,
            label: actorType === 'ALL'
              ? t('auditLog.filterActorType')
              : t(`auditLog.actorType.${actorType}`, { defaultValue: actorType }),
          }))}
        />

        <PageSizeSelect
          value={query.pageSize}
          onChange={(pageSize) => updateQuery({ pageSize }, { resetPage: true })}
          className="min-h-11"
        />
        <ColumnVisibilityToggle
          allColumns={allColumns}
          hiddenKeys={hiddenKeys}
          onToggle={toggleColumn}
        />

        <div className="flex basis-full flex-wrap items-end gap-3 border-t border-border pt-3">
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-semibold text-foreground">
              {t('auditLog.filterQuickTime')}
            </legend>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface-muted p-1">
              {PRESET_KEYS.map((key) => (
                <Button
                  key={key}
                  variant={activePreset === key ? 'default' : 'ghost'}
                  size="sm"
                  className="min-h-9"
                  onClick={() => handlePreset(key)}
                >
                  {t(`auditLog.preset.${key}`)}
                </Button>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            <span>{t('auditLog.filterFrom')}</span>
            <Input
              type="date"
              value={query.from}
              aria-invalid={dateRangeError ? true : undefined}
              onChange={(event) => {
                setActivePreset(null)
                updateQuery({ from: event.target.value }, { resetPage: true })
              }}
              className="min-h-11"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            <span>{t('auditLog.filterTo')}</span>
            <Input
              type="date"
              value={query.to}
              aria-invalid={dateRangeError ? true : undefined}
              onChange={(event) => {
                setActivePreset(null)
                updateQuery({ to: event.target.value }, { resetPage: true })
              }}
              className="min-h-11"
            />
          </label>

          {isFiltered ? (
            <Button variant="outline" className="min-h-11" onClick={handleReset}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('auditLog.resetFilters')}
            </Button>
          ) : null}

          <span
            className={cn(
              'min-h-5 self-center text-sm text-muted-foreground',
              (!state.isFetching || dateRangeError) && 'invisible',
            )}
            role="status"
            aria-live="polite"
          >
            {t('auditLog.refreshing', { defaultValue: 'Đang cập nhật…' })}
          </span>
        </div>
      </FilterBar>

      <div className="mb-3 flex flex-wrap items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => setShowMobileFilter(true)}
        >
          <ListFilter size={16} aria-hidden="true" />
          {t('auditLog.mobileFilterLabel')}
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
        {isFiltered ? (
          <Button variant="ghost" className="min-h-11" onClick={handleReset}>
            <RotateCcw size={16} aria-hidden="true" />
            {t('auditLog.resetFilters')}
          </Button>
        ) : null}
        <span
          className={cn(
            'min-h-5 text-sm text-muted-foreground',
            (!state.isFetching || dateRangeError) && 'invisible',
          )}
          role="status"
          aria-live="polite"
        >
          {t('auditLog.refreshing', { defaultValue: 'Đang cập nhật…' })}
        </span>
      </div>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? handleReset : undefined}
        clearAllLabel={t('auditLog.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('auditLog.activeFiltersLabel', {
          defaultValue: 'Bộ lọc đang áp dụng',
        })}
      />

      {dateRangeError ? (
        <Alert tone="danger" size="sm" className="mb-3">
          {dateRangeError}
        </Alert>
      ) : null}

      {detailNotice ? (
        <Alert
          tone="info"
          size="sm"
          className="mb-3"
          dismissible
          onDismiss={() => setDetailNotice('')}
        >
          {detailNotice}
        </Alert>
      ) : null}

      {state.status === 'success' && totalItems != null && totalItems > 0 ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 text-sm text-muted-foreground">
          <p>
            {t('auditLog.summaryFound', {
              count: totalItems.toLocaleString(i18n.language),
            })}
            {isFiltered ? ` ${t('auditLog.summaryFiltered')}` : ''}
          </p>
          {totalItems > query.pageSize ? (
            <p className="text-xs">
              {t('auditLog.pageScopeNote', {
                defaultValue: 'Sắp xếp và xuất dữ liệu chỉ áp dụng cho các dòng trong trang đang xem.',
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('auditLog.errorLoadTitle')}
          description={state.error}
          actionLabel={t('auditLog.errorRetry')}
          onAction={handleRetry}
        />
      ) : null}

      {state.status === 'success' && state.items.length === 0 && !dateRangeError ? (
        <StatePanel
          tone="neutral"
          title={isFiltered ? t('auditLog.emptyFiltered') : t('auditLog.empty')}
          description={isFiltered ? t('auditLog.emptyFilteredDesc') : t('auditLog.emptyDesc')}
          actionLabel={isFiltered ? t('auditLog.resetFilters') : undefined}
          onAction={isFiltered ? handleReset : undefined}
        />
      ) : null}

      {showData ? (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="hide-on-mobile">
              <AdminTable
                caption={t('auditLog.tableCaption')}
                columns={visibleColumns}
                rows={sortedItems}
                loading={state.status === 'loading'}
                pageSize={query.pageSize}
                onRowClick={handleOpenDetail}
                sortKey={sort.key}
                sortDir={sort.dir}
                onSortChange={(key, dir) => setSort({ key, dir })}
                rowClassName={(log) => DANGEROUS_ACTIONS.has(log.action)
                  ? 'bb-row-accent--danger'
                  : ''}
              />
            </div>

            <MobileCardList>
              {state.status === 'loading'
                ? Array.from({ length: 4 }, (_, index) => (
                    <li key={index} className="mobile-card animate-pulse" aria-hidden="true">
                      <div className="h-4 w-1/2 rounded-xs bg-surface-muted" />
                      <div className="mt-2 h-3 w-3/4 rounded-xs bg-surface-muted" />
                    </li>
                  ))
                : sortedItems.map((log) => (
                    <AuditCard
                      key={log.id}
                      log={log}
                      onClick={() => handleOpenDetail(log)}
                    />
                  ))}
            </MobileCardList>
          </div>

          {state.status === 'success' ? (
            <PaginationControls
              pagination={state.pagination}
              disabled={state.isFetching}
              onPageChange={(page) => updateQuery({ page })}
            />
          ) : null}
        </div>
      ) : null}

      {selectedLog ? (
        <AuditDetailDrawer log={selectedLog} onClose={handleCloseDetail} />
      ) : null}

      {showMobileFilter ? (
        <MobileFilterDrawer
          query={query}
          searchInput={searchInput}
          activeFilterCount={activeFilterCount}
          onApply={handleMobileApply}
          onReset={handleReset}
          onClose={() => setShowMobileFilter(false)}
          isFiltered={isFiltered}
        />
      ) : null}
    </Screen>
  )
}
