import { useEffect, useRef, useState } from 'react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { deleteMedia, fetchMedia, uploadMedia } from '../lib/adminApi'
import { formatText } from '../lib/formatters'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const INITIAL_QUERY = { search: '', mimeType: 'ALL', page: 1, pageSize: 20 }

export function MediaLibraryScreen({ canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [deleting, setDeleting] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    let active = true
    fetchMedia(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  async function handleDelete(mediaId) {
    if (!window.confirm('Xoá file này?')) return
    setDeleting(mediaId)
    try {
      await deleteMedia(mediaId)
      setState((p) => ({ ...p, items: p.items.filter((m) => m.id !== mediaId) }))
    } catch (e) {
      alert(e.message || 'Lỗi xoá file')
    } finally {
      setDeleting(null)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(`Loại file không hỗ trợ: ${file.type}. Chấp nhận: JPEG, PNG, WebP, GIF, SVG, MP4.`)
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File quá lớn: ${formatBytes(file.size)}. Giới hạn: ${formatBytes(MAX_FILE_SIZE)}.`)
      e.target.value = ''
      return
    }

    setUploadError('')
    setUploading(true)
    try {
      await uploadMedia(file)
      // Refresh the list
      setQuery((p) => ({ ...p }))
    } catch (err) {
      setUploadError(err.message || 'Lỗi upload file.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => ({ ...p, ...partial, page: options.resetPage ? 1 : p.page }))
  }

  const isImage = (mime) => mime && mime.startsWith('image/')

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Media</p>
          <h1>Thư viện ảnh</h1>
          <p>Quản lý file media đã upload lên MinIO.</p>
        </div>
        {canUpdate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Đang upload...' : 'Upload file'}
            </button>
          </div>
        )}
      </header>

      {uploadError && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          {uploadError}
          <button type="button" style={{ marginLeft: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setUploadError('')}>✕</button>
        </div>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          Tìm kiếm
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })}
            placeholder="Tên file, alt text" />
        </label>
        <label>
          Loại file
          <select className="control-select" value={query.mimeType}
            onChange={(e) => updateQuery({ mimeType: e.target.value }, { resetPage: true })}>
            <option value="ALL">Tất cả</option>
            <option value="image/">Hình ảnh</option>
            <option value="video/">Video</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải media" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi tải media" description={state.error} actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Không có file" description="Chưa có file media nào."
          actionLabel="Xoá lọc" onAction={() => setQuery(INITIAL_QUERY)} />
      )}

      {state.status === 'success' && state.items.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {state.items.map((media) => (
              <div key={media.id} style={{ border: '1px solid var(--c-border)', borderRadius: '6px', overflow: 'hidden', background: 'var(--c-surface)' }}>
                <div style={{ height: '120px', background: 'var(--c-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {isImage(media.mimeType) && media.publicUrl ? (
                    <img src={media.publicUrl} alt={media.altText || media.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: '2rem', color: 'var(--c-text-muted)' }}>📄</span>
                  )}
                </div>
                <div style={{ padding: '0.5rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={media.filename}>
                    {formatText(media.filename.split('/').pop())}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{formatBytes(media.fileSize)}</p>
                  <p style={{ fontSize: '0.7rem', color: media.storageProvider === 'MINIO' ? 'var(--c-success)' : 'var(--c-warning)' }}>
                    {media.storageProvider}
                  </p>
                  {canUpdate && (
                    <button type="button" className="btn btn-danger" style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleDelete(media.id)} disabled={deleting === media.id}>
                      {deleting === media.id ? 'Đang xoá...' : 'Xoá'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
