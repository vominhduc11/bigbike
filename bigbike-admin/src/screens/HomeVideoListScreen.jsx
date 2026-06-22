import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { AlertCircle, GripVertical, Play, Plus } from 'lucide-react'
import { useDragSensors, SortableRow } from '../components/Sortable'
import { toast } from '@/lib/toast'
import {
  fetchHomeVideos,
  createHomeVideo,
  updateHomeVideo,
  deleteHomeVideo,
  reorderHomeVideos,
} from '../lib/adminApi'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { VideoPickerModal } from '../components/VideoPickerModal'
import { MediaDimensionWarning } from '../components/MediaDimensionWarning'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { BulkActionBar } from '../components/BulkActionBar'
import { FormField } from '../components/layout/FormField'
import { showConfirm } from '../lib/confirm'
import { useContentLang } from '../lib/contentLang'
import { extractAllowedYouTubeId, validateHomeVideoUrl } from '../lib/urlPolicies'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const EMPTY_FORM = {
  title: '',
  titleEn: '',
  videoType: 'youtube',
  videoUrl: '',
  thumbnailUrl: '',
  thumbnailAlt: '',
  isActive: true,
}

function VideoPreviewModal({ video, onClose }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const displayTitle = contentLang === 'en' ? (video.titleEn || video.title) : video.title
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
          className="absolute top-2.5 right-3 z-[1] inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-xs border-none bg-black/60 text-2xl leading-none cursor-pointer text-white"
          aria-label={t('common.close', { defaultValue: 'Đóng' })}
        >×</button>

        <div className="relative pb-[56.25%]">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={displayTitle}
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

        {displayTitle && (
          <p className="m-0 px-4 py-2.5 text-xs font-semibold text-white bg-black">
            {displayTitle}
          </p>
        )}
      </div>
    </div>
  )
}

function VideoCard({ video, canUpdate, onEdit, onDelete, onToggleActive, onPreview, selected, onSelect, selectionMode }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const displayTitle = contentLang === 'en' ? (video.titleEn || video.title) : video.title
  const thumbSrc = video.thumbnail?.url
    || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg` : null)

  return (
    <SortableRow id={video.id} disabled={!canUpdate || selectionMode}>
      {(sortable) => (
    <div
      ref={sortable.setNodeRef}
      style={{
        ...sortable.style,
        opacity: video.isActive === false && !selected ? 0.55 : (sortable.isDragging ? 0.4 : 1),
        ...(selected ? { borderColor: 'var(--admin-color-primary)', background: 'var(--admin-color-surface-selected)' } : {}),
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', flexWrap: 'wrap',
      }}
      className="bb-card"
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
              {...sortable.handleProps}
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
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black/55">
            <Play size={14} fill="white" className="text-white ml-0.5" aria-hidden="true" />
          </span>
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-bold text-sm mb-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayTitle}
        </div>
        <div className="text-xs bb-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.videoUrl}
        </div>
        <div className="mt-1">
          <span className={`bb-badge ${video.isActive ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
            {video.isActive ? t('homeVideos.statusVisible') : t('homeVideos.statusHidden')}
          </span>
        </div>
      </div>

      {canUpdate && (
        <div className="flex gap-2" style={{ flexShrink: 0 }}>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={() => onToggleActive(video)}>
            {video.isActive ? t('homeVideos.hideAction') : t('homeVideos.showAction')}
          </button>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={() => onEdit(video)}>
            {t('common.edit')}
          </button>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" style={{ color: 'var(--bb-danger)' }} onClick={() => onDelete(video.id)}>
            {t('common.delete')}
          </button>
        </div>
      )}
    </div>
      )}
    </SortableRow>
  )
}

export function HomeVideoListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // Lỗi gắn theo từng ô (title/videoUrl) + lỗi chung của form (vd lỗi lưu từ server).
  const [fieldErrors, setFieldErrors] = useState({})
  const [localItems, setLocalItems] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [previewVideo, setPreviewVideo] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isBulkBusy, setIsBulkBusy] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const sensors = useDragSensors()

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
    onError: (err) => setFieldErrors({ form: err.message || t('homeVideos.createError') }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }) => updateHomeVideo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success(t('homeVideos.updateSuccess'))
      resetForm()
    },
    onError: (err) => setFieldErrors({ form: err.message || t('homeVideos.updateError') }),
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
    setFieldErrors({})
  }

  function openEdit(video) {
    setEditingVideo(video)
    setForm({
      title: video.title,
      titleEn: video.titleEn || '',
      videoType: video.youtubeId ? 'youtube' : 'upload',
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnail?.url || '',
      thumbnailAlt: video.thumbnail?.alt || '',
      isActive: video.isActive,
    })
    setFieldErrors({})
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

  // Kiểm tra hợp lệ trả về lỗi gắn theo từng ô để hiện ngay cạnh ô sai (tiêu chí 7.2/7.3).
  function validateForm(values) {
    const errors = {}
    if (!values.title.trim()) {
      errors.title = t('homeVideos.validationTitle')
    }
    const videoCheck = validateHomeVideoUrl(values.videoUrl)
    if (!videoCheck.valid) {
      errors.videoUrl = values.videoType === 'youtube'
        ? t('homeVideos.validationYoutube')
        : t('homeVideos.validationUpload')
    } else if (values.videoType === 'youtube' && !extractAllowedYouTubeId(values.videoUrl)) {
      errors.videoUrl = t('homeVideos.validationYoutube')
    } else if (values.videoType === 'upload' && videoCheck.source !== 'upload') {
      errors.videoUrl = t('homeVideos.validationUpload')
    }
    return errors
  }

  // "Reward early, punish late": chỉ báo lỗi ô khi admin rời ô (blur), và xoá lỗi
  // ngay khi admin sửa lại đúng (tiêu chí 7.1).
  function validateField(field) {
    const errors = validateForm(form)
    setFieldErrors((prev) => {
      const next = { ...prev }
      if (errors[field]) next[field] = errors[field]
      else delete next[field]
      return next
    })
  }

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field] && !prev.form) return prev
      const next = { ...prev }
      delete next[field]
      delete next.form
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()

    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const title = form.title.trim()
    const videoCheck = validateHomeVideoUrl(form.videoUrl)
    const hasThumbnail = Boolean(form.thumbnailUrl.trim())
    const newSortOrder = items.length > 0
      ? Math.max(...items.map((video) => video.sortOrder)) + 1
      : 0
    const input = {
      title,
      titleEn: form.titleEn.trim(),
      videoUrl: videoCheck.normalized,
      sortOrder: editingVideo ? editingVideo.sortOrder : newSortOrder,
      isActive: form.isActive,
      thumbnail: hasThumbnail
        ? { url: form.thumbnailUrl.trim(), alt: form.thumbnailAlt.trim() || title }
        : null,
      ...(editingVideo && !hasThumbnail ? { clearThumbnail: true } : {}),
    }

    setFieldErrors({})
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
    // Admin VI/EN switch (strict English): ở EN chỉ hiện video đã có tiêu đề tiếng Anh.
    if (contentLang === 'en' && !(v.titleEn || '').trim()) return false
    const q = searchText.trim().toLowerCase()
    const matchSearch = q === ''
      || v.title.toLowerCase().includes(q)
      || (v.titleEn || '').toLowerCase().includes(q)
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
      toast.success(isActive ? t('homeVideos.bulkShowSuccess', { count: selectedIds.size }) : t('homeVideos.bulkHideSuccess', { count: selectedIds.size }))
    } catch {
      toast.error(t('homeVideos.bulkActionError'))
    } finally {
      setIsBulkBusy(false)
    }
  }

  async function handleBulkDelete() {
    const count = selectedIds.size
    const confirmed = await showConfirm(t('homeVideos.bulkDeleteConfirm', { count }), t('homeVideos.bulkDeleteConfirmTitle'))
    if (!confirmed) return
    setIsBulkBusy(true)
    try {
      await Promise.all([...selectedIds].map((id) => deleteHomeVideo(id)))
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      setSelectedIds(new Set())
      toast.success(t('homeVideos.bulkDeleteSuccess', { count }))
    } catch {
      toast.error(t('homeVideos.bulkActionError'))
    } finally {
      setIsBulkBusy(false)
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const youtubePreviewId = extractAllowedYouTubeId(form.videoUrl)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true" aria-label={t('homeVideos.loading')}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bb-skeleton-block" style={{ height: 82 }} />
        ))}
      </div>
    )
  }
  if (isError) return <StatePanel tone="danger" title={t('homeVideos.loadError')} description={error?.message} />

  const listContent = items.length === 0 ? (
    <StatePanel
      tone="neutral"
      title={t('homeVideos.empty')}
      description={t('homeVideos.emptyDescription')}
      actionLabel={canUpdate ? t('homeVideos.addButton') : undefined}
      onAction={canUpdate ? () => { setShowForm(true); setEditingVideo(null); setForm(EMPTY_FORM); setFieldErrors({}) } : undefined}
    />
  ) : (
    <div className="flex flex-col gap-2.5">

      {/* Filter bar */}
      <div className="flex gap-2 items-center">
        <Input
          type="search"
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setSelectedIds(new Set()) }}
          placeholder={t('homeVideos.searchPlaceholder', { defaultValue: 'Tìm theo tên video...' })}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setSelectedIds(new Set()) }}>
          <SelectTrigger className="w-auto text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('homeVideos.filterAll', { defaultValue: 'Tất cả' })} ({items.length})</SelectItem>
            <SelectItem value="active">{t('homeVideos.filterActive', { defaultValue: 'Đang hiện' })} ({items.filter((v) => v.isActive).length})</SelectItem>
            <SelectItem value="hidden">{t('homeVideos.filterHidden', { defaultValue: 'Đang ẩn' })} ({items.filter((v) => !v.isActive).length})</SelectItem>
          </SelectContent>
        </Select>
        {isFiltering && (
          <Button type="button" variant="outline" size="sm" className="whitespace-nowrap"
            onClick={() => { setSearchText(''); setStatusFilter('ALL'); setSelectedIds(new Set()) }}>
            {t('homeVideos.clearFilter', { defaultValue: 'Xoá bộ lọc' })}
          </Button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('homeVideos.noMatch', { defaultValue: 'Không tìm thấy video' })}
          description={t('homeVideos.noMatchDescription', { defaultValue: 'Thử thay đổi từ khoá hoặc bộ lọc trạng thái.' })}
          actionLabel={t('homeVideos.clearFilter', { defaultValue: 'Xoá bộ lọc' })}
          onAction={() => { setSearchText(''); setStatusFilter('ALL'); setSelectedIds(new Set()) }}
        />
      ) : (<>

      {canUpdate && (
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(checked) => handleSelectAll(checked)}
            aria-label={t('homeVideos.selectAll', { defaultValue: 'Chọn tất cả' })}
           />
          <span className="text-sm text-muted-foreground">
            {selectionMode
              ? t('homeVideos.selectedOf', { selected: selectedIds.size, total: items.length, defaultValue: `Đã chọn ${selectedIds.size} / ${items.length}` })
              : t('homeVideos.selectAll', { defaultValue: 'Chọn tất cả' })}
          </span>
          {selectionMode && (
            <Button type="button" variant="outline" size="sm" className="ml-1"
              onClick={() => setSelectedIds(new Set())}>
              {t('common.deselect', { defaultValue: 'Bỏ chọn' })}
            </Button>
          )}
        </div>
      )}

      {selectionMode && canUpdate && (
        <BulkActionBar
          selectedCount={t('homeVideos.bulkSelectedLabel', { count: selectedIds.size, defaultValue: `${selectedIds.size} video đã chọn` })}
          onClear={() => setSelectedIds(new Set())}
          actions={[
            { label: t('homeVideos.hideAction'), onClick: () => handleBulkSetActive(false), disabled: isBulkBusy },
            { label: t('homeVideos.showAction'), onClick: () => handleBulkSetActive(true), disabled: isBulkBusy },
            { label: t('common.delete'), onClick: handleBulkDelete, disabled: isBulkBusy, tone: 'danger' },
          ]}
        />
      )}

      {isFiltering && (
        <p className="text-xs text-muted-foreground m-0 mb-1 ml-0.5">
          {t('homeVideos.filterReorderHint', {
            shown: filteredItems.length,
            total: items.length,
            defaultValue: `${filteredItems.length} / ${items.length} video — kéo thả sắp xếp bị tắt khi đang lọc`,
          })}
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

      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('homeVideos.eyebrow', { defaultValue: 'Nội dung' })}</p>
          <h1>{t('homeVideos.title')}</h1>
          <p className="bb-muted">{t('homeVideos.description', { defaultValue: 'Quản lý video hiển thị trên trang chủ.' })}</p>
        </div>
        {canUpdate && !showForm && (
          <div className="bb-screen-actions">
            <button
              type="button"
              className="bb-btn bb-btn-primary"
              onClick={() => { setShowForm(true); setEditingVideo(null); setForm(EMPTY_FORM); setFieldErrors({}) }}
            >
              <Plus size={14} />{t('homeVideos.addButton')}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bb-card mb-4">
          <div className="bb-card-header">
            <h2>{editingVideo ? t('homeVideos.editTitle') : t('homeVideos.createTitle')}</h2>
          </div>
          <form onSubmit={handleSubmit} className="bb-card-body flex flex-col gap-3">
          {fieldErrors.form ? (
            <div
              role="alert"
              className="flex items-center gap-1.5 rounded-xs border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger m-0"
            >
              <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
              {fieldErrors.form}
            </div>
          ) : null}

          <FormField
            label={t('homeVideos.formTitle')}
            required
            error={fieldErrors.title}
          >
            <Input
              required
              value={form.title}
              onChange={(event) => { setForm((prev) => ({ ...prev, title: event.target.value })); clearFieldError('title') }}
              onBlur={() => validateField('title')}
              placeholder={t('homeVideos.formTitlePlaceholder')}
            />
          </FormField>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('homeVideos.formTitleEn')}
            <Input
              value={form.titleEn}
              onChange={(event) => setForm((prev) => ({ ...prev, titleEn: event.target.value }))}
              placeholder={t('homeVideos.formTitleEnPlaceholder')}
            />
            <span className="text-xs font-normal text-muted-foreground">{t('homeVideos.formTitleEnHint')}</span>
          </label>

          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            {t('homeVideos.formSource')}
            <RadioGroup
              value={form.videoType}
              onValueChange={(value) => { setForm((prev) => ({ ...prev, videoType: value, videoUrl: '' })); clearFieldError('videoUrl') }}
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
            <div className="flex flex-col gap-1">
              <FormField
                label={t('homeVideos.formYoutubeUrl')}
                required
                error={fieldErrors.videoUrl}
                helper={t('homeVideos.youtubeHint')}
              >
                <Input
                  required
                  type="url"
                  value={form.videoUrl}
                  onChange={(event) => { setForm((prev) => ({ ...prev, videoUrl: event.target.value })); clearFieldError('videoUrl') }}
                  onBlur={() => validateField('videoUrl')}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </FormField>
              {youtubePreviewId && (
                <img
                  src={`https://img.youtube.com/vi/${youtubePreviewId}/maxresdefault.jpg`}
                  alt={t('homeVideos.youtubePreviewAlt')}
                  className="mt-1.5 w-full max-w-xs h-auto rounded-xs border border-border"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-sm font-semibold">
              {t('homeVideos.formUpload')}
              {fieldErrors.videoUrl ? (
                <span className="flex items-center gap-1 text-xs text-danger font-normal" role="alert">
                  <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
                  {fieldErrors.videoUrl}
                </span>
              ) : null}
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
              recommend={IMAGE_RECO.videoThumb}
            />
            <span className="text-xs text-muted-foreground font-normal">{t('homeVideos.formThumbnailHint')}</span>
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
          onSelect={(url) => { setForm((prev) => ({ ...prev, videoUrl: url })); clearFieldError('videoUrl'); setVideoPickerOpen(false) }}
          onClose={() => setVideoPickerOpen(false)}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}
    </div>
  )
}
