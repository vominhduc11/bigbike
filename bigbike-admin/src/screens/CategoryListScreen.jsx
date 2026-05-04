import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchCategories, updateCategory } from '../lib/adminApi'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'sortOrder:asc',
  page: 1,
  pageSize: 20,
}

const ALL_CATS_KEY = { page: 1, pageSize: 100, sort: 'sortOrder:asc' }

// Build map: id → full breadcrumb path (e.g. "Mũ Bảo Hiểm / Mũ Fullface")
function buildBreadcrumbMap(items) {
  const byId = new Map(items.map((c) => [c.id, c]))
  const cache = new Map()
  const getPath = (id) => {
    if (cache.has(id)) return cache.get(id)
    const cat = byId.get(id)
    if (!cat) return ''
    const path = cat.parentId
      ? `${getPath(cat.parentId)} / ${cat.name}`
      : cat.name
    cache.set(id, path)
    return path
  }
  const map = new Map()
  items.forEach((c) => map.set(c.id, getPath(c.id)))
  return map
}

// Build tree from flat list for tree-view rendering
function buildTree(items) {
  const byId = new Map(items.map((c) => [c.id, { ...c, children: [] }]))
  const roots = []
  for (const c of byId.values()) {
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId).children.push(c)
    } else {
      roots.push(c)
    }
  }
  const sort = (arr) =>
    arr.sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder
      if (a.sortOrder != null) return -1
      if (b.sortOrder != null) return 1
      return a.name.localeCompare(b.name)
    })
  const flatten = (nodes, depth) => {
    const result = []
    sort(nodes).forEach((node) => {
      result.push({ ...node, _depth: depth })
      result.push(...flatten(node.children, depth + 1))
    })
    return result
  }
  return flatten(roots, 0)
}

const isDefaultQuery = (q) =>
  !q.search && q.visibility === 'ALL' && q.sort === 'sortOrder:asc'

export function CategoryListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [togglingId, setTogglingId] = useState(null)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const paginatedState = useAdminList(['categories', query], () => fetchCategories(query))

  const { data: allCatsResult } = useQuery({
    queryKey: ['categories', ALL_CATS_KEY],
    queryFn: () => fetchCategories(ALL_CATS_KEY),
  })

  const allItems = allCatsResult?.items ?? []

  const breadcrumbMap = useMemo(() => buildBreadcrumbMap(allItems), [allItems])

  const treeRows = useMemo(() => {
    if (!isDefaultQuery(query)) return []
    return buildTree(allItems)
  }, [query, allItems])

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, visible }) => updateCategory(id, { visible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t('categories.toggleSuccess'))
      setTogglingId(null)
    },
    onError: (err) => {
      toast.error(err.message || t('common.error'))
      setTogglingId(null)
    },
  })

  function handleToggleVisibility(category) {
    if (!canUpdate || togglingId) return
    setTogglingId(category.id)
    toggleVisibilityMutation.mutate({ id: category.id, visible: !category.isVisible })
  }

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((previous) => {
      const next = { ...previous, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpandedIds(new Set(allItems.filter((c) => c.parentId == null).map((c) => c.id)))
  }
  function collapseAll() {
    setExpandedIds(new Set())
  }

  const useTreeMode = isDefaultQuery(query) && treeRows.length > 0

  // In tree mode, filter based on expanded state
  const visibleTreeRows = useMemo(() => {
    if (!useTreeMode) return []
    const result = []
    for (const row of treeRows) {
      if (row._depth === 0) {
        result.push(row)
      } else {
        // show only if every ancestor is expanded
        // Check parent expanded
        let show = true
        let cur = row
        while (cur.parentId) {
          if (!expandedIds.has(cur.parentId)) { show = false; break }
          cur = allItems.find((c) => c.id === cur.parentId) || {}
          if (!cur.parentId) break
        }
        if (show) result.push(row)
      }
    }
    return result
  }, [useTreeMode, treeRows, expandedIds, allItems])

  // ── Flat mode renders ────────────────────────────────────────────
  const flatModeStatus = paginatedState.status
  const flatItems = paginatedState.items

  const renderCategoryRow = (category, depth = 0) => {
    const hasChildren = useTreeMode && treeRows.some((r) => r.parentId === category.id && r._depth > 0)
    const isExpanded = expandedIds.has(category.id)
    const breadcrumb = breadcrumbMap.get(category.id) || category.name
    const isRestoreMode = query.visibility === 'HIDDEN'

    return (
      <tr key={category.id} className={`cat-row depth-${depth}${category.isVisible ? '' : ' cat-row--hidden'}`}>
        {/* Name cell with tree indent */}
        <td>
          <div className="cat-name-cell" style={{ paddingLeft: depth * 20 }}>
            {useTreeMode && hasChildren ? (
              <button
                type="button"
                className="cat-expand-btn"
                onClick={() => toggleExpand(category.id)}
                aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="cat-expand-spacer" />
            )}
            <div className="thumbnail-wrap thumbnail-wrap--sm">
              {category.image?.url ? (
                <img src={category.image.url} alt={category.image.alt || category.name} referrerPolicy="no-referrer" loading="lazy" />
              ) : (
                <span>IMG</span>
              )}
            </div>
            <div>
              <strong>{formatText(category.name)}</strong>
              <p className="cat-slug">{category.slug}</p>
              {!useTreeMode && category.parentId && (
                <p className="cat-breadcrumb">{breadcrumb}</p>
              )}
            </div>
          </div>
        </td>

        {/* Description */}
        <td className="cat-desc">{stripHtml(category.description)?.slice(0, 80) || '—'}</td>

        {/* Visibility badge */}
        <td>
          <span className={category.isVisible ? 'status-badge status-success' : 'status-badge status-neutral'}>
            {category.isVisible ? t('categories.visibleLabel') : t('categories.hiddenLabel')}
          </span>
        </td>

        {/* Updated */}
        <td>{formatDateTime(category.updatedAt)}</td>

        {/* Actions */}
        <td className="align-right">
          <div className="cat-actions">
            {canUpdate && (
              <button
                type="button"
                className={`btn btn-sm ${category.isVisible ? 'btn-ghost-danger' : 'btn-ghost-success'}`}
                disabled={togglingId === category.id}
                onClick={() => handleToggleVisibility(category)}
                title={category.isVisible ? t('categories.hideAction') : t('categories.restoreAction')}
              >
                {togglingId === category.id
                  ? '…'
                  : category.isVisible
                    ? t('categories.hideAction')
                    : t('categories.restoreAction')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/admin/categories/${category.id}`)}
            >
              {isRestoreMode ? t('categories.restoreAction') : t('common.edit')}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('categories.eyebrow')}</p>
          <h1>{t('categories.title')}</h1>
          <p>{t('categories.description')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/admin/categories/new')}
          disabled={!canUpdate}
        >
          {canUpdate ? t('categories.create') : t('common.noPermission')}
        </button>
      </header>

      {paginatedState.warning ? <ReadOnlyBanner warning={paginatedState.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input
            className="control-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('categories.searchPlaceholder')}
          />
        </label>
        <label>
          {t('categories.filterVisibility')}
          <select
            className="control-select"
            value={query.visibility}
            onChange={(event) =>
              updateQuery({ visibility: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">{t('common.all')}</option>
            <option value="VISIBLE">{t('common.visible')}</option>
            <option value="HIDDEN">{t('common.hidden')}</option>
          </select>
        </label>
        <label>
          {t('categories.filterSort')}
          <select
            className="control-select"
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value }, { resetPage: true })
            }
          >
            <option value="sortOrder:asc">{t('sort.sortOrder')}</option>
            <option value="updatedAt:desc">{t('sort.newestUpdated')}</option>
            <option value="updatedAt:asc">{t('sort.oldestUpdated')}</option>
            <option value="name:asc">{t('sort.nameAZ')}</option>
          </select>
        </label>
        {useTreeMode && (
          <div className="filter-bar-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={expandAll}>
              {t('categories.expandAll')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={collapseAll}>
              {t('categories.collapseAll')}
            </button>
          </div>
        )}
      </section>

      {/* ── Tree mode ── */}
      {useTreeMode && (
        <div className="cat-tree-wrap">
          {allCatsResult == null ? (
            <StatePanel tone="info" title={t('common.loading')} description="" />
          ) : visibleTreeRows.length === 0 ? (
            <StatePanel
              tone="neutral"
              title={t('categories.empty')}
              description={t('categories.emptyDesc')}
              actionLabel={t('common.resetFilters')}
              onAction={resetFilters}
            />
          ) : (
            <div className="table-scroll-wrap">
              <table className="admin-table cat-tree-table">
                <caption className="sr-only">{t('categories.tableCaption')}</caption>
                <thead>
                  <tr>
                    <th>{t('categories.colCategory')}</th>
                    <th>{t('categories.colDescription')}</th>
                    <th>{t('categories.colVisibility')}</th>
                    <th>{t('categories.colUpdated')}</th>
                    <th className="align-right">{t('categories.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTreeRows.map((row) => renderCategoryRow(row, row._depth))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Flat / filtered mode ── */}
      {!useTreeMode && (
        <>
          {flatModeStatus === 'error' ? (
            <StatePanel
              tone="danger"
              title={t('categories.loadError')}
              description={paginatedState.error || 'Unknown category list error.'}
              actionLabel={t('common.retry')}
              onAction={() => paginatedState.refetch()}
            />
          ) : null}

          {flatModeStatus === 'success' && flatItems.length === 0 ? (
            <StatePanel
              tone="neutral"
              title={t('categories.empty')}
              description={t('categories.emptyDesc')}
              actionLabel={t('common.resetFilters')}
              onAction={resetFilters}
            />
          ) : null}

          {flatModeStatus === 'loading' || (flatModeStatus === 'success' && flatItems.length > 0) ? (
            <>
              <div className="table-scroll-wrap">
                <table className="admin-table cat-tree-table">
                  <caption className="sr-only">{t('categories.tableCaption')}</caption>
                  <thead>
                    <tr>
                      <th>{t('categories.colCategory')}</th>
                      <th>{t('categories.colDescription')}</th>
                      <th>{t('categories.colVisibility')}</th>
                      <th className="align-right">{t('categories.colSortOrder')}</th>
                      <th>{t('categories.colUpdated')}</th>
                      <th className="align-right">{t('categories.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatModeStatus === 'loading'
                      ? Array.from({ length: query.pageSize }).map((_, i) => (
                          <tr key={i} className="skel-row">
                            {Array.from({ length: 6 }).map((__, j) => (
                              <td key={j}><span className="bb-skel" style={{ width: '80%', height: 18 }} /></td>
                            ))}
                          </tr>
                        ))
                      : flatItems.map((cat) => renderCategoryRow(cat, 0))}
                  </tbody>
                </table>
              </div>
              {flatModeStatus === 'success' && (
                <PaginationControls
                  pagination={paginatedState.pagination}
                  onPageChange={(nextPage) => updateQuery({ page: nextPage })}
                />
              )}
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
