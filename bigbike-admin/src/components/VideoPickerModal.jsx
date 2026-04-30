import { useEffect, useRef, useState } from 'react'
import { fetchMedia, uploadMedia } from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'

const ALLOWED_MIME = ['video/mp4']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB — matches backend limit

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function VideoPickerModal({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 280)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1 })
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  const PAGE_SIZE = 20

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [debouncedSearch])

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((p) => ({ ...p, status: 'loading' }))
    fetchMedia({ search: debouncedSearch, mimeType: 'video/', page, pageSize: PAGE_SIZE })
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items ?? [], totalPages: r.pagination?.totalPages ?? 1 })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], totalPages: 1, error: e.message })
      })
    return () => { active = false }
  }, [debouncedSearch, page])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(`Không hỗ trợ định dạng ${file.type}. Chỉ hỗ trợ MP4.`)
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File quá lớn (${formatBytes(file.size)}). Tối đa 500 MB.`)
      e.target.value = ''
      return
    }
    setUploadError('')
    setUploading(true)
    setUploadProgress(0)
    try {
      const result = await uploadMedia(file, '', (pct) => setUploadProgress(pct))
      const url = result?.item?.publicUrl
      if (url) {
        setPage(1)
        setSearch('')
        setSelectedUrl(url)
        setState((p) => ({ ...p, status: 'loading' }))
      }
    } catch (err) {
      setUploadError(err.message || 'Upload thất bại.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleConfirm() {
    if (selectedUrl) onSelect(selectedUrl)
  }

  const isLoading = state.status === 'loading'

  return (
    <>
      <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mpicker-modal" role="dialog" aria-modal="true" aria-label="Chọn video từ thư viện">
        <div className="mpicker-header">
          <h3 className="mpicker-title">Thư viện video</h3>
          <div className="mpicker-header-actions">
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
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <IconUpload />
              {uploading ? `Đang tải lên${uploadProgress ? ` ${uploadProgress}%` : '...'}` : 'Tải video lên'}
            </button>
            <button type="button" className="btn btn-icon btn-secondary" onClick={onClose} aria-label="Đóng">
              <IconClose />
            </button>
          </div>
        </div>

        <div className="mpicker-search">
          <input
            className="control-input"
            type="search"
            placeholder="Tìm kiếm video..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {uploadError && (
          <div className="mpicker-upload-error">
            {uploadError}
            <button type="button" onClick={() => setUploadError('')} aria-label="Đóng lỗi">✕</button>
          </div>
        )}

        <div className="mpicker-body">
          {isLoading && <div className="mpicker-state">Đang tải...</div>}
          {state.status === 'error' && <div className="mpicker-state mpicker-state-error">{state.error}</div>}
          {state.status === 'success' && state.items.length === 0 && (
            <div className="mpicker-state mpicker-state-empty">
              <IconVideo />
              <p>Chưa có video nào{search ? ' phù hợp' : ''}. Tải lên video đầu tiên.</p>
            </div>
          )}
          {state.status === 'success' && state.items.length > 0 && (
            <div className="mpicker-grid">
              {state.items.map((media) => {
                const url = media.publicUrl
                const isSelected = url === selectedUrl
                const filename = media.filename?.split('/').pop() ?? 'video'
                return (
                  <button
                    key={media.id}
                    type="button"
                    className={`mpicker-item${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedUrl(isSelected ? null : url)}
                    title={filename}
                  >
                    <div className="mpicker-thumb mpicker-thumb-video">
                      {url ? (
                        <video src={`${url}#t=0.001`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                      ) : (
                        <IconVideo />
                      )}
                    </div>
                    {isSelected && (
                      <div className="mpicker-item-check" aria-hidden="true">
                        <IconCheck />
                      </div>
                    )}
                    <div className="mpicker-item-info">
                      <span className="mpicker-item-name">{filename.replace(/\.[^.]+$/, '')}</span>
                      {media.fileSize ? (
                        <span className="mpicker-item-size">{formatBytes(media.fileSize)}</span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {state.totalPages > 1 && (
          <div className="mpicker-pagination">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isLoading}>← Trước</button>
            <span className="mpicker-page-info">Trang {page} / {state.totalPages}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.min(state.totalPages, p + 1))} disabled={page >= state.totalPages || isLoading}>Sau →</button>
          </div>
        )}

        <div className="mpicker-footer">
          {selectedUrl ? (
            <span style={{ fontSize: 12, color: 'var(--admin-color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
              {selectedUrl.split('/').pop()}
            </span>
          ) : (
            <span className="mpicker-hint">Chọn một video để sử dụng</span>
          )}
          <div className="mpicker-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={!selectedUrl}>
              Chọn video này
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
