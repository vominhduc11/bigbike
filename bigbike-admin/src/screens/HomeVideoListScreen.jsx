import { useState } from 'react'
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

function extractYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const EMPTY_FORM = {
  title: '',
  videoType: 'youtube', // 'youtube' | 'upload'
  videoUrl: '',
  thumbnailUrl: '',
  thumbnailAlt: '',
  isActive: true,
}

function VideoCard({ video, canUpdate, onEdit, onDelete, onToggleActive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: video.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--admin-color-surface-base)',
        border: '1px solid var(--admin-color-border-subtle)',
        borderRadius: 'var(--admin-radius-md)',
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        boxShadow: 'var(--admin-shadow-xs)',
        opacity: video.isActive === false ? 0.55 : undefined,
      }}
    >
      {canUpdate && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'grab',
            padding: '2px 4px',
            color: 'var(--admin-color-text-muted)',
            flexShrink: 0,
            touchAction: 'none',
          }}
          aria-label="Kéo để sắp xếp"
        >
          <GripVertical size={16} />
        </button>
      )}

      {video.thumbnail?.url && (
        <div style={{ flexShrink: 0, width: 80, height: 48, position: 'relative', borderRadius: 4, overflow: 'hidden', background: '#111' }}>
          <img
            src={video.thumbnail.url}
            alt={video.thumbnail.alt || video.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

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
            {video.isActive ? 'Hiển thị' : 'Ẩn'}
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
            {video.isActive ? 'Ẩn' : 'Hiện'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(video)}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
          >
            Sửa
          </button>
          <button
            type="button"
            onClick={() => onDelete(video.id)}
            style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--admin-color-danger-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--admin-color-danger)' }}
          >
            Xoá
          </button>
        </div>
      )}
    </div>
  )
}

export function HomeVideoListScreen({ canUpdate }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [localItems, setLocalItems] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-videos'],
    queryFn: fetchHomeVideos,
  })

  const items = localItems ?? (data?.items ?? [])
  const activeItem = activeId ? items.find((v) => v.id === activeId) : null

  const createMutation = useMutation({
    mutationFn: createHomeVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success('Đã thêm video.')
      resetForm()
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi thêm video.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }) => updateHomeVideo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success('Đã cập nhật video.')
      resetForm()
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi cập nhật video.'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteHomeVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(null)
      toast.success('Đã xoá video.')
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi xoá video.'),
  })

  const reorderMutation = useMutation({
    mutationFn: (reorderItems) => reorderHomeVideos(reorderItems),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['home-videos'] })
      setLocalItems(result.items)
    },
    onError: (err) => {
      toast.error(err.message || 'Lỗi khi sắp xếp.')
      setLocalItems(null)
    },
  })

  function resetForm() {
    setShowForm(false)
    setEditingVideo(null)
    setForm(EMPTY_FORM)
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
    setShowForm(true)
  }

  async function handleDelete(id) {
    const ok = await showConfirm('Xoá video này?')
    if (!ok) return
    deleteMutation.mutate(id)
  }

  function handleToggleActive(video) {
    updateMutation.mutate({
      id: video.id,
      input: { isActive: !video.isActive },
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const hasThumbnail = !!form.thumbnailUrl.trim()
    const newSortOrder = items.length > 0
      ? Math.max(...items.map((v) => v.sortOrder)) + 1
      : 0
    const input = {
      title: form.title.trim(),
      videoUrl: form.videoUrl.trim(),
      sortOrder: editingVideo ? editingVideo.sortOrder : newSortOrder,
      isActive: form.isActive,
      thumbnail: hasThumbnail
        ? { url: form.thumbnailUrl.trim(), alt: form.thumbnailAlt.trim() || form.title.trim() }
        : null,
      ...(editingVideo && !hasThumbnail ? { clearThumbnail: true } : {}),
    }
    if (editingVideo) {
      updateMutation.mutate({ id: editingVideo.id, input })
    } else {
      createMutation.mutate(input)
    }
  }

  function handleDragStart(event) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((v) => v.id === active.id)
    const newIndex = items.findIndex((v) => v.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((v, i) => ({ ...v, sortOrder: i }))
    setLocalItems(reordered)
    reorderMutation.mutate(reordered.map((v) => ({ id: v.id, sortOrder: v.sortOrder })))
  }

  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  if (isLoading) return <StatePanel tone="neutral" title="Đang tải video..." />
  if (isError) return <StatePanel tone="danger" title="Không thể tải danh sách video." />

  return (
    <div style={{ padding: '24px 0', maxWidth: 760 }}>
      {!canUpdate && <ReadOnlyBanner />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Video trang chủ</h1>
        {canUpdate && !showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingVideo(null); setForm(EMPTY_FORM) }}
            style={{ padding: '8px 16px', background: 'var(--admin-color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            + Thêm video
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
            {editingVideo ? 'Chỉnh sửa video' : 'Thêm video mới'}
          </h3>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Tiêu đề *
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Tên video"
              style={{ padding: '8px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, fontSize: 14 }}
            />
          </label>

          {/* Video source type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            Nguồn video *
            <div style={{ display: 'flex', gap: 20, fontWeight: 400 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="videoType"
                  value="youtube"
                  checked={form.videoType === 'youtube'}
                  onChange={() => setForm((f) => ({ ...f, videoType: 'youtube' }))}
                />
                YouTube
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="videoType"
                  value="upload"
                  checked={form.videoType === 'upload'}
                  onChange={() => setForm((f) => ({ ...f, videoType: 'upload' }))}
                />
                Upload video
              </label>
            </div>
          </div>

          {form.videoType === 'youtube' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
              YouTube URL *
              <input
                required
                type="url"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{ padding: '8px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: 'var(--admin-color-text-muted)', fontWeight: 400 }}>
                Hỗ trợ: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
              </span>
              {extractYouTubeId(form.videoUrl) && (
                <img
                  src={`https://img.youtube.com/vi/${extractYouTubeId(form.videoUrl)}/maxresdefault.jpg`}
                  alt="YouTube thumbnail preview"
                  style={{ marginTop: 6, width: '100%', maxWidth: 320, height: 'auto', borderRadius: 4, border: '1px solid var(--admin-color-border-subtle)' }}
                />
              )}
            </label>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
              File video *
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVideoPickerOpen(true)}
                >
                  {form.videoUrl ? 'Đổi video' : 'Chọn từ thư viện'}
                </button>
                {form.videoUrl && (
                  <button
                    type="button"
                    className="btn btn-icon btn-danger-ghost"
                    onClick={() => setForm((f) => ({ ...f, videoUrl: '' }))}
                    aria-label="Xoá video"
                  >
                    ✕
                  </button>
                )}
              </div>
              {form.videoUrl && (
                <span style={{ fontSize: 11, color: 'var(--admin-color-text-success)', fontWeight: 400 }}>
                  ✓ {form.videoUrl.split('/').pop()}
                </span>
              )}
              {!form.videoUrl && (
                <span style={{ fontSize: 11, color: 'var(--admin-color-text-muted)', fontWeight: 400 }}>
                  Định dạng hỗ trợ: MP4, WebM. Tối đa 500 MB.
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Ảnh thumbnail (tuỳ chọn)
            <ImageUrlInput
              value={form.thumbnailUrl}
              onChange={(url) => setForm((f) => ({ ...f, thumbnailUrl: url }))}
              placeholder="URL ảnh thumbnail"
            />
            {form.thumbnailUrl && (
              <input
                value={form.thumbnailAlt}
                onChange={(e) => setForm((f) => ({ ...f, thumbnailAlt: e.target.value }))}
                placeholder="Alt text ảnh"
                style={{ padding: '8px 10px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 6, fontSize: 14, marginTop: 4 }}
              />
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Hiển thị
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={isBusy}
              style={{ padding: '8px 20px', background: 'var(--admin-color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
            >
              {isBusy ? 'Đang lưu...' : editingVideo ? 'Lưu thay đổi' : 'Thêm'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{ padding: '8px 16px', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 8, background: 'none', cursor: 'pointer' }}
            >
              Huỷ
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <StatePanel tone="neutral" title="Chưa có video nào." description="Thêm video đầu tiên bằng nút phía trên." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((v) => v.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  canUpdate={canUpdate}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem && (
              <VideoCard
                video={activeItem}
                canUpdate={false}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggleActive={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {videoPickerOpen && (
        <VideoPickerModal
          onSelect={(url) => { setForm((f) => ({ ...f, videoUrl: url })); setVideoPickerOpen(false) }}
          onClose={() => setVideoPickerOpen(false)}
        />
      )}
    </div>
  )
}
