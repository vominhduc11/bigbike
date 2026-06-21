import { useMemo, useState } from 'react'
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
import { Search, X, Plus, AlertTriangle } from 'lucide-react'
import { useDragSensors } from '../components/Sortable'
import { toast } from 'sonner'
import {
  createMenuItem,
  deleteMenuItem,
  fetchMenuDetail,
  fetchMenus,
  reorderMenuItems,
  updateMenuItem,
} from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { showConfirm } from '../lib/confirm'
import { formatText } from '../lib/formatters'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { Button } from '@/components/ui/button'
import {
  SYSTEM_SLOTS,
  EMPTY_ITEM,
  SLOT_CONTEXT_NOTES,
  safeMenuDetailCache,
  normalizeParentId,
  sameParent,
  sortMenuItems,
  buildMenuTree,
  flattenMenuTree,
  collectDescendantIds,
  isItemFormValid,
} from './menu/constants'
import { Modal } from './menu/Modal'
import { ItemForm } from './menu/ItemForm'
import { SortableMenuItem } from './menu/SortableMenuItem'

// ── Main screen ───────────────────────────────────────────────────────────────

export function MenuScreen({ canUpdate }) {
  const { t } = useTranslation()
  // Ngôn ngữ NỘI DUNG (nút VI/EN ở header). Chỉ đổi nhãn hiển thị của mục menu;
  // giao diện admin vẫn cố định tiếng Việt.
  const contentLang = useContentLang()
  const pickLabel = (item) => (contentLang === 'en' ? (item?.labelEn || item?.label || '') : (item?.label || ''))
  const queryClient = useQueryClient()

  // Tab selection (always one of SYSTEM_SLOTS.location)
  const [selectedLocation, setSelectedLocation] = useState(SYSTEM_SLOTS[0].location)

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

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['menu-detail', selectedMenuId],
    queryFn: () => fetchMenuDetail(selectedMenuId),
    enabled: Boolean(selectedMenuId),
  })
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
    // Admin VI/EN switch (strict English): ở EN chỉ hiện mục đã có nhãn tiếng Anh.
    const base = contentLang === 'en'
      ? flatMenuItems.filter((item) => (item.labelEn || '').trim() !== '')
      : flatMenuItems
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.labelEn || '').toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q),
    )
  }, [flatMenuItems, search, contentLang])

  // Parent options for "add item" form
  const parentOptions = flatMenuItems

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
        url: data.url,
        targetType: 'CUSTOM',
        targetId: null,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-detail', selectedMenuId] }),
    onError: (e) => toast.error(e?.status === 409 ? t('menus.deleteItemConflict') : (e.message || t('common.error'))),
    onSettled: () => setDeletingItemId(null),
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
      url: newItem.url.trim(),
      targetType: 'CUSTOM',
      targetId: null,
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
    const confirmed = await showConfirm(t('menus.deleteItemConfirm'), t('menus.deleteItemTitle'))
    if (!confirmed) return
    deleteItemMutation.mutate(itemId)
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
        targetType: 'CUSTOM',
        targetId: null,
        parentId: nextParentId,
        sortOrder: Number(editItemForm.sortOrder),
        openInNewTab: editItemForm.openInNewTab,
        cssClass: null,
        status: editItemForm.status || 'ACTIVE',
      },
    })
  }

  function openEditItem(item) {
    setEditItem(item)
    setEditItemForm({
      label: item.label || '',
      labelEn: item.labelEn || '',
      url: item.url || '',
      parentId: item.parentId || '',
      sortOrder: String(item.sortOrder ?? '0'),
      openInNewTab: item.openInNewTab === true,
      cssClass: '',
      status: item.status || 'ACTIVE',
    })
    setEditItemError('')
  }

  function openAddItem() {
    setNewItem(EMPTY_ITEM)
    setItemError('')
    setShowItemModal(true)
  }

  function selectSlot(location) {
    setSelectedLocation(location)
    setShowItemModal(false)
    setNewItem(EMPTY_ITEM)
    setItemError('')
    setEditItem(null)
    setEditItemError('')
    setSearch('')
  }

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

  const selectedSlot = SYSTEM_SLOTS.find((s) => s.location === selectedLocation) ?? SYSTEM_SLOTS[0]
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

      {/* ── Slot tabs ── */}
      <div className="menu-slot-tabs" role="tablist" aria-label={t('menus.selectMenu')}>
        {SYSTEM_SLOTS.map((slot) => {
          const summary = menuByLocation.get(slot.location)
          const isActive = slot.location === selectedLocation
          const missing = !summary
          const inactive = summary && summary.status !== 'ACTIVE'
          return (
            <button
              key={slot.location}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`menu-slot-tab${isActive ? ' is-active' : ''}${missing ? ' is-missing' : ''}`}
              onClick={() => selectSlot(slot.location)}
            >
              <span className="menu-slot-tab-title">
                {summary?.name?.trim() ? formatText(summary.name) : t(slot.titleKey)}
              </span>
              <span className="menu-slot-tab-meta">
                <span className="menu-slot-tab-loc">{slot.location}</span>
                {missing && (
                  <span className="menu-slot-tab-flag is-missing">{t('menus.slotMissingBadge')}</span>
                )}
                {inactive && (
                  <span className="menu-slot-tab-flag is-inactive">{t('menus.slotInactiveBadge')}</span>
                )}
              </span>
              <span className="menu-slot-tab-desc">{t(slot.descKey)}</span>
            </button>
          )
        })}
      </div>

      {/* ── Panel: items for the selected slot ── */}
      <main className="menu-panel">
        {slotMissing ? (
          <div className="menu-slot-missing">
            <AlertTriangle size={18} />
            <div>
              <strong>{t('menus.slotMissingTitle', { location: selectedSlot.location })}</strong>
              <p>{t('menus.slotMissingDesc')}</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="p-6">
            <StatePanel tone="info" title={t('menus.loading')} description={t('common.pleaseWait')} />
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
                <div className="menu-search-box">
                  <span className="menu-search-icon"><Search size={14} /></span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên hoặc URL..."
                    aria-label="Tìm kiếm mục menu"
                  />
                  {search && (
                    <button
                      type="button"
                      className="menu-search-clear"
                      onClick={() => setSearch('')}
                      aria-label="Xóa tìm kiếm"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Items table */}
            {menuItems.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-muted-foreground text-sm mb-3">
                  {t('menus.noItems')}
                </p>
                {canUpdate && (
                  <Button onClick={openAddItem}>
                    <Plus size={14} />
                    {t('menus.addItem')}
                  </Button>
                )}
              </div>
            ) : filteredFlatItems.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">
                Không tìm thấy mục nào phù hợp với &ldquo;{search}&rdquo;.
              </div>
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
                    <table className="menu-table">
                      <colgroup>
                        <col /><col /><col /><col />
                        {canUpdate && <col />}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="menu-grip-cell" />
                          <th>{t('menus.itemLabel')}</th>
                          <th>{t('menus.itemParent')}</th>
                          <th>{t('menus.itemUrl')}</th>
                          {canUpdate && <th />}
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
          onClose={() => { setShowItemModal(false); setNewItem(EMPTY_ITEM); setItemError('') }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setShowItemModal(false); setNewItem(EMPTY_ITEM); setItemError('') }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="add-item-form" loading={addItemMutation.isPending} disabled={!isItemFormValid(newItem)}>
                {t('common.add')}
              </Button>
            </>
          }
        >
          <form id="add-item-form" onSubmit={handleAddItem}>
            {SLOT_CONTEXT_NOTES[selectedLocation] && (
              <div className="menu-form-context-note">
                {SLOT_CONTEXT_NOTES[selectedLocation]}
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
              isNew
            />
          </form>
        </Modal>
      )}

      {/* ── Modal: Edit Item ── */}
      {editItem && (
        <Modal
          title={`${t('common.edit')}: ${pickLabel(editItem)}`}
          onClose={() => { setEditItem(null); setEditItemError('') }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setEditItem(null); setEditItemError('') }}>
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
              isNew={false}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}
