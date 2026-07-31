import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useDragSensors } from '../components/Sortable'
import { toast } from '@/lib/toast'
import {
  createMenuItem,
  deleteMenuItem,
  fetchCategoryTree,
  fetchMenuDetail,
  fetchMenus,
  reorderMenuItems,
  updateMenuItem,
} from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { queryKeys } from '../lib/queryKeys'
import { showConfirm } from '../lib/confirm'
import { formatText } from '../lib/formatters'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { Alert } from '@/components/ui/alert'
import { BulkActionBar } from '../components/BulkActionBar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SYSTEM_SLOTS,
  EMPTY_ITEM,
  SLOT_CONTEXT_NOTE_KEYS,
  safeMenuDetailCache,
  normalizeParentId,
  sameParent,
  sortMenuItems,
  buildMenuTree,
  flattenMenuTree,
  buildCategoryTreeOrder,
  collectDescendantIds,
  isItemFormValid,
  normalizeMenuUrlForSave,
} from './menu/constants'
import { Modal } from './menu/Modal'
import { ItemForm } from './menu/ItemForm'
import { SortableMenuItem } from './menu/SortableMenuItem'

// ── Main screen ───────────────────────────────────────────────────────────────

export function MenuScreen({ canUpdate, canReadCatalog }) {
  const { t } = useTranslation()
  // Ngôn ngữ NỘI DUNG (nút VI/EN ở header). Chỉ đổi nhãn hiển thị của mục menu;
  // giao diện admin vẫn cố định tiếng Việt.
  const contentLang = useContentLang()
  const pickLabel = (item) => (contentLang === 'en' ? (item?.labelEn || item?.label || '') : (item?.label || ''))
  const queryClient = useQueryClient()

  // Tab selection (always primary)
  const selectedLocation = 'primary'

  // Modals
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  // Forms
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [itemError, setItemError] = useState('')
  const [editItemForm, setEditItemForm] = useState(EMPTY_ITEM)
  const [editItemError, setEditItemError] = useState('')

  // Search
  const [search, setSearch] = useState('')

  // Per-row delete tracking
  const [deletingItemId, setDeletingItemId] = useState(null)
  // Per-row status-toggle tracking (O4)
  const [togglingItemId, setTogglingItemId] = useState(null)

  // Bulk selection (O6)
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Snapshot of the edit form taken at open time, to detect unsaved changes (F6)
  const editItemSnapshotRef = useRef(EMPTY_ITEM)

  // ── Queries ────────────────────────────────────────────────────────────────
  // Pull the full menu list once so we can map location → menuId without
  // adding a dedicated by-location admin endpoint.
  const { data: menusData, isLoading, isError, error } = useQuery({
    queryKey: ['menus'],
    queryFn: fetchMenus,
  })

  const warning = ''

  const menuByLocation = useMemo(() => {
    const map = new Map()
    ;(menusData?.items ?? []).forEach((m) => {
      if (m.location) map.set(m.location, m)
    })
    return map
  }, [menusData])

  const selectedMenuSummary = menuByLocation.get(selectedLocation) ?? null
  const selectedMenuId = selectedMenuSummary?.id ?? null

  const {
    data: detailData,
    isLoading: detailLoading,
    isError: detailIsError,
    error: detailError,
  } = useQuery({
    queryKey: ['menu-detail', selectedMenuId],
    queryFn: () => fetchMenuDetail(selectedMenuId),
    enabled: Boolean(selectedMenuId),
  })

  // Danh mục có sẵn cho picker "Chọn danh mục có sẵn" trong ItemForm. Luôn dùng
  // cây 'vi' (giống ô "Mục cha") để không mất option khi UI content-lang đang EN.
  const { data: categoriesResult, isError: categoriesIsError } = useQuery({
    queryKey: queryKeys.categoriesTree('vi'),
    queryFn: () => fetchCategoryTree('vi'),
    enabled: canReadCatalog,
    staleTime: 5 * 60 * 1000,
  })
  const categoryTreeOptions = useMemo(
    () => buildCategoryTreeOrder(categoriesResult?.items ?? []),
    [categoriesResult],
  )
  const menuDetail = detailData?.item ?? null
  const menuItems = useMemo(
    () => sortMenuItems((menuDetail?.items ?? []).filter((item) => item?.id && item.id !== 'unknown')),
    [menuDetail?.items],
  )
  const menuTree = useMemo(() => buildMenuTree(menuItems), [menuItems])
  const flatMenuItems = useMemo(() => flattenMenuTree(menuTree), [menuTree])
  const itemById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems])

  // Filtered items from search
  const filteredFlatItems = useMemo(() => {
    const base = flatMenuItems
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (item) =>
        (item.label || '').toLowerCase().includes(q) ||
        (item.labelEn || '').toLowerCase().includes(q) ||
        (item.url || '').toLowerCase().includes(q),
    )
  }, [flatMenuItems, search])

  // Parent options for "add item" form
  const parentOptions = flatMenuItems

  // Bulk selection helpers (O6) — scoped to currently visible/filtered rows
  const visibleItemIds = useMemo(() => filteredFlatItems.map((i) => i.id), [filteredFlatItems])
  const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedItemIds.has(id))
  const someVisibleSelected = !allVisibleSelected && visibleItemIds.some((id) => selectedItemIds.has(id))

  // Parent options for "edit item" form — exclude self and all descendants
  const editParentOptions = useMemo(() => {
    if (!editItem) return parentOptions
    const excluded = collectDescendantIds(menuItems, editItem.id)
    excluded.add(editItem.id)
    return parentOptions.filter((item) => !excluded.has(item.id))
  }, [editItem, menuItems, parentOptions])

  const sensors = useDragSensors()

  // ── Mutations ──────────────────────────────────────────────────────────────
  const reorderMutation = useMutation({
    mutationFn: (items) => reorderMenuItems(selectedMenuId, items),
    onSuccess: (data) => {
      queryClient.setQueryData(['menu-detail', selectedMenuId], safeMenuDetailCache(data))
    },
    onError: () => {
      toast.error(t('common.error'))
      queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })
    },
  })

  const addItemMutation = useMutation({
    mutationFn: (payload) => createMenuItem(selectedMenuId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })
      setShowItemModal(false)
      setNewItem(EMPTY_ITEM)
      toast.success(t('menus.addItem'))
    },
    onError: (e) => setItemError(e.message || t('common.error')),
  })

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data, parentChanged }) => {
      const patchPayload = {
        label: data.label,
        labelEn: data.labelEn,
        url: normalizeMenuUrlForSave(data.url),
        targetType: data.targetType || 'CUSTOM',
        targetId: data.targetType === 'CATEGORY' ? (data.targetId || null) : null,
        sortOrder: data.sortOrder,
        openInNewTab: data.openInNewTab,
        cssClass: null,
        status: data.status || 'ACTIVE',
        parentId: data.parentId || null,
      }
      const updated = await updateMenuItem(selectedMenuId, itemId, patchPayload)
      if (parentChanged) {
        const reorderPayload = menuItems.map((item) => ({
          id: item.id,
          parentId: item.id === itemId ? (data.parentId || null) : (item.parentId || null),
          sortOrder: item.id === itemId ? data.sortOrder : Number(item.sortOrder ?? 0),
        }))
        await reorderMenuItems(selectedMenuId, reorderPayload)
      }
      return updated
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })
      setEditItem(null)
      toast.success(t('menus.saveMenu'))
    },
    onError: (e) => setEditItemError(e.message || t('common.error')),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => deleteMenuItem(selectedMenuId, itemId),
    onMutate: (itemId) => setDeletingItemId(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })
      toast.success(t('menus.deleteItemSuccess', { defaultValue: 'Đã xoá mục menu.' }))
    },
    onError: (e) => toast.error(e?.status === 409 ? t('menus.deleteItemConflict') : (e.message || t('common.error'))),
    onSettled: () => setDeletingItemId(null),
  })

  // O4 — bật/tắt hiển thị mục ngay trên dòng, không cần mở modal sửa. Gửi lại
  // nguyên payload PATCH (giống submit form sửa) vì backend không hỗ trợ patch
  // từng phần một cách đáng tin cậy.
  const toggleStatusMutation = useMutation({
    mutationFn: ({ item, nextStatus }) => updateMenuItem(selectedMenuId, item.id, {
      label: item.label,
      labelEn: item.labelEn,
      url: normalizeMenuUrlForSave(item.url),
      targetType: item.targetType || 'CUSTOM',
      targetId: item.targetType === 'CATEGORY' ? (item.targetId || null) : null,
      sortOrder: item.sortOrder,
      openInNewTab: item.openInNewTab,
      cssClass: null,
      status: nextStatus,
      parentId: item.parentId || null,
    }),
    onMutate: ({ item }) => setTogglingItemId(item.id),
    onSuccess: (_data, { nextStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })
      toast.success(nextStatus === 'ACTIVE'
        ? t('menus.statusActivatedToast', { defaultValue: 'Đã bật hiển thị mục menu.' })
        : t('menus.statusDeactivatedToast', { defaultValue: 'Đã ẩn mục menu.' }))
    },
    onError: (e) => toast.error(e.message || t('common.error')),
    onSettled: () => setTogglingItemId(null),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeItem = itemById.get(active.id)
    const overItem = itemById.get(over.id)
    if (!activeItem || !overItem) return

    if (!sameParent(activeItem.parentId, overItem.parentId)) {
      toast.error(t('menus.dragSameParent'))
      return
    }

    const siblings = sortMenuItems(
      menuItems.filter((item) => sameParent(item.parentId, activeItem.parentId)),
    )
    const oldIndex = siblings.findIndex((item) => item.id === active.id)
    const newIndex = siblings.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex)
    const nextSortById = new Map(reorderedSiblings.map((item, idx) => [item.id, idx]))

    queryClient.setQueryData(['menu-detail', selectedMenuId], (prev) => {
      if (!prev?.item) return prev
      const updated = prev.item.items.map((item) =>
        nextSortById.has(item.id) ? { ...item, sortOrder: nextSortById.get(item.id) } : item,
      )
      return { ...prev, item: { ...prev.item, items: updated } }
    })

    const reorderPayload = menuItems.map((item) => ({
      id: item.id,
      parentId: item.parentId || null,
      sortOrder: nextSortById.has(item.id) ? nextSortById.get(item.id) : Number(item.sortOrder ?? 0),
    }))
    reorderMutation.mutate(reorderPayload)
  }

  function handleAddItem(e) {
    e.preventDefault()
    setItemError('')
    addItemMutation.mutate({
      label: newItem.label.trim(),
      labelEn: newItem.labelEn.trim(),
      url: normalizeMenuUrlForSave(newItem.url),
      targetType: newItem.targetType || 'CUSTOM',
      targetId: newItem.targetType === 'CATEGORY' ? (newItem.targetId || null) : null,
      parentId: newItem.parentId || null,
      sortOrder: Number(newItem.sortOrder),
      openInNewTab: newItem.openInNewTab,
      cssClass: null,
      status: newItem.status || 'ACTIVE',
    })
  }

  async function handleDeleteItem(itemId) {
    const childCount = menuItems.filter((i) => sameParent(i.parentId, itemId)).length
    if (childCount > 0) {
      toast.error(t('menus.deleteItemHasChildren', { count: childCount }))
      return
    }
    const label = pickLabel(itemById.get(itemId)) || t('menus.itemLabel')
    const confirmed = await showConfirm(
      t('menus.deleteItemConfirmNamed', {
        label,
        defaultValue: 'Xoá mục "{{label}}"? Khách sẽ không còn thấy mục này trên menu.',
      }),
      t('menus.deleteItemTitle'),
      { variant: 'danger', confirmLabel: t('common.delete') },
    )
    if (!confirmed) return
    deleteItemMutation.mutate(itemId)
  }

  // O4 — bật/tắt hiển thị trực tiếp trên dòng
  function handleToggleItemStatus(item) {
    const nextStatus = item.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
    toggleStatusMutation.mutate({ item, nextStatus })
  }

  // O6 — chọn/bỏ chọn theo dòng và theo toàn bộ danh sách đang hiển thị
  function toggleItemSelected(itemId) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleItemIds.forEach((id) => next.delete(id))
      } else {
        visibleItemIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function clearItemSelection() {
    setSelectedItemIds(new Set())
  }

  async function handleBulkDeleteItems() {
    if (selectedItemIds.size === 0) return
    const ids = [...selectedItemIds]
    const blocked = ids.filter((id) => menuItems.filter((i) => sameParent(i.parentId, id)).length > 0)
    const deletable = ids.filter((id) => !blocked.includes(id))
    if (blocked.length > 0) {
      toast.error(t('menus.bulkDeleteBlocked', {
        count: blocked.length,
        defaultValue: '{{count}} mục không thể xoá vì còn mục con — hãy xoá hoặc di chuyển mục con ra trước.',
      }))
    }
    if (deletable.length === 0) return
    const confirmed = await showConfirm(
      t('menus.bulkDeleteConfirm', {
        count: deletable.length,
        defaultValue: 'Xoá {{count}} mục menu đã chọn? Khách sẽ không còn thấy các mục này trên menu.',
      }),
      t('menus.bulkDeleteConfirmTitle', { defaultValue: 'Xoá nhiều mục menu' }),
      { variant: 'danger', confirmLabel: t('common.delete') },
    )
    if (!confirmed) return
    setBulkDeleting(true)
    try {
      const results = await Promise.allSettled(deletable.map((id) => deleteMenuItem(selectedMenuId, id)))
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })
      setSelectedItemIds(new Set())
      if (succeeded > 0) {
        toast.success(t('menus.bulkDeleteSuccess', {
          count: succeeded,
          defaultValue: 'Đã xoá {{count}} mục menu.',
        }))
      }
      if (succeeded < deletable.length) toast.error(t('common.error'))
    } finally {
      setBulkDeleting(false)
    }
  }

  function handleEditItem(e) {
    e.preventDefault()
    if (!editItem) return
    setEditItemError('')
    const nextParentId = normalizeParentId(editItemForm.parentId)
    const parentChanged = nextParentId !== normalizeParentId(editItem.parentId)
    updateItemMutation.mutate({
      itemId: editItem.id,
      parentChanged,
      data: {
        label: editItemForm.label.trim(),
        labelEn: editItemForm.labelEn.trim(),
        url: editItemForm.url.trim(),
        targetType: editItemForm.targetType || 'CUSTOM',
        targetId: editItemForm.targetType === 'CATEGORY' ? (editItemForm.targetId || null) : null,
        parentId: nextParentId,
        sortOrder: Number(editItemForm.sortOrder),
        openInNewTab: editItemForm.openInNewTab,
        cssClass: null,
        status: editItemForm.status || 'ACTIVE',
      },
    })
  }

  function openEditItem(item) {
    const form = {
      label: item.label || '',
      labelEn: item.labelEn || '',
      url: item.url || '',
      parentId: item.parentId || '',
      sortOrder: String(item.sortOrder ?? '0'),
      openInNewTab: item.openInNewTab === true,
      cssClass: '',
      status: item.status || 'ACTIVE',
      targetType: item.targetType || 'CUSTOM',
      targetId: item.targetId || '',
    }
    setEditItem(item)
    setEditItemForm(form)
    editItemSnapshotRef.current = form
    setEditItemError('')
  }

  function openAddItem() {
    setNewItem(EMPTY_ITEM)
    setItemError('')
    setShowItemModal(true)
  }

  // F6 — đóng modal Thêm mục: hỏi xác nhận nếu form đang khác EMPTY_ITEM (còn
  // thay đổi chưa lưu). Dùng chung cho nút X / Esc / click ra ngoài (đều đi qua
  // onClose của Modal) và nút Huỷ ở footer.
  async function closeAddModal() {
    const dirty = JSON.stringify(newItem) !== JSON.stringify(EMPTY_ITEM)
    if (dirty) {
      const confirmed = await showConfirm(
        t('menus.discardConfirm', { defaultValue: 'Bạn đang có thay đổi chưa lưu. Đóng cửa sổ này sẽ mất các thay đổi đó. Tiếp tục?' }),
        t('menus.discardConfirmTitle', { defaultValue: 'Huỷ thay đổi?' }),
      )
      if (!confirmed) return
    }
    setShowItemModal(false)
    setNewItem(EMPTY_ITEM)
    setItemError('')
  }

  // F6 — đóng modal Sửa mục: so với snapshot lấy lúc mở modal thay vì EMPTY_ITEM.
  async function closeEditModal() {
    const dirty = JSON.stringify(editItemForm) !== JSON.stringify(editItemSnapshotRef.current)
    if (dirty) {
      const confirmed = await showConfirm(
        t('menus.discardConfirm', { defaultValue: 'Bạn đang có thay đổi chưa lưu. Đóng cửa sổ này sẽ mất các thay đổi đó. Tiếp tục?' }),
        t('menus.discardConfirmTitle', { defaultValue: 'Huỷ thay đổi?' }),
      )
      if (!confirmed) return
    }
    setEditItem(null)
    setEditItemError('')
  }


  // O3 — Ctrl/Cmd+S để lưu ngay trong modal Thêm/Sửa mục, không bắt buộc bấm nút.
  useSaveShortcut(showItemModal, () => {
    if (isItemFormValid(newItem)) document.getElementById('add-item-form')?.requestSubmit()
  })
  useSaveShortcut(Boolean(editItem), () => {
    if (isItemFormValid(editItemForm)) document.getElementById('edit-item-form')?.requestSubmit()
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) return <StatePanel tone="info" title={t('menus.loading')} description={t('common.pleaseWait')} />
  if (isError) return (
    <StatePanel
      tone="danger"
      title={t('menus.loadError')}
      description={error?.message}
      actionLabel={t('common.retry')}
      onAction={() => queryClient.invalidateQueries({ queryKey: ['menus'] })}
    />
  )

  const selectedSlot = SYSTEM_SLOTS[0]
  const slotMissing = !selectedMenuSummary

  return (
    <div>
      {/* ── Header (no create-menu CTA — slots are fixed) ── */}
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('menus.eyebrow')}</p>
          <h1>{t('menus.title')}</h1>
          <p className="bb-muted">{t('menus.description')}</p>
        </div>
      </div>

      {warning && <ReadOnlyBanner warning={warning} />}
      {!canReadCatalog ? (
        <Alert tone="warning">
          Cần quyền catalog.read để tải và chọn liên kết danh mục. Các loại liên kết menu khác vẫn dùng được.
        </Alert>
      ) : null}

      {/* ── Panel: items for the selected slot ── */}
      <main
        className="menu-panel"
        id="menu-panel"
        tabIndex={0}
      >
        {slotMissing ? (
          <div className="p-6">
            <Alert tone="warning">
              <strong>{t('menus.slotMissingTitle', { location: selectedSlot.location })}</strong>
              <p className="mt-0.5">{t('menus.slotMissingDesc')}</p>
            </Alert>
          </div>
        ) : detailLoading ? (
          <div className="p-6">
            <StatePanel tone="info" title={t('menus.loading')} description={t('common.pleaseWait')} />
          </div>
        ) : detailIsError ? (
          <div className="p-6">
            <StatePanel
              tone="danger"
              title={t('menus.loadError')}
              description={detailError?.message}
              actionLabel={t('common.retry')}
              onAction={() => queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] })}
            />
          </div>
        ) : menuDetail ? (
          <>
            {/* Panel header */}
            <div className="menu-panel-head">
              <div className="menu-panel-head-info">
                <h2>{formatText(menuDetail.name)}</h2>
                <span className="menu-panel-head-loc">{menuDetail.location}</span>
              </div>
              {canUpdate && (
                <Button className="shrink-0" onClick={openAddItem}>
                  <Plus size={14} />
                  {t('menus.addItem')}
                </Button>
              )}
            </div>

            {/* Search toolbar */}
            {menuItems.length > 0 && (
              <div className="menu-panel-toolbar">
                <FilterSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={t('menus.searchPlaceholder', { defaultValue: 'Tìm theo tên hoặc URL...' })}
                  ariaLabel={t('menus.searchAria', { defaultValue: 'Tìm kiếm mục menu' })}
                />
              </div>
            )}

            {/* O6 — bulk action bar (chỉ hiện khi đã chọn ít nhất 1 mục) */}
            {canUpdate && selectedItemIds.size > 0 && (
              <BulkActionBar
                selectedCount={selectedItemIds.size}
                onClear={clearItemSelection}
                closeLabel={t('common.deselect', { defaultValue: 'Bỏ chọn' })}
                actions={[
                  {
                    label: t('menus.bulkDelete', { defaultValue: 'Xoá đã chọn' }),
                    tone: 'danger',
                    onClick: handleBulkDeleteItems,
                    disabled: bulkDeleting,
                  },
                ]}
              />
            )}

            {/* Items table */}
            {menuItems.length === 0 ? (
              <StatePanel
                tone="neutral"
                title={t('menus.noItems')}
                actionLabel={canUpdate ? t('menus.addItem') : undefined}
                onAction={canUpdate ? openAddItem : undefined}
              />
            ) : filteredFlatItems.length === 0 ? (
              <StatePanel
                tone="neutral"
                title={t('menus.searchNoMatch', { query: search, defaultValue: 'Không tìm thấy mục nào phù hợp với “{{query}}”.' })}
              />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredFlatItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="menu-table-wrap">
                    {/* min-width buộc cuộn ngang trên mobile thay vì ép cột chật (menu-table-wrap đã overflow:auto). */}
                    <table className="menu-table min-w-[560px]">
                      <colgroup>
                        {canUpdate && <col className="menu-col-check" />}
                        <col className="menu-col-grip" />
                        <col className="menu-col-label" />
                        <col className="menu-col-parent" />
                        <col className="menu-col-url" />
                        {canUpdate && <col className="menu-col-actions" />}
                      </colgroup>
                      <thead>
                        <tr>
                          {canUpdate && (
                            <th className="menu-grip-cell" scope="col">
                              <Checkbox
                                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                                onCheckedChange={toggleSelectAllVisible}
                                disabled={bulkDeleting || visibleItemIds.length === 0}
                                aria-label={t('menus.selectAllAria', { defaultValue: 'Chọn tất cả mục đang hiển thị' })}
                              />
                            </th>
                          )}
                          <th className="menu-grip-cell" scope="col">
                            <span className="sr-only">{t('menus.itemReorder', { defaultValue: 'Sắp xếp' })}</span>
                          </th>
                          <th scope="col">{t('menus.itemLabel')}</th>
                          <th scope="col">{t('menus.itemParent')}</th>
                          <th scope="col">{t('menus.itemUrl')}</th>
                          {canUpdate && (
                            <th scope="col">
                              <span className="sr-only">{t('menus.itemActions', { defaultValue: 'Thao tác' })}</span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFlatItems.map((item) => (
                          <SortableMenuItem
                            key={item.id}
                            item={item}
                            displayLabel={pickLabel(item)}
                            parentLabel={item.parentId ? (pickLabel(itemById.get(item.parentId)) || t('menus.parentMissing')) : ''}
                            rootLabel={t('menus.parentRoot')}
                            canUpdate={canUpdate}
                            onEdit={openEditItem}
                            onDelete={handleDeleteItem}
                            isDeleting={deletingItemId === item.id}
                            selected={selectedItemIds.has(item.id)}
                            onToggleSelect={() => toggleItemSelected(item.id)}
                            onToggleStatus={handleToggleItemStatus}
                            isToggling={togglingItemId === item.id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        ) : null}
      </main>

      {/* ── Modal: Add Item ── */}
      {showItemModal && (
        <Modal
          title={`${t('menus.addItem')} — ${formatText(menuDetail?.name ?? '')}`}
          description={t('menus.addItemDialogDesc', { defaultValue: 'Thêm một mục mới vào thanh điều hướng.' })}
          onClose={closeAddModal}
          footer={
            <>
              <Button variant="outline" onClick={closeAddModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="add-item-form" loading={addItemMutation.isPending} disabled={!isItemFormValid(newItem)}>
                {t('common.add')}
              </Button>
            </>
          }
        >
          <form id="add-item-form" onSubmit={handleAddItem}>
            {SLOT_CONTEXT_NOTE_KEYS[selectedLocation] && (
              <div className="menu-form-context-note">
                {t(SLOT_CONTEXT_NOTE_KEYS[selectedLocation].key, { defaultValue: SLOT_CONTEXT_NOTE_KEYS[selectedLocation].defaultValue })}
              </div>
            )}
            {itemError && (
              <p className="mb-3 text-sm text-danger">
                {itemError}
              </p>
            )}
            <ItemForm
              value={newItem}
              onChange={(patch) => setNewItem((p) => ({ ...p, ...patch }))}
              parentOptions={parentOptions}
              categoryOptions={categoryTreeOptions}
              categoryError={canReadCatalog && categoriesIsError}
              isNew
            />
          </form>
        </Modal>
      )}

      {/* ── Modal: Edit Item ── */}
      {editItem && (
        <Modal
          title={`${t('common.edit')}: ${pickLabel(editItem)}`}
          description={t('menus.editItemDialogDesc', { defaultValue: 'Chỉnh sửa mục điều hướng.' })}
          onClose={closeEditModal}
          footer={
            <>
              <Button variant="outline" onClick={closeEditModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="edit-item-form" loading={updateItemMutation.isPending} disabled={!isItemFormValid(editItemForm)}>
                {t('menus.saveMenu')}
              </Button>
            </>
          }
        >
          <form id="edit-item-form" onSubmit={handleEditItem}>
            {editItemError && (
              <p className="mb-3 text-sm text-danger">
                {editItemError}
              </p>
            )}
            <ItemForm
              value={editItemForm}
              onChange={(patch) => setEditItemForm((p) => ({ ...p, ...patch }))}
              parentOptions={editParentOptions}
              categoryOptions={categoryTreeOptions}
              categoryError={canReadCatalog && categoriesIsError}
              isNew={false}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}
