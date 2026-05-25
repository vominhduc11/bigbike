import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchHomeHighlights, saveHomeHighlights, fetchProducts } from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SLOT_LABELS = { 1: 'Slot 1', 2: 'Slot 2', 3: 'Slot 3' }

function ProductPicker({ value, onChange, disabled }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const { data, isFetching } = useQuery({
    queryKey: ['home-highlights-product-search', query],
    queryFn: () => fetchProducts({ q: query, page: 1, pageSize: 8 }),
    enabled: open && query.trim().length > 0,
    staleTime: 30_000,
  })

  const results = data?.items ?? []

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
    onChange(product)
    setQuery('')
    setOpen(false)
  }, [onChange])

  const displayValue = query || (value ? value.name : '')

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={displayValue}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t('homeHighlights.searchPlaceholder')}
        disabled={disabled}
        className="w-full"
      />
      {open && (query.trim().length > 0) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border shadow-md max-h-60 overflow-y-auto">
          {isFetching && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {t('common.loading')}…
            </div>
          )}
          {!isFetching && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {t('homeHighlights.noResults')}
            </div>
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

function SlotCard({ slotNumber, product, onProductChange, disabled }) {
  const { t } = useTranslation()

  return (
    <div className="border border-border p-4 flex flex-col gap-3">
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {SLOT_LABELS[slotNumber]}
      </p>

      {product && (
        <div className="flex items-start gap-3 p-3 bg-muted/50">
          {product.image?.url && (
            <img
              src={product.image.url}
              alt={product.image.alt || product.name}
              referrerPolicy="no-referrer"
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
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => onProductChange(null)}
              aria-label={t('homeHighlights.clearSlot')}
            >
              ✕
            </button>
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
  const queryClient = useQueryClient()

  const [slots, setSlots] = useState([
    { slot: 1, product: null },
    { slot: 2, product: null },
    { slot: 3, product: null },
  ])
  const [initialized, setInitialized] = useState(false)

  const { isLoading, isError, error } = useQuery({
    queryKey: ['home-highlights'],
    queryFn: fetchHomeHighlights,
    onSuccess(data) {
      if (!initialized) {
        const loaded = [1, 2, 3].map((n) => {
          const found = (data.items ?? []).find((i) => i.slot === n)
          if (!found) return { slot: n, product: null }
          return {
            slot: n,
            product: {
              id: found.productId,
              name: found.productName,
              slug: found.productSlug,
              image: found.productImageUrl ? { url: found.productImageUrl, alt: found.productName } : null,
            },
          }
        })
        setSlots(loaded)
        setInitialized(true)
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (slotsToSave) => saveHomeHighlights(slotsToSave),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['home-highlights'] })
      toast.success(t('homeHighlights.savedSuccess'))
    },
    onError(err) {
      toast.error(err?.message || t('common.errorOccurred'))
    },
  })

  function handleProductChange(slotNumber, product) {
    setSlots((prev) =>
      prev.map((s) => (s.slot === slotNumber ? { ...s, product } : s))
    )
  }

  function handleSave() {
    const filled = slots.filter((s) => s.product?.id)
    if (filled.length === 0) {
      toast.error(t('homeHighlights.noSlotsError'))
      return
    }
    const body = filled.map((s) => ({ slot: s.slot, productId: s.product.id }))
    saveMutation.mutate(body)
  }

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
        eyebrow={t('homeHighlights.eyebrow')}
        title={t('homeHighlights.title')}
        description={t('homeHighlights.description')}
        actions={
          <Button
            onClick={handleSave}
            disabled={!canUpdate || saveMutation.isPending}
          >
            {saveMutation.isPending ? t('common.saving') : t('homeHighlights.saveButton')}
          </Button>
        }
      />

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
