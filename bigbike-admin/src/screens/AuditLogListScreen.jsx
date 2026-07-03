import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { AdminTable } from '../components/AdminTable'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAuditLogs } from '../lib/adminApi'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { formatDateTimeWithSeconds } from '../lib/formatters'
import { FilterChips } from '../components/FilterChips'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { ActionLabel, ActorCell, ModuleBadge, ResourceCell } from './audit-log-list/cells'
import { AuditDetailDrawer } from './audit-log-list/AuditDetailDrawer'
import { AuditCard } from './audit-log-list/AuditCard'
import { MobileFilterDrawer } from './audit-log-list/MobileFilterDrawer'

// ── Main screen ────────────────────────────────────────────────────────────────

export function AuditLogListScreen() {
  const { t } = useTranslation()
  const initialQuery = useMemo(() => readQueryFromUrl(INITIAL_QUERY), [])
  const [query, setQuery]             = useState(initialQuery)
  const [searchInput, setSearchInput] = useState(() => initialQuery.q)
  const [state, setState]             = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [activePreset, setActivePreset] = useState(null)
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  // Client-side sort of the current page. The audit-log endpoint returns a fixed
  // server order and accepts no sort param, so we re-order the loaded rows only.
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  // deep-link: read detail id from URL once on mount (does not trigger fetch)
  const [initialDetailId] = useState(
    () => new URLSearchParams(window.location.search).get('detail')
  )
  const [selectedLog, setSelectedLog] = useState(null)

  const isFiltered = query.actorType !== 'ALL' || query.resourceType !== 'ALL' || !!query.q || !!query.from || !!query.to
  const activeFilterCount = [
    query.actorType    !== 'ALL',
    query.resourceType !== 'ALL',
    !!query.q,
    !!query.from || !!query.to,
  ].filter(Boolean).length

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    let active = true
    fetchAuditLogs(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: '' })
        // Restore detail drawer from URL deep-link on initial load
        if (initialDetailId) {
          const match = r.items.find((item) => item.id === initialDetailId)
          if (match) setSelectedLog(match)
        }
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
    // initialDetailId is a one-time deep-link seed; re-running on its change would reopen the drawer.
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    {
      key: 'createdAt',
      label: t('auditLog.colTime'),
      sortable: true,
      render: (r) => <time className="audit-col-time" title={r.createdAt}>{formatDateTimeWithSeconds(r.createdAt)}</time>,
    },
    {
      key: 'actor',
      label: t('auditLog.colActor'),
      sortable: true,
      render: (r) => <ActorCell log={r} />,
    },
    {
      key: 'action',
      label: t('auditLog.colAction'),
      render: (r) => <ActionLabel action={r.action} />,
    },
    {
      key: 'module',
      label: t('auditLog.colModule'),
      sortable: true,
      render: (r) => <ModuleBadge resourceType={r.resourceType} />,
    },
    {
      key: 'entity',
      label: t('auditLog.colEntity'),
      render: (r) => <ResourceCell log={r} />,
    },
  ], [t])

  // T7: cho phép ẩn/hiện cột trên bảng nhật ký, lưu lựa chọn theo trình duyệt.
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:audit-logs')

  const updateQuery = useCallback((partial, options = { resetPage: false }) => {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }, [])

  const handleSortChange = useCallback((key, dir) => {
    setSort({ key, dir })
  }, [])

  // Sort the current page client-side (the endpoint returns a fixed server order).
  const sortedItems = useMemo(() => {
    if (!sort.key) return state.items
    const sortValue = (log) => {
      if (sort.key === 'createdAt') return log.createdAt || ''
      if (sort.key === 'actor') return (log.actorDisplayName || log.actorEmail || log.actorType || '').toLowerCase()
      if (sort.key === 'module') return (log.resourceType || '').toLowerCase()
      return ''
    }
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...state.items].sort((a, b) => {
      const av = sortValue(a)
      const bv = sortValue(b)
      if (av < bv) return -1 * factor
      if (av > bv) return 1 * factor
      return 0
    })
  }, [state.items, sort])

  function handleSearch() {
    setState((p) => ({ ...p, status: 'loading' }))
    updateQuery({ q: searchInput }, { resetPage: true })
  }

  function handleReset() {
    setSearchInput('')
    setActivePreset(null)
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery({ ...INITIAL_QUERY })
  }

  function handlePreset(preset) {
    setActivePreset(preset)
    const { from, to } = getDatePreset(preset)
    updateQuery({ from, to }, { resetPage: true })
  }

  function handleRowClick(log) {
    setSelectedLog(log)
    setDetailParam(log.id)
  }

  function handleCloseDrawer() {
    setSelectedLog(null)
    setDetailParam(null)
  }

  function handleExport() {
    if (state.items.length === 0) return
    exportToCsv(state.items, t)
  }

  const totalItems = state.pagination?.totalItems

  // ── Active-filter chips (desktop) — one dismissible chip per non-default filter ──
  const filterChips = []
  if (query.resourceType !== 'ALL') {
    filterChips.push({
      key: 'module',
      label: t('auditLog.chipModule', {
        value: t(`auditLog.module.${query.resourceType}`, { defaultValue: query.resourceType }),
        defaultValue: `Mục: ${t(`auditLog.module.${query.resourceType}`, { defaultValue: query.resourceType })}`,
      }),
      removeLabel: t('auditLog.resetFilters'),
      onRemove: () => updateQuery({ resourceType: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.actorType !== 'ALL') {
    filterChips.push({
      key: 'actorType',
      label: t('auditLog.chipActorType', {
        value: t(`auditLog.actorType.${query.actorType}`, { defaultValue: query.actorType }),
        defaultValue: `Người thực hiện: ${t(`auditLog.actorType.${query.actorType}`, { defaultValue: query.actorType })}`,
      }),
      removeLabel: t('auditLog.resetFilters'),
      onRemove: () => updateQuery({ actorType: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.q) {
    filterChips.push({
      key: 'q',
      label: t('auditLog.chipSearch', { term: query.q, defaultValue: `Tìm: "${query.q}"` }),
      removeLabel: t('auditLog.resetFilters'),
      onRemove: () => { setSearchInput(''); updateQuery({ q: '' }, { resetPage: true }) },
    })
  }
  if (query.from || query.to) {
    const rangeLabel = query.from && query.to
      ? `${query.from} – ${query.to}`
      : (query.from || query.to)
    filterChips.push({
      key: 'dateRange',
      label: t('auditLog.chipDateRange', { range: rangeLabel, defaultValue: `Thời gian: ${rangeLabel}` }),
      removeLabel: t('auditLog.resetFilters'),
      onRemove: () => { setActivePreset(null); updateQuery({ from: '', to: '' }, { resetPage: true }) },
    })
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('auditLog.eyebrow')}</p>
          <h1>{t('auditLog.title')}</h1>
          <p className="bb-muted">{t('auditLog.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={handleExport}
            disabled={state.items.length === 0}
            title={
              state.items.length > 0
                ? t('auditLog.exportTooltip', { count: state.items.length })
                : t('auditLog.exportTooltipEmpty')
            }
          >
            <Download size={14} />{t('auditLog.exportBtn')}
          </button>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {/* ── Desktop filter bar — 2-row layout (#3) ── */}
      <section className="bb-filter-bar audit-filter-bar">
        {/* Row 1: search + module + actor + page size */}
        <div className="audit-filter-row">
          <label className="audit-filter-search-group">
            <span>{t('auditLog.filterSearch')}</span>
            <div className="flex gap-1.5">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('auditLog.filterSearchPlaceholder')}
                className="min-w-56"
               />
              <Button variant="outline" onClick={handleSearch}>
                {t('auditLog.filterQuickSearch')}
              </Button>
            </div>
          </label>

          <label>
            <span>{t('auditLog.filterModule')}</span>
            <Select
              value={query.resourceType}
              onValueChange={(val) => updateQuery({ resourceType: val }, { resetPage: true })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <SelectItem key={r} value={r}>{t(`auditLog.module.${r}`, { defaultValue: r })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          <label>
            <span>{t('auditLog.filterActorType')}</span>
            <Select
              value={query.actorType}
              onValueChange={(val) => updateQuery({ actorType: val }, { resetPage: true })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <SelectItem key={a} value={a}>{t(`auditLog.actorType.${a}`, { defaultValue: a })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          {/* #11: Page size switcher */}
          <label>
            <span>{t('auditLog.pageSizeLabel')}</span>
            <Select
              value={query.pageSize}
              onValueChange={(val) => updateQuery({ pageSize: Number(val), page: 1 })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {[20, 50, 100].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent></Select>
          </label>

          {/* T7: ẩn/hiện cột trên bảng nhật ký */}
          <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        </div>

        {/* Row 2: date presets + date pickers + clear */}
        <div className="audit-filter-row audit-filter-row--dates">
          <div>
            <span className="block text-sm font-medium mb-1.5">
              {t('auditLog.filterQuickTime')}
            </span>
            <div className="audit-preset-chips">
              {PRESET_KEYS.map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={activePreset === key ? 'audit-preset-active' : undefined}
                  onClick={() => handlePreset(key)}
                >
                  {t(`auditLog.preset.${key}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <label>
              <span>{t('auditLog.filterFrom')}</span>
              <Input
                type="date"
                value={query.from}
                onChange={(e) => { setActivePreset(null); updateQuery({ from: e.target.value }, { resetPage: true }) }}
               />
            </label>
            <label>
              <span>{t('auditLog.filterTo')}</span>
              <Input
                type="date"
                value={query.to}
                onChange={(e) => { setActivePreset(null); updateQuery({ to: e.target.value }, { resetPage: true }) }}
               />
            </label>
            {isFiltered && (
              <Button variant="outline" onClick={handleReset} className="self-end">
                {t('auditLog.resetFilters')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Mobile filter toggle — #10: hidden at ≤900px via CSS ── */}
      <div className="audit-mobile-filter-toggle">
        <Button variant="outline" onClick={() => setShowMobileFilter(true)}>
          {t('auditLog.mobileFilterLabel')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
        {query.q && (
          <span className="audit-mobile-search-chip">
            "{query.q}"
            <button type="button" onClick={() => { setSearchInput(''); updateQuery({ q: '' }, { resetPage: true }) }} aria-label={t('auditLog.resetFilters')}>✕</button>
          </span>
        )}
        {isFiltered && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            {t('auditLog.resetFilters')}
          </Button>
        )}
      </div>

      {/* ── Active-filter chips (desktop only; mobile uses its own toggle row) ── */}
      {filterChips.length > 0 && (
        <div className="hide-on-mobile">
          <FilterChips
            chips={filterChips}
            onClearAll={filterChips.length > 1 ? handleReset : undefined}
            clearAllLabel={t('auditLog.resetFilters')}
            ariaLabel={t('auditLog.activeFiltersLabel', { defaultValue: 'Bộ lọc đang áp dụng' })}
          />
        </div>
      )}

      {/* ── Results summary bar ── */}
      {state.status === 'success' && totalItems != null && totalItems > 0 && (
        <div className="audit-summary-bar">
          <span>
            {t('auditLog.summaryFound', { count: totalItems.toLocaleString('vi-VN') })}
            {isFiltered && ` ${t('auditLog.summaryFiltered')}`}
          </span>
        </div>
      )}

      {/* ── Error state ── */}
      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('auditLog.errorLoadTitle')}
          description={state.error}
          actionLabel={t('auditLog.errorRetry')}
          onAction={() => setQuery((p) => ({ ...p }))}
        />
      )}

      {/* ── Empty state ── */}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={isFiltered ? t('auditLog.emptyFiltered') : t('auditLog.empty')}
          description={isFiltered ? t('auditLog.emptyFilteredDesc') : t('auditLog.emptyDesc')}
          {...(isFiltered ? { actionLabel: t('auditLog.resetFilters'), onAction: handleReset } : {})}
        />
      )}

      {/* ── Data ── */}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <div className="audit-table-wrapper">
            <AdminTable
              caption={t('auditLog.tableCaption')}
              columns={visibleColumns}
              rows={sortedItems}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={handleRowClick}
              sortKey={sort.key}
              sortDir={sort.dir}
              onSortChange={handleSortChange}
              rowClassName={(r) => `audit-table-row${DANGEROUS_ACTIONS.has(r.action) ? ' audit-row-danger' : ''}`}
            />
          </div>

          <div className="audit-card-list" aria-label={t('auditLog.tableCaption')} role="list">
            {state.status === 'loading'
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="audit-card audit-card--skeleton" aria-hidden="true" role="listitem">
                    <div className="skeleton-cell w-3/5 h-3.5 mb-2 rounded" />
                    <div className="skeleton-cell w-2/5 h-3 rounded" />
                  </div>
                ))
              : sortedItems.map((log) => (
                  <div key={log.id} role="listitem">
                    <AuditCard log={log} onClick={() => handleRowClick(log)} />
                  </div>
                ))
            }
          </div>

          {state.status === 'success' && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </>
      )}

      {selectedLog && (
        <AuditDetailDrawer log={selectedLog} onClose={handleCloseDrawer} />
      )}

      {showMobileFilter && (
        <MobileFilterDrawer
          query={query}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={handleSearch}
          onUpdate={updateQuery}
          onReset={handleReset}
          onClose={() => setShowMobileFilter(false)}
          isFiltered={isFiltered}
        />
      )}
    </div>
  )
}
