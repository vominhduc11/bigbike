import { useState } from 'react'
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
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { createSlider, deleteSlider, fetchSliders, reorderSliders, updateSlider } from '../lib/adminApi'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { validateSafePublicLink } from '../lib/urlPolicies'
import { Badge } from '@/components/ui/badge'
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
  isActive: true,
}

function SliderCard({ slider, canUpdate, onEdit, onDelete, onToggleActive }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSelf } = useSortable({
    id: slider.id,
    disabled: !canUpdate,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSelf ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: slider.isActive === false ? 0.55 : undefined }}
      className="flex gap-3 items-start rounded-md border border-border bg-surface px-4 py-3 shadow-xs"
    >
      {canUpdate && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="bg-transparent border-none cursor-grab px-1 py-0.5 text-muted-foreground shrink-0 touch-none"
          title={t('sliders.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
          aria-label={t('sliders.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
        >
          <GripVertical size={16} />
        </button>
      )}

      <div className="flex flex-col gap-1 shrink-0">
        {slider.desktopImage?.url && (
          <img
            src={slider.desktopImage.url}
            alt={slider.desktopImage.alt || ''}
            title="Desktop"
            className="object-cover rounded w-[100px] h-[52px]"
          />
        )}
        {slider.mobileImage?.url && (
          <img
            src={slider.mobileImage.url}
            alt={slider.mobileImage.alt || ''}
            title="Mobile"
            className="object-cover rounded w-[60px] h-[32px]"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="m-0 text-sm font-semibold">
            #{slider.sortOrder} · {slider.location}
          </p>
          <Badge variant={slider.isActive !== false ? 'success' : 'muted'}>
            {slider.isActive !== false ? t('sliders.statusActive') : t('sliders.statusInactive')}
          </Badge>
        </div>
        {slider.externalLink && (
          <p className="truncate text-xs text-muted-foreground">
            {t('sliders.linkLabel')} {slider.externalLink}
          </p>
        )}
        {slider.productId && (
          <p className="text-xs text-muted-foreground">
            {t('sliders.productLabel')} {slider.productId}
          </p>
        )}
      </div>

      {canUpdate && (
        <div className="flex gap-1.5 shrink-0 items-start">
          <Button variant="outline" size="sm" onClick={() => onToggleActive(slider)}>
            {slider.isActive !== false ? t('common.disable') : t('common.enable')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(slider)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(slider.id)}>
            {t('common.delete')}
          </Button>
        </div>
      )}
    </div>
  )
}

export function SliderListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [location, setLocation] = useState('home')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, location: 'home' })
  const [formError, setFormError] = useState('')
  const [activeId, setActiveId] = useState(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sliders', location],
    queryFn: () => fetchSliders(location),
  })

  const items = [...(data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  const warning = data?.mode === 'mock' ? (data?.warning ?? '') : ''

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
  })

  const deleteMutation = useMutation({
    mutationFn: (sliderId) => deleteSlider(sliderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sliders', location] })
      toast.success(t('sliders.deleteSuccess', { defaultValue: 'Đã xoá slider' }))
    },
    onError: (e) => toast.error(e.message || t('sliders.deleteError')),
  })

  function openAddForm() {
    setEditingId(null)
    const nextOrder = items.length > 0
      ? Math.max(...items.map((i) => Number(i.sortOrder ?? 0))) + 1
      : 0
    setForm({ ...EMPTY_FORM, location, sortOrder: String(nextOrder) })
    setFormError('')
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
      isActive: slider.isActive !== false,
    })
    setFormError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError('')
  }

  async function handleDelete(sliderId) {
    const confirmed = await showConfirm(t('sliders.deleteConfirm'), t('sliders.deleteConfirmTitle'))
    if (!confirmed) return
    deleteMutation.mutate(sliderId)
  }

  function handleToggleActive(slider) {
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
    if (!form.externalLink.trim() && !form.productId.trim()) {
      setFormError(t('sliders.formRequired'))
      return
    }
    if (form.externalLink.trim()) {
      const linkValidation = validateSafePublicLink(form.externalLink)
      if (!linkValidation.valid) {
        setFormError(t('sliders.formExternalLinkInvalid'))
        return
      }
    }
    setFormError('')
    const payload = buildPayload()
    if (editingId) {
      editMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDragStart(event) {
    if (!canUpdate || reorderMutation.isPending) return
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    if (!canUpdate || reorderMutation.isPending) return
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)

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

  const activeSlider = activeId ? items.find((i) => i.id === activeId) : null
  const isSaving = createMutation.isPending || editMutation.isPending
    || reorderMutation.isPending || toggleActiveMutation.isPending

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('sliders.eyebrow')}</p>
          <h1>{t('sliders.title')}</h1>
          <p>{t('sliders.description')}</p>
        </div>
        {canUpdate && (
          <Button onClick={() => { if (showForm && !editingId) { closeForm() } else { openAddForm() } }}>
            {showForm && !editingId ? t('common.cancel') : t('sliders.addBtn')}
          </Button>
        )}
      </header>

      {warning ? <ReadOnlyBanner warning={warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('sliders.filterLocation')}
          <Select value={location} onValueChange={(val) => { setLocation(val); closeForm() }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
          </SelectContent></Select>
        </label>
      </section>

      {showForm && (
        <form onSubmit={handleSubmit} className="detail-section">
          <div className="detail-section-header">
            <h2>{editingId ? t('sliders.editFormTitle') : t('sliders.formTitle')}</h2>
          </div>
          <div className="detail-section-content">
            {formError && <p className="mb-3 text-danger">{formError}</p>}
            <div className="form-grid">
              <label className="form-field">
                {t('sliders.formLocation')}
                <Select value={form.location} onValueChange={(val) => setForm((p) => ({ ...p, location: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent></Select>
              </label>
              <label className="form-field">
                {t('sliders.formSortOrder')}
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}  />
              </label>
              <label className="form-field flex items-center gap-2">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked === true }))}
                 />
                {t('sliders.formIsActive')}
              </label>

              <div className="form-field form-field-wide">
                <span>{t('sliders.formDesktopUrl')}</span>
                <ImageUrlInput
                  value={form.desktopImageUrl}
                  onChange={(url) => setForm((p) => ({ ...p, desktopImageUrl: url }))}
                />
              </div>
              <label className="form-field form-field-wide">
                {t('sliders.formDesktopAlt')}
                <Input value={form.desktopAlt} onChange={(e) => setForm((p) => ({ ...p, desktopAlt: e.target.value }))}  />
              </label>

              <div className="form-field form-field-wide">
                <span>{t('sliders.formMobileUrl')}</span>
                <ImageUrlInput
                  value={form.mobileImageUrl}
                  onChange={(url) => setForm((p) => ({ ...p, mobileImageUrl: url }))}
                />
              </div>
              <label className="form-field form-field-wide">
                {t('sliders.formMobileAlt')}
                <Input value={form.mobileAlt} onChange={(e) => setForm((p) => ({ ...p, mobileAlt: e.target.value }))}  />
              </label>

              <label className="form-field form-field-wide">
                {t('sliders.formExternalLink')}
                <Input placeholder="https://..." value={form.externalLink} onChange={(e) => setForm((p) => ({ ...p, externalLink: e.target.value }))}  />
                <small className="field-help">{t('sliders.formExternalLinkHint')}</small>
              </label>
              <label className="form-field">
                {t('sliders.formProductId')}
                <Input value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}  />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" loading={isSaving}>
                {editingId ? t('common.update') : t('sliders.saveBtn')}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </form>
      )}

      {isLoading && <StatePanel tone="info" title={t('sliders.loading')} description={t('common.pleaseWait')} />}
      {isError && <StatePanel tone="danger" title={t('sliders.error')} description={error?.message} actionLabel={t('common.retry')} onAction={() => queryClient.invalidateQueries({ queryKey: ['sliders', location] })} />}
      {!isLoading && !isError && items.length === 0 && (
        <StatePanel tone="neutral" title={t('sliders.empty')} description={t('sliders.emptyDesc', { location })} />
      )}

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2">
              {items.map((slider) => (
                <SliderCard
                  key={slider.id}
                  slider={slider}
                  canUpdate={canUpdate}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeSlider ? (
              <SliderCard slider={activeSlider} canUpdate={false} onEdit={() => {}} onDelete={() => {}} onToggleActive={() => {}} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  )
}
