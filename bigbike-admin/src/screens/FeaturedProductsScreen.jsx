import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { fetchHomepageBlocks, saveHomepageBlocks, fetchProducts } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
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

  const { data, isFetching } = useQuery({
    queryKey: ['featured-products-search', query, contentLang],
    queryFn: () => fetchProducts({ q: query, page: 1, pageSize: 8, publishStatus: 'PUBLISHED' }),
    enabled: open && query.trim().length > 0,
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
    setItems((prev) => prev.filter((p) => p.id !== productId))
  }

  function handleSave() {
    saveMutation.mutate(items.map((p) => p.id))
  }

  const disabledIds = new Set(items.map((p) => p.id))

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
            <div className="mt-2">
              <ProductPicker onAdd={handleAdd} disabledIds={disabledIds} disabled={!canUpdate} />
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
