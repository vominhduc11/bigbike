import { useState, useEffect, useRef } from 'react'
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
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '90vw', maxWidth: 800,
          background: '#000', borderRadius: 10, overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 12, zIndex: 1,
            background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
            fontSize: 22, lineHeight: 1, cursor: 'pointer', borderRadius: 4,
            padding: '2px 8px',
          }}
          aria-label="Đóng"
        >×</button>

        <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
          ) : video.videoUrl ? (
            <video
              src={video.videoUrl}
              controls
              autoPlay
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          ) : null}
        </div>

        {video.title && (
          <p style={{ margin: 0, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 600, background: '#111' }}>
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
        background: selected ? 'var(--admin-color-primary-subtle, #1a2a3a)' : 'var(--admin-color-surface-base)',
        border: selected ? '1px solid var(--admin-color-primary)' : '1px solid var(--admin-color-border-subtle)',
        borderRadius: 'var(--admin-radius-md)',
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        boxShadow: 'var(--admin-shadow-xs)',
        opacity: video.isActive === false && !selected ? 0.55 : undefined,
      }}
    >
      {canUpdate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(video.id, e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--admin-color-primary)' }}
            aria-label={`Chọn video ${video.title}`}
          />
          {!selectionMode && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              style={{
                background: 'none', border: 'none', cursor: 'grab',
                padding: '2px 4px', color: 'var(--admin-color-text-muted)', touchAction: 'none',
              }}
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
        style={{
          flexShrink: 0, width: 96, height: 58,
          borderRadius: 6, overflow: 'hidden',
          background: '#111', border: 'none', padding: 0,
          cursor: 'pointer', position: 'relative',
        }}
        aria-label={`Xem trước: ${video.title}`}
      >
        {thumbSrc
          ? <img src={thumbSrc} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : video.videoUrl
            ? <video src={video.videoUrl} preload="metadata" muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
            : <div style={{ width: '100%', height: '100%', background: '#222' }} />
        }
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
        }}>
          <svg viewBox="0 0 40 40" width={28} height={28} fill="none">
            <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.55)" />
            <polygon points="16,12 16,28 30,20" fill="white" />
          </svg>
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {video.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--admin-color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {video.videoUrl}
        </div>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 99,
            background: video.isActive ? 'var(--admin-color-success-subtle)' : 'var(--admin-color-surface-raised)',
            color: video.isActive ? 'var(--admin-color-success)' : 'var(--admin-color-text-muted)',
            fontWeight: 600,
          }}>
            {video.isActive ? t('homeVideos.statusVisible') : t('homeVideos.statusHidden')}
          </span>
        </div>
      </div>

      {canUpdate && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onToggleActive(video)}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
          >
            {video.isActive ? t('homeVideos.hideAction') : t('homeVideos.showAction')}
          </button>
          <button
            type="button"
            onClick={() => onEdit(video)}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
          >
            {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(video.id)}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--admin-color-danger-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--admin-color-danger)' }}
          >
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
  const selectAllRef = useRef(null)

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

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="search"
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setSelectedIds(new Set()) }}
          placeholder="Tìm theo tên video..."
          style={{
            flex: 1, padding: '7px 12px',
            border: '1px solid var(--admin-color-border-subtle)',
            borderRadius: 8, fontSize: 13,
            background: 'var(--admin-color-surface-base)',
            color: 'inherit', outline: 'none',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSelectedIds(new Set()) }}
          style={{
            padding: '7px 10px',
            border: '1px solid var(--admin-color-border-subtle)',
            borderRadius: 8, fontSize: 13,
            background: 'var(--admin-color-surface-base)',
            color: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả ({items.length})</option>
          <option value="active">Đang hiện ({items.filter((v) => v.isActive).length})</option>
          <option value="hidden">Đang ẩn ({items.filter((v) => !v.isActive).length})</option>
        </select>
        {isFiltering && (
          <button
            type="button"
            onClick={() => { setSearchText(''); setStatusFilter('ALL'); setSelectedIds(new Set()) }}
            style={{ fontSize: 12, padding: '7px 12px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 8, background: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Xoá bộ lọc
          </button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <StatePanel tone="neutral" title="Không tìm thấy video" description="Thử thay đổi từ khoá hoặc bộ lọc trạng thái." />
      ) : (<>

      {canUpdate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--admin-color-primary)' }}
            aria-label="Chọn tất cả"
          />
          <span style={{ fontSize: 13, color: 'var(--admin-color-text-muted)' }}>
            {selectionMode ? `Đã chọn ${selectedIds.size} / ${items.length}` : 'Chọn tất cả'}
          </span>
          {selectionMode && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{ fontSize: 12, padding: '2px 8px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, background: 'none', cursor: 'pointer', marginLeft: 4 }}
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}

      {selectionMode && canUpdate && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 14px',
          background: 'var(--admin-color-surface-raised)',
          border: '1px solid var(--admin-color-border-subtle)',
          borderRadius: 'var(--admin-radius-md)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>
            {selectedIds.size} video đã chọn:
          </span>
          <button
            type="button"
            disabled={isBulkBusy}
            onClick={() => handleBulkSetActive(false)}
            style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, background: 'none', cursor: isBulkBusy ? 'not-allowed' : 'pointer', opacity: isBulkBusy ? 0.6 : 1 }}
          >
            Ẩn
          </button>
          <button
            type="button"
            disabled={isBulkBusy}
            onClick={() => handleBulkSetActive(true)}
            style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, background: 'none', cursor: isBulkBusy ? 'not-allowed' : 'pointer', opacity: isBulkBusy ? 0.6 : 1 }}
          >
            Hiện
          </button>
          <button
            type="button"
            disabled={isBulkBusy}
            onClick={handleBulkDelete}
            style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--admin-color-danger-border)', borderRadius: 6, background: 'none', cursor: isBulkBusy ? 'not-allowed' : 'pointer', color: 'var(--admin-color-danger)', opacity: isBulkBusy ? 0.6 : 1 }}
          >
            Xoá
          </button>
        </div>
      )}

      {isFiltering && (
        <p style={{ fontSize: 12, color: 'var(--admin-color-text-muted)', margin: '0 0 4px 2px' }}>
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
    <div style={{ padding: '24px 0', maxWidth: 760 }}>
      {!canUpdate && <ReadOnlyBanner />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('homeVideos.title')}</h1>
        {canUpdate && !showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingVideo(null); setForm(EMPTY_FORM); setFormError('') }}
            style={{ padding: '8px 16px', background: 'var(--admin-color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            {t('homeVideos.addButton')}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--admin-color-surface-base)',
            border: '1px solid var(--admin-color-border-subtle)',
            borderRadius: 'var(--admin-radius-md)',
            padding: 20,
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {editingVideo ? t('homeVideos.editTitle') : t('homeVideos.createTitle')}
          </h3>

          {formError ? (
            <p style={{ color: 'var(--admin-color-danger)', margin: 0 }}>{formError}</p>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
            {t('homeVideos.formTitle')}
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder={t('homeVideos.formTitlePlaceholder')}
              style={{ padding: '8px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, fontSize: 14 }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            {t('homeVideos.formSource')}
            <div style={{ display: 'flex', gap: 20, fontWeight: 400 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="videoType"
                  value="youtube"
                  checked={form.videoType === 'youtube'}
                  onChange={() => setForm((prev) => ({ ...prev, videoType: 'youtube', videoUrl: '' }))}
                />
                {t('homeVideos.sourceYoutube')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="videoType"
                  value="upload"
                  checked={form.videoType === 'upload'}
                  onChange={() => setForm((prev) => ({ ...prev, videoType: 'upload', videoUrl: '' }))}
                />
                {t('homeVideos.sourceUpload')}
              </label>
            </div>
          </div>

          {form.videoType === 'youtube' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('homeVideos.formYoutubeUrl')}
              <input
                required
                type="url"
                value={form.videoUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{ padding: '8px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: 'var(--admin-color-text-muted)', fontWeight: 400 }}>
                {t('homeVideos.youtubeHint')}
              </span>
              {youtubePreviewId && (
                <img
                  src={`https://img.youtube.com/vi/${youtubePreviewId}/maxresdefault.jpg`}
                  alt={t('homeVideos.youtubePreviewAlt')}
                  style={{ marginTop: 6, width: '100%', maxWidth: 320, height: 'auto', borderRadius: 4, border: '1px solid var(--admin-color-border-subtle)' }}
                />
              )}
            </label>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('homeVideos.formUpload')}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVideoPickerOpen(true)}
                  disabled={!canUpdate}
                >
                  {form.videoUrl ? t('homeVideos.changeVideo') : t('homeVideos.pickVideo')}
                </button>
                {form.videoUrl && (
                  <button
                    type="button"
                    className="btn btn-icon btn-danger-ghost"
                    onClick={() => setForm((prev) => ({ ...prev, videoUrl: '' }))}
                    aria-label={t('homeVideos.removeVideo')}
                    disabled={!canUpdate}
                  >
                    ✕
                  </button>
                )}
              </div>
              {form.videoUrl ? (
                <span style={{ fontSize: 11, color: 'var(--admin-color-text-success)', fontWeight: 400 }}>
                  ✓ {form.videoUrl.split('/').pop()}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--admin-color-text-muted)', fontWeight: 400 }}>
                  {t('homeVideos.uploadHint')}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
            {t('homeVideos.formThumbnail')}
            <ImageUrlInput
              value={form.thumbnailUrl}
              onChange={(url) => setForm((prev) => ({ ...prev, thumbnailUrl: url }))}
              alt={form.thumbnailAlt}
              onAltChange={(alt) => setForm((prev) => ({ ...prev, thumbnailAlt: alt }))}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            {t('homeVideos.formIsActive')}
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={isBusy}
              style={{ padding: '8px 20px', background: 'var(--admin-color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
            >
              {isBusy ? t('homeVideos.saving') : editingVideo ? t('homeVideos.saveChanges') : t('homeVideos.save')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{ padding: '8px 16px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 8, background: 'none', cursor: 'pointer' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
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
