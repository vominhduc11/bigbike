import { useState, useMemo } from 'react'
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
import { AlertCircle, Check, GripVertical, Play, Plus, X } from 'lucide-react'
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
import { MediaRequirementHint } from '../components/MediaRequirementHint'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { BulkActionBar } from '../components/BulkActionBar'
import { FormField } from '../components/layout/FormField'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { useUrlSyncedState } from '@/lib/useUrlSyncedState'
import { useContentLang } from '../lib/contentLang'
import {
  extractAllowedYouTubeId,
  extractWritableYouTubeId,
  extractAllowedTikTokId,
  tiktokEmbedUrl,
  isAllowedFacebookVideoUrl,
  facebookEmbedUrl,
  isAllowedMediaVideoUrl,
  validateHomeVideoUrl,
} from '../lib/urlPolicies'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useHasPermission } from '@/lib/auth'
import { buildHomeVideoThumbnail } from './homeVideoPayload'

const EMPTY_FORM = {
  title: '',
  titleEn: '',
  videoType: 'youtube',
  videoUrl: '',
  thumbnailUrl: '',
  thumbnailAlt: '',
  thumbnailWidth: null,
  thumbnailHeight: null,
  thumbnailMimeType: '',
  isActive: true,
}

function VideoPreviewModal({ video, onClose }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const displayTitle = contentLang === 'en' ? (video.titleEn || video.title) : video.title
  const tiktokId = video.youtubeId ? null : extractAllowedTikTokId(video.videoUrl)
  const embedUrl = video.youtubeId
    ? `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`
    : tiktokId
      ? tiktokEmbedUrl(tiktokId)
      : (isAllowedFacebookVideoUrl(video.videoUrl) ? facebookEmbedUrl(video.videoUrl) : null)

  // A3: dùng Radix Dialog (ui/dialog) — tự lo focus-trap, Escape, khoá cuộn body và
  // trả focus về phần tử trigger khi đóng, thay cho hộp thoại tự dựng trước đây.
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showClose={false}
        className="w-[90vw] max-w-[800px] overflow-hidden border-0 bg-black p-0"
      >
        <DialogTitle className="sr-only">
          {displayTitle || t('homeVideos.previewTitle', { defaultValue: 'Xem trước video' })}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-3 top-2.5 z-[1] bg-black/60 text-white hover:bg-black/80 hover:text-white"
          aria-label={t('common.close', { defaultValue: 'Đóng' })}
        >
          <X size={20} aria-hidden="true" />
        </Button>

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
      </DialogContent>
    </Dialog>
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
      style={sortable.style}
      className={`bb-card bb-slider-card bb-slider-card-body ${video.isActive === false && !selected ? 'is-inactive' : ''} ${sortable.isDragging ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''}`}
    >
      {canUpdate && (
        <div className="flex items-center gap-1 shrink-0">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(video.id, checked)}
            aria-label={`Chọn video ${video.title}`}
           />
          {!selectionMode && (
            <Button
              variant="unstyled"
              {...sortable.handleProps}
              className="bb-related-grip"
              aria-label={t('homeVideos.dragToReorder')}
            >
              <GripVertical size={16} />
            </Button>
          )}
        </div>
      )}

      <Button
        variant="unstyled"
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
      </Button>

      <div className="bb-slider-copy">
        <div className="bb-slider-title-row">
          <span className="bb-slider-title">{displayTitle}</span>
          <span className={`bb-badge ${video.isActive ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
            {video.isActive ? t('homeVideos.statusVisible') : t('homeVideos.statusHidden')}
          </span>
        </div>
        <div className="bb-slider-meta">{video.videoUrl}</div>
      </div>

      {canUpdate && (
        <div className="bb-slider-actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => onToggleActive(video)}>
            {video.isActive ? t('homeVideos.hideAction') : t('homeVideos.showAction')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(video)}>
            {t('common.edit')}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="text-danger" onClick={() => onDelete(video)}>
            {t('common.delete')}
          </Button>
        </div>
      )}
    </div>
      )}
    </SortableRow>
  )
}

export function HomeVideoListScreen({ canUpdate }) {
  const hasPermission = useHasPermission()
  const canReadMedia = hasPermission('media.read')
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // F6: bản chụp form lúc mở, dùng để biết có thay đổi chưa lưu — mirror SliderListScreen.
  const [baseline, setBaseline] = useState(null)
  // Lỗi gắn theo từng ô (title/videoUrl) + lỗi chung của form (vd lỗi lưu từ server).
  const [fieldErrors, setFieldErrors] = useState({})
  const [localItems, setLocalItems] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [previewVideo, setPreviewVideo] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isBulkBusy, setIsBulkBusy] = useState(false)
  // T9: lưu bộ lọc vào URL để khôi phục khi quay lại màn hình.
  const [query, setQuery] = useUrlSyncedState({ q: '', status: 'ALL' })
  const searchText = query.q
  const statusFilter = query.status
  const setSearchText = (value) => setQuery((prev) => ({ ...prev, q: value }))
  const setStatusFilter = (value) => setQuery((prev) => ({ ...prev, status: value }))

  const sensors = useDragSensors()

  const { data, isLoading, isError, error, refetch } = useQuery({
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

  // N7: bật/ẩn 1 video phản hồi tức thì (lạc quan) + rollback nếu lỗi — pattern giống reorderMutation.
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateHomeVideo(id, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['home-videos'] })
      const previous = queryClient.getQueryData(['home-videos'])
      const previousLocal = localItems
      setLocalItems(items.map((video) => (video.id === id ? { ...video, isActive } : video)))
      return { previous, previousLocal }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
    },
    onError: (err, _vars, context) => {
      toast.error(err.message || t('homeVideos.updateError'))
      if (context?.previous) queryClient.setQueryData(['home-videos'], context.previous)
      setLocalItems(context?.previousLocal ?? null)
    },
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

  // F6: cảnh báo khi rời trang lúc form đang có thay đổi chưa lưu (mirror SliderListScreen).
  const isDirty = useMemo(() => {
    if (!showForm || !baseline) return false
    return JSON.stringify(form) !== JSON.stringify(baseline)
  }, [showForm, baseline, form])

  useUnsavedChanges(isDirty, t('homeVideos.unsavedConfirm', {
    defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
  }))

  // O3: Ctrl/Cmd+S lưu form video khi đang mở.
  useSaveShortcut(showForm && canUpdate, handleSubmit)

  function resetForm() {
    setShowForm(false)
    setEditingVideo(null)
    setForm(EMPTY_FORM)
    setBaseline(null)
    setFieldErrors({})
  }

  // F5/F6: Huỷ khi form đang có thay đổi chưa lưu → hỏi xác nhận trước, tránh mất bản nháp.
  async function handleCancelForm() {
    if (isDirty) {
      const ok = await showConfirm(
        t('homeVideos.unsavedConfirm', {
          defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
        }),
        t('homeVideos.unsavedTitle', { defaultValue: 'Có thay đổi chưa lưu' }),
      )
      if (!ok) return
    }
    resetForm()
  }

  // F6: mở form tạo mới — dùng chung cho nút "Thêm video" và hành động trên StatePanel rỗng.
  function openCreateForm() {
    setShowForm(true)
    setEditingVideo(null)
    setForm(EMPTY_FORM)
    setBaseline(EMPTY_FORM)
    setFieldErrors({})
  }

  function openEdit(video) {
    setEditingVideo(video)
    const next = {
      title: video.title,
      titleEn: video.titleEn || '',
      videoType: (video.youtubeId || extractAllowedYouTubeId(video.videoUrl))
        ? 'youtube'
        : (extractAllowedTikTokId(video.videoUrl)
            ? 'tiktok'
            : (isAllowedFacebookVideoUrl(video.videoUrl)
                ? 'facebook'
                : (isAllowedMediaVideoUrl(video.videoUrl) ? 'upload' : ''))),
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnail?.rawUrl || video.thumbnail?.url || '',
      thumbnailAlt: video.thumbnail?.alt || '',
      thumbnailWidth: video.thumbnail?.width ?? null,
      thumbnailHeight: video.thumbnail?.height ?? null,
      thumbnailMimeType: video.thumbnail?.mimeType || '',
      isActive: video.isActive,
    }
    setForm(next)
    setBaseline(next)
    setFieldErrors({})
    setShowForm(true)
  }

  async function handleDelete(video) {
    if (!video?.id) return
    const name = video.title || video.titleEn || video.id
    const confirmed = await showConfirm(
      t('homeVideos.deleteConfirm', { name }),
      t('common.permanentDeleteTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (!confirmed) return
    deleteMutation.mutate(video.id)
  }

  function handleToggleActive(video) {
    toggleActiveMutation.mutate({ id: video.id, isActive: !video.isActive })
  }

  async function handleVideoTypeChange(value) {
    if (value === form.videoType) return
    if (form.videoUrl.trim()) {
      const confirmed = await showConfirm(
        t('homeVideos.switchSourceConfirm'),
        t('homeVideos.switchSourceConfirmTitle'),
      )
      if (!confirmed) return
    }
    setForm((prev) => ({ ...prev, videoType: value, videoUrl: '' }))
    clearFieldError('videoUrl')
  }

  // Kiểm tra hợp lệ trả về lỗi gắn theo từng ô để hiện ngay cạnh ô sai (tiêu chí 7.2/7.3).
  function validateForm(values) {
    const errors = {}
    if (!values.title.trim()) {
      errors.title = t('homeVideos.validationTitle')
    }
    const videoCheck = validateHomeVideoUrl(values.videoUrl)
    if (!['youtube', 'tiktok', 'facebook', 'upload'].includes(values.videoType)) {
      errors.videoUrl = t('homeVideos.validationSource')
      return errors
    }
    const invalidMessage = values.videoType === 'youtube'
      ? t('homeVideos.validationYoutube')
      : values.videoType === 'tiktok'
        ? t('homeVideos.validationTikTok')
        : values.videoType === 'facebook'
          ? t('homeVideos.validationFacebook')
          : t('homeVideos.validationUpload')
    if (!videoCheck.valid) {
      errors.videoUrl = invalidMessage
    } else if (values.videoType === 'youtube' && !extractWritableYouTubeId(values.videoUrl)) {
      errors.videoUrl = t('homeVideos.validationYoutube')
    } else if (videoCheck.source !== values.videoType) {
      errors.videoUrl = invalidMessage
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
      thumbnail: buildHomeVideoThumbnail(form),
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
    // F5: hỏi xác nhận trước khi bật/ẩn hàng loạt, đồng nhất với handleBulkDelete ngay bên dưới.
    const count = selectedIds.size
    const confirmed = await showConfirm(
      isActive
        ? t('homeVideos.bulkShowConfirm', { count })
        : t('homeVideos.bulkHideConfirm', { count }),
      isActive ? t('homeVideos.bulkShowConfirmTitle') : t('homeVideos.bulkHideConfirmTitle'),
    )
    if (!confirmed) return
    // N7: cập nhật lạc quan hàng loạt — đổi trạng thái UI ngay, rollback nếu lỗi.
    const ids = new Set(selectedIds)
    const previousLocal = localItems
    setIsBulkBusy(true)
    setLocalItems(items.map((video) => (ids.has(video.id) ? { ...video, isActive } : video)))
    try {
      // allSettled thay cho Promise.all: 1 item lỗi không huỷ cả loạt, và báo đúng
      // số thành công / thất bại thay vì báo "thành công" khi thực tế lưu một phần.
      const results = await Promise.allSettled([...ids].map((id) => updateHomeVideo(id, { isActive })))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setSelectedIds(new Set())
      if (fail === 0) {
        setLocalItems(null)
        toast.success(isActive ? t('homeVideos.bulkShowSuccess', { count: ok }) : t('homeVideos.bulkHideSuccess', { count: ok }))
      } else if (ok === 0) {
        setLocalItems(previousLocal)
        toast.error(t('homeVideos.bulkActionError'))
      } else {
        setLocalItems(null)
        toast.warning(t('homeVideos.bulkPartial', { ok, fail, defaultValue: `Đã cập nhật ${ok} video, ${fail} video lỗi.` }))
      }
    } finally {
      setIsBulkBusy(false)
    }
  }

  async function handleBulkDelete() {
    const count = selectedIds.size
    const confirmed = await showConfirm(
      t('homeVideos.bulkDeleteConfirm', { count }),
      t('common.permanentDeleteTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (!confirmed) return
    setIsBulkBusy(true)
    try {
      const results = await Promise.allSettled([...selectedIds].map((id) => deleteHomeVideo(id)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      setSelectedIds(new Set())
      if (fail === 0) {
        toast.success(t('homeVideos.bulkDeleteSuccess', { count: ok }))
      } else if (ok === 0) {
        toast.error(t('homeVideos.bulkActionError'))
      } else {
        toast.warning(t('homeVideos.bulkDeletePartial', { ok, fail, defaultValue: `Đã xoá ${ok} video, ${fail} video lỗi.` }))
      }
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
  if (isError) return <StatePanel tone="danger" title={t('homeVideos.loadError')} description={error?.message} actionLabel={t('common.retry')} onAction={() => refetch()} />

  const listContent = items.length === 0 ? (
    <StatePanel
      tone="neutral"
      title={t('homeVideos.empty')}
      description={t('homeVideos.emptyDescription')}
      actionLabel={canUpdate ? t('homeVideos.addButton') : undefined}
      onAction={canUpdate ? openCreateForm : undefined}
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
            <Button
              type="button"
              onClick={openCreateForm}
            >
              <Plus size={14} />{t('homeVideos.addButton')}
            </Button>
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
              onValueChange={(value) => { void handleVideoTypeChange(value) }}
              className="flex flex-wrap gap-5 font-normal"
            >
              <label className="flex items-center gap-1.5 cursor-pointer">
                <RadioGroupItem value="youtube" />
                {t('homeVideos.sourceYoutube')}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <RadioGroupItem value="tiktok" />
                {t('homeVideos.sourceTikTok')}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <RadioGroupItem value="facebook" />
                {t('homeVideos.sourceFacebook')}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <RadioGroupItem value="upload" />
                {t('homeVideos.sourceUpload')}
              </label>
            </RadioGroup>
          </div>

          {['youtube', 'tiktok', 'facebook'].includes(form.videoType) ? (
            <div className="flex flex-col gap-1">
              <FormField
                label={form.videoType === 'youtube'
                  ? t('homeVideos.formYoutubeUrl')
                  : form.videoType === 'tiktok' ? t('homeVideos.formTikTokUrl') : t('homeVideos.formFacebookUrl')}
                required
                error={fieldErrors.videoUrl}
                helper={form.videoType === 'youtube'
                  ? t('homeVideos.youtubeHint')
                  : form.videoType === 'tiktok' ? t('homeVideos.tiktokHint') : t('homeVideos.facebookHint')}
              >
                <Input
                  required
                  type="url"
                  value={form.videoUrl}
                  onChange={(event) => { setForm((prev) => ({ ...prev, videoUrl: event.target.value })); clearFieldError('videoUrl') }}
                  onBlur={() => validateField('videoUrl')}
                  placeholder={form.videoType === 'youtube'
                    ? 'https://www.youtube.com/watch?v=...'
                    : form.videoType === 'tiktok'
                      ? 'https://www.tiktok.com/@account/video/...'
                      : 'https://www.facebook.com/account/videos/...'}
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
          ) : form.videoType === 'upload' ? (
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
                  disabled={!canUpdate || !canReadMedia}
                  title={!canReadMedia ? t('media.videoPermissionDeniedDesc') : undefined}
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
                    <X size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
              {!canReadMedia ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {t('media.videoPermissionDeniedDesc')}
                </span>
              ) : null}
              <MediaRequirementHint recommend={IMAGE_RECO.video} className="font-normal" />
              {form.videoUrl ? (
                <span className="text-xs text-success font-normal">
                  <Check size={14} aria-hidden="true" /> {form.videoUrl.split('/').pop()}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground font-normal">
                  {t('homeVideos.uploadHint')}
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-sm border border-warning-border bg-warning-bg p-3 text-sm text-warning" role="alert">
              {t('homeVideos.legacySourceWarning')}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm font-semibold">
            {t('homeVideos.formThumbnail')}
            <ImageUrlInput
              value={form.thumbnailUrl}
              onChange={(url, media) => setForm((prev) => ({
                ...prev,
                thumbnailUrl: url,
                thumbnailWidth: media?.width ?? null,
                thumbnailHeight: media?.height ?? null,
                thumbnailMimeType: media?.mimeType ?? '',
              }))}
              alt={form.thumbnailAlt}
              onAltChange={(alt) => setForm((prev) => ({ ...prev, thumbnailAlt: alt }))}
              previewAlt={form.thumbnailAlt || form.title}
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
            <Button type="button" variant="secondary" onClick={handleCancelForm}>
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

      {videoPickerOpen && canUpdate && canReadMedia && (
        <VideoPickerModal
          recommend={IMAGE_RECO.video}
          onSelect={(url, media) => {
            setForm((prev) => ({
              ...prev,
              videoUrl: url,
              title: prev.title.trim() ? prev.title : (media?.title || media?.altText || '')
            }))
            clearFieldError('videoUrl')
            setVideoPickerOpen(false)
          }}
          onClose={() => setVideoPickerOpen(false)}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}
    </div>
  )
}
