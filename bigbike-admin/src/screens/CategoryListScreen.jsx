import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, ExternalLink, FolderTree, ImageOff, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchCategories, fetchCategoryTree, updateCategory } from '../lib/adminApi'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/danh-muc-san-pham`

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'sortOrder:asc',
  page: 1,
  pageSize: 20,
}

const EMPTY_ITEMS = []

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

// Wrap matched substring(s) in <mark> for live search highlighting.
function highlightMatch(text, term) {
  if (!term) return text
  const lower = String(text).toLowerCase()
  const lowerTerm = term.toLowerCase()
  const i = lower.indexOf(lowerTerm)
  if (i === -1) return text
  const before = text.slice(0, i)
  const match = text.slice(i, i + term.length)
  const after = text.slice(i + term.length)
  return (
    <>
      {before}
      <mark className="cat-match-highlight">{match}</mark>
      {highlightMatch(after, term)}
    </>
  )
}

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
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkProgress, setBulkProgress] = useState(null) // {done,total} or null
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const paginatedState = useAdminList(['categories', query], () => fetchCategories(query))

  const { data: allCatsResult } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => fetchCategoryTree(),
  })

  const allItems = useMemo(() => allCatsResult?.items ?? EMPTY_ITEMS, [allCatsResult?.items])

  const breadcrumbMap = useMemo(() => buildBreadcrumbMap(allItems), [allItems])

  // DnD optimistic-order state. Declared early so memos that build the
  // tree can apply the override without a temporal-dead-zone forward
  // reference. The actual drag handlers come later.
  const [dragSavingId, setDragSavingId] = useState(null)
  const [orderOverride, setOrderOverride] = useState(null)

  const orderedAllItems = useMemo(() => {
    if (!orderOverride) return allItems
    return allItems.map((c) => orderOverride.has(c.id)
      ? { ...c, sortOrder: orderOverride.get(c.id) }
      : c)
  }, [allItems, orderOverride])

  // Tree mode runs whenever no visibility/sort filter is set — even with
  // search active, because we now keep the tree structure and just dim
  // non-matching rows. Only an explicit visibility/sort filter falls back
  // to flat-paginated mode.
  const isTreeShape = !query.visibility || query.visibility === 'ALL'
    && (query.sort === 'sortOrder:asc' || !query.sort)

  const treeRows = useMemo(() => {
    if (!isTreeShape) return []
    return buildTree(orderedAllItems)
  }, [isTreeShape, orderedAllItems])

  // Compute matching ids (and ancestors) when search is active so the tree
  // can highlight matches and auto-expand paths to them.
  const searchTerm = (query.search || '').trim().toLowerCase()
  const { matchedIds, matchAncestors } = useMemo(() => {
    if (!searchTerm) return { matchedIds: new Set(), matchAncestors: new Set() }
    const byId = new Map(allItems.map((c) => [c.id, c]))
    const matched = new Set()
    const ancestors = new Set()
    for (const cat of allItems) {
      if (
        (cat.name || '').toLowerCase().includes(searchTerm)
        || (cat.slug || '').toLowerCase().includes(searchTerm)
      ) {
        matched.add(cat.id)
        let cur = cat.parentId ? byId.get(cat.parentId) : null
        let safety = 32
        while (cur && safety-- > 0) {
          ancestors.add(cur.id)
          cur = cur.parentId ? byId.get(cur.parentId) : null
        }
      }
    }
    return { matchedIds: matched, matchAncestors: ancestors }
  }, [searchTerm, allItems])

  // Auto-expand ancestor paths whenever the search term changes so users see
  // the matches without manually expanding each level.
  useEffect(() => {
    if (!searchTerm) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      matchAncestors.forEach((id) => next.add(id))
      return next
    })
  }, [searchTerm, matchAncestors])

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    // Selections refer to ids that may no longer be on the visible page after
    // a filter/page change. Clearing avoids confusing the user with an action
    // bar showing items they can't see.
    setSelectedIds(new Set())
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, visible }) => updateCategory(id, { visible }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      // Surface an Undo affordance — the very next action a user might want
      // when they accidentally hide/show the wrong category. Skip the undo
      // when it's the user explicitly chaining undo themselves.
      if (variables._isUndo) {
        toast.success(t('categories.toggleSuccess'))
      } else {
        toast.success(t('categories.toggleSuccess'), {
          action: {
            label: t('common.undo'),
            onClick: () => {
              if (toggleVisibilityMutation.isPending) return
              setTogglingId(variables.id)
              toggleVisibilityMutation.mutate({ id: variables.id, visible: !variables.visible, _isUndo: true })
            },
          },
          duration: 6000,
        })
      }
      setTogglingId(null)
    },
    onError: (err) => {
      toast.error(err.message || t('common.error'))
      setTogglingId(null)
    },
  })

  function handleToggleVisibility(category) {
    // Block individual toggle while a bulk action is in flight too — both
    // hit the same endpoint and we don't have transactional batching.
    if (!canUpdate || toggleVisibilityMutation.isPending || bulkProgress) return
    setTogglingId(category.id)
    toggleVisibilityMutation.mutate({ id: category.id, visible: !category.isVisible })
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // Hide must run leaves-first: backend rejects hiding a category that still
  // has visible children. Show has no such constraint, so any order works.
  async function runBulkVisibility(targetVisible) {
    if (!canUpdate || bulkProgress) return
    const byId = new Map(allItems.map((c) => [c.id, c]))
    const depthOf = (id) => {
      let d = 0
      let cur = byId.get(id)
      while (cur?.parentId) {
        d += 1
        cur = byId.get(cur.parentId)
        if (d > 50) break
      }
      return d
    }
    const ids = Array.from(selectedIds)
      .filter((id) => byId.has(id))
      .sort((a, b) => (targetVisible ? depthOf(a) - depthOf(b) : depthOf(b) - depthOf(a)))

    setBulkProgress({ done: 0, total: ids.length })
    let success = 0
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        await updateCategory(ids[i], { visible: targetVisible })
        success += 1
      } catch (err) {
        failed += 1
        const cat = byId.get(ids[i])
        toast.error(`${cat?.name || ids[i]}: ${err.message || t('common.error')}`)
      }
      setBulkProgress({ done: i + 1, total: ids.length })
    }
    setBulkProgress(null)
    clearSelection()
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    // Pick the toast tone by outcome — silent success is misleading when
    // every request actually failed.
    const summary = t('categories.bulkResult', { success, failed })
    if (failed === 0) {
      toast.success(summary)
    } else if (success === 0) {
      toast.error(summary)
    } else {
      toast.warning(summary)
    }
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

  // ── Drag & drop reorder ──────────────────────────────────────────────
  // (state declared above so memos can read orderOverride; sensors + handler here)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (!canUpdate || dragSavingId) return

    const draggedId = active.id
    const targetId = over.id
    const dragged = allItems.find((c) => c.id === draggedId)
    const target = allItems.find((c) => c.id === targetId)
    if (!dragged || !target) return
    // Only reorder within the same parent — moving across parents would
    // require also updating parentId and re-validating the cycle guard.
    if ((dragged.parentId || null) !== (target.parentId || null)) {
      toast.error(t('categories.reorderSameParentOnly'))
      return
    }

    const siblings = allItems
      .filter((c) => (c.parentId || null) === (dragged.parentId || null))
      .sort((a, b) => {
        if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder
        if (a.sortOrder != null) return -1
        if (b.sortOrder != null) return 1
        return (a.name || '').localeCompare(b.name || '')
      })
    const oldIdx = siblings.findIndex((c) => c.id === draggedId)
    const newIdx = siblings.findIndex((c) => c.id === targetId)
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

    const reordered = arrayMove(siblings, oldIdx, newIdx)
    // New sortOrders are 0,1,2,... so the order is stable and explicit.
    const updates = reordered.map((c, i) => ({ id: c.id, sortOrder: i }))

    // Optimistic UI: paint new order immediately, rollback if any PATCH fails.
    const overrideMap = new Map(updates.map((u) => [u.id, u.sortOrder]))
    setOrderOverride(overrideMap)
    setDragSavingId(draggedId)
    try {
      // Run sequentially — backend doesn't have transactional batching so
      // sequential requests give us a recoverable state on partial failure.
      for (const u of updates) {
        if ((siblings.find((c) => c.id === u.id)?.sortOrder ?? -1) === u.sortOrder) continue
        await updateCategory(u.id, { sortOrder: u.sortOrder })
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t('categories.reorderSuccess'))
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setOrderOverride(null)
      setDragSavingId(null)
    }
  }

  function expandAll() {
    // Expand every node that has at least one child, at any depth — not
    // only roots. With "expand only roots" the user still has to click
    // through level 2 to see level 3, which contradicts what the label
    // says.
    const parentIds = new Set(
      allItems.map((c) => c.parentId).filter((id) => id != null),
    )
    setExpandedIds(parentIds)
  }
  function collapseAll() {
    setExpandedIds(new Set())
  }

  const useTreeMode = isTreeShape && treeRows.length > 0

  // In tree mode:
  //   - With no search: show every node whose ancestors are all expanded.
  //   - With search: keep the tree shape but only show nodes that match or
  //     sit on the path between a match and the root, so users still see
  //     where the match lives in the hierarchy.
  // Walk ancestors via id→item map (O(1) per hop) instead of allItems.find()
  // which would otherwise make this O(depth * n) per row.
  const visibleTreeRows = useMemo(() => {
    if (!useTreeMode) return []
    const byId = new Map(allItems.map((c) => [c.id, c]))
    const result = []
    const ancestorsExpanded = (row) => {
      let cur = row
      while (cur.parentId) {
        if (!expandedIds.has(cur.parentId)) return false
        cur = byId.get(cur.parentId) || {}
        if (!cur.parentId) break
      }
      return true
    }
    for (const row of treeRows) {
      if (searchTerm) {
        const isMatch = matchedIds.has(row.id)
        const isAncestor = matchAncestors.has(row.id)
        if (!isMatch && !isAncestor) continue
        // For ancestors above level 0 we still respect expand state to keep
        // user-collapsed branches collapsed.
        if (row._depth === 0 || ancestorsExpanded(row)) {
          result.push({ ...row, _isMatch: isMatch })
        }
      } else {
        if (row._depth === 0 || ancestorsExpanded(row)) result.push(row)
      }
    }
    return result
  }, [useTreeMode, treeRows, expandedIds, allItems, searchTerm, matchedIds, matchAncestors])

  // ── Flat mode renders ────────────────────────────────────────────
  const flatModeStatus = paginatedState.status
  const flatItems = paginatedState.items

  // Rows currently shown to the user — basis for the header "select all" checkbox.
  const currentPageRows = useTreeMode ? visibleTreeRows : flatItems
  const currentPageIds = useMemo(
    () => currentPageRows.map((r) => r.id),
    [currentPageRows],
  )
  const allCurrentSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id))
  const someCurrentSelected =
    currentPageIds.some((id) => selectedIds.has(id)) && !allCurrentSelected

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allCurrentSelected) {
        currentPageIds.forEach((id) => next.delete(id))
      } else {
        currentPageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const selectAllCheckbox = canUpdate ? (
    <th className="cat-select-cell">
      <input
        type="checkbox"
        aria-label={t('categories.selectAllAria')}
        checked={allCurrentSelected}
        ref={(el) => { if (el) el.indeterminate = someCurrentSelected }}
        onChange={toggleSelectAllOnPage}
        disabled={Boolean(bulkProgress) || currentPageIds.length === 0}
      />
    </th>
  ) : null

  const renderCategoryRow = (category, depth = 0, sortableProps = null) => {
    const hasChildren = useTreeMode && treeRows.some((r) => r.parentId === category.id && r._depth > 0)
    const isExpanded = expandedIds.has(category.id)
    const breadcrumb = breadcrumbMap.get(category.id) || category.name
    const descText = stripHtml(category.description)
    const goToDetail = () => navigate(`/admin/categories/${category.id}`)
    const isMatch = category._isMatch
    const isDimmed = searchTerm && !isMatch

    return (
      <tr
        key={category.id}
        ref={sortableProps?.setNodeRef}
        style={sortableProps?.style}
        {...(sortableProps?.attributes || {})}
        className={[
          `cat-row depth-${depth}`,
          !category.isVisible && 'cat-row--hidden',
          isMatch && 'cat-row--matched',
          isDimmed && 'cat-row--dimmed',
          sortableProps?.isDragging && 'cat-row--dragging',
          dragSavingId === category.id && 'cat-row--saving',
        ].filter(Boolean).join(' ')}>
        {canUpdate && (
          <td className="cat-select-cell">
            <input
              type="checkbox"
              aria-label={t('categories.selectRowAria')}
              checked={selectedIds.has(category.id)}
              onChange={() => toggleSelected(category.id)}
              disabled={Boolean(bulkProgress)}
            />
          </td>
        )}
        {/* Name cell with tree indent */}
        <td>
          <div className="cat-name-cell" style={{ paddingLeft: depth * 20 }}>
            {/* Drag handle (tree mode only, no search active) */}
            {useTreeMode && canUpdate && sortableProps && !searchTerm && (
              <button
                type="button"
                className="cat-drag-handle"
                aria-label={t('categories.dragHandle')}
                title={t('categories.dragHandleTitle')}
                {...(sortableProps.listeners || {})}
                disabled={Boolean(bulkProgress) || Boolean(dragSavingId)}
              >
                <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
                  <circle cx="2.5" cy="2"  r="1.2" fill="currentColor" />
                  <circle cx="2.5" cy="7"  r="1.2" fill="currentColor" />
                  <circle cx="2.5" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="7.5" cy="2"  r="1.2" fill="currentColor" />
                  <circle cx="7.5" cy="7"  r="1.2" fill="currentColor" />
                  <circle cx="7.5" cy="12" r="1.2" fill="currentColor" />
                </svg>
              </button>
            )}
            {useTreeMode && hasChildren ? (
              <button
                type="button"
                className={`cat-expand-btn${isExpanded ? ' is-open' : ''}`}
                onClick={() => toggleExpand(category.id)}
                aria-label={isExpanded ? t('categories.collapse') : t('categories.expand')}
                aria-expanded={isExpanded}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ) : (
              <span className="cat-expand-spacer" />
            )}
            <div className="thumbnail-wrap thumbnail-wrap--sm cat-thumb-hover">
              {category.image?.url ? (
                <>
                  <img src={category.image.url} alt={category.image.alt || category.name} referrerPolicy="no-referrer" loading="lazy" />
                  {/* Hover preview popup — same URL, no extra request */}
                  <div className="cat-thumb-popover" aria-hidden="true">
                    <img src={category.image.url} alt="" referrerPolicy="no-referrer" />
                  </div>
                </>
              ) : (
                <span className="thumbnail-placeholder" aria-hidden="true">
                  <ImageOff size={14} />
                </span>
              )}
            </div>
            <button
              type="button"
              className="cat-name-link"
              onClick={goToDetail}
              title={t('categories.openDetail')}
            >
              <strong>
                {searchTerm ? highlightMatch(formatText(category.name), searchTerm) : formatText(category.name)}
              </strong>
              <span className="cat-slug">
                {searchTerm ? highlightMatch(category.slug || '', searchTerm) : category.slug}
              </span>
              {!useTreeMode && category.parentId && (
                <span className="cat-breadcrumb">{breadcrumb}</span>
              )}
            </button>
          </div>
        </td>

        {/* Description */}
        <td className="cat-desc">
          {descText ? descText : <span className="cell-empty">—</span>}
        </td>

        {/* Visibility badge */}
        <td>
          <span className={category.isVisible ? 'status-badge status-success' : 'status-badge status-neutral'}>
            {category.isVisible ? t('categories.visibleLabel') : t('categories.hiddenLabel')}
          </span>
        </td>

        {/* Sort order — flat mode only */}
        {!useTreeMode && (
          <td className="align-right">{category.sortOrder ?? <span className="cell-empty">—</span>}</td>
        )}

        {/* Updated */}
        <td>{formatDateTime(category.updatedAt)}</td>

        {/* Actions */}
        <td className="align-right">
          <div className="cat-actions">
            {category.slug && (
              <a
                className="btn btn-icon btn-ghost btn-sm"
                href={`${STOREFRONT_BASE}/${category.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t('categories.viewOnSite')}
                aria-label={t('categories.viewOnSite')}
              >
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
            {canUpdate && (
              <button
                type="button"
                className={`btn btn-sm ${category.isVisible ? 'btn-ghost-danger' : 'btn-ghost-success'}`}
                disabled={toggleVisibilityMutation.isPending || Boolean(bulkProgress)}
                onClick={() => handleToggleVisibility(category)}
                title={category.isVisible ? t('categories.hideAction') : t('categories.restoreAction')}
              >
                {togglingId === category.id
                  ? '…'
                  : category.isVisible
                    ? t('categories.unpublishAction')
                    : t('categories.republishAction')}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  // Sortable wrapper that injects dnd-kit ref/listeners into the row.
  function SortableTreeRow({ category, depth }) {
    const sortable = useSortable({ id: category.id })
    const style = {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
      zIndex: sortable.isDragging ? 2 : undefined,
    }
    return renderCategoryRow(category, depth, {
      setNodeRef: sortable.setNodeRef,
      attributes: sortable.attributes,
      listeners: sortable.listeners,
      isDragging: sortable.isDragging,
      style,
    })
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
            <option value="ALL">{t('categories.filterVisibilityAll')}</option>
            <option value="VISIBLE">{t('categories.filterVisibilityVisible')}</option>
            <option value="HIDDEN">{t('categories.filterVisibilityHidden')}</option>
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

      {/* Active filter chips. Visible only when at least one filter
          differs from the default — gives users a quick way to see and
          undo what's narrowing the list. */}
      {(query.search || query.visibility !== 'ALL' || query.sort !== 'sortOrder:asc') && (
        <div className="filter-chips" aria-label={t('categories.activeFiltersAria')}>
          {query.search && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => { setSearchInput(''); updateQuery({ search: '' }, { resetPage: true }) }}
              aria-label={t('categories.removeFilter', { filter: t('common.search') })}
            >
              <span>{t('categories.filterChipSearch', { value: query.search })}</span>
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {query.visibility !== 'ALL' && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => updateQuery({ visibility: 'ALL' }, { resetPage: true })}
              aria-label={t('categories.removeFilter', { filter: t('categories.filterVisibility') })}
            >
              <span>{t('categories.filterChipVisibility', {
                value: query.visibility === 'VISIBLE'
                  ? t('categories.filterVisibilityVisible')
                  : t('categories.filterVisibilityHidden'),
              })}</span>
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {query.sort !== 'sortOrder:asc' && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => updateQuery({ sort: 'sortOrder:asc' }, { resetPage: true })}
              aria-label={t('categories.removeFilter', { filter: t('categories.filterSort') })}
            >
              <span>{t('categories.filterChipSort', { value: t('sort.' + (
                query.sort === 'updatedAt:desc' ? 'newestUpdated'
                  : query.sort === 'updatedAt:asc' ? 'oldestUpdated'
                    : query.sort === 'name:asc' ? 'nameAZ'
                      : 'sortOrder'
              )) })}</span>
              <X size={12} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm filter-chip-reset"
            onClick={resetFilters}
          >
            {t('common.resetFilters')}
          </button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {canUpdate && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span>
            {bulkProgress
              ? t('categories.bulkProcessing', { done: bulkProgress.done, total: bulkProgress.total })
              : t('categories.bulkSelectedCount', { count: selectedIds.size })}
          </span>
          <div className="bulk-action-bar-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearSelection}
              disabled={Boolean(bulkProgress)}
            >
              {t('categories.bulkClear')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => runBulkVisibility(true)}
              disabled={Boolean(bulkProgress)}
            >
              {t('categories.bulkShow')}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => runBulkVisibility(false)}
              disabled={Boolean(bulkProgress)}
            >
              {t('categories.bulkHide')}
            </button>
          </div>
        </div>
      )}

      {/* ── Tree mode ── */}
      {useTreeMode && (
        <div className="cat-tree-wrap">
          {allCatsResult == null ? (
            <div className="table-scroll-wrap">
              <table className="admin-table cat-tree-table cat-table-tree" aria-busy="true">
                <colgroup>
                  {canUpdate && <col className="col-select" />}
                  <col className="col-name" />
                  <col className="col-desc" />
                  <col className="col-vis" />
                  <col className="col-updated" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    {selectAllCheckbox}
                    <th>{t('categories.colCategory')}</th>
                    <th>{t('categories.colDescription')}</th>
                    <th>{t('categories.colVisibility')}</th>
                    <th>{t('categories.colUpdated')}</th>
                    <th className="align-right">{t('categories.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="skel-row">
                      {Array.from({ length: canUpdate ? 6 : 5 }).map((__, j) => (
                        <td key={j}><span className="bb-skel" style={{ width: '80%', height: 18 }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : visibleTreeRows.length === 0 ? (
            <div className="cat-empty-state">
              <FolderTree size={56} aria-hidden="true" className="cat-empty-icon" />
              <h2 className="cat-empty-title">
                {searchTerm ? t('categories.emptySearchTitle') : t('categories.emptyTitle')}
              </h2>
              <p className="cat-empty-desc">
                {searchTerm
                  ? t('categories.emptySearchDesc', { value: searchTerm })
                  : t('categories.emptyDesc')}
              </p>
              <div className="cat-empty-actions">
                {(searchTerm || query.visibility !== 'ALL' || query.sort !== 'sortOrder:asc') && (
                  <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                    {t('common.resetFilters')}
                  </button>
                )}
                {canUpdate && (
                  <button type="button" className="btn btn-primary" onClick={() => navigate('/admin/categories/new')}>
                    {t('categories.create')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="table-scroll-wrap">
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleTreeRows.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
              <table className="admin-table cat-tree-table cat-table-tree">
                <caption className="sr-only">{t('categories.tableCaption')}</caption>
                <colgroup>
                  {canUpdate && <col className="col-select" />}
                  <col className="col-name" />
                  <col className="col-desc" />
                  <col className="col-vis" />
                  <col className="col-updated" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    {selectAllCheckbox}
                    <th>{t('categories.colCategory')}</th>
                    <th>{t('categories.colDescription')}</th>
                    <th>{t('categories.colVisibility')}</th>
                    <th>{t('categories.colUpdated')}</th>
                    <th className="align-right">{t('categories.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTreeRows.map((row) =>
                    canUpdate && !searchTerm
                      ? <SortableTreeRow key={row.id} category={row} depth={row._depth} />
                      : renderCategoryRow(row, row._depth)
                  )}
                </tbody>
              </table>
                </SortableContext>
              </DndContext>
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
              description={paginatedState.error || t('common.unknownError')}
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
                <table className="admin-table cat-tree-table cat-table-flat">
                  <caption className="sr-only">{t('categories.tableCaption')}</caption>
                  <colgroup>
                    {canUpdate && <col className="col-select" />}
                    <col className="col-name" />
                    <col className="col-desc" />
                    <col className="col-vis" />
                    <col className="col-sort" />
                    <col className="col-updated" />
                    <col className="col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      {selectAllCheckbox}
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
                            {Array.from({ length: canUpdate ? 7 : 6 }).map((__, j) => (
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
