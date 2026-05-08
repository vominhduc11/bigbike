import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Search, X, Plus, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  createMenuItem,
  deleteMenuItem,
  fetchBrands,
  fetchCategories,
  fetchContent,
  fetchMenuDetail,
  fetchMenus,
  fetchProducts,
  reorderMenuItems,
  updateMenuItem,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'

// ── System slots ───────────────────────────────────────────────────────────────
// Mirrors backend `MenuLocations.SYSTEM_LOCATIONS`. The storefront only renders
// menus at these locations, so the admin UI exposes them as fixed tabs and never
// allows creating/deleting menu containers.

const SYSTEM_SLOTS = [
  {
    location: 'primary',
    titleKey: 'menus.slotPrimaryTitle',
    descKey: 'menus.slotPrimaryDesc',
    fallbackName: 'Header Menu',
  },
  {
    location: 'footer',
    titleKey: 'menus.slotFooterTitle',
    descKey: 'menus.slotFooterDesc',
    fallbackName: 'Footer Navigation',
  },
  {
    location: 'guide',
    titleKey: 'menus.slotGuideTitle',
    descKey: 'menus.slotGuideDesc',
    fallbackName: 'Buying Guide Menu',
  },
]

// ── Constants ──────────────────────────────────────────────────────────────────

const TARGET_TYPES = ['CUSTOM', 'CATEGORY', 'PRODUCT', 'BRAND', 'PAGE', 'ARTICLE']

const EMPTY_ITEM = {
  label: '',
  url: '',
  sortOrder: '0',
  parentId: '',
  targetType: 'CUSTOM',
  targetId: '',
  openInNewTab: false,
  cssClass: '',
  status: 'ACTIVE',
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function normalizeTargetType(targetType) {
  return TARGET_TYPES.includes(targetType) ? targetType : 'CUSTOM'
}

function toTargetUrl(targetType, item) {
  const slug = item?.slug
  if (!slug) return ''
  switch (targetType) {
    case 'CATEGORY': return `/danh-muc-san-pham/${slug}/`
    case 'PRODUCT':  return `/product/${slug}/`
    case 'BRAND':    return `/brands/${slug}/`
    case 'PAGE':     return `/${slug}/`
    case 'ARTICLE':  return `/tin-tuc/${slug}/`
    default:         return ''
  }
}

function toTargetOption(targetType, item) {
  return {
    id: item?.id || '',
    label: item?.name || item?.title || item?.slug || item?.id,
    slug: item?.slug || '',
    url: toTargetUrl(targetType, item),
  }
}

async function fetchMenuTargetOptions(targetType, search) {
  const query = { pageSize: 100, search, sort: 'name:asc' }
  switch (targetType) {
    case 'CATEGORY': {
      const data = await fetchCategories(query)
      return (data.items ?? []).map((item) => toTargetOption(targetType, item))
    }
    case 'PRODUCT': {
      const data = await fetchProducts({ ...query, sort: 'updatedAt:desc' })
      return (data.items ?? []).map((item) => toTargetOption(targetType, item))
    }
    case 'BRAND': {
      const data = await fetchBrands(query)
      return (data.items ?? []).map((item) => toTargetOption(targetType, item))
    }
    case 'PAGE': {
      const data = await fetchContent({ ...query, type: 'PAGE', publishStatus: 'ALL' })
      return (data.items ?? []).map((item) => toTargetOption(targetType, item))
    }
    case 'ARTICLE': {
      const data = await fetchContent({ ...query, type: 'ARTICLE', publishStatus: 'ALL' })
      return (data.items ?? []).map((item) => toTargetOption(targetType, item))
    }
    default:
      return []
  }
}

function normalizeParentId(parentId) {
  return parentId || ''
}

function sameParent(a, b) {
  return normalizeParentId(a) === normalizeParentId(b)
}

function sortMenuItems(items) {
  return [...items].sort((a, b) => {
    const byOrder = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    if (byOrder !== 0) return byOrder
    return String(a.label || '').localeCompare(String(b.label || ''))
  })
}

function buildMenuTree(items) {
  const byId = new Map()
  sortMenuItems(items).forEach((item) => {
    byId.set(item.id, { ...item, children: [] })
  })
  const roots = []
  byId.forEach((node) => {
    const parentId = normalizeParentId(node.parentId)
    const parent = parentId ? byId.get(parentId) : null
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => {
      const byOrder = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
      if (byOrder !== 0) return byOrder
      return String(a.label || '').localeCompare(String(b.label || ''))
    })
    nodes.forEach((node) => sortChildren(node.children))
  }
  sortChildren(roots)
  return roots
}

function flattenMenuTree(nodes, depth = 0) {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenMenuTree(node.children, depth + 1),
  ])
}

function collectDescendantIds(items, itemId) {
  const childrenByParent = new Map()
  items.forEach((item) => {
    const parentId = normalizeParentId(item.parentId)
    if (!parentId) return
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
    childrenByParent.get(parentId).push(item.id)
  })
  const descendants = new Set()
  const visit = (id) => {
    for (const childId of childrenByParent.get(id) ?? []) {
      if (descendants.has(childId)) continue
      descendants.add(childId)
      visit(childId)
    }
  }
  visit(itemId)
  return descendants
}

function formatParentOption(item) {
  return `${'── '.repeat(item.depth)}${item.label}`
}

function isValidCustomUrl(url) {
  const v = url.trim()
  if (!v) return false
  if (v.startsWith('/') || v.startsWith('#') || v.startsWith('tel:') || v.startsWith('mailto:')) return true
  try { new URL(v); return true } catch { return false }
}

function targetTypeLabel(t, targetType) {
  switch (normalizeTargetType(targetType)) {
    case 'CATEGORY': return t('menus.targetCategory')
    case 'PRODUCT':  return t('menus.targetProduct')
    case 'BRAND':    return t('menus.targetBrand')
    case 'PAGE':     return t('menus.targetPage')
    case 'ARTICLE':  return t('menus.targetArticle')
    default:         return t('menus.targetCustom')
  }
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="menu-modal-overlay" onClick={handleOverlayClick}>
      <div className="menu-modal" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
        <div className="menu-modal-header">
          <h2 id="menu-modal-title">{title}</h2>
          <button type="button" className="menu-modal-close" onClick={onClose} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="menu-modal-body">{children}</div>
        {footer && <div className="menu-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

function MenuParentSelect({ value, onChange, options, label, rootLabel }) {
  return (
    <label className="form-field">
      {label}
      <select
        className="control-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{rootLabel}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {formatParentOption(item)}
          </option>
        ))}
      </select>
    </label>
  )
}

function MenuTargetFields({ value, onChange, t }) {
  const targetType = normalizeTargetType(value.targetType)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)

  const targetQuery = useQuery({
    queryKey: ['menu-target-options', targetType, debouncedSearch],
    queryFn: () => fetchMenuTargetOptions(targetType, debouncedSearch),
    enabled: targetType !== 'CUSTOM',
    staleTime: 5 * 60_000,
  })
  const options = targetQuery.data ?? []
  const hasSelectedOption = options.some((item) => item.id === value.targetId)

  function updateTargetType(nextType) {
    onChange({ targetType: nextType, targetId: '', url: nextType === 'CUSTOM' ? value.url : '' })
    setSearch('')
  }

  function updateTargetId(nextId) {
    const selected = options.find((item) => item.id === nextId)
    onChange({
      targetId: nextId,
      url: selected?.url || '',
      label: value.label?.trim() ? value.label : (selected?.label || value.label),
    })
  }

  return (
    <>
      <label className="form-field">
        {t('menus.targetType')}
        <select
          className="control-select"
          value={targetType}
          onChange={(e) => updateTargetType(e.target.value)}
        >
          <option value="CATEGORY">{t('menus.targetCategory')}</option>
          <option value="PRODUCT">{t('menus.targetProduct')}</option>
          <option value="BRAND">{t('menus.targetBrand')}</option>
          <option value="PAGE">{t('menus.targetPage')}</option>
          <option value="ARTICLE">{t('menus.targetArticle')}</option>
          <option value="CUSTOM">{t('menus.targetCustom')}</option>
        </select>
      </label>

      {targetType === 'CUSTOM' ? (
        <label className="form-field">
          {t('menus.itemUrlCustom')}
          <input
            className="control-input"
            value={value.url}
            onChange={(e) => onChange({ url: e.target.value, targetId: '' })}
            placeholder="/danh-muc-san-pham/... hoặc https://..."
            required
          />
          {value.url.trim() && !isValidCustomUrl(value.url) && (
            <small style={{ color: 'var(--admin-color-status-danger-text)', marginTop: 2 }}>
              URL không hợp lệ. Dùng đường dẫn bắt đầu bằng / hoặc URL đầy đủ.
            </small>
          )}
        </label>
      ) : (
        <>
          <label className="form-field">
            {t('menus.targetSearch')}
            <input
              className="control-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('menus.targetSearchPlaceholder')}
            />
          </label>
          <label className="form-field">
            {t('menus.targetRecord')}
            <select
              className="control-select"
              value={value.targetId}
              onChange={(e) => updateTargetId(e.target.value)}
              required
            >
              <option value="">
                {targetQuery.isLoading ? t('menus.targetLoading') : t('menus.targetSelectPlaceholder')}
              </option>
              {value.targetId && !hasSelectedOption && (
                <option value={value.targetId}>{value.label || value.url}</option>
              )}
              {options.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            {t('menus.targetUrlPreview')}
            <input className="control-input" value={value.url} readOnly />
          </label>
          {!targetQuery.isLoading && options.length === 0 && (
            <small style={{ color: 'var(--admin-color-text-muted)' }}>
              {t('menus.targetEmpty')}
            </small>
          )}
        </>
      )}
    </>
  )
}

function ItemForm({ value, onChange, parentOptions, t, isNew }) {
  return (
    <div className="form-grid">
      <label className="form-field">
        {t('menus.itemLabel')}
        <input
          className="control-input"
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Tên hiển thị"
          required
          autoFocus={isNew}
        />
      </label>
      <MenuTargetFields value={value} t={t} onChange={onChange} />
      <MenuParentSelect
        label={t('menus.itemParent')}
        rootLabel={t('menus.parentRoot')}
        value={value.parentId}
        options={parentOptions}
        onChange={(v) => onChange({ parentId: v })}
      />
      <label className="form-field">
        {t('menus.formSortOrder')}
        <input
          className="control-input"
          type="number"
          min="0"
          value={value.sortOrder}
          onChange={(e) => onChange({ sortOrder: e.target.value })}
        />
      </label>
      <label className="form-field">
        {t('menus.itemCssClass')}
        <input
          className="control-input"
          value={value.cssClass}
          placeholder="highlight"
          onChange={(e) => onChange({ cssClass: e.target.value })}
        />
      </label>
      <label className="form-field">
        {t('menus.itemStatus')}
        <select
          className="control-select"
          value={value.status}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </label>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={value.openInNewTab}
          onChange={(e) => onChange({ openInNewTab: e.target.checked })}
        />
        {t('menus.itemOpenInNewTab')}
      </label>
    </div>
  )
}

function SortableMenuItem({ item, parentLabel, rootLabel, typeLabel, canUpdate, onEdit, onDelete, isDeleting }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const isInactive = item.status === 'INACTIVE'

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={isInactive ? 'is-inactive' : ''}
    >
      <td className="menu-grip-cell">
        {canUpdate && (
          <button
            type="button"
            className="menu-grab-btn"
            title="Kéo để sắp xếp (cùng cấp)"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={15} />
          </button>
        )}
      </td>
      <td style={{ paddingLeft: `${8 + item.depth * 18}px` }}>
        <div className="menu-item-label-cell">
          {item.depth > 0 && (
            <span className="menu-item-depth">L{item.depth + 1}</span>
          )}
          <span className="menu-item-name">{item.label}</span>
          {isInactive && <span className="menu-item-badge-inactive">Ẩn</span>}
        </div>
      </td>
      <td>
        <span className="menu-item-parent-cell">
          {parentLabel || <span style={{ color: 'var(--admin-color-text-muted)' }}>{rootLabel}</span>}
        </span>
      </td>
      <td>
        <span className="menu-item-url-cell" title={item.url}>{item.url}</span>
      </td>
      <td>
        <span className="menu-item-type-cell">{typeLabel}</span>
      </td>
      {canUpdate && (
        <td className="menu-item-actions-cell">
          <div className="menu-row-actions">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '3px 8px' }}
              onClick={() => onEdit(item)}
              title="Chỉnh sửa mục này"
              disabled={isDeleting}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ padding: '3px 8px' }}
              onClick={() => onDelete(item.id)}
              title="Xoá mục này"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function MenuScreen({ canUpdate }) {
  const { t } = useTranslation()
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

  const menus = menusData?.items ?? []
  const warning = menusData?.mode === 'mock' ? (menusData?.warning ?? '') : ''

  const menuByLocation = useMemo(() => {
    const map = new Map()
    menus.forEach((m) => {
      if (m.location) map.set(m.location, m)
    })
    return map
  }, [menus])

  const selectedMenuSummary = menuByLocation.get(selectedLocation) ?? null
  const selectedMenuId = selectedMenuSummary?.id ?? null

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['menu-detail', selectedMenuId],
    queryFn: () => fetchMenuDetail(selectedMenuId),
    enabled: Boolean(selectedMenuId),
  })
  const menuDetail = detailData?.item ?? null
  const menuItems = useMemo(() => sortMenuItems(menuDetail?.items ?? []), [menuDetail?.items])
  const menuTree = useMemo(() => buildMenuTree(menuItems), [menuItems])
  const flatMenuItems = useMemo(() => flattenMenuTree(menuTree), [menuTree])
  const itemById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems])

  // Filtered items from search
  const filteredFlatItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return flatMenuItems
    return flatMenuItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q),
    )
  }, [flatMenuItems, search])

  // Parent options for "add item" form
  const parentOptions = flatMenuItems

  // Parent options for "edit item" form — exclude self and all descendants
  const editParentOptions = useMemo(() => {
    if (!editItem) return parentOptions
    const excluded = collectDescendantIds(menuItems, editItem.id)
    excluded.add(editItem.id)
    return parentOptions.filter((item) => !excluded.has(item.id))
  }, [editItem, menuItems, parentOptions])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Mutations ──────────────────────────────────────────────────────────────
  const reorderMutation = useMutation({
    mutationFn: (items) => reorderMenuItems(selectedMenuId, items),
    onSuccess: (data) => {
      queryClient.setQueryData(['menu-detail', selectedMenuId], data)
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
        url: data.url,
        targetType: data.targetType,
        targetId: data.targetType === 'CUSTOM' ? null : (data.targetId || null),
        sortOrder: data.sortOrder,
        openInNewTab: data.openInNewTab,
        cssClass: data.cssClass?.trim() || null,
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
    onError: (e) => toast.error(e.message || t('common.error')),
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
    const targetType = normalizeTargetType(newItem.targetType)
    if (!newItem.label.trim()) { setItemError(t('menus.linkRequired')); return }
    if (targetType === 'CUSTOM' && !newItem.url.trim()) { setItemError(t('menus.linkRequired')); return }
    if (targetType === 'CUSTOM' && newItem.url.trim() && !isValidCustomUrl(newItem.url)) {
      setItemError('URL không hợp lệ. Dùng đường dẫn / hoặc URL đầy đủ.'); return
    }
    if (targetType !== 'CUSTOM' && !newItem.targetId) { setItemError(t('menus.targetRequired')); return }
    setItemError('')
    addItemMutation.mutate({
      label: newItem.label.trim(),
      url: newItem.url.trim(),
      targetType,
      targetId: targetType === 'CUSTOM' ? null : newItem.targetId,
      parentId: newItem.parentId || null,
      sortOrder: Number(newItem.sortOrder),
      openInNewTab: newItem.openInNewTab,
      cssClass: newItem.cssClass.trim() || null,
      status: newItem.status || 'ACTIVE',
    })
  }

  async function handleDeleteItem(itemId) {
    const confirmed = await showConfirm(t('menus.deleteItemConfirm'), t('menus.deleteItemTitle'))
    if (!confirmed) return
    deleteItemMutation.mutate(itemId)
  }

  function handleEditItem(e) {
    e.preventDefault()
    const targetType = normalizeTargetType(editItemForm.targetType)
    if (!editItemForm.label.trim()) { setEditItemError(t('menus.linkRequired')); return }
    if (targetType === 'CUSTOM' && !editItemForm.url.trim()) { setEditItemError(t('menus.linkRequired')); return }
    if (targetType === 'CUSTOM' && editItemForm.url.trim() && !isValidCustomUrl(editItemForm.url)) {
      setEditItemError('URL không hợp lệ. Dùng đường dẫn / hoặc URL đầy đủ.'); return
    }
    if (targetType !== 'CUSTOM' && !editItemForm.targetId) { setEditItemError(t('menus.targetRequired')); return }
    setEditItemError('')
    const nextParentId = normalizeParentId(editItemForm.parentId)
    const parentChanged = nextParentId !== normalizeParentId(editItem.parentId)
    updateItemMutation.mutate({
      itemId: editItem.id,
      parentChanged,
      data: {
        label: editItemForm.label.trim(),
        url: editItemForm.url.trim(),
        targetType,
        targetId: targetType === 'CUSTOM' ? '' : editItemForm.targetId,
        parentId: nextParentId,
        sortOrder: Number(editItemForm.sortOrder),
        openInNewTab: editItemForm.openInNewTab,
        cssClass: editItemForm.cssClass?.trim() || null,
        status: editItemForm.status || 'ACTIVE',
      },
    })
  }

  function openEditItem(item) {
    const targetType = normalizeTargetType(item.targetType)
    setEditItem(item)
    setEditItemForm({
      label: item.label || '',
      url: item.url || '',
      parentId: item.parentId || '',
      targetType,
      targetId: targetType === 'CUSTOM' ? '' : (item.targetId || ''),
      sortOrder: String(item.sortOrder ?? '0'),
      openInNewTab: item.openInNewTab === true,
      cssClass: item.cssClass || '',
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
    <section className="screen">
      {/* ── Header (no create-menu CTA — slots are fixed) ── */}
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('menus.eyebrow')}</p>
          <h1>{t('menus.title')}</h1>
          <p>{t('menus.description')}</p>
        </div>
      </header>

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
          <div style={{ padding: 24 }}>
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
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flexShrink: 0 }}
                  onClick={openAddItem}
                >
                  <Plus size={14} />
                  {t('menus.addItem')}
                </button>
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
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-sm)', marginBottom: 12 }}>
                  {t('menus.noItems')}
                </p>
                {canUpdate && (
                  <button type="button" className="btn btn-primary" onClick={openAddItem}>
                    <Plus size={14} />
                    {t('menus.addItem')}
                  </button>
                )}
              </div>
            ) : filteredFlatItems.length === 0 ? (
              <div style={{ padding: '24px 20px', color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-sm)' }}>
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
                        <col /><col /><col /><col /><col />
                        {canUpdate && <col />}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="menu-grip-cell" />
                          <th>{t('menus.itemLabel')}</th>
                          <th>{t('menus.itemParent')}</th>
                          <th>{t('menus.itemUrl')}</th>
                          <th>{t('menus.itemTarget')}</th>
                          {canUpdate && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFlatItems.map((item) => (
                          <SortableMenuItem
                            key={item.id}
                            item={item}
                            parentLabel={item.parentId ? (itemById.get(item.parentId)?.label || t('menus.parentMissing')) : ''}
                            rootLabel={t('menus.parentRoot')}
                            typeLabel={targetTypeLabel(t, item.targetType)}
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowItemModal(false); setNewItem(EMPTY_ITEM); setItemError('') }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="add-item-form"
                className="btn btn-primary"
                disabled={addItemMutation.isPending}
              >
                {addItemMutation.isPending ? t('common.saving') : t('common.add')}
              </button>
            </>
          }
        >
          <form id="add-item-form" onSubmit={handleAddItem}>
            {itemError && (
              <p style={{ color: 'var(--admin-color-status-danger-text)', marginBottom: 12, fontSize: 'var(--admin-text-sm)' }}>
                {itemError}
              </p>
            )}
            <ItemForm
              value={newItem}
              onChange={(patch) => setNewItem((p) => ({ ...p, ...patch }))}
              parentOptions={parentOptions}
              t={t}
              isNew
            />
          </form>
        </Modal>
      )}

      {/* ── Modal: Edit Item ── */}
      {editItem && (
        <Modal
          title={`${t('common.edit')}: ${editItem.label}`}
          onClose={() => { setEditItem(null); setEditItemError('') }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setEditItem(null); setEditItemError('') }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="edit-item-form"
                className="btn btn-primary"
                disabled={updateItemMutation.isPending}
              >
                {updateItemMutation.isPending ? t('common.saving') : t('menus.saveMenu')}
              </button>
            </>
          }
        >
          <form id="edit-item-form" onSubmit={handleEditItem}>
            {editItemError && (
              <p style={{ color: 'var(--admin-color-status-danger-text)', marginBottom: 12, fontSize: 'var(--admin-text-sm)' }}>
                {editItemError}
              </p>
            )}
            <ItemForm
              value={editItemForm}
              onChange={(patch) => setEditItemForm((p) => ({ ...p, ...patch }))}
              parentOptions={editParentOptions}
              t={t}
              isNew={false}
            />
          </form>
        </Modal>
      )}
    </section>
  )
}
