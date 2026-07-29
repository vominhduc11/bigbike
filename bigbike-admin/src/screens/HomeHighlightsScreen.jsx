import { useState, useCallback, useEffect, useMemo } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { fetchHomeHighlights, saveHomeHighlights } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { normalizeImageAsset } from '../lib/contracts'
import { useProductPicker } from '../lib/useProductPicker'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Button } from '@/components/ui/button'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { showConfirm } from '../lib/confirm'
import { canReloadHighlightsForLanguageChange } from './home-highlights/draftGuard'

// Chữ ký so sánh dirty: chỉ phụ thuộc slot + productId đã chọn (thứ tự cố định 1-2-3).
function slotsSignature(slots) {
  return [1, 2, 3]
    .map((n) => {
      const s = slots.find((x) => x.slot === n)
      return `${n}:${s?.product?.id ?? ''}`
    })
    .join('|')
}

function ProductPicker({ value, onChange, disabled }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const [open, setOpen] = useState(false)
  const { search, setSearch, items, isFetching, reset } = useProductPicker({
    queryKey: 'home-highlights-product-search',
    contentLang,
    params: { page: 1, pageSize: 8, publishStatus: 'PUBLISHED' },
    debounceMs: 0,
    enabled: open,
  })

  const handleSelect = useCallback((product) => {
    onChange(product)
    reset()
    setOpen(false)
  }, [onChange, reset])

  const displayValue = search || (value ? value.name : '')

  return (
    <ProductPickerCombobox
      search={displayValue}
      onSearchChange={(v) => { setSearch(v); setOpen(true) }}
      onFocus={() => setOpen(true)}
      open={open && search.trim().length > 0}
      onOpenChange={(next) => { if (!next) setOpen(false) }}
      loading={isFetching}
      items={items}
      onPick={handleSelect}
      placeholder={t('homeHighlights.searchPlaceholder')}
      loadingText={`${t('common.loading')}…`}
      emptyText={t('homeHighlights.noResults')}
      disabled={disabled}
    />
  )
}

function SlotCard({ slotNumber, product, onProductChange, disabled }) {
  const { t } = useTranslation()

  return (
    <div className="border border-border p-4 flex flex-col gap-3">
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('homeHighlights.slotLabel', { number: slotNumber, defaultValue: 'Vị trí {{number}}' })}
      </p>

      {product && (
        <div className="flex items-start gap-3 p-3 bg-muted/50">
          {product.image?.url && (
            <img
              src={product.image.url}
              alt={product.image.alt || product.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              // Ảnh sản phẩm hỏng/404 không để lại ô ảnh vỡ trong slot (nhất quán với các màn khác).
              onError={(event) => { event.currentTarget.hidden = true }}
              className="w-16 h-16 object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight line-clamp-2">{product.name}</p>
            {product.sku && (
              <p className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</p>
            )}
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 -m-1.5 text-muted-foreground"
              onClick={() => onProductChange(null)}
              aria-label={t('homeHighlights.clearSlot')}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      <ProductPicker
        value={product}
        onChange={onProductChange}
        disabled={disabled}
      />
    </div>
  )
}

export function HomeHighlightsScreen({ canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()

  const [slots, setSlots] = useState([
    { slot: 1, product: null },
    { slot: 2, product: null },
    { slot: 3, product: null },
  ])
  const [initialized, setInitialized] = useState(false)

  const { isLoading, isError, error, data: highlightsData, refetch } = useQuery({
    queryKey: ['home-highlights', contentLang],
    queryFn: fetchHomeHighlights,
  })

  useEffect(() => {
    if (!highlightsData || initialized) return
    const loaded = [1, 2, 3].map((n) => {
      const found = (highlightsData.items ?? []).find((i) => i.slot === n)
      if (!found) return { slot: n, product: null }
      return {
        slot: n,
        product: {
          id: found.productId,
          name: found.productName,
          slug: found.productSlug,
          image: normalizeImageAsset({ url: found.productImageUrl, alt: found.productName }) ?? null,
        },
      }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(loaded)
    setInitialized(true)
  }, [highlightsData, initialized])

  const saveMutation = useMutation({
    mutationFn: (slotsToSave) => saveHomeHighlights(slotsToSave),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['home-highlights'] })
      toast.success(t('homeHighlights.savedSuccess'))
    },
    onError(err) {
      toast.error(err?.message || t('common.errorOccurred', { defaultValue: 'Đã xảy ra lỗi.' }))
    },
  })

  // Baseline = trạng thái slot đã lưu (theo dữ liệu fetch về); dirty khi khác baseline.
  const baselineSignature = useMemo(() => {
    const loaded = [1, 2, 3].map((n) => {
      const found = (highlightsData?.items ?? []).find((i) => i.slot === n)
      return { slot: n, product: found ? { id: found.productId } : null }
    })
    return slotsSignature(loaded)
  }, [highlightsData])

  const isDirty = initialized && !saveMutation.isPending && slotsSignature(slots) !== baselineSignature

  useUnsavedChanges(isDirty)

  // Khi đổi ngôn ngữ nội dung (VI/EN), chỉ tải lại tên đã dịch sau khi bảo vệ
  // bản nháp. Chọn huỷ trong hộp xác nhận sẽ giữ nguyên các slot đang sửa.
  useEffect(() => {
    let cancelled = false
    async function maybeReload() {
      const shouldReload = await canReloadHighlightsForLanguageChange({
        initialized,
        isDirty,
        confirmDiscard: () => showConfirm(
          t('homeHighlights.langSwitchConfirm'),
          t('homeHighlights.unsavedTitle'),
        ),
      })
      if (cancelled || !shouldReload) return
      setInitialized(false)
    }
    maybeReload()
    return () => { cancelled = true }
    // Chỉ chạy khi contentLang đổi; isDirty/initialized là snapshot tại thời điểm đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentLang])

  // O3: Ctrl/Cmd+S lưu 3 slot nổi bật; handleSave tự báo lỗi nếu chưa chọn sản phẩm nào.
  useSaveShortcut(canUpdate, handleSave)

  function handleProductChange(slotNumber, product) {
    setSlots((prev) =>
      prev.map((s) => (s.slot === slotNumber ? { ...s, product } : s))
    )
  }

  const filledSlots = slots.filter((s) => s.product?.id)
  const hasFilledSlot = filledSlots.length > 0

  function handleSave() {
    if (!hasFilledSlot) {
      toast.error(t('homeHighlights.noSlotsError'))
      return
    }
    const body = filledSlots.map((s) => ({ slot: s.slot, productId: s.product.id }))
    saveMutation.mutate(body)
  }

  if (isLoading) {
    return (
      <Screen maxWidth="720px">
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t('common.loading')}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bb-skeleton-block" style={{ height: 140 }} />
          ))}
        </div>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen>
        <StatePanel
          tone="danger"
          title={t('common.errorLoading', { defaultValue: 'Không tải được dữ liệu' })}
          description={error?.message}
          actionLabel={t('common.retry')}
          onAction={refetch}
        />
      </Screen>
    )
  }

  return (
    <Screen maxWidth="720px">
      {!canUpdate && <ReadOnlyBanner />}

      <ScreenHeader
        eyebrow={t('homeHighlights.eyebrow')}
        title={t('homeHighlights.title')}
        description={t('homeHighlights.description')}
        actions={
          <Button
            onClick={handleSave}
            loading={saveMutation.isPending}
            disabled={!canUpdate || !hasFilledSlot}
          >
            {t('homeHighlights.saveButton')}
          </Button>
        }
      />

      {canUpdate && !hasFilledSlot && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-sm text-muted-foreground -mt-2 mb-1"
        >
          <AlertCircle size={14} aria-hidden="true" className="shrink-0" />
          {t('homeHighlights.noSlotsHint', { defaultValue: 'Chọn ít nhất 1 sản phẩm để lưu.' })}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {slots.map((s) => (
          <SlotCard
            key={s.slot}
            slotNumber={s.slot}
            product={s.product}
            onProductChange={(product) => handleProductChange(s.slot, product)}
            disabled={!canUpdate}
          />
        ))}
      </div>
    </Screen>
  )
}
