import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { fetchHomepageBlocks, saveHomepageBlocks, fetchProducts } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { SortableList } from '../components/Sortable'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Button } from '@/components/ui/button'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'

const FEATURED_GRID_MAX = 12

function ProductPicker({ onAdd, disabledIds, disabled }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Debounce trước khi bắn request tìm kiếm để không gọi server mỗi phím gõ.
  const debouncedQuery = useDebounce(query, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['featured-products-search', debouncedQuery, contentLang],
    queryFn: () => fetchProducts({ q: debouncedQuery, page: 1, pageSize: 8, publishStatus: 'PUBLISHED' }),
    enabled: open && debouncedQuery.trim().length > 0,
    staleTime: 30_000,
  })

  const results = (data?.items ?? []).filter((p) => !disabledIds.has(p.id))

  const handleSelect = useCallback((product) => {
    onAdd(product)
    setQuery('')
    setOpen(false)
  }, [onAdd])

  return (
    <ProductPickerCombobox
      search={query}
      onSearchChange={(v) => { setQuery(v); setOpen(true) }}
      onFocus={() => setOpen(true)}
      open={open && query.trim().length > 0}
      onOpenChange={(next) => { if (!next) setOpen(false) }}
      loading={isFetching}
      items={results}
      onPick={handleSelect}
      placeholder={t('featuredProducts.searchPlaceholder')}
      loadingText={`${t('common.loading')}…`}
      emptyText={t('featuredProducts.noResults')}
      disabled={disabled}
    />
  )
}

function ProductRow({ product, canUpdate, onRemove, sortable }) {
  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 p-3 border border-border bg-background"
    >
      {canUpdate && sortable && (
        <button
          type="button"
          {...sortable.handleProps}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
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
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [items, setItems] = useState([])
  const [initialized, setInitialized] = useState(false)

  const { isLoading, isError, error, data: blocksData } = useQuery({
    queryKey: ['homepage-blocks', contentLang],
    queryFn: fetchHomepageBlocks,
  })

  // Đổi ngôn ngữ nội dung → fetch lại theo lang mới, bỏ chốt để lấy lại tên đã dịch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setInitialized(false) }, [contentLang])

  useEffect(() => {
    if (blocksData && !initialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(blocksData.featuredGrid ?? [])
      setInitialized(true)
    }
  }, [blocksData, initialized])

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
    const index = items.findIndex((p) => p.id === productId)
    if (index === -1) return
    const removed = items[index]
    setItems((prev) => prev.filter((p) => p.id !== productId))
    toast.success(
      t('featuredProducts.removedFromList', { defaultValue: 'Đã xóa khỏi danh sách' }),
      {
        action: {
          label: t('common.undo', { defaultValue: 'Hoàn tác' }),
          onClick: () =>
            setItems((current) => {
              if (current.some((p) => p.id === removed.id)) return current
              const restored = [...current]
              restored.splice(Math.min(index, restored.length), 0, removed)
              return restored
            }),
        },
      },
    )
  }

  function handleSave() {
    saveMutation.mutate(items.map((p) => p.id))
  }

  const disabledIds = new Set(items.map((p) => p.id))

  const pickerRef = useRef(null)
  function focusPicker() {
    pickerRef.current?.querySelector('input')?.focus()
  }

  if (isLoading) {
    return (
      <Screen maxWidth="720px">
        <div
          className="flex flex-col gap-1"
          role="status"
          aria-busy="true"
          aria-label={t('common.loading')}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border border-border bg-background animate-pulse"
            >
              <div className="w-12 h-12 bg-surface-muted rounded-xs flex-shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="h-4 w-1/2 bg-surface-muted rounded-xs" />
                <div className="h-3 w-1/4 bg-surface-muted rounded-xs" />
              </div>
            </div>
          ))}
        </div>
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
            <StatePanel
              tone="info"
              title={t('featuredProducts.emptyTitle', { defaultValue: 'Chưa có sản phẩm nổi bật' })}
              description={t('featuredProducts.emptyHint')}
              actionLabel={canUpdate ? t('featuredProducts.emptyAction', { defaultValue: 'Thêm sản phẩm' }) : undefined}
              onAction={canUpdate ? focusPicker : undefined}
            />
          )}

          {items.length > 0 && (
            <SortableList
              items={items}
              disabled={!canUpdate || saveMutation.isPending}
              onReorder={setItems}
              className="flex flex-col gap-1"
              renderItem={(product, sortable) => (
                <ProductRow
                  product={product}
                  canUpdate={canUpdate}
                  onRemove={handleRemove}
                  sortable={sortable}
                />
              )}
              renderOverlay={(product) => (
                <ProductRow product={product} canUpdate={false} onRemove={() => {}} />
              )}
            />
          )}

          {canUpdate && items.length < FEATURED_GRID_MAX && (
            <div className="mt-2" ref={pickerRef}>
              <ProductPicker onAdd={handleAdd} disabledIds={disabledIds} disabled={!canUpdate} />
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
