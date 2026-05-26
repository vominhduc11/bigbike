import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { fetchHomepageBlocks, saveHomepageBlocks, fetchProducts } from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const FEATURED_GRID_MAX = 12

function ProductPicker({ onAdd, disabledIds, disabled }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const { data, isFetching } = useQuery({
    queryKey: ['featured-products-search', query],
    queryFn: () => fetchProducts({ q: query, page: 1, pageSize: 8, publishStatus: 'PUBLISHED' }),
    enabled: open && query.trim().length > 0,
    staleTime: 30_000,
  })

  const results = (data?.items ?? []).filter((p) => !disabledIds.has(p.id))

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((product) => {
    onAdd(product)
    setQuery('')
    setOpen(false)
  }, [onAdd])

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t('featuredProducts.searchPlaceholder')}
        disabled={disabled}
        className="w-full"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border shadow-md max-h-60 overflow-y-auto">
          {isFetching && (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t('common.loading')}…</div>
          )}
          {!isFetching && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t('featuredProducts.noResults')}</div>
          )}
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-muted text-sm"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(product) }}
            >
              {product.image?.url && (
                <img
                  src={product.image.url}
                  alt={product.image.alt || product.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 object-cover flex-shrink-0"
                  loading="lazy"
                />
              )}
              <span className="truncate">{product.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({ product, canUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled: !canUpdate,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border border-border bg-background"
    >
      {canUpdate && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          style={{ cursor: 'grab', touchAction: 'none' }}
          aria-label="Kéo để sắp xếp"
        >
          <GripVertical size={16} />
        </button>
      )}
      {product.image?.url && (
        <img
          src={product.image.url}
          alt={product.image.alt || product.name}
          referrerPolicy="no-referrer"
          className="w-12 h-12 object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{product.name}</p>
        {product.sku && (
          <p className="text-xs text-muted-foreground mt-0.5">SKU: {product.sku}</p>
        )}
      </div>
      {canUpdate && (
        <button
          type="button"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1"
          onClick={() => onRemove(product.id)}
          aria-label="Xóa khỏi danh sách"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function FeaturedProductsScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [items, setItems] = useState([])
  const [initialized, setInitialized] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const { isLoading, isError, error } = useQuery({
    queryKey: ['homepage-blocks'],
    queryFn: fetchHomepageBlocks,
    onSuccess(data) {
      if (!initialized) {
        setItems(data.featuredGrid ?? [])
        setInitialized(true)
      }
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const saveMutation = useMutation({
    mutationFn: (featuredGrid) => saveHomepageBlocks(featuredGrid),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['homepage-blocks'] })
      toast.success(t('featuredProducts.savedSuccess'))
    },
    onError(err) {
      toast.error(err?.message || t('common.errorOccurred'))
    },
  })

  function handleAdd(product) {
    if (items.length >= FEATURED_GRID_MAX) {
      toast.error(t('featuredProducts.limitReached', { max: FEATURED_GRID_MAX }))
      return
    }
    if (items.some((p) => p.id === product.id)) return
    setItems((prev) => [...prev, product])
  }

  function handleRemove(productId) {
    setItems((prev) => prev.filter((p) => p.id !== productId))
  }

  function handleDragStart(event) {
    if (!canUpdate || saveMutation.isPending) return
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    if (!canUpdate || saveMutation.isPending) return
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((p) => p.id === active.id)
    const newIndex = items.findIndex((p) => p.id === over.id)
    setItems((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  function handleSave() {
    saveMutation.mutate(items.map((p) => p.id))
  }

  const disabledIds = new Set(items.map((p) => p.id))
  const activeProduct = activeId ? items.find((p) => p.id === activeId) : null

  if (isLoading) {
    return (
      <Screen>
        <StatePanel tone="info" title={t('common.loading')} description={t('common.pleaseWait')} />
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen>
        <StatePanel tone="danger" title={t('common.errorLoading')} description={error?.message} />
      </Screen>
    )
  }

  return (
    <Screen maxWidth="720px">
      {!canUpdate && <ReadOnlyBanner />}

      <ScreenHeader
        eyebrow={t('featuredProducts.eyebrow')}
        title={t('featuredProducts.title')}
        description={t('featuredProducts.description')}
        actions={
          <Button
            onClick={handleSave}
            disabled={!canUpdate || saveMutation.isPending}
          >
            {saveMutation.isPending ? t('common.saving') : t('featuredProducts.saveButton')}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {t('featuredProducts.gridTitle')}
            </p>
            <span className="text-xs text-muted-foreground">
              {items.length} / {FEATURED_GRID_MAX}
            </span>
          </div>

          {items.length === 0 && (
            <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t('featuredProducts.emptyHint')}
            </div>
          )}

          {items.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1">
                  {items.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      canUpdate={canUpdate}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeProduct ? (
                  <ProductRow product={activeProduct} canUpdate={false} onRemove={() => {}} />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {canUpdate && items.length < FEATURED_GRID_MAX && (
            <div className="mt-2">
              <ProductPicker onAdd={handleAdd} disabledIds={disabledIds} disabled={!canUpdate} />
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
