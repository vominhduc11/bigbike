import { useState, useEffect } from 'react'
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
import {
  fetchHomeVideos,
  createHomeVideo,
  updateHomeVideo,
  deleteHomeVideo,
  reorderHomeVideos,
} from '../lib/adminApi'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { VideoPickerModal } from '../components/VideoPickerModal'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { extractAllowedYouTubeId, validateHomeVideoUrl } from '../lib/urlPolicies'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const EMPTY_FORM = {
  title: '',
  videoType: 'youtube',
  videoUrl: '',
  thumbnailUrl: '',
  thumbnailAlt: '',
  isActive: true,
}

function VideoPreviewModal({ video, onClose }) {
  const embedUrl = video.youtubeId
    ? `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`
    : null

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/80"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[90vw] max-w-[800px] overflow-hidden rounded-md bg-black"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-3 z-[1] rounded-xs border-none bg-black/60 text-2xl leading-none cursor-pointer px-2 py-0.5 text-white"
          aria-label="Đóng"
        >×</button>

        <div className="relative pb-[56.25%]">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-none"
            />
          ) : video.videoUrl ? (
            <video
              src={video.videoUrl}
              controls
              autoPlay
              className="absolute inset-0 w-full h-full"
            />
          ) : null}
        </div>

        {video.title && (
          <p className="m-0 px-4 py-2.5 text-xs font-semibold text-white bg-black">
            {video.title}
          </p>
        )}
      </div>
    </div>
  )
}

function VideoCard({ video, canUpdate, onEdit, onDelete, onToggleActive, onPreview, selected, onSelect, selectionMode }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
    disabled: !canUpdate || selectionMode,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const thumbSrc = video.thumbnail?.url
    || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg` : null)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: video.isActive === false && !selected ? 0.55 : style.opacity,
        ...(selected ? { borderColor: 'var(--admin-color-brand-red)', background: 'var(--admin-color-surface-selected)' } : {}),
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px',
      }}
      className="card"
    >
      {canUpdate && (
        <div className="flex items-center gap-1 shrink-0">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(video.id, checked)}
            aria-label={`Chọn video ${video.title}`}
           />
          {!selectionMode && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="bg-transparent border-none cursor-grab px-1 py-0.5 text-muted-foreground touch-none"
              aria-label={t('homeVideos.dragToReorder')}
            >
              <GripVertical size={16} />
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onPreview}
        className="shrink-0 w-24 h-[58px] rounded-sm overflow-hidden bg-black border-none p-0 cursor-pointer relative"
        aria-label={`Xem trước: ${video.title}`}
      >
        {thumbSrc
          ? <img src={thumbSrc} alt={video.title} className="w-full h-full object-cover block" />
          : video.videoUrl
            ? <video src={video.videoUrl} preload="metadata" muted className="w-full h-full object-cover block pointer-events-none" />
            : <div className="w-full h-full bg-black" />
        }
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <svg viewBox="0 0 40 40" width={28} height={28} fill="none">
            <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.55)" />
            <polygon points="16,12 16,28 30,20" fill="white" />
          </svg>
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-700 text-sm mb-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.title}
        </div>
        <div className="text-xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.videoUrl}
        </div>
        <div className="mt-1">
          <span className={`badge ${video.isActive ? 'badge-success' : 'badge-neutral'}`}>
            {video.isActive ? t('homeVideos.statusVisible') : t('homeVideos.statusHidden')}
          </span>
        </div>
      </div>

      {canUpdate && (
        <div className="flex gap-2" style={{ flexShrink: 0 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onToggleActive(video)}>
            {video.isActive ? t('homeVideos.hideAction') : t('homeVideos.showAction')}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onEdit(video)}>
            {t('common.edit')}
          </button>
          <button type="button" className="btn btn-outline btn-sm text-danger" onClick={() => onDelete(video.id)}>
            {t('common.delete')}
          </button>
        </div>
      )}
    </div>
  )
}

export function HomeVideoListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [localItems, setLocalItems] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [previewVideo, setPreviewVideo] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isBulkBusy, setIsBulkBusy] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['home-videos'],
    queryFn: fetchHomeVideos,
  })

  const items = localItems ?? (data?.items ?? [])
  const activeItem = activeId ? items.find((video) => video.id === activeId) : null

  const createMutation = useMutation({
    mutationFn: createHomeVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success(t('homeVideos.createSuccess'))
      resetForm()
    },
    onError: (err) => setFormError(err.message || t('homeVideos.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }) => updateHomeVideo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success(t('homeVideos.updateSuccess'))
      resetForm()
    },
    onError: (err) => setFormError(err.message || t('homeVideos.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteHomeVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success(t('homeVideos.deleteSuccess'))
    },
    onError: (err) => toast.error(err.message || t('homeVideos.deleteError')),
  })

  const reorderMutation = useMutation({
    mutationFn: (reorderItems) => reorderHomeVideos(reorderItems),
    onMutate: async (reorderItems) => {
      await queryClient.cancelQueries({ queryKey: ['home-videos'] })
      const previous = queryClient.getQueryData(['home-videos'])
      const optimisticItems = items.map((video) => {
        const next = reorderItems.find((entry) => entry.id === video.id)
        return next ? { ...video, sortOrder: next.sortOrder } : video
      }).sort((left, right) => left.sortOrder - right.sortOrder)
      setLocalItems(optimisticItems)
      return { previous }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['home-videos'], result)
      setLocalItems(result.items)
    },
    onError: (err, _vars, context) => {
      toast.error(err.message || t('homeVideos.reorderError'))
      if (context?.previous) {
        queryClient.setQueryData(['home-videos'], context.previous)
      }
      setLocalItems(null)
    },
  })

  function resetForm() {
    setShowForm(false)
    setEditingVideo(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function openEdit(video) {
    setEditingVideo(video)
    setForm({
      title: video.title,
      videoType: video.youtubeId ? 'youtube' : 'upload',
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnail?.url || '',
      thumbnailAlt: video.thumbnail?.alt || '',
      isActive: video.isActive,
    })
    setFormError('')
    setShowForm(true)
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm(t('homeVideos.deleteConfirm'), t('homeVideos.deleteConfirmTitle'))
    if (!confirmed) return
    deleteMutation.mutate(id)
  }

  function handleToggleActive(video) {
    updateMutation.mutate({
      id: video.id,
      input: { isActive: !video.isActive },
    })
  }

  function handleSubmit(event) {
    event.preventDefault()

    const title = form.title.trim()
    if (!title) {
      setFormError(t('homeVideos.validationTitle'))
      return
    }

    const videoCheck = validateHomeVideoUrl(form.videoUrl)
    if (!videoCheck.valid) {
      setFormError(form.videoType === 'youtube' ? t('homeVideos.validationYoutube') : t('homeVideos.validationUpload'))
      return
    }

    if (form.videoType === 'youtube' && !extractAllowedYouTubeId(form.videoUrl)) {
      setFormError(t('homeVideos.validationYoutube'))
      return
    }

    if (form.videoType === 'upload' && videoCheck.source !== 'upload') {
      setFormError(t('homeVideos.validationUpload'))
      return
    }

    const hasThumbnail = Boolean(form.thumbnailUrl.trim())
    const newSortOrder = items.length > 0
      ? Math.max(...items.map((video) => video.sortOrder)) + 1
      : 0
    const input = {
      title,
      videoUrl: videoCheck.normalized,
      sortOrder: editingVideo ? editingVideo.sortOrder : newSortOrder,
      isActive: form.isActive,
      thumbnail: hasThumbnail
        ? { url: form.thumbnailUrl.trim(), alt: form.thumbnailAlt.trim() || title }
        : null,
      ...(editingVideo && !hasThumbnail ? { clearThumbnail: true } : {}),
    }

    setFormError('')
    if (editingVideo) {
      updateMutation.mutate({ id: editingVideo.id, input })
    } else {
      createMutation.mutate(input)
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
    const oldIndex = items.findIndex((video) => video.id === active.id)
    const newIndex = items.findIndex((video) => video.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((video, index) => ({ ...video, sortOrder: index }))
    setLocalItems(reordered)
    reorderMutation.mutate(reordered.map((video) => ({ id: video.id, sortOrder: video.sortOrder })))
  }

  const isFiltering = searchText.trim() !== '' || statusFilter !== 'ALL'
  const filteredItems = items.filter((v) => {
    const matchSearch = searchText.trim() === '' || v.title.toLowerCase().includes(searchText.trim().toLowerCase())
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'active' ? v.isActive : !v.isActive)
    return matchSearch && matchStatus
  })

  const selectionMode = selectedIds.size > 0
  const allSelected = filteredItems.length > 0 && filteredItems.every((v) => selectedIds.has(v.id))
  const someSelected = selectionMode && !allSelected

  function handleSelect(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function handleSelectAll(checked) {
    setSelectedIds(checked ? new Set(filteredItems.map((v) => v.id)) : new Set())
  }

  async function handleBulkSetActive(isActive) {
    setIsBulkBusy(true)
    try {
      await Promise.all([...selectedIds].map((id) => updateHomeVideo(id, { isActive })))
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      setSelectedIds(new Set())
      toast.success(isActive ? `Đã hiện ${selectedIds.size} video` : `Đã ẩn ${selectedIds.size} video`)
    } catch {
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsBulkBusy(false)
    }
  }

  async function handleBulkDelete() {
    const count = selectedIds.size
    const confirmed = await showConfirm(`Xoá ${count} video đã chọn? Thao tác này không thể hoàn tác.`, 'Xoá hàng loạt')
    if (!confirmed) return
    setIsBulkBusy(true)
    try {
      await Promise.all([...selectedIds].map((id) => deleteHomeVideo(id)))
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      setSelectedIds(new Set())
      toast.success(`Đã xoá ${count} video`)
    } catch {
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsBulkBusy(false)
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const youtubePreviewId = extractAllowedYouTubeId(form.videoUrl)

  if (isLoading) return <StatePanel tone="neutral" title={t('homeVideos.loading')} />
  if (isError) return <StatePanel tone="danger" title={t('homeVideos.loadError')} description={error?.message} />

  const listContent = items.length === 0 ? (
    <StatePanel tone="neutral" title={t('homeVideos.empty')} description={t('homeVideos.emptyDescription')} />
  ) : (
    <div className="flex flex-col gap-2.5">

      {/* Filter bar */}
      <div className="flex gap-2 items-center">
        <Input
          type="search"
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setSelectedIds(new Set()) }}
          placeholder="Tìm theo tên video..."
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setSelectedIds(new Set()) }}>
          <SelectTrigger className="w-auto text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả ({items.length})</SelectItem>
            <SelectItem value="active">Đang hiện ({items.filter((v) => v.isActive).length})</SelectItem>
            <SelectItem value="hidden">Đang ẩn ({items.filter((v) => !v.isActive).length})</SelectItem>
          </SelectContent>
        </Select>
        {isFiltering && (
          <Button type="button" variant="outline" size="sm" className="whitespace-nowrap"
            onClick={() => { setSearchText(''); setStatusFilter('ALL'); setSelectedIds(new Set()) }}>
            Xoá bộ lọc
          </Button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <StatePanel tone="neutral" title="Không tìm thấy video" description="Thử thay đổi từ khoá hoặc bộ lọc trạng thái." />
      ) : (<>

      {canUpdate && (
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(checked) => handleSelectAll(checked)}
            aria-label="Chọn tất cả"
           />
          <span className="text-sm text-muted-foreground">
            {selectionMode ? `Đã chọn ${selectedIds.size} / ${items.length}` : 'Chọn tất cả'}
          </span>
          {selectionMode && (
            <Button type="button" variant="outline" size="sm" className="ml-1"
              onClick={() => setSelectedIds(new Set())}>
              Bỏ chọn
            </Button>
          )}
        </div>
      )}

      {selectionMode && canUpdate && (
        <div className="flex gap-2 items-center rounded-md border border-border bg-surface-raised px-3.5 py-2.5">
          <span className="text-sm font-semibold mr-1">
            {selectedIds.size} video đã chọn:
          </span>
          <Button type="button" variant="outline" size="sm" disabled={isBulkBusy}
            onClick={() => handleBulkSetActive(false)}>Ẩn</Button>
          <Button type="button" variant="outline" size="sm" disabled={isBulkBusy}
            onClick={() => handleBulkSetActive(true)}>Hiện</Button>
          <Button type="button" variant="danger" size="sm" disabled={isBulkBusy}
            onClick={handleBulkDelete}>Xoá</Button>
        </div>
      )}

      {isFiltering && (
        <p className="text-xs text-muted-foreground m-0 mb-1 ml-0.5">
          {filteredItems.length} / {items.length} video — kéo thả sắp xếp bị tắt khi đang lọc
        </p>
      )}

      {filteredItems.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          canUpdate={canUpdate && !isFiltering}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onPreview={() => setPreviewVideo(video)}
          selected={selectedIds.has(video.id)}
          onSelect={handleSelect}
          selectionMode={selectionMode || isFiltering}
        />
      ))}
      </>)}
    </div>
  )

  return (
    <div>
      {!canUpdate && <ReadOnlyBanner />}

      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('homeVideos.eyebrow', { defaultValue: 'Nội dung' })}</p>
          <h1>{t('homeVideos.title')}</h1>
          <p className="desc">{t('homeVideos.description', { defaultValue: 'Quản lý video hiển thị trên trang chủ.' })}</p>
        </div>
        {canUpdate && !showForm && (
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setShowForm(true); setEditingVideo(null); setForm(EMPTY_FORM); setFormError('') }}
            >
              {t('homeVideos.addButton')}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-head">
            <h2>{editingVideo ? t('homeVideos.editTitle') : t('homeVideos.createTitle')}</h2>
          </div>
          <form onSubmit={handleSubmit} className="card-body flex flex-col gap-3">
          {formError ? (
            <p className="text-danger m-0">{formError}</p>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('homeVideos.formTitle')}
            <Input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder={t('homeVideos.formTitlePlaceholder')}
            />
          </label>

          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            {t('homeVideos.formSource')}
            <RadioGroup
              value={form.videoType}
              onValueChange={(value) => setForm((prev) => ({ ...prev, videoType: value, videoUrl: '' }))}
              className="flex gap-5 font-normal"
            >
              <label className="flex items-center gap-1.5 cursor-pointer">
                <RadioGroupItem value="youtube" />
                {t('homeVideos.sourceYoutube')}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <RadioGroupItem value="upload" />
                {t('homeVideos.sourceUpload')}
              </label>
            </RadioGroup>
          </div>

          {form.videoType === 'youtube' ? (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t('homeVideos.formYoutubeUrl')}
              <Input
                required
                type="url"
                value={form.videoUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <span className="text-xs text-muted-foreground font-normal">
                {t('homeVideos.youtubeHint')}
              </span>
              {youtubePreviewId && (
                <img
                  src={`https://img.youtube.com/vi/${youtubePreviewId}/maxresdefault.jpg`}
                  alt={t('homeVideos.youtubePreviewAlt')}
                  className="mt-1.5 w-full max-w-xs h-auto rounded-xs border border-border"
                />
              )}
            </label>
          ) : (
            <div className="flex flex-col gap-1 text-sm font-semibold">
              {t('homeVideos.formUpload')}
              <div className="flex gap-2 items-center">
                <Button variant="secondary" size="sm"
                  type="button"
                  onClick={() => setVideoPickerOpen(true)}
                  disabled={!canUpdate}
                >
                  {form.videoUrl ? t('homeVideos.changeVideo') : t('homeVideos.pickVideo')}
                </Button>
                {form.videoUrl && (
                  <Button variant="ghost" size="icon" className="text-danger hover:bg-danger-bg"
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, videoUrl: '' }))}
                    aria-label={t('homeVideos.removeVideo')}
                    disabled={!canUpdate}
                  >
                    ✕
                  </Button>
                )}
              </div>
              {form.videoUrl ? (
                <span className="text-xs text-success font-normal">
                  ✓ {form.videoUrl.split('/').pop()}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground font-normal">
                  {t('homeVideos.uploadHint')}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm font-semibold">
            {t('homeVideos.formThumbnail')}
            <ImageUrlInput
              value={form.thumbnailUrl}
              onChange={(url) => setForm((prev) => ({ ...prev, thumbnailUrl: url }))}
              alt={form.thumbnailAlt}
              onAltChange={(alt) => setForm((prev) => ({ ...prev, thumbnailAlt: alt }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: !!checked }))}
             />
            {t('homeVideos.formIsActive')}
          </label>

          <div className="flex gap-2.5">
            <Button type="submit" loading={isBusy}>
              {editingVideo ? t('homeVideos.saveChanges') : t('homeVideos.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
          </div>
          </form>
        </div>
      )}

      {canUpdate && items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((video) => video.id)} strategy={verticalListSortingStrategy}>
            {listContent}
          </SortableContext>
          <DragOverlay>
            {activeItem && (
              <VideoCard
                video={activeItem}
                canUpdate={false}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggleActive={() => {}}
                onPreview={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      ) : listContent}

      {videoPickerOpen && canUpdate && (
        <VideoPickerModal
          onSelect={(url) => { setForm((prev) => ({ ...prev, videoUrl: url })); setVideoPickerOpen(false) }}
          onClose={() => setVideoPickerOpen(false)}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}
    </div>
  )
}
