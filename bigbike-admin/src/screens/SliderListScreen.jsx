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
      style={{ ...style, opacity: slider.isActive === false ? 0.55 : style.opacity }}
      className="card"
    >
      <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px' }}>
        {canUpdate && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="icon-btn"
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
            <span className="fw-700 text-sm">#{slider.sortOrder} · {slider.location}</span>
            <span className={`badge ${slider.isActive !== false ? 'badge-success' : 'badge-neutral'}`}>
              <span className="dot" />
              {slider.isActive !== false ? t('sliders.statusActive') : t('sliders.statusInactive')}
            </span>
          </div>
          {slider.externalLink && (
            <p className="text-xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {t('sliders.linkLabel')} {slider.externalLink}
            </p>
          )}
          {slider.productId && (
            <p className="text-xs muted" style={{ margin: 0 }}>
              {t('sliders.productLabel')} {slider.productId}
            </p>
          )}
        </div>

        {canUpdate && (
          <div className="flex gap-2" style={{ flexShrink: 0, alignItems: 'flex-start' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onToggleActive(slider)}>
              {slider.isActive !== false ? t('common.disable') : t('common.enable')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onEdit(slider)}>
              {t('common.edit')}
            </button>
            <button type="button" className="btn btn-outline btn-sm text-danger" onClick={() => onDelete(slider.id)}>
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>
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
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('sliders.eyebrow')}</p>
          <h1>{t('sliders.title')}</h1>
          <p className="desc">{t('sliders.description')}</p>
        </div>
        {canUpdate && (
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { if (showForm && !editingId) { closeForm() } else { openAddForm() } }}
            >
              {showForm && !editingId ? t('common.cancel') : t('sliders.addBtn')}
            </button>
          </div>
        )}
      </div>

      {warning ? <ReadOnlyBanner warning={warning} /> : null}

      <div className="filter-bar">
        <select
          className="filter-select"
          value={location}
          onChange={(e) => { setLocation(e.target.value); closeForm() }}
          aria-label={t('sliders.filterLocation')}
        >
          {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-head"><h2>{editingId ? t('sliders.editFormTitle') : t('sliders.formTitle')}</h2></div>
          <form onSubmit={handleSubmit} className="card-body">
            {formError && <p className="mb-3 text-danger">{formError}</p>}
            <div className="grid-2">
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
                <ImageUrlInput value={form.desktopImageUrl} onChange={(url) => setForm((p) => ({ ...p, desktopImageUrl: url }))} />
              </div>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formDesktopAlt')}</span>
                <Input value={form.desktopAlt} onChange={(e) => setForm((p) => ({ ...p, desktopAlt: e.target.value }))} />
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formMobileUrl')}</span>
                <ImageUrlInput value={form.mobileImageUrl} onChange={(url) => setForm((p) => ({ ...p, mobileImageUrl: url }))} />
              </div>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formMobileAlt')}</span>
                <Input value={form.mobileAlt} onChange={(e) => setForm((p) => ({ ...p, mobileAlt: e.target.value }))} />
              </label>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('sliders.formExternalLink')}</span>
                <Input placeholder="https://..." value={form.externalLink} onChange={(e) => setForm((p) => ({ ...p, externalLink: e.target.value }))} />
                <span className="hint">{t('sliders.formExternalLinkHint')}</span>
              </label>
              <label className="form-field">
                <span>{t('sliders.formProductId')}</span>
                <Input value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} />
              </label>
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
            <div className="flex flex-col gap-2">
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
    </div>
  )
}
