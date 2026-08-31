import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { SortableList } from '../components/Sortable'
import {
  createSlider,
  deleteSlider,
  fetchSliders,
  reorderSliders,
  updateSlider,
} from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { useProductPicker } from '../lib/useProductPicker'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { DetailSection } from '../components/DetailSection'
import { FormField, Screen, ScreenHeader, StickyActionBar } from '../components/layout'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { HelpTooltip } from '../components/HelpTooltip'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  HOME_LOCATION,
  buildSliderPayload,
  validateSliderProduct,
} from './slider-list/sliderPayload'
// Nhãn tiếng Việt thân thiện cho mã vị trí kỹ thuật (T2). Mã lạ → trả nguyên mã.
function locationLabel(t, code) {
  return code === HOME_LOCATION ? t('sliders.locationHome', { defaultValue: 'Trang chủ' }) : code
}
const EMPTY_FORM = {
  location: HOME_LOCATION,
  sortOrder: '0',
  desktopImageUrl: '',
  desktopImageAlt: '',
  desktopImageWidth: null,
  desktopImageHeight: null,
  desktopImageMimeType: '',
  mobileImageUrl: '',
  mobileImageAlt: '',
  mobileImageWidth: null,
  mobileImageHeight: null,
  mobileImageMimeType: '',
  productId: '',
  productName: '',
  isActive: true,
}

function SliderCard({
  slider,
  canUpdate,
  canFullEdit,
  onEdit,
  onDelete,
  onToggleActive,
  sortable,
  toggling,
  deleting,
}) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const productLabel =
    contentLang === 'en'
      ? slider.productNameEn ||
        slider.productName ||
        t('sliders.productUnnamed', { defaultValue: 'Sản phẩm đã liên kết' })
      : slider.productName || t('sliders.productUnnamed', { defaultValue: 'Sản phẩm đã liên kết' })
  return (
    <DetailSection
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={cn(
        'bb-slider-card',
        slider.isActive === false && 'is-inactive',
        sortable?.isDragging && 'is-dragging',
      )}
      contentClassName="bb-slider-card-body"
    >
      {canUpdate && sortable && (
        <Button
          variant="ghost"
          size="icon"
          {...sortable.handleProps}
          className="bb-slider-drag"
          title={t('sliders.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
          aria-label={t('sliders.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
        >
          <GripVertical size={16} />
        </Button>
      )}

      <div className="bb-slider-media-stack">
        {slider.desktopImage?.url && (
          <img
            src={slider.desktopImage.url}
            alt={slider.desktopImage.alt || ''}
            title={t('sliders.deviceDesktop')}
            className="bb-slider-thumb bb-slider-thumb--desktop"
          />
        )}
        {slider.mobileImage?.url && (
          <img
            src={slider.mobileImage.url}
            alt={slider.mobileImage.alt || ''}
            title={t('sliders.deviceMobile')}
            className="bb-slider-thumb bb-slider-thumb--mobile"
          />
        )}
      </div>

      <div className="bb-slider-copy">
        <div className="bb-slider-title-row">
          <span className="bb-slider-title">
            #{slider.sortOrder} · {locationLabel(t, slider.location)}
          </span>
          <Badge variant={slider.isActive !== false ? 'success' : 'secondary'}>
            {slider.isActive !== false ? t('sliders.statusActive') : t('sliders.statusInactive')}
          </Badge>
        </div>
        {slider.productId && (
          <p className="bb-slider-meta">
            {t('sliders.productLabel')} {productLabel}
          </p>
        )}
      </div>

      {canUpdate && (
        <div className="bb-slider-actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={toggling}
            aria-busy={toggling}
            onClick={() => onToggleActive(slider)}
          >
            {/* N7: nhãn phản ánh ngay trạng thái lạc quan (cache đã đổi); chỉ disable trong lúc chờ. */}
            {/* V5: nhãn "Ẩn/Hiện" đồng nhất với HomeVideoListScreen (homeVideos.hideAction/showAction) thay vì common.enable/disable chung chung. */}
            {slider.isActive !== false
              ? t('sliders.hideAction', { defaultValue: 'Ẩn' })
              : t('sliders.showAction', { defaultValue: 'Hiện' })}
          </Button>
          {canFullEdit ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => onEdit(slider)}
            >
              {t('common.edit')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-danger"
            disabled={deleting}
            aria-busy={deleting}
            onClick={() => onDelete(slider)}
          >
            {deleting ? t('common.deleting', { defaultValue: 'Đang xoá...' }) : t('common.delete')}
          </Button>
        </div>
      )}
    </DetailSection>
  )
}

export function SliderListScreen({ canUpdate, canFullEdit = canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  // Màn này chỉ quản lý slider Trang chủ — không còn bộ lọc vị trí.
  const location = HOME_LOCATION
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  // Bản chụp form lúc mở (để biết có thay đổi chưa lưu — F6). null khi form đóng.
  const [baseline, setBaseline] = useState(null)
  const [formError, setFormError] = useState('')
  // Lỗi inline cạnh trường sản phẩm liên kết.
  const [productFieldError, setProductFieldError] = useState('')
  // Chỉ hiện lỗi chọn sản phẩm sau khi admin đã thử lưu hoặc bỏ chọn.
  const [productTouched, setProductTouched] = useState(false)
  // ID banner đang gọi API bật/tắt hoặc xoá → disable đúng nút trên thẻ đó.
  const [togglingId, setTogglingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  // Tìm-chọn sản phẩm cho trường Product ID (thay ô gõ ID thủ công).
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const {
    search: productSearch,
    setSearch: setProductSearch,
    items: productSearchItems,
    isFetching: isSearchingProducts,
  } = useProductPicker({
    queryKey: 'slider-product-search',
    contentLang,
    params: { page: 1, pageSize: 8, publishStatus: 'PUBLISHED' },
    enabled: productPickerOpen,
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sliders', location],
    queryFn: () => fetchSliders(location),
  })

  const items = [...(data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  const visibleItems = items
  const filteredByLang = false
  const warning = ''

  const reorderMutation = useMutation({
    mutationFn: ({ location: loc, items }) => reorderSliders(loc, items),
    onMutate: async ({ location: loc }) => {
      await queryClient.cancelQueries({ queryKey: ['sliders', loc] })
      return { previous: queryClient.getQueryData(['sliders', loc]), loc }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['sliders', location], result)
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['sliders', context.loc], context.previous)
      } else {
        queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      }
      toast.error(t('sliders.saveError', { defaultValue: 'Lỗi khi lưu thứ tự' }))
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload) => createSlider(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      closeForm()
      toast.success(t('sliders.saveSuccess', { defaultValue: 'Đã lưu banner' }))
    },
    onError: (e) => setFormError(e.message || t('sliders.saveError')),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSlider(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      closeForm()
      toast.success(t('sliders.saveSuccess', { defaultValue: 'Đã lưu slider' }))
    },
    onError: (e) => setFormError(e.message || t('sliders.saveError')),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateSlider(id, { isActive }),
    // Optimistic bật/tắt hiển thị (N7) — đổi trạng thái ngay trong cache, rollback nếu lỗi,
    // theo đúng mẫu reorderMutation để trải nghiệm đồng nhất.
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['sliders', location] })
      const previous = queryClient.getQueryData(['sliders', location])
      queryClient.setQueryData(['sliders', location], (prev) => {
        if (!prev?.items) return prev
        return { ...prev, items: prev.items.map((s) => (s.id === id ? { ...s, isActive } : s)) }
      })
      return { previous }
    },
    onSuccess: () => {
      toast.success(t('sliders.toggleSuccess', { defaultValue: 'Đã cập nhật trạng thái' }))
    },
    onError: (e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['sliders', location], context.previous)
      toast.error(
        e?.message || t('sliders.saveError', { defaultValue: 'Lỗi khi cập nhật trạng thái' }),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      setTogglingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (sliderId) => deleteSlider(sliderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      toast.success(t('sliders.deleteSuccess', { defaultValue: 'Đã xoá slider' }))
    },
    onError: (e) => toast.error(e.message || t('sliders.deleteError')),
    onSettled: () => setDeletingId(null),
  })

  // Form đang có thay đổi chưa lưu khi đang mở và khác bản chụp lúc mở (F6).
  const isDirty = useMemo(() => {
    if (!showForm || !baseline) return false
    return JSON.stringify(form) !== JSON.stringify(baseline)
  }, [showForm, baseline, form])

  // Cảnh báo khi rời trang / reload / đóng tab lúc đang có thay đổi chưa lưu.
  useUnsavedChanges(
    isDirty,
    t('sliders.unsavedConfirm', {
      defaultValue:
        'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
    }),
  )

  // O3: Ctrl/Cmd+S lưu form banner khi đang mở.
  useSaveShortcut(showForm && canFullEdit, handleSubmit)

  // Hỏi xác nhận trước khi bỏ form nếu đang có thay đổi chưa lưu, rồi đóng form.
  async function confirmCloseForm() {
    if (isDirty) {
      const ok = await showConfirm(
        t('sliders.unsavedConfirm', {
          defaultValue:
            'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
        }),
        t('sliders.unsavedTitle', { defaultValue: 'Có thay đổi chưa lưu' }),
      )
      if (!ok) return false
    }
    closeForm()
    return true
  }

  function openAddForm() {
    setEditingId(null)
    const nextOrder =
      items.length > 0 ? Math.max(...items.map((i) => Number(i.sortOrder ?? 0))) + 1 : 0
    const next = { ...EMPTY_FORM, location, sortOrder: String(nextOrder) }
    setForm(next)
    setBaseline(next)
    setFormError('')
    setProductFieldError('')
    setProductTouched(false)
    setProductSearch('')
    setProductPickerOpen(false)
    setShowForm(true)
  }

  function handleEdit(slider) {
    setEditingId(slider.id)
    const next = {
      location: slider.location,
      sortOrder: String(slider.sortOrder),
      desktopImageUrl: slider.desktopImage?.rawUrl || slider.desktopImage?.url || '',
      desktopImageAlt: slider.desktopImage?.alt || '',
      desktopImageWidth: slider.desktopImage?.width ?? null,
      desktopImageHeight: slider.desktopImage?.height ?? null,
      desktopImageMimeType: slider.desktopImage?.mimeType || '',
      mobileImageUrl: slider.mobileImage?.rawUrl || slider.mobileImage?.url || '',
      mobileImageAlt: slider.mobileImage?.alt || '',
      mobileImageWidth: slider.mobileImage?.width ?? null,
      mobileImageHeight: slider.mobileImage?.height ?? null,
      mobileImageMimeType: slider.mobileImage?.mimeType || '',
      productId: slider.productId || '',
      productName: slider.productName || slider.productNameEn || '',
      isActive: slider.isActive !== false,
    }
    setForm(next)
    setBaseline(next)
    setFormError('')
    setProductFieldError('')
    setProductTouched(false)
    setProductSearch('')
    setProductPickerOpen(false)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setBaseline(null)
    setFormError('')
    setProductFieldError('')
    setProductTouched(false)
    setProductSearch('')
    setProductPickerOpen(false)
  }

  const handlePickProduct = useCallback(
    (product) => {
      setForm((p) => ({ ...p, productId: product.id, productName: product.name || product.id }))
      setProductSearch('')
      setProductPickerOpen(false)
      setProductFieldError('')
      setFormError('')
    },
    [setProductSearch],
  )

  function clearSelectedProduct() {
    const next = { ...form, productId: '', productName: '' }
    setForm(next)
    // Bỏ sản phẩm sau khi đã tương tác → hiển thị ngay lỗi bắt buộc.
    if (productTouched) setProductFieldError(validateSliderProduct(next, t))
  }

  async function handleDelete(slider) {
    if (!slider?.id) return
    const bannerName = `${locationLabel(t, slider.location)} (#${slider.sortOrder ?? 0})`
    const confirmed = await showConfirm(
      t('sliders.deleteConfirmDetail', {
        name: bannerName,
        defaultValue: `Xoá vĩnh viễn banner "${bannerName}". Banner sẽ không còn hiển thị trên trang web và thao tác này không thể hoàn tác.`,
      }),
      t('common.permanentDeleteTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (!confirmed) return
    setDeletingId(slider.id)
    deleteMutation.mutate(slider.id)
  }

  function handleToggleActive(slider) {
    setTogglingId(slider.id)
    toggleActiveMutation.mutate({ id: slider.id, isActive: slider.isActive === false })
  }

  const buildPayload = () => buildSliderPayload(form)

  function handleSubmit(e) {
    e.preventDefault()
    setProductTouched(true)
    const productError = validateSliderProduct(form, t)
    if (productError) {
      setProductFieldError(productError)
      setFormError('')
      return
    }
    setFormError('')
    setProductFieldError('')
    const payload = buildPayload()
    if (editingId) {
      editMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleReorder(reordered) {
    if (reorderMutation.isPending) return

    // Optimistic update
    queryClient.setQueryData(['sliders', location], (prev) => {
      if (!prev) return prev
      const updated = reordered.map((item, idx) => ({ ...item, sortOrder: idx }))
      return { ...prev, items: updated }
    })

    // Single batch call — avoids UNIQUE(location, sort_order) race conditions
    reorderMutation.mutate({
      location,
      items: reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })),
    })
  }

  const isSaving =
    createMutation.isPending ||
    editMutation.isPending ||
    reorderMutation.isPending ||
    toggleActiveMutation.isPending

  return (
    <Screen>
      <ScreenHeader
        group="content"
        title={t('sliders.title')}
        actions={
          canFullEdit ? (
            <Button
              type="button"
              onClick={() => {
                if (showForm && !editingId) {
                  confirmCloseForm()
                } else {
                  openAddForm()
                }
              }}
            >
              <Plus size={14} />
              {showForm && !editingId ? t('common.cancel') : t('sliders.addBtn')}
            </Button>
          ) : null
        }
      />

      {warning ? <ReadOnlyBanner warning={warning} /> : null}
      {canUpdate && !canFullEdit ? (
        <ReadOnlyBanner warning={t('sliders.limitedEditWarning')} />
      ) : null}

      {showForm && (
        <DetailSection
          title={editingId ? t('sliders.editFormTitle') : t('sliders.formTitle')}
          className="mb-4"
        >
          <form onSubmit={handleSubmit}>
            {formError && <p className="mb-3 text-danger">{formError}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {/* F10: nhóm 9 trường thành 4 khối có tiêu đề thay vì 1 lưới phẳng. */}
              <h3 className="col-span-full text-sm font-semibold text-foreground">
                {t('sliders.sectionPosition', { defaultValue: 'Vị trí & thứ tự' })}
              </h3>
              {/* Vị trí cố định Trang chủ (owner decision 2026-07-15) — không còn Select chọn vị trí. */}
              <FormField label={t('sliders.formLocation')}>
                <Input value={locationLabel(t, HOME_LOCATION)} disabled readOnly />
              </FormField>
              <FormField label={t('sliders.formSortOrder')} required>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                />
              </FormField>
              {/* V2: bỏ marginTop:22 canh thủ công — checkbox giờ đứng riêng 1 hàng full-width, không cần canh theo ô cạnh bên. */}
              <label className="col-span-full flex min-h-11 w-fit cursor-pointer items-center gap-3 rounded-[var(--admin-radius-control)] border border-border p-3 text-sm hover:bg-muted">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({ ...p, isActive: checked === true }))
                  }
                />
                <span>{t('sliders.formIsActive')}</span>
              </label>

              <h3 className="col-span-full border-t border-border pt-4 text-sm font-semibold text-foreground">
                {t('sliders.sectionDesktopImage', { defaultValue: 'Ảnh hiển thị trên máy tính' })}
              </h3>
              <FormField
                label={t('sliders.formDesktopUrl')}
                helper={t('sliders.formDesktopUrlHint')}
                full
              >
                <ImageUrlInput
                  value={form.desktopImageUrl}
                  onChange={(url, media) =>
                    setForm((p) => ({
                      ...p,
                      desktopImageUrl: url,
                      desktopImageWidth: media?.width ?? null,
                      desktopImageHeight: media?.height ?? null,
                      desktopImageMimeType: media?.mimeType ?? '',
                    }))
                  }
                  alt={form.desktopImageAlt}
                  onAltChange={(alt) => setForm((p) => ({ ...p, desktopImageAlt: alt }))}
                  previewAlt={form.desktopImageAlt || t('sliders.formDesktopUrl')}
                  recommend={IMAGE_RECO.sliderDesktop}
                />
              </FormField>

              <h3 className="col-span-full border-t border-border pt-4 text-sm font-semibold text-foreground">
                {t('sliders.sectionMobileImage', { defaultValue: 'Ảnh hiển thị trên điện thoại' })}
              </h3>
              <div className="col-span-full flex flex-col gap-2">
                <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  {t('sliders.formMobileUrl', { defaultValue: 'Ảnh hiển thị trên điện thoại' })}
                  <HelpTooltip content={t('sliders.formMobileUrlHint')} />
                </span>
                <ImageUrlInput
                  value={form.mobileImageUrl}
                  onChange={(url, media) =>
                    setForm((p) => ({
                      ...p,
                      mobileImageUrl: url,
                      mobileImageWidth: media?.width ?? null,
                      mobileImageHeight: media?.height ?? null,
                      mobileImageMimeType: media?.mimeType ?? '',
                    }))
                  }
                  alt={form.mobileImageAlt}
                  onAltChange={(alt) => setForm((p) => ({ ...p, mobileImageAlt: alt }))}
                  previewAlt={
                    form.mobileImageAlt ||
                    t('sliders.formMobileUrl', { defaultValue: 'Ảnh hiển thị trên điện thoại' })
                  }
                  recommend={IMAGE_RECO.sliderMobile}
                />
              </div>

              <h3 className="col-span-full border-t border-border pt-4 text-sm font-semibold text-foreground">
                {t('sliders.sectionLink', { defaultValue: 'Liên kết' })}
              </h3>
              <FormField
                label={t('sliders.formProduct', { defaultValue: 'Sản phẩm liên kết' })}
                helper={t('sliders.formProductHint', {
                  defaultValue: 'Chọn sản phẩm để banner mở tới trang chi tiết sản phẩm.',
                })}
                error={productTouched ? productFieldError : undefined}
                required
                full
              >
                {form.productId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{form.productName || form.productId}</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSelectedProduct}
                    >
                      {t('common.remove', { defaultValue: 'Bỏ chọn' })}
                    </Button>
                  </div>
                ) : (
                  <ProductPickerCombobox
                    search={productSearch}
                    onSearchChange={(v) => {
                      setProductSearch(v)
                      setProductPickerOpen(true)
                      if (productFieldError) setProductFieldError('')
                    }}
                    onFocus={() => setProductPickerOpen(true)}
                    open={productPickerOpen && productSearch.trim().length > 0}
                    onOpenChange={(next) => {
                      if (!next) setProductPickerOpen(false)
                    }}
                    loading={isSearchingProducts}
                    items={productSearchItems}
                    onPick={handlePickProduct}
                    placeholder={t('sliders.formProductSearchPlaceholder', {
                      defaultValue: 'Tìm sản phẩm theo tên hoặc mã sản phẩm…',
                    })}
                    loadingText={`${t('common.loading')}…`}
                    emptyText={t('sliders.formProductNoResults', {
                      defaultValue: 'Không tìm thấy sản phẩm phù hợp.',
                    })}
                  />
                )}
              </FormField>
            </div>
            <StickyActionBar ariaLabel={t('common.actions')}>
              <Button type="button" variant="outline" onClick={confirmCloseForm}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingId ? t('common.update') : t('sliders.saveBtn')}
              </Button>
            </StickyActionBar>
          </form>
        </DetailSection>
      )}

      {isLoading ? <ScreenSkeleton variant="cards" count={4} showHeader={false} /> : null}
      {isError && (
        <StatePanel
          tone="danger"
          title={t('sliders.error')}
          description={error?.message}
          actionLabel={t('common.retry')}
          onAction={() => queryClient.invalidateQueries({ queryKey: ['sliders', location] })}
        />
      )}
      {!isLoading &&
        !isError &&
        visibleItems.length === 0 &&
        (filteredByLang ? (
          // Có banner ở vị trí này nhưng tất cả bị ẩn vì chưa có nội dung tiếng Anh.
          <StatePanel
            tone="neutral"
            title={t('sliders.emptyFilteredLang', {
              defaultValue: 'Không có banner tiếng Anh ở vị trí này',
            })}
            description={t('sliders.emptyFilteredLangDesc', {
              defaultValue:
                'Các banner ở vị trí này được gắn sản phẩm chưa có tên tiếng Anh nên bị ẩn ở chế độ tiếng Anh. Chuyển về tiếng Việt để xem, hoặc bổ sung tên tiếng Anh cho sản phẩm.',
            })}
          />
        ) : (
          <StatePanel
            tone="neutral"
            title={t('sliders.empty')}
            description={t('sliders.emptyDesc', { location: locationLabel(t, location) })}
            actionLabel={canFullEdit ? t('sliders.addBtn') : undefined}
            onAction={canFullEdit ? openAddForm : undefined}
          />
        ))}

      {visibleItems.length > 0 && (
        <SortableList
          items={visibleItems}
          disabled={!canUpdate || reorderMutation.isPending}
          onReorder={handleReorder}
          className="flex flex-col gap-2"
          renderItem={(slider, sortable) => (
            <SliderCard
              slider={slider}
              canUpdate={canUpdate}
              canFullEdit={canFullEdit}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              sortable={sortable}
              toggling={togglingId === slider.id && toggleActiveMutation.isPending}
              deleting={deletingId === slider.id && deleteMutation.isPending}
            />
          )}
          renderOverlay={(slider) => (
            <SliderCard
              slider={slider}
              canUpdate={false}
              canFullEdit={false}
              onEdit={() => {}}
              onDelete={() => {}}
              onToggleActive={() => {}}
            />
          )}
        />
      )}
    </Screen>
  )
}
