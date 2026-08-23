import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { ChevronRight, Copy, ExternalLink, Eye, EyeOff, GripVertical, ImageOff, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react'
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
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { FilterChips } from '../components/FilterChips'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { fetchCategories, fetchCategoryDetail, fetchCategoryTree, updateCategory, softDeleteCategory, restoreCategory, hardDeleteCategory, previewCategoryPermanentDelete } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { visibilityRowAccent } from '../lib/statusTone'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { queryKeys } from '../lib/queryKeys'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  DUPLICATE_SESSION_KEY,
  EMPTY_ITEMS,
  INITIAL_QUERY,
  STOREFRONT_BASE,
  buildTree,
} from './category-list/constants'
import { CategoryEmptyState } from './category-list/CategoryEmptyState'
import { CategoryFlatTableHead, CategoryTreeTableHead } from './category-list/CategoryTableHead'
import { FilterBar, MobileCardList, MobileCard, Screen, ScreenHeader } from '../components/layout'

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
  const categoryColumns = useMemo(() => [
    { key: 'category', label: t('categories.colCategory'), hideable: false },
    { key: 'visibility', label: t('categories.colVisibility') },
    { key: 'homepage', label: t('categories.colHomepage') },
    { key: 'updatedAt', label: t('categories.colUpdated') },
    { key: 'actions', label: t('categories.colActions'), hideable: false },
  ], [t])
  const {
    hiddenKeys: hiddenCategoryColumnKeys,
    toggle: toggleCategoryColumn,
    allColumns: hideableCategoryColumns,
  } = useColumnVisibility(categoryColumns, 'columns:categories')
  const isCategoryColumnVisible = (key) => !hiddenCategoryColumnKeys.includes(key)
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [togglingId, setTogglingId] = useState(null)
  const [rowActionBusy, setRowActionBusy] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkProgress, setBulkProgress] = useState(null) // {done,total} or null
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)

  // O9: danh mục vừa mở gần đây (ghi lại từ CategoryDetailScreen khi mount).
  const recentCategoryItems = useRecentItems('recent:categories')

  const paginatedState = useAdminList(['categories', query, contentLang], () => fetchCategories(query))

  // N2: đọc thêm isError/error/refetch riêng của query cây — trước đây lỗi ở
  // đây bị nuốt im lặng, buộc màn hình rơi vĩnh viễn về "Dạng danh sách" mà
  // không có cách báo lỗi hay thử lại thật (bấm lại tab "Dạng cây" chỉ đổi
  // filter, không refetch query này).
  const {
    data: allCatsResult,
    isError: isTreeError,
    isFetching: isTreeFetching,
    error: treeError,
    refetch: refetchTree,
  } = useQuery({
    queryKey: queryKeys.categoriesTree(contentLang),
    queryFn: () => fetchCategoryTree(),
  })

  const allItems = useMemo(() => allCatsResult?.items ?? EMPTY_ITEMS, [allCatsResult?.items])

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
    // N7: cập nhật lạc quan — badge trạng thái đổi ngay khi bấm thay vì chỉ
    // sau khi request thành công, rollback lại nếu request lỗi.
    onMutate: async ({ id, visible }) => {
      await queryClient.cancelQueries({ queryKey: ['categories'] })
      const previousQueries = queryClient.getQueriesData({ queryKey: ['categories'] })
      queryClient.setQueriesData({ queryKey: ['categories'] }, (old) => {
        if (!old?.items) return old
        return { ...old, items: old.items.map((c) => (c.id === id ? { ...c, isVisible: visible } : c)) }
      })
      return { previousQueries }
    },
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
    onError: (err, _variables, context) => {
      context?.previousQueries?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(err.message || t('common.error'))
      setTogglingId(null)
    },
  })

  async function handleToggleVisibility(category) {
    // Block individual toggle while a bulk action is in flight too — both
    // hit the same endpoint and we don't have transactional batching.
    if (!canUpdate || category.id === 'uncategorized' || toggleVisibilityMutation.isPending || bulkProgress) return
    const willBeVisible = !category.isVisible
    const confirmed = await showConfirm(
      willBeVisible
        ? t('categories.showConfirm', {
          name: category.name,
          defaultValue: `Hiện danh mục ${category.name} trên website?`,
        })
        : t('categories.hideConfirm', {
          name: category.name,
          defaultValue: `Ẩn danh mục ${category.name} khỏi website? Danh mục này không bị chuyển vào Thùng rác.`,
        }),
      willBeVisible
        ? t('categories.showConfirmTitle', { defaultValue: 'Xác nhận hiện trên website' })
        : t('categories.hideConfirmTitle', { defaultValue: 'Xác nhận ẩn khỏi website' }),
      {
        variant: 'default',
        confirmLabel: willBeVisible ? t('categories.showAction') : t('categories.hideAction'),
      },
    )
    if (!confirmed) return

    setTogglingId(category.id)
    toggleVisibilityMutation.mutate({ id: category.id, visible: willBeVisible })
  }

  function toggleSelected(id) {
    if (id === 'uncategorized' || bulkProgress) return
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
    // Hiding is reversible visibility state, so the confirmation stays neutral.
    if (!targetVisible) {
      const confirmed = await showConfirm(
        t('categories.bulkHideConfirm', { count: selectedIds.size }),
        t('categories.bulkHideConfirmTitle'),
        { variant: 'default', confirmLabel: t('categories.hideAction') },
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
      .filter((id) => id !== 'uncategorized' && byId.has(id))
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

  // Bulk khôi phục / xoá vĩnh viễn khi đang xem Thùng rác — bọc API single-item
  // sẵn có (restoreCategory / hardDeleteCategory), cùng khuôn runBulkVisibility.
  // Chạy tuần tự vì xoá vĩnh viễn cha kéo theo con (như runBulkVisibility).
  async function runBulkTrash(action) {
    if (!canUpdate || bulkProgress) return
    const byId = new Map([...allItems, ...paginatedState.items].map((c) => [c.id, c]))
    let ids = Array.from(selectedIds).filter((id) => id !== 'uncategorized' && byId.has(id))
    if (ids.length === 0) return

    if (action === 'permanentDelete') {
      let impact
      try {
        impact = await previewCategoryPermanentDelete(ids)
      } catch (error) {
        toast.error(error.message || t('categories.permanentDeleteImpactError'))
        return
      }
      const confirmed = await showConfirm(
        t('categories.bulkPermanentDeleteImpactConfirm', {
          selectedCount: impact.requestedCategoryCount,
          descendantCount: impact.descendantCategoryCount,
          affectedProductCount: impact.affectedProductCount,
          reassignedProductCount: impact.reassignedProductCount,
        }),
        t('common.permanentDeleteTitle'),
        { variant: 'danger', confirmLabel: t('common.permanentDelete') },
      )
      if (!confirmed) return
      ids = impact.rootCategoryIds
    }

    const apiFn = action === 'restore' ? restoreCategory : hardDeleteCategory
    setBulkProgress({ done: 0, total: ids.length })
    let success = 0
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        await apiFn(ids[i])
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
    queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
    const summary = t('categories.bulkResult', { success, failed })
    if (failed === 0) toast.success(summary)
    else if (success === 0) toast.error(summary)
    else toast.warning(summary)
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
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
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

  // F11: Nhân bản danh mục — tải chi tiết đầy đủ, ghi tạm vào sessionStorage rồi
  // điều hướng sang màn tạo mới; CategoryDetailScreen đọc bản nháp đó khi mount
  // (cùng cơ chế "Sao chép" đã có ở Sản phẩm).
  const handleDuplicate = async (category) => {
    if (rowActionBusy || bulkProgress) return
    setRowActionBusy(`duplicate:${category.id}`)
    try {
      const result = await fetchCategoryDetail(category.id)
      const item = result?.item
      if (!item) return
      try {
        sessionStorage.setItem(DUPLICATE_SESSION_KEY, JSON.stringify(item))
      } catch { /* quota */ }
      navigate('/admin/categories/new')
    } catch {
      toast.error(t('categories.dupLoadError', { defaultValue: 'Không thể tải dữ liệu danh mục để sao chép.' }))
    } finally {
      setRowActionBusy(null)
    }
  }

  const handleSoftDelete = async (category) => {
    if (rowActionBusy || bulkProgress) return
    const confirmed = await showConfirm(
      t('categories.deleteConfirm', { name: category.name, defaultValue: `Chuyển danh mục ${category.name} vào Thùng rác. Các danh mục con cũng sẽ được xoá mềm và có thể khôi phục.` }),
      t('common.moveToTrashTitle'),
      { confirmLabel: t('common.moveToTrash'), variant: 'default' }
    )
    if (!confirmed) return

    setRowActionBusy(`delete:${category.id}`)
    try {
      await softDeleteCategory(category.id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      toast.success(t('categories.deleteSuccess', { defaultValue: 'Đã chuyển danh mục vào Thùng rác.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    } finally {
      setRowActionBusy(null)
    }
  }

  const handleRestore = async (category) => {
    if (rowActionBusy || bulkProgress) return
    const confirmed = await showConfirm(
      t('categories.restoreConfirm', { name: category.name, defaultValue: `Bạn có chắc chắn muốn khôi phục danh mục ${category.name}? Các danh mục con cũng sẽ được khôi phục.` }),
      t('categories.restoreConfirmTitle', { defaultValue: 'Xác nhận khôi phục' }),
      { confirmLabel: t('products.restore'), variant: 'default' }
    )
    if (!confirmed) return

    setRowActionBusy(`restore:${category.id}`)
    try {
      await restoreCategory(category.id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      toast.success(t('categories.restoreSuccess', { defaultValue: 'Khôi phục danh mục thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    } finally {
      setRowActionBusy(null)
    }
  }

  const handlePermanentDelete = async (category) => {
    if (rowActionBusy || bulkProgress) return
    setRowActionBusy(`permanent:${category.id}`)
    let impact
    try {
      impact = await previewCategoryPermanentDelete([category.id])
    } catch (error) {
      toast.error(error.message || t('categories.permanentDeleteImpactError'))
      setRowActionBusy(null)
      return
    }
    const confirmed = await showConfirm(
      t('categories.permanentDeleteImpactConfirm', {
        name: category.name,
        descendantCount: impact.descendantCategoryCount,
        affectedProductCount: impact.affectedProductCount,
        reassignedProductCount: impact.reassignedProductCount,
      }),
      t('common.permanentDeleteTitle'),
      { confirmLabel: t('common.permanentDelete'), variant: 'danger' }
    )
    if (!confirmed) {
      setRowActionBusy(null)
      return
    }

    try {
      await hardDeleteCategory(category.id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      toast.success(t('categories.permanentDeleteSuccess', { defaultValue: 'Xoá vĩnh viễn danh mục thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    } finally {
      setRowActionBusy(null)
    }
  }

  const useTreeMode = isTreeShape && !isTreeError

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
    () => currentPageRows.filter((r) => r.id !== 'uncategorized').map((r) => r.id),
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
    <Checkbox
      aria-label={t('categories.selectAllAria')}
      checked={allCurrentSelected ? true : someCurrentSelected ? 'indeterminate' : false}
      onCheckedChange={toggleSelectAllOnPage}
      disabled={Boolean(bulkProgress) || currentPageIds.length === 0}
    />
  ) : null

  // Nút thao tác dòng danh mục — dùng chung cho bảng (.cat-actions) và thẻ mobile (P2-2).
  const renderCategoryRowActions = (category) => {
    const isSystemCategory = category.id === 'uncategorized'
    const detailPath = `/admin/categories/${category.id}`
    const actionForRow = rowActionBusy?.endsWith(`:${category.id}`)
    const rowBusy = actionForRow || togglingId === category.id || Boolean(bulkProgress)
    const storefrontAvailable = Boolean(category.slug && category.isVisible && !query.deleted)

    return (
      <div className="cat-actions" onClick={(event) => event.stopPropagation()}>
        <Button
          variant="unstyled"
          size="icon"
          type="button"
          className="bb-icon-btn min-h-11 min-w-11"
          title={t('common.edit', { defaultValue: 'Chỉnh sửa' })}
          aria-label={t('common.edit', { defaultValue: 'Chỉnh sửa' })}
          onClick={() => navigate(detailPath)}
        >
          <Pencil size={15} aria-hidden="true" />
        </Button>

        {canUpdate && !isSystemCategory && !query.deleted && (
          <Button
            variant="unstyled"
            size="icon"
            type="button"
            className="bb-icon-btn min-h-11 min-w-11"
            loading={togglingId === category.id}
            disabled={rowBusy || toggleVisibilityMutation.isPending}
            onClick={() => handleToggleVisibility(category)}
            title={category.isVisible
              ? t('categories.hideAction', { defaultValue: 'Ẩn khỏi website' })
              : t('categories.showAction', { defaultValue: 'Hiện trên website' })}
            aria-label={category.isVisible
              ? t('categories.hideAction', { defaultValue: 'Ẩn khỏi website' })
              : t('categories.showAction', { defaultValue: 'Hiện trên website' })}
          >
            {category.isVisible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </Button>
        )}

        {(storefrontAvailable || (canUpdate && !isSystemCategory)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="unstyled"
                size="icon"
                type="button"
                className="bb-icon-btn min-h-11 min-w-11"
                title={t('common.actions', { defaultValue: 'Thao tác' })}
                aria-label={t('common.actions', { defaultValue: 'Thao tác' })}
                disabled={rowBusy}
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {storefrontAvailable && (
                <>
                  <DropdownMenuItem asChild>
                    <a
                      href={`${STOREFRONT_BASE}/${category.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} className="mr-2" aria-hidden="true" />
                      {t('categories.viewOnSite')}
                    </a>
                  </DropdownMenuItem>
                  {canUpdate && !isSystemCategory ? <DropdownMenuSeparator /> : null}
                </>
              )}
              {canUpdate && !isSystemCategory && !query.deleted && (
                <>
                  <DropdownMenuItem disabled={rowBusy} onSelect={() => handleDuplicate(category)}>
                    <Copy size={14} className="mr-2" aria-hidden="true" />
                    {t('categories.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={rowBusy}
                    onSelect={() => handleSoftDelete(category)}
                    className="text-danger focus:text-danger"
                  >
                    <Trash2 size={14} className="mr-2" aria-hidden="true" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </>
              )}
              {canUpdate && !isSystemCategory && query.deleted && (
                <>
                  <DropdownMenuItem disabled={rowBusy} onSelect={() => handleRestore(category)}>
                    <Undo2 size={14} className="mr-2" aria-hidden="true" />
                    {t('products.restore')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={rowBusy}
                    onSelect={() => handlePermanentDelete(category)}
                    className="text-danger focus:text-danger"
                  >
                    <Trash2 size={14} className="mr-2" aria-hidden="true" />
                    {t('common.permanentDelete', { defaultValue: 'Xoá vĩnh viễn' })}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )
  }

  // Thẻ mobile cho 1 danh mục — thay bảng cuộn ngang trên điện thoại (P2-2).
  // Kéo-thả sắp xếp vẫn chỉ ở desktop; mobile hiển thị dạng danh sách phẳng.
  const mobileCategoryCard = (category) => {
    return (
      <MobileCard
        key={category.id}
        title={formatText(category.name)}
        subtitle={category.slug ? `/${category.slug}` : undefined}
        status={<StatusBadge type="visibility" status={category.isVisible} />}
        meta={[
          {
            label: t('categories.colHomepage'),
            value: category.showOnHomepage === true
              ? t('common.yes')
              : category.showOnHomepage === false
                ? t('common.no')
                : t('common.unknown'),
          },
          { label: t('categories.colUpdated'), value: formatDateTime(category.updatedAt) },
        ]}
        onClick={() => navigate(`/admin/categories/${category.id}`)}
        selectable={canUpdate && category.id !== 'uncategorized'}
        selected={selectedIds.has(category.id)}
        onSelectChange={() => toggleSelected(category.id)}
        actions={renderCategoryRowActions(category)}
      />
    )
  }

  const renderCategoryRow = (category, depth = 0, sortableProps = null) => {
    const hasChildren = useTreeMode && treeRows.some((r) => r.parentId === category.id && r._depth > 0)
    const isExpanded = expandedIds.has(category.id)
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
          visibilityRowAccent(category.isVisible),
        ].filter(Boolean).join(' ')}>
        {canUpdate && (
          <td className="cat-select-cell">
            <Checkbox
              aria-label={t('categories.selectRowAria')}
              checked={selectedIds.has(category.id)}
              onCheckedChange={() => toggleSelected(category.id)}
              disabled={category.id === 'uncategorized' || Boolean(bulkProgress)}
             />
          </td>
        )}
        {/* Name cell with tree indent */}
        <td>
          <div className="cat-name-cell" style={{ paddingLeft: depth * 20 }}>
            {/* Drag handle (tree mode only, no search active) */}
            {useTreeMode && canUpdate && sortableProps && !searchTerm && (
              <Button variant="unstyled"
                type="button"
                className="cat-drag-handle"
                aria-label={t('categories.dragHandle')}
                title={t('categories.dragHandleTitle')}
                {...(sortableProps.listeners || {})}
                disabled={Boolean(bulkProgress) || Boolean(dragSavingId)}
              >
                <GripVertical size={16} aria-hidden="true" />
              </Button>
            )}
            {useTreeMode && hasChildren ? (
              <Button variant="unstyled"
                type="button"
                className={`cat-expand-btn${isExpanded ? ' is-open' : ''}`}
                onClick={() => toggleExpand(category.id)}
                aria-label={isExpanded ? t('categories.collapse') : t('categories.expand')}
                aria-expanded={isExpanded}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            ) : (
              <span className="cat-expand-spacer" />
            )}
            <div className="bb-product-cell min-w-0 flex-1">
              <div className="cat-thumb-hover shrink-0">
                <span className="bb-product-thumb">
                  {category.image?.url ? (
                    <img src={category.image.url} alt={category.image.alt || category.name} referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="thumbnail-placeholder" aria-hidden="true">
                      <ImageOff size={14} />
                    </span>
                  )}
                </span>
                {category.image?.url ? (
                  <div className="cat-thumb-popover" aria-hidden="true">
                    <img src={category.image.url} alt="" referrerPolicy="no-referrer" />
                  </div>
                ) : null}
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
                <span className="bb-cell-sub cat-slug">
                  {category.slug
                    ? <>/{searchTerm ? highlightMatch(category.slug, searchTerm) : category.slug}</>
                    : '—'}
                </span>
              </a>
            </div>
          </div>
        </td>

        {/* Display status */}
        {isCategoryColumnVisible('visibility') && (
          <td>
            <StatusBadge type="visibility" status={category.isVisible} className="cat-status-badge" />
          </td>
        )}

        {/* Homepage */}
        {isCategoryColumnVisible('homepage') && (
          <td>
            <span className="text-sm text-foreground">
              {category.showOnHomepage === true
                ? t('common.yes')
                : category.showOnHomepage === false
                  ? t('common.no')
                  : t('common.unknown')}
            </span>
          </td>
        )}

        {/* Updated */}
        {isCategoryColumnVisible('updatedAt') && (
          <td className="align-right">
            <span className="text-xs text-muted-foreground">{formatDateTime(category.updatedAt)}</span>
          </td>
        )}

        {/* Actions */}
        <td className="align-right">
          {renderCategoryRowActions(category)}
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
  if (query.deleted) {
    activeFilterChips.push({
      key: 'deleted',
      label: t('categories.filterChipTrash', {
        value: t('categories.filterTrashTab', { defaultValue: 'Thùng rác' }),
        defaultValue: 'Trạng thái: {{value}}',
      }),
      removeLabel: t('categories.removeFilter', {
        filter: t('categories.filterTrash', { defaultValue: 'Trạng thái' }),
        defaultValue: 'Bỏ lọc {{filter}}',
      }),
      onRemove: () => updateQuery({ deleted: false }, { resetPage: true }),
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

  const hasActiveFilters = activeFilterChips.length > 0
  const isRefreshing = useTreeMode ? isTreeFetching : paginatedState.isFetching
  const resultSummary = useTreeMode
    ? t('categories.resultSummaryTree', {
      shown: visibleTreeRows.length,
      total: allItems.length,
      defaultValue: `${visibleTreeRows.length}/${allItems.length} danh mục`,
    })
    : flatModeStatus === 'success'
      ? t('categories.resultSummaryFlat', {
        count: paginatedState.pagination?.totalItems ?? flatItems.length,
        defaultValue: `${paginatedState.pagination?.totalItems ?? flatItems.length} danh mục`,
      })
      : ''

  const resultAnnounce = useTreeMode
    ? t('categories.resultsAnnounceTree', {
      shown: visibleTreeRows.length,
      total: allItems.length,
      defaultValue: `Đang hiển thị ${visibleTreeRows.length}/${allItems.length} danh mục trong cây`,
    })
    : flatModeStatus === 'success'
      ? t('categories.resultsAnnounce', {
        count: paginatedState.pagination?.totalItems ?? flatItems.length,
        defaultValue: `Đã lọc: ${paginatedState.pagination?.totalItems ?? flatItems.length} danh mục`,
      })
      : ''

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('categories.eyebrow')}
        title={t('categories.title')}
        description={t('categories.description')}
        actions={canUpdate ? (
          <Button type="button" className="min-h-11" onClick={() => navigate('/admin/categories/new')}>
            <Plus size={16} aria-hidden="true" />
            {t('categories.create')}
          </Button>
        ) : null}
      />

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentCategoryItems} onSelect={(item) => navigate(`/admin/categories/${item.id}`)} />

      {!canUpdate
        ? <ReadOnlyBanner warning={t('categories.readOnlyListHint', { defaultValue: 'Bạn chỉ có quyền xem danh mục; mọi thao tác thay đổi đều bị khóa.' })} />
        : paginatedState.warning
          ? <ReadOnlyBanner warning={paginatedState.warning} />
          : null}

      {/* N2: query cây lỗi trước đây bị nuốt im lặng — rơi vĩnh viễn về "Dạng
          danh sách" không cảnh báo, và bấm lại tab "Dạng cây" không refetch.
          Hiện rõ lỗi + nút "Thử lại" gọi đúng refetch của query cây (không
          nhầm với paginatedState.refetch() của chế độ danh sách phẳng). */}
      {isTreeError && (
        <Alert tone="danger" size="sm" className="mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span>
              {t('categories.treeLoadError', { defaultValue: 'Không tải được cây danh mục.' })}
              {treeError?.message ? ` ${treeError.message}` : ''}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchTree()}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      )}

      <FilterBar ariaLabel={t('categories.filterAria', { defaultValue: 'Bộ lọc danh mục' })} className="mt-4">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('categories.searchPlaceholder')}
          ariaLabel={t('categories.searchPlaceholder')}
          wrapperClassName="min-w-64 flex-1"
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
        <ColumnVisibilityToggle
          allColumns={hideableCategoryColumns}
          hiddenKeys={hiddenCategoryColumnKeys}
          onToggle={toggleCategoryColumn}
        />
        <div className="flex min-w-full flex-wrap items-center gap-3 border-t border-border pt-3">
          <div
            className="bb-seg"
            role="tablist"
            aria-label={t('categories.viewModeAria')}
          >
            <Button
              variant="unstyled"
              type="button"
              role="tab"
              aria-selected={isTreeShape}
              disabled={query.deleted}
              title={query.deleted ? t('categories.viewModeTreeUnavailableTrash') : undefined}
              className={isTreeShape ? 'active' : undefined}
              onClick={() => updateQuery({ visibility: 'ALL', sort: 'sortOrder:asc' }, { resetPage: true })}
            >
              {t('categories.viewModeTree')}
            </Button>
            <Button
              variant="unstyled"
              type="button"
              role="tab"
              aria-selected={!isTreeShape}
              className={!isTreeShape ? 'active' : undefined}
              onClick={() => updateQuery({ sort: 'updatedAt:desc' }, { resetPage: true })}
            >
              {t('categories.viewModeFlat')}
            </Button>
          </div>
          {resultSummary ? (
            <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {resultSummary}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {useTreeMode ? (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={expandAll}>
                  {t('categories.expandAll')}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={collapseAll}>
                  {t('categories.collapseAll')}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="min-h-9"
              disabled={isRefreshing}
              onClick={() => (useTreeMode ? refetchTree() : paginatedState.refetch())}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : undefined} aria-hidden="true" />
              {t('common.refresh', { defaultValue: 'Làm mới' })}
            </Button>
          </div>
        </div>
      </FilterBar>

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

      <span className="sr-only" role="status" aria-live="polite">
        {resultAnnounce}
      </span>

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
        actions={query.deleted
          ? [
            {
              label: t('products.restore'),
              onClick: () => runBulkTrash('restore'),
              disabled: Boolean(bulkProgress),
            },
            {
              label: t('common.permanentDelete'),
              tone: 'danger',
              onClick: () => runBulkTrash('permanentDelete'),
              disabled: Boolean(bulkProgress),
            },
          ]
          : [
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
            <ScreenSkeleton variant="table" count={8} showHeader={false} />
          ) : visibleTreeRows.length === 0 ? (
            <CategoryEmptyState
              searchTerm={searchTerm}
              query={query}
              canUpdate={canUpdate}
              onResetFilters={resetFilters}
              onCreate={() => navigate('/admin/categories/new')}
            />
          ) : (
            <div className="bb-card">
              <div className="bb-card-body bb-card-body--flush">
                <div className="table-scroll-wrap hide-on-mobile">
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={visibleTreeRows.map((r) => r.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <table className="cat-tree-table cat-table-tree">
                        <caption className="sr-only">{t('categories.tableCaption')}</caption>
                        <CategoryTreeTableHead canUpdate={canUpdate} selectAllCheckbox={selectAllCheckbox} hiddenKeys={hiddenCategoryColumnKeys} />
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
                <MobileCardList className="p-3">
                  {visibleTreeRows.map((cat) => mobileCategoryCard(cat))}
                </MobileCardList>
              </div>
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
              className="mt-4"
            />
          ) : null}

          {flatModeStatus === 'success' && flatItems.length === 0 ? (
            <StatePanel
              tone="neutral"
              title={hasActiveFilters
                ? t('categories.emptyFiltered', { defaultValue: 'Không có danh mục phù hợp' })
                : t('categories.empty')}
              description={hasActiveFilters
                ? t('categories.emptyFilteredDesc', { defaultValue: 'Hãy đổi từ khóa hoặc bộ lọc để xem kết quả khác.' })
                : t('categories.emptyDesc')}
              actionLabel={hasActiveFilters ? t('common.resetFilters') : canUpdate ? t('categories.create') : undefined}
              onAction={hasActiveFilters ? resetFilters : canUpdate ? () => navigate('/admin/categories/new') : undefined}
              className="mt-4"
            />
          ) : null}

          {flatModeStatus === 'loading' ? (
            <ScreenSkeleton variant="table" count={query.pageSize} showHeader={false} />
          ) : null}

          {flatModeStatus === 'success' && flatItems.length > 0 ? (
            <div className="bb-card mt-4">
              <div className="bb-card-body bb-card-body--flush">
                <div className="table-scroll-wrap hide-on-mobile">
                  <table className="cat-tree-table cat-table-flat" aria-busy={flatModeStatus === 'loading'}>
                    <caption className="sr-only">{t('categories.tableCaption')}</caption>
                    <CategoryFlatTableHead canUpdate={canUpdate} selectAllCheckbox={selectAllCheckbox} hiddenKeys={hiddenCategoryColumnKeys} />
                    <tbody>
                      {flatItems.map((cat) => renderCategoryRow(cat, 0))}
                    </tbody>
                  </table>
                </div>
                {flatModeStatus === 'success' && flatItems.length > 0 ? (
                  <MobileCardList className="p-3">
                    {flatItems.map((cat) => mobileCategoryCard(cat))}
                  </MobileCardList>
                ) : null}
              </div>
              {flatModeStatus === 'success' && (
                <div className="px-4">
                  <PaginationControls
                    pagination={paginatedState.pagination}
                    disabled={paginatedState.isFetching || Boolean(bulkProgress)}
                    onPageChange={(nextPage) => updateQuery({ page: nextPage })}
                  />
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </Screen>
  )
}
