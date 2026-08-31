import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { fetchHomepageBlocks, saveHomepageBlocks } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { useProductPicker } from '../lib/useProductPicker'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { showConfirm } from '../lib/confirm'
import { StatePanel } from '../components/StatePanel'
import { SortableList } from '../components/Sortable'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { StickyActionBar } from '../components/layout/StickyActionBar'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { PublishStatusBadge } from '../components/StatusBadge'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import {
  FEATURED_GRID_MAX,
  featuredSaveErrorMessage,
  isFeaturedLive,
} from './featured-products/constants'

function ProductPicker({ onAdd, disabledIds, disabled }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const [open, setOpen] = useState(false)
  const { search, setSearch, items, isFetching, reset } = useProductPicker({
    queryKey: 'featured-products-search',
    contentLang,
    params: { page: 1, pageSize: 8, publishStatus: 'PUBLISHED' },
    enabled: open,
  })

  const results = items.filter((p) => !disabledIds.has(p.id))

  const handleSelect = useCallback(
    (product) => {
      onAdd(product)
      reset()
      setOpen(false)
    },
    [onAdd, reset],
  )

  return (
    <ProductPickerCombobox
      search={search}
      onSearchChange={(v) => {
        setSearch(v)
        setOpen(true)
      }}
      onFocus={() => setOpen(true)}
      open={open && search.trim().length > 0}
      onOpenChange={(next) => {
        if (!next) setOpen(false)
      }}
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
  const { t } = useTranslation()
  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 p-3 border border-border bg-background"
    >
      {canUpdate && sortable && (
        <Button
          variant="unstyled"
          {...sortable.handleProps}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label={t('featuredProducts.dragHandle', { defaultValue: 'Kéo để sắp xếp' })}
        >
          <GripVertical size={16} />
        </Button>
      )}
      {product.image?.url && (
        <img
          src={product.image.url}
          alt={product.image.alt || product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          // Ảnh hỏng/404 trước đây để lại ô ảnh vỡ giữa dòng — ẩn hẳn để dòng không bị lệch.
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
          className="w-12 h-12 object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{product.name}</p>
        {product.sku && <p className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</p>}
      </div>
      {/* Sản phẩm bị chuyển về Nháp/Thùng rác vẫn nằm trong danh sách nổi bật nhưng KHÔNG
          hiện trên trang chủ, và chặn luôn thao tác lưu. Gắn nhãn trạng thái để chủ shop
          thấy ngay thay vì chỉ biết khi bấm Lưu và nhận thông báo lỗi. */}
      {!isFeaturedLive(product) && (
        <span className="flex-shrink-0">
          <PublishStatusBadge value={product.publishStatus} />
        </span>
      )}
      {canUpdate && (
        <Button
          variant="unstyled"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1"
          onClick={() => onRemove(product.id)}
          aria-label={t('featuredProducts.removeItem', { defaultValue: 'Xoá khỏi danh sách' })}
        >
          <X size={14} />
        </Button>
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
  // baseline = danh sách id đã lưu trên server, để so sánh phát hiện thay đổi chưa lưu.
  const [baselineIds, setBaselineIds] = useState([])

  const {
    isLoading,
    isError,
    error,
    data: blocksData,
    refetch,
  } = useQuery({
    queryKey: ['homepage-blocks', contentLang],
    queryFn: fetchHomepageBlocks,
  })

  // So sánh thứ tự id hiện tại với baseline để biết có thay đổi chưa lưu (F6).
  const currentIds = items.map((p) => p.id)
  const isDirty =
    currentIds.length !== baselineIds.length || currentIds.some((id, i) => id !== baselineIds[i])

  // Cảnh báo khi rời trang / reload / đóng tab lúc đang có thay đổi chưa lưu.
  useUnsavedChanges(
    isDirty,
    t('featuredProducts.unsavedConfirm', {
      defaultValue:
        'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
    }),
  )

  // Đổi ngôn ngữ nội dung → fetch lại theo lang mới, bỏ chốt để lấy lại tên đã dịch.
  // Nếu đang có thay đổi chưa lưu thì hỏi trước khi ghi đè danh sách đã sửa.
  useEffect(() => {
    if (!initialized) return
    let cancelled = false
    async function maybeReset() {
      if (isDirty) {
        const ok = await showConfirm(
          t('featuredProducts.langSwitchConfirm', {
            defaultValue:
              'Bạn có thay đổi chưa lưu. Đổi ngôn ngữ sẽ tải lại danh sách và mất các thay đổi này. Tiếp tục?',
          }),
          t('featuredProducts.unsavedTitle', { defaultValue: 'Có thay đổi chưa lưu' }),
        )
        if (cancelled || !ok) return
      }
      setInitialized(false)
    }
    maybeReset()
    return () => {
      cancelled = true
    }
    // Chỉ chạy khi contentLang đổi; isDirty/initialized đọc snapshot tại thời điểm đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentLang])

  useEffect(() => {
    if (blocksData && !initialized) {
      const grid = blocksData.featuredGrid ?? []
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(grid)
      setBaselineIds(grid.map((p) => p.id))
      setInitialized(true)
    }
  }, [blocksData, initialized])

  const saveMutation = useMutation({
    mutationFn: (featuredGrid) => saveHomepageBlocks(featuredGrid),
    onSuccess(_data, featuredGrid) {
      // Đã lưu → baseline = danh sách vừa lưu, gỡ cảnh báo trước khi refetch.
      setBaselineIds(featuredGrid)
      clearNavGuard()
      queryClient.invalidateQueries({ queryKey: ['homepage-blocks'] })
      toast.success(t('featuredProducts.savedSuccess'))
    },
    onError(err) {
      toast.error(featuredSaveErrorMessage(t, err, items))
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
      t('featuredProducts.removedFromList', { defaultValue: 'Đã xoá khỏi danh sách' }),
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

  function handleDiscard() {
    setInitialized(false)
  }

  const disabledIds = new Set(items.map((p) => p.id))
  const staleItems = items.filter((product) => !isFeaturedLive(product))

  const pickerRef = useRef(null)
  function focusPicker() {
    pickerRef.current?.querySelector('input')?.focus()
  }

  if (isLoading) {
    return (
      <Screen>
        <ScreenSkeleton variant="cards" count={4} showHeader={false} />
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen>
        <StatePanel
          tone="danger"
          title={t('common.errorLoading')}
          description={error?.message}
          actionLabel={t('common.retry')}
          onAction={refetch}
        />
      </Screen>
    )
  }

  return (
    // Route của màn này yêu cầu sẵn quyền sửa sản phẩm (`routePermission` trong App.jsx),
    // nên không có trường hợp mở được màn mà chỉ được xem — không cần dải "chỉ xem".
    // Owner chốt 2026-07-28: giữ nguyên cách phân quyền này.
    <Screen>
      <ScreenHeader
        group="products"
        title={t('featuredProducts.title')}
        help={t('featuredProducts.description')}
      />

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (canUpdate && !saveMutation.isPending) handleSave()
        }}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === 'Enter' &&
            canUpdate &&
            !saveMutation.isPending
          ) {
            e.preventDefault()
            handleSave()
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('featuredProducts.gridTitle')}</p>
            <span className="text-xs text-muted-foreground">
              {items.length} / {FEATURED_GRID_MAX}
            </span>
          </div>

          {staleItems.length > 0 && (
            <Alert tone="warning" size="sm">
              {t('featuredProducts.staleWarning', {
                count: staleItems.length,
                names: staleItems.map((p) => p.name).join(', '),
                defaultValue:
                  'Có {{count}} sản phẩm trong danh sách hiện không còn đang bán nên không hiện trên trang chủ: {{names}}. Hãy đăng bán lại hoặc bỏ khỏi danh sách — chưa xử lý thì không lưu được thay đổi.',
              })}
            </Alert>
          )}

          {items.length === 0 && (
            <StatePanel
              tone="info"
              title={t('featuredProducts.emptyTitle', { defaultValue: 'Chưa có sản phẩm nổi bật' })}
              description={t('featuredProducts.emptyHint')}
              actionLabel={
                canUpdate
                  ? t('featuredProducts.emptyAction', { defaultValue: 'Thêm sản phẩm' })
                  : undefined
              }
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

        <StickyActionBar ariaLabel={t('common.actions')}>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={!isDirty || saveMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={saveMutation.isPending} disabled={!canUpdate || !isDirty}>
            {t('featuredProducts.saveButton')}
          </Button>
        </StickyActionBar>
      </form>
    </Screen>
  )
}
