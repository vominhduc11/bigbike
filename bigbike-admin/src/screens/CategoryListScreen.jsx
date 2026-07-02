import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { ChevronRight, ExternalLink, GripVertical, ImageOff, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDragSensors, SortableRow } from '../components/Sortable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { fetchCategories, fetchCategoryTree, updateCategory, softDeleteCategory, restoreCategory, hardDeleteCategory } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  EMPTY_ITEMS,
  INITIAL_QUERY,
  STOREFRONT_BASE,
  buildBreadcrumbMap,
  buildTree,
} from './category-list/constants'
import { CategoryEmptyState } from './category-list/CategoryEmptyState'
import { CategoryFlatTableHead, CategoryTreeTableHead } from './category-list/CategoryTableHead'

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

// Sortable wrapper that injects dnd-kit ref/listeners into the row. Defined at module
// scope (not inside CategoryListScreen) so its identity is stable across renders —
// previously it was redefined on every render of the list screen, which made React treat
// it as a brand-new component type each time and unmount+remount the entire tree (losing
// dnd-kit's per-row useSortable state) on any state change, even a checkbox toggle.
// renderCategoryRow is threaded through as a prop instead of a closure for the same reason.
function SortableTreeRow({ category, depth, renderCategoryRow }) {
  return (
    <SortableRow id={category.id}>
      {(sortable) => renderCategoryRow(category, depth, {
        setNodeRef: sortable.setNodeRef,
        attributes: sortable.attributes,
        listeners: sortable.listeners,
        isDragging: sortable.isDragging,
        style: { ...sortable.style, zIndex: sortable.isDragging ? 2 : undefined },
      })}
    </SortableRow>
  )
}

export function CategoryListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
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
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)

  const paginatedState = useAdminList(['categories', query, contentLang], () => fetchCategories(query))

  const { data: allCatsResult } = useQuery({
    queryKey: ['categories', 'tree', contentLang],
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
  const isTreeShape = (!query.visibility || query.visibility === 'ALL')
    && (query.sort === 'sortOrder:asc' || !query.sort)
    && !query.deleted

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Hiding is destructive (categories disappear from the storefront) and has
    // no per-row Undo on the bulk path, so gate it behind a confirm dialog.
    // The show path is non-destructive and stays unconfirmed.
    if (!targetVisible) {
      const confirmed = await showConfirm(
        t('categories.bulkHideConfirm', { count: selectedIds.size }),
        t('categories.bulkHideConfirmTitle'),
        { variant: 'danger' },
      )
      if (!confirmed) return
    }
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
  const dndSensors = useDragSensors(6)

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

  const handleSoftDelete = async (category) => {
    const confirmed = await showConfirm(
      t('categories.deleteConfirm', { name: category.name, defaultValue: `Bạn có chắc chắn muốn xóa danh mục ${category.name}? Các danh mục con cũng sẽ bị xóa mềm.` }),
      t('categories.deleteConfirmTitle', { defaultValue: 'Xác nhận xóa' }),
      { confirmLabel: t('common.delete'), variant: 'danger' }
    )
    if (!confirmed) return

    try {
      await softDeleteCategory(category.id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      toast.success(t('categories.deleteSuccess', { defaultValue: 'Đã chuyển danh mục vào Thùng rác.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const handleRestore = async (category) => {
    const confirmed = await showConfirm(
      t('categories.restoreConfirm', { name: category.name, defaultValue: `Bạn có chắc chắn muốn khôi phục danh mục ${category.name}? Các danh mục con cũng sẽ được khôi phục.` }),
      t('categories.restoreConfirmTitle', { defaultValue: 'Xác nhận khôi phục' }),
      { confirmLabel: t('products.restore'), variant: 'default' }
    )
    if (!confirmed) return

    try {
      await restoreCategory(category.id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      toast.success(t('categories.restoreSuccess', { defaultValue: 'Khôi phục danh mục thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const handlePermanentDelete = async (category) => {
    const confirmed = await showConfirm(
      t('categories.permanentDeleteConfirm', { name: category.name, defaultValue: `Bạn có chắc chắn muốn xóa vĩnh viễn danh mục ${category.name} cùng toàn bộ danh mục con? Hành vi này không thể khôi phục.` }),
      t('categories.permanentDeleteConfirmTitle', { defaultValue: 'Xác nhận xóa vĩnh viễn' }),
      { confirmLabel: t('common.permanentDelete'), variant: 'danger' }
    )
    if (!confirmed) return

    try {
      await hardDeleteCategory(category.id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      toast.success(t('categories.permanentDeleteSuccess', { defaultValue: 'Xóa vĩnh viễn danh mục thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
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
      <Checkbox
        aria-label={t('categories.selectAllAria')}
        checked={allCurrentSelected ? true : someCurrentSelected ? 'indeterminate' : false}
        onCheckedChange={toggleSelectAllOnPage}
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
            <Checkbox
              aria-label={t('categories.selectRowAria')}
              checked={selectedIds.has(category.id)}
              onCheckedChange={() => toggleSelected(category.id)}
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
                <GripVertical size={16} aria-hidden="true" />
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
            <a
              href={`/admin/categories/${category.id}`}
              className="cat-name-link"
              title={t('categories.openDetail')}
              onClick={(e) => {
                // Ctrl/Cmd-click hoặc chuột-giữa → để trình duyệt mở tab mới.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                e.preventDefault()
                goToDetail()
              }}
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
            </a>
          </div>
        </td>

        {/* Description */}
        <td className="cat-desc">
          {descText ? descText : <span className="cell-empty">—</span>}
        </td>

        {/* Visibility badge */}
        <td>
          <StatusBadge type="visibility" status={category.isVisible} className="cat-status-badge" />
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
              <Button asChild variant="ghost" size="icon">
                <a
                  href={`${STOREFRONT_BASE}/${category.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('categories.viewOnSite')}
                  aria-label={t('categories.viewOnSite')}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </Button>
            )}
            {canUpdate && !query.deleted && (
              <Button
                variant="outline"
                size="sm"
                className={category.isVisible ? 'text-destructive hover:text-destructive' : 'text-success hover:text-success'}
                disabled={toggleVisibilityMutation.isPending || Boolean(bulkProgress)}
                onClick={() => handleToggleVisibility(category)}
                title={category.isVisible ? t('categories.hideAction') : t('categories.restoreAction')}
              >
                {togglingId === category.id
                  ? '…'
                  : category.isVisible
                    ? t('categories.unpublishAction')
                    : t('categories.republishAction')}
              </Button>
            )}
            {canUpdate && category.id !== 'uncategorized' && !query.deleted && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleSoftDelete(category)}
              >
                {t('common.delete')}
              </Button>
            )}
            {canUpdate && query.deleted && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-success hover:text-success"
                  onClick={() => handleRestore(category)}
                >
                  {t('products.restore')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handlePermanentDelete(category)}
                >
                  {t('common.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' })}
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const sortLabelKey = query.sort === 'updatedAt:desc'
    ? 'newestUpdated'
    : query.sort === 'updatedAt:asc'
      ? 'oldestUpdated'
      : query.sort === 'name:asc'
        ? 'nameAZ'
        : 'sortOrder'

  const activeFilterChips = []
  if (query.search) {
    activeFilterChips.push({
      key: 'search',
      label: t('categories.filterChipSearch', { value: query.search }),
      removeLabel: t('categories.removeFilter', { filter: t('common.search') }),
      onRemove: () => {
        setSearchInput('')
        updateQuery({ search: '' }, { resetPage: true })
      },
    })
  }
  if (query.visibility !== 'ALL') {
    activeFilterChips.push({
      key: 'visibility',
      label: t('categories.filterChipVisibility', {
        value: query.visibility === 'VISIBLE'
          ? t('categories.filterVisibilityVisible')
          : t('categories.filterVisibilityHidden'),
      }),
      removeLabel: t('categories.removeFilter', { filter: t('categories.filterVisibility') }),
      onRemove: () => updateQuery({ visibility: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.sort !== 'sortOrder:asc') {
    activeFilterChips.push({
      key: 'sort',
      label: t('categories.filterChipSort', { value: t(`sort.${sortLabelKey}`) }),
      removeLabel: t('categories.removeFilter', { filter: t('categories.filterSort') }),
      onRemove: () => updateQuery({ sort: 'sortOrder:asc' }, { resetPage: true }),
    })
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('categories.eyebrow')}</p>
          <h1>{t('categories.title')}</h1>
          <p className="bb-muted">{t('categories.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            onClick={() => navigate('/admin/categories/new')}
            disabled={!canUpdate}
          >
            <Plus size={14} />{canUpdate ? t('categories.create') : t('common.noPermission')}
          </button>
        </div>
      </div>

      {paginatedState.warning ? <ReadOnlyBanner warning={paginatedState.warning} /> : null}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('categories.searchPlaceholder')}
        />
        <FilterSelect
          value={query.deleted ? 'TRASH' : 'ACTIVE'}
          onValueChange={(v) => updateQuery({ deleted: v === 'TRASH' }, { resetPage: true })}
          ariaLabel={t('categories.filterTrash', { defaultValue: 'Trạng thái' })}
          options={[
            { value: 'ACTIVE', label: t('categories.filterActive', { defaultValue: 'Hoạt động' }) },
            { value: 'TRASH', label: t('categories.filterTrashTab', { defaultValue: 'Thùng rác' }) },
          ]}
        />
        <FilterSelect
          value={query.visibility}
          onValueChange={(v) => updateQuery({ visibility: v }, { resetPage: true })}
          ariaLabel={t('categories.filterVisibility')}
          options={[
            { value: 'ALL', label: t('categories.filterVisibilityAll') },
            { value: 'VISIBLE', label: t('categories.filterVisibilityVisible') },
            { value: 'HIDDEN', label: t('categories.filterVisibilityHidden') },
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('categories.filterSort')}
          options={[
            { value: 'sortOrder:asc', label: t('sort.sortOrder') },
            { value: 'updatedAt:desc', label: t('sort.newestUpdated') },
            { value: 'updatedAt:asc', label: t('sort.oldestUpdated') },
            { value: 'name:asc', label: t('sort.nameAZ') },
          ]}
        />
        {!useTreeMode && (
          <PageSizeSelect
            value={query.pageSize}
            onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
          />
        )}
        {useTreeMode && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Chế độ cây ẩn phân trang nên không có tổng số bản ghi; hiện
                tổng số danh mục để admin vẫn biết quy mô dữ liệu (tiêu chí 6.3). */}
            <span className="bb-muted" style={{ fontSize: 12 }}>
              {t('categories.treeTotalCount', { count: allItems.length, defaultValue: `${allItems.length} danh mục` })}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={expandAll}>
                {t('categories.expandAll')}
              </button>
              <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={collapseAll}>
                {t('categories.collapseAll')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active filter chips. Visible only when at least one filter
          differs from the default — gives users a quick way to see and
          undo what's narrowing the list. */}
      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('categories.activeFiltersAria')}
      />

      {/* ── Bulk action bar ── */}
      {/* Hợp đồng BulkActionBar: số → bar tự dịch "{n} đã chọn"; chuỗi → hiện
          nguyên văn (dùng cho nhãn tiến độ tùy biến). Trùng lặp chữ "đã chọn"
          trước đây là do truyền chuỗi đã-dịch cho trường hợp thường — nay
          truyền số thô để khớp Order/Product list. */}
      <BulkActionBar
        selectedCount={canUpdate && selectedIds.size > 0
          ? (bulkProgress
            ? t('categories.bulkProcessing', { done: bulkProgress.done, total: bulkProgress.total })
            : selectedIds.size)
          : null}
        onClear={clearSelection}
        closeLabel={t('categories.bulkClear')}
        actions={[
          {
            label: t('categories.bulkShow'),
            onClick: () => runBulkVisibility(true),
            disabled: Boolean(bulkProgress),
          },
          {
            label: t('categories.bulkHide'),
            tone: 'danger',
            onClick: () => runBulkVisibility(false),
            disabled: Boolean(bulkProgress),
          },
        ]}
      />

      {/* ── Tree mode ── */}
      {useTreeMode && (
        <div className="cat-tree-wrap">
          {allCatsResult == null ? (
            <div className="table-scroll-wrap">
              <table className="admin-table cat-tree-table cat-table-tree" aria-busy="true">
                <CategoryTreeTableHead canUpdate={canUpdate} selectAllCheckbox={selectAllCheckbox} />
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="skel-row">
                      {Array.from({ length: canUpdate ? 6 : 5 }).map((__, j) => (
                        <td key={j}><span className="bb-skel w-4/5 h-5" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : visibleTreeRows.length === 0 ? (
            <CategoryEmptyState
              searchTerm={searchTerm}
              query={query}
              canUpdate={canUpdate}
              onResetFilters={resetFilters}
              onCreate={() => navigate('/admin/categories/new')}
            />
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
                <CategoryTreeTableHead canUpdate={canUpdate} selectAllCheckbox={selectAllCheckbox} />
                <tbody>
                  {visibleTreeRows.map((row) =>
                    canUpdate && !searchTerm
                      ? <SortableTreeRow key={row.id} category={row} depth={row._depth} renderCategoryRow={renderCategoryRow} />
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
                  <CategoryFlatTableHead canUpdate={canUpdate} selectAllCheckbox={selectAllCheckbox} />
                  <tbody>
                    {flatModeStatus === 'loading'
                      ? Array.from({ length: query.pageSize }).map((_, i) => (
                          <tr key={i} className="skel-row">
                            {Array.from({ length: canUpdate ? 7 : 6 }).map((__, j) => (
                              <td key={j}><span className="bb-skel w-4/5 h-5" /></td>
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
    </div>
  )
}
