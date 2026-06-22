import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { SortableList } from '../components/Sortable'
import { createSlider, deleteSlider, fetchProducts, fetchSliders, reorderSliders, updateSlider } from '../lib/adminApi'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { showConfirm } from '../lib/confirm'
import { validateSafePublicLink } from '../lib/urlPolicies'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

const LOCATIONS = ['home', 'category', 'category_sidebar', 'promotion']
const EMPTY_FORM = {
  location: 'home',
  sortOrder: '0',
  desktopImageUrl: '',
  desktopAlt: '',
  mobileImageUrl: '',
  mobileAlt: '',
  externalLink: '',
  productId: '',
  productName: '',
  isActive: true,
}

function SliderCard({ slider, canUpdate, onEdit, onDelete, onToggleActive, sortable, toggling, deleting }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const productLabel = contentLang === 'en'
    ? (slider.productNameEn || slider.productName || slider.productId)
    : (slider.productName || slider.productId)
  const dragOpacity = sortable?.isDragging ? 0.4 : 1

  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: slider.isActive === false ? 0.55 : dragOpacity }}
      className="bb-card"
    >
      <div className="bb-card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', flexWrap: 'wrap' }}>
        {canUpdate && sortable && (
          <button
            type="button"
            {...sortable.handleProps}
            className="bb-icon-btn"
            style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
            title={t('sliders.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
            aria-label={t('sliders.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
          >
            <GripVertical size={16} />
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          {slider.desktopImage?.url && (
            <img
              src={slider.desktopImage.url}
              alt={slider.desktopImage.alt || ''}
              title="Desktop"
              style={{ width: 100, height: 52, objectFit: 'cover', borderRadius: 6 }}
            />
          )}
          {slider.mobileImage?.url && (
            <img
              src={slider.mobileImage.url}
              alt={slider.mobileImage.alt || ''}
              title="Mobile"
              style={{ width: 60, height: 32, objectFit: 'cover', borderRadius: 6 }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>#{slider.sortOrder} · {slider.location}</span>
            <span className={`bb-badge ${slider.isActive !== false ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
              <span className="dot" />
              {slider.isActive !== false ? t('sliders.statusActive') : t('sliders.statusInactive')}
            </span>
          </div>
          {slider.externalLink && (
            <p className="bb-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, fontSize: 12 }}>
              {t('sliders.linkLabel')} {slider.externalLink}
            </p>
          )}
          {slider.productId && (
            <p className="bb-muted" style={{ margin: 0, fontSize: 12 }}>
              {t('sliders.productLabel')} {productLabel}
            </p>
          )}
        </div>

        {canUpdate && (
          <div className="flex gap-2" style={{ flexShrink: 0, alignItems: 'flex-start' }}>
            <button
              type="button"
              className="bb-btn bb-btn-secondary bb-btn-sm"
              disabled={toggling}
              aria-busy={toggling}
              onClick={() => onToggleActive(slider)}
            >
              {toggling
                ? t('common.saving')
                : (slider.isActive !== false ? t('common.disable') : t('common.enable'))}
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-secondary bb-btn-sm"
              disabled={deleting}
              onClick={() => onEdit(slider)}
            >
              {t('common.edit')}
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-secondary bb-btn-sm"
              style={{ color: 'var(--bb-danger)' }}
              disabled={deleting}
              aria-busy={deleting}
              onClick={() => onDelete(slider.id)}
            >
              {deleting ? t('common.deleting', { defaultValue: 'Đang xoá...' }) : t('common.delete')}
            </button>
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
  const [location, setLocation] = useState('home')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, location: 'home' })
  const [formError, setFormError] = useState('')
  // Lỗi inline cạnh nhóm link ngoài / product ID (tiêu chí 7.1/7.2).
  const [linkFieldError, setLinkFieldError] = useState('')
  // ID banner đang gọi API bật/tắt hoặc xoá → disable đúng nút trên thẻ đó.
  const [togglingId, setTogglingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  // Tìm-chọn sản phẩm cho trường Product ID (thay ô gõ ID thủ công).
  const [productSearch, setProductSearch] = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const debouncedProductSearch = useDebounce(productSearch, 300)

  const { data: productSearchData, isFetching: isSearchingProducts } = useQuery({
    queryKey: ['slider-product-search', debouncedProductSearch, contentLang],
    queryFn: () => fetchProducts({ q: debouncedProductSearch, page: 1, pageSize: 8, publishStatus: 'PUBLISHED' }),
    enabled: productPickerOpen && debouncedProductSearch.trim().length > 0,
    staleTime: 30_000,
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sliders', location],
    queryFn: () => fetchSliders(location),
  })

  const items = [...(data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  // Admin VI/EN switch (strict English): ở EN ẩn banner liên kết tới SP chưa có tên
  // tiếng Anh. Banner không gắn SP (chỉ ảnh/link ngoài) vẫn hiện vì không có nội dung để dịch.
  const visibleItems = contentLang === 'en'
    ? items.filter((s) => !s.productId || (s.productNameEn || '').trim() !== '')
    : items
  // Có banner ở vị trí này nhưng tất cả bị ẩn do lọc tiếng Anh (để phân biệt
  // "trống thật" với "ẩn vì chưa có tên tiếng Anh" ở empty-state).
  const filteredByLang = items.length > 0 && visibleItems.length === 0
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      toast.success(t('sliders.toggleSuccess', { defaultValue: 'Đã cập nhật trạng thái' }))
    },
    onError: (e) => toast.error(e?.message || t('sliders.saveError', { defaultValue: 'Lỗi khi cập nhật trạng thái' })),
    onSettled: () => setTogglingId(null),
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

  function openAddForm() {
    setEditingId(null)
    const nextOrder = items.length > 0
      ? Math.max(...items.map((i) => Number(i.sortOrder ?? 0))) + 1
      : 0
    setForm({ ...EMPTY_FORM, location, sortOrder: String(nextOrder) })
    setFormError('')
    setLinkFieldError('')
    setProductSearch('')
    setProductPickerOpen(false)
    setShowForm(true)
  }

  function handleEdit(slider) {
    setEditingId(slider.id)
    setForm({
      location: slider.location,
      sortOrder: String(slider.sortOrder),
      desktopImageUrl: slider.desktopImage?.url || '',
      desktopAlt: slider.desktopImage?.alt || '',
      mobileImageUrl: slider.mobileImage?.url || '',
      mobileAlt: slider.mobileImage?.alt || '',
      externalLink: slider.externalLink || '',
      productId: slider.productId || '',
      productName: slider.productName || slider.productNameEn || '',
      isActive: slider.isActive !== false,
    })
    setFormError('')
    setLinkFieldError('')
    setProductSearch('')
    setProductPickerOpen(false)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError('')
    setLinkFieldError('')
    setProductSearch('')
    setProductPickerOpen(false)
  }

  const handlePickProduct = useCallback((product) => {
    setForm((p) => ({ ...p, productId: product.id, productName: product.name || product.id }))
    setProductSearch('')
    setProductPickerOpen(false)
    setLinkFieldError('')
    setFormError('')
  }, [])

  function clearSelectedProduct() {
    setForm((p) => ({ ...p, productId: '', productName: '' }))
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

  function buildPayload() {
    const payload = {
      location: form.location,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
      externalLink: form.externalLink.trim() || undefined,
      productId: form.productId.trim() || undefined,
    }
    if (form.desktopImageUrl.trim()) {
      payload.desktopImage = { url: form.desktopImageUrl.trim(), alt: form.desktopAlt.trim() || undefined }
    }
    if (form.mobileImageUrl.trim()) {
      payload.mobileImage = { url: form.mobileImageUrl.trim(), alt: form.mobileAlt.trim() || undefined }
    }
    return payload
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Lỗi đích sát nhóm link ngoài / sản phẩm (tiêu chí 7.1/7.2) thay vì chỉ banner đầu form.
    if (!form.externalLink.trim() && !form.productId.trim()) {
      setLinkFieldError(t('sliders.formRequired'))
      setFormError('')
      return
    }
    if (form.externalLink.trim()) {
      const linkValidation = validateSafePublicLink(form.externalLink)
      if (!linkValidation.valid) {
        setLinkFieldError(t('sliders.formExternalLinkInvalid'))
        setFormError('')
        return
      }
    }
    setFormError('')
    setLinkFieldError('')
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
            <button
              type="button"
              className="bb-btn bb-btn-primary"
              onClick={() => { if (showForm && !editingId) { closeForm() } else { openAddForm() } }}
            >
              <Plus size={14} />{showForm && !editingId ? t('common.cancel') : t('sliders.addBtn')}
            </button>
          </div>
        )}
      </div>

      {warning ? <ReadOnlyBanner warning={warning} /> : null}

      <div className="bb-filter-bar">
        <FilterSelect
          value={location}
          onValueChange={(v) => { setLocation(v); closeForm() }}
          ariaLabel={t('sliders.filterLocation')}
          options={LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
        />
      </div>

      {showForm && (
        <div className="bb-card mb-4">
          <div className="bb-card-header"><h2>{editingId ? t('sliders.editFormTitle') : t('sliders.formTitle')}</h2></div>
          <form onSubmit={handleSubmit} className="bb-card-body">
            {formError && <p className="mb-3 text-danger">{formError}</p>}
            <div className="bb-grid-2">
              <label className="form-field">
                <span>{t('sliders.formLocation')}</span>
                <Select value={form.location} onValueChange={(val) => setForm((p) => ({ ...p, location: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="form-field">
                <span>{t('sliders.formSortOrder')}</span>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))} />
              </label>
              <label
                className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit"
                style={{ marginTop: 22 }}
              >
                <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked === true }))} />
                <span>{t('sliders.formIsActive')}</span>
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formDesktopUrl')}</span>
                <ImageUrlInput value={form.desktopImageUrl} onChange={(url) => setForm((p) => ({ ...p, desktopImageUrl: url }))} recommend={IMAGE_RECO.sliderDesktop} />
                <span className="hint">{t('sliders.formDesktopUrlHint')}</span>
              </div>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formDesktopAlt')}</span>
                <Input value={form.desktopAlt} onChange={(e) => setForm((p) => ({ ...p, desktopAlt: e.target.value }))} />
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formMobileUrl')}</span>
                <ImageUrlInput value={form.mobileImageUrl} onChange={(url) => setForm((p) => ({ ...p, mobileImageUrl: url }))} recommend={IMAGE_RECO.bannerMobile} />
                <span className="hint">{t('sliders.formMobileUrlHint')}</span>
              </div>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formMobileAlt')}</span>
                <Input value={form.mobileAlt} onChange={(e) => setForm((p) => ({ ...p, mobileAlt: e.target.value }))} />
              </label>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formExternalLink')}</span>
                <Input
                  placeholder="https://..."
                  value={form.externalLink}
                  aria-invalid={linkFieldError ? true : undefined}
                  onChange={(e) => { setForm((p) => ({ ...p, externalLink: e.target.value })); if (linkFieldError) setLinkFieldError('') }}
                />
                <span className="hint">{t('sliders.formExternalLinkHint')}</span>
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formProduct', { defaultValue: 'Sản phẩm liên kết' })}</span>
                {form.productId ? (
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
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
                    onSearchChange={(v) => { setProductSearch(v); setProductPickerOpen(true) }}
                    onFocus={() => setProductPickerOpen(true)}
                    open={productPickerOpen && productSearch.trim().length > 0}
                    onOpenChange={(next) => { if (!next) setProductPickerOpen(false) }}
                    loading={isSearchingProducts}
                    items={productSearchData?.items ?? []}
                    onPick={handlePickProduct}
                    placeholder={t('sliders.formProductSearchPlaceholder', { defaultValue: 'Tìm sản phẩm theo tên hoặc SKU…' })}
                    loadingText={`${t('common.loading')}…`}
                    emptyText={t('sliders.formProductNoResults', { defaultValue: 'Không tìm thấy sản phẩm phù hợp.' })}
                  />
                )}
                <span className="hint">{t('sliders.formProductHint', { defaultValue: 'Chọn sản phẩm để banner trỏ tới trang sản phẩm đó. Có thể để trống nếu đã nhập link ngoài.' })}</span>
              </div>
              {linkFieldError && (
                <small className="field-error" style={{ gridColumn: '1 / -1' }} role="alert">{linkFieldError}</small>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" loading={isSaving}>{editingId ? t('common.update') : t('sliders.saveBtn')}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <StatePanel tone="info" title={t('sliders.loading')} description={t('common.pleaseWait')} />}
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
            description={t('sliders.emptyDesc', { location })}
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
