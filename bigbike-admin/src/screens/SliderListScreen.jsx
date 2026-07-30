import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { SortableList } from '../components/Sortable'
import { createSlider, deleteSlider, fetchSliders, reorderSliders, updateSlider } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { useProductPicker } from '../lib/useProductPicker'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { HOME_LOCATION, buildSliderPayload, validateSliderProduct } from './slider-list/sliderPayload'
// Nhãn tiếng Việt thân thiện cho mã vị trí kỹ thuật (T2). Mã lạ → trả nguyên mã.
function locationLabel(t, code) {
  return code === HOME_LOCATION
    ? t('sliders.locationHome', { defaultValue: 'Trang chủ' })
    : code
}
const EMPTY_FORM = {
  location: HOME_LOCATION,
  sortOrder: '0',
  desktopImageUrl: '',
  mobileImageUrl: '',
  mobileImageAlt: '',
  productId: '',
  productName: '',
  isActive: true,
}

function SliderCard({ slider, canUpdate, onEdit, onDelete, onToggleActive, sortable, toggling, deleting }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const productLabel = contentLang === 'en'
    ? (slider.productNameEn || slider.productName || t('sliders.productUnnamed', { defaultValue: 'Sản phẩm đã liên kết' }))
    : (slider.productName || t('sliders.productUnnamed', { defaultValue: 'Sản phẩm đã liên kết' }))
  return (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={`bb-card bb-slider-card ${slider.isActive === false ? 'is-inactive' : ''} ${sortable?.isDragging ? 'is-dragging' : ''}`}
    >
      <div className="bb-card-body bb-slider-card-body">
        {canUpdate && sortable && (
          <Button
            variant="unstyled"
            {...sortable.handleProps}
            className="bb-icon-btn bb-slider-drag"
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
              title="Desktop"
              className="bb-slider-thumb bb-slider-thumb--desktop"
            />
          )}
          {slider.mobileImage?.url && (
            <img
              src={slider.mobileImage.url}
              alt={slider.mobileImage.alt || ''}
              title="Mobile"
              className="bb-slider-thumb bb-slider-thumb--mobile"
            />
          )}
        </div>

        <div className="bb-slider-copy">
          <div className="bb-slider-title-row">
            <span className="bb-slider-title">#{slider.sortOrder} · {locationLabel(t, slider.location)}</span>
            <span className={`bb-badge ${slider.isActive !== false ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
              <span className="dot" />
              {slider.isActive !== false ? t('sliders.statusActive') : t('sliders.statusInactive')}
            </span>
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
              {slider.isActive !== false ? t('sliders.hideAction', { defaultValue: 'Ẩn' }) : t('sliders.showAction', { defaultValue: 'Hiện' })}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => onEdit(slider)}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-danger"
              disabled={deleting}
              aria-busy={deleting}
              onClick={() => onDelete(slider.id)}
            >
              {deleting ? t('common.deleting', { defaultValue: 'Đang xoá...' }) : t('common.delete')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function SliderListScreen({ canUpdate }) {
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
      toast.error(e?.message || t('sliders.saveError', { defaultValue: 'Lỗi khi cập nhật trạng thái' }))
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
  useUnsavedChanges(isDirty, t('sliders.unsavedConfirm', {
    defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
  }))

  // O3: Ctrl/Cmd+S lưu form banner khi đang mở.
  useSaveShortcut(showForm && canUpdate, handleSubmit)

  // Hỏi xác nhận trước khi bỏ form nếu đang có thay đổi chưa lưu, rồi đóng form.
  async function confirmCloseForm() {
    if (isDirty) {
      const ok = await showConfirm(
        t('sliders.unsavedConfirm', {
          defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
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
    const nextOrder = items.length > 0
      ? Math.max(...items.map((i) => Number(i.sortOrder ?? 0))) + 1
      : 0
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
      desktopImageUrl: slider.desktopImage?.url || '',
      mobileImageUrl: slider.mobileImage?.url || '',
      mobileImageAlt: slider.mobileImage?.alt || '',
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

  const handlePickProduct = useCallback((product) => {
    setForm((p) => ({ ...p, productId: product.id, productName: product.name || product.id }))
    setProductSearch('')
    setProductPickerOpen(false)
    setProductFieldError('')
    setFormError('')
  }, [setProductSearch])

  function clearSelectedProduct() {
    const next = { ...form, productId: '', productName: '' }
    setForm(next)
    // Bỏ sản phẩm sau khi đã tương tác → hiển thị ngay lỗi bắt buộc.
    if (productTouched) setProductFieldError(validateSliderProduct(next, t))
  }

  async function handleDelete(sliderId) {
    const confirmed = await showConfirm(
      t('sliders.deleteConfirmDetail', {
        defaultValue: 'Banner sẽ bị xoá vĩnh viễn và không còn hiển thị trên trang web. Thao tác này không thể hoàn tác.',
      }),
      t('sliders.deleteConfirmTitle'),
    )
    if (!confirmed) return
    setDeletingId(sliderId)
    deleteMutation.mutate(sliderId)
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

  const isSaving = createMutation.isPending || editMutation.isPending
    || reorderMutation.isPending || toggleActiveMutation.isPending

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('sliders.eyebrow')}</p>
          <h1>{t('sliders.title')}</h1>
          <p className="bb-muted">{t('sliders.description')}</p>
        </div>
        {canUpdate && (
          <div className="bb-screen-actions">
            <Button
              type="button"
              onClick={() => { if (showForm && !editingId) { confirmCloseForm() } else { openAddForm() } }}
            >
              <Plus size={14} />{showForm && !editingId ? t('common.cancel') : t('sliders.addBtn')}
            </Button>
          </div>
        )}
      </div>

      {warning ? <ReadOnlyBanner warning={warning} /> : null}

      {showForm && (
        <div className="bb-card mb-4">
          <div className="bb-card-header"><h2>{editingId ? t('sliders.editFormTitle') : t('sliders.formTitle')}</h2></div>
          <form onSubmit={handleSubmit} className="bb-card-body">
            {formError && <p className="mb-3 text-danger">{formError}</p>}
            <p className="bb-muted mb-3 text-xs">
              <span className="text-danger" aria-hidden="true">*</span> {t('sliders.requiredLegend', { defaultValue: 'Bắt buộc' })}
            </p>
            <div className="bb-grid-2">
              {/* F10: nhóm 9 trường thành 4 khối có tiêu đề thay vì 1 lưới phẳng. */}
              <div className="bb-form-section-label">
                {t('sliders.sectionPosition', { defaultValue: 'Vị trí & thứ tự' })}
              </div>
              {/* Vị trí cố định Trang chủ (owner decision 2026-07-15) — không còn Select chọn vị trí. */}
              <label className="form-field">
                <span>{t('sliders.formLocation')}</span>
                <Input value={locationLabel(t, HOME_LOCATION)} disabled readOnly />
              </label>
              <label className="form-field">
                <span>
                  {t('sliders.formSortOrder')}
                  <span className="text-danger ml-0.5" aria-hidden="true">*</span>
                </span>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))} />
              </label>
              {/* V2: bỏ marginTop:22 canh thủ công — checkbox giờ đứng riêng 1 hàng full-width, không cần canh theo ô cạnh bên. */}
              <label
                className="form-field-wide flex w-fit cursor-pointer items-center gap-2.5 border border-border p-2.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked === true }))} />
                <span>{t('sliders.formIsActive')}</span>
              </label>

              <div className="bb-form-section-label with-divider">
                {t('sliders.sectionDesktopImage', { defaultValue: 'Ảnh desktop' })}
              </div>
              <div className="form-field form-field-wide">
                <span>{t('sliders.formDesktopUrl')}</span>
                <ImageUrlInput
                  value={form.desktopImageUrl}
                  onChange={(url) => setForm((p) => ({ ...p, desktopImageUrl: url }))}
                  recommend={IMAGE_RECO.sliderDesktop}
                />
                <span className="hint">{t('sliders.formDesktopUrlHint')}</span>
              </div>

              <div className="bb-form-section-label with-divider">
                {t('sliders.sectionMobileImage', { defaultValue: 'Ảnh mobile' })}
              </div>
              <div className="form-field form-field-wide">
                <span>{t('sliders.formMobileUrl', { defaultValue: 'Ảnh mobile' })}</span>
                <ImageUrlInput
                  value={form.mobileImageUrl}
                  onChange={(url) => setForm((p) => ({ ...p, mobileImageUrl: url }))}
                  alt={form.mobileImageAlt}
                  onAltChange={(alt) => setForm((p) => ({ ...p, mobileImageAlt: alt }))}
                  previewAlt={form.mobileImageAlt || t('sliders.formMobileUrl', { defaultValue: 'Ảnh mobile' })}
                  recommend={IMAGE_RECO.sliderMobile}
                />
                <span className="hint">{t('sliders.formMobileUrlHint')}</span>
              </div>

              <div className="bb-form-section-label with-divider">
                {t('sliders.sectionLink', { defaultValue: 'Liên kết' })}
              </div>
              <p className="form-field-wide -mt-1 text-xs text-muted-foreground">
                {t('sliders.productRequiredHint', { defaultValue: 'Bắt buộc: chọn sản phẩm mà banner sẽ mở tới.' })}
              </p>
              <div className="form-field form-field-wide">
                <span>
                  {t('sliders.formProduct', { defaultValue: 'Sản phẩm liên kết' })}
                  <span className="text-danger ml-0.5" aria-hidden="true">*</span>
                </span>
                {form.productId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bb-badge bb-badge-neutral">
                      {form.productName || form.productId}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={clearSelectedProduct}>
                      {t('common.remove', { defaultValue: 'Bỏ chọn' })}
                    </Button>
                  </div>
                ) : (
                  <ProductPickerCombobox
                    search={productSearch}
                    onSearchChange={(v) => { setProductSearch(v); setProductPickerOpen(true); if (productFieldError) setProductFieldError('') }}
                    onFocus={() => setProductPickerOpen(true)}
                    open={productPickerOpen && productSearch.trim().length > 0}
                    onOpenChange={(next) => { if (!next) setProductPickerOpen(false) }}
                    loading={isSearchingProducts}
                    items={productSearchItems}
                    onPick={handlePickProduct}
                    placeholder={t('sliders.formProductSearchPlaceholder', { defaultValue: 'Tìm sản phẩm theo tên hoặc SKU…' })}
                    loadingText={`${t('common.loading')}…`}
                    emptyText={t('sliders.formProductNoResults', { defaultValue: 'Không tìm thấy sản phẩm phù hợp.' })}
                  />
                )}
                <span className="hint">{t('sliders.formProductHint', { defaultValue: 'Chọn sản phẩm để banner mở tới trang chi tiết sản phẩm.' })}</span>
                {productTouched && productFieldError && (
                  <small className="field-error" role="alert">{productFieldError}</small>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" loading={isSaving}>{editingId ? t('common.update') : t('sliders.saveBtn')}</Button>
              <Button type="button" variant="outline" onClick={confirmCloseForm}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={t('sliders.loading')}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bb-skeleton-block" style={{ height: 96 }} />
          ))}
        </div>
      )}
      {isError && <StatePanel tone="danger" title={t('sliders.error')} description={error?.message} actionLabel={t('common.retry')} onAction={() => queryClient.invalidateQueries({ queryKey: ['sliders', location] })} />}
      {!isLoading && !isError && visibleItems.length === 0 && (
        filteredByLang ? (
          // Có banner ở vị trí này nhưng tất cả bị ẩn vì chưa có nội dung tiếng Anh.
          <StatePanel
            tone="neutral"
            title={t('sliders.emptyFilteredLang', { defaultValue: 'Không có banner tiếng Anh ở vị trí này' })}
            description={t('sliders.emptyFilteredLangDesc', { defaultValue: 'Các banner ở vị trí này được gắn sản phẩm chưa có tên tiếng Anh nên bị ẩn ở chế độ tiếng Anh. Chuyển về tiếng Việt để xem, hoặc bổ sung tên tiếng Anh cho sản phẩm.' })}
          />
        ) : (
          <StatePanel
            tone="neutral"
            title={t('sliders.empty')}
            description={t('sliders.emptyDesc', { location: locationLabel(t, location) })}
            actionLabel={canUpdate ? t('sliders.addBtn') : undefined}
            onAction={canUpdate ? openAddForm : undefined}
          />
        )
      )}

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
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              sortable={sortable}
              toggling={togglingId === slider.id && toggleActiveMutation.isPending}
              deleting={deletingId === slider.id && deleteMutation.isPending}
            />
          )}
          renderOverlay={(slider) => (
            <SliderCard slider={slider} canUpdate={false} onEdit={() => {}} onDelete={() => {}} onToggleActive={() => {}} />
          )}
        />
      )}
    </div>
  )
}
