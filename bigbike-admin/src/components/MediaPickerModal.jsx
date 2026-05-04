import { useEffect, useRef, useState } from 'react'
import { fetchMedia, uploadMedia } from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_FILE_SIZE = 50 * 1024 * 1024

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

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
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

/**
 * MediaPickerModal — browse + upload media, call onSelect on pick.
 *
 * Props:
 *   onSelect(url)          — single-select mode (default): called with one URL string
 *   onSelectMultiple(urls) — multi-select mode: called with array of URL strings
 *   multiSelect            — enable multi-select (default: false)
 *   onClose()              — called when modal should close
 */
export function MediaPickerModal({ onSelect, onSelectMultiple, multiSelect = false, onClose }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 280)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1 })
  // Single-select: string | null; Multi-select: Set<string>
  const [selectedUrls, setSelectedUrls] = useState(() => multiSelect ? new Set() : null)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([]) // { name, progress, error }
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const PAGE_SIZE = 30

  // Reset page on new search.
  useEffect(() => { setPage(1) }, [debouncedSearch])

  useEffect(() => {
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchMedia({ search: debouncedSearch, mimeType: 'image/', page, pageSize: PAGE_SIZE })
      .then((r) => {
        if (!active) return
        setState({
          status: 'success',
          items: r.items ?? [],
          totalPages: r.pagination?.totalPages ?? 1,
        })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], totalPages: 1, error: e.message })
      })
    return () => { active = false }
  }, [debouncedSearch, page])

  // Close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Upload helpers ──────────────────────────────────────────────────────────

  async function uploadFiles(files) {
    const valid = []
    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.type)) {
        setUploadError(`"${file.name}" không hỗ trợ định dạng ${file.type}.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`"${file.name}" quá lớn (${formatBytes(file.size)}). Tối đa 50 MB.`)
        continue
      }
      valid.push(file)
    }
    if (!valid.length) return

    setUploadError('')
    setUploading(true)
    const uploadedUrls = []

    for (const file of valid) {
      setUploadQueue((q) => [...q, { name: file.name, progress: 0, error: null }])
      try {
        const result = await uploadMedia(file, '', (pct) => {
          setUploadQueue((q) => q.map((item) => item.name === file.name ? { ...item, progress: pct } : item))
        })
        const url = result?.item?.publicUrl
        if (url) {
          uploadedUrls.push(url)
          setUploadQueue((q) => q.map((item) => item.name === file.name ? { ...item, progress: 100 } : item))
        }
      } catch (err) {
        setUploadQueue((q) => q.map((item) => item.name === file.name ? { ...item, error: err.message || 'Thất bại' } : item))
      }
    }

    setUploading(false)
    // Refresh grid
    setPage(1)
    setSearch('')
    setState((p) => ({ ...p, status: 'loading' }))
    // Auto-select uploaded images
    if (uploadedUrls.length > 0) {
      if (multiSelect) {
        setSelectedUrls((prev) => new Set([...prev, ...uploadedUrls]))
      } else {
        setSelectedUrls(uploadedUrls[uploadedUrls.length - 1])
      }
    }
    setTimeout(() => setUploadQueue([]), 2000)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length) uploadFiles(files)
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragOver(true)
  }
  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false)
  }
  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) uploadFiles(files)
  }

  // ── Selection helpers ────────────────────────────────────────────────────────

  function toggleUrl(url) {
    if (multiSelect) {
      setSelectedUrls((prev) => {
        const next = new Set(prev)
        if (next.has(url)) next.delete(url)
        else next.add(url)
        return next
      })
    } else {
      setSelectedUrls((prev) => (prev === url ? null : url))
    }
  }

  function isSelected(url) {
    return multiSelect ? selectedUrls.has(url) : selectedUrls === url
  }

  function handleConfirm() {
    if (multiSelect) {
      const urls = [...selectedUrls]
      if (urls.length) onSelectMultiple?.(urls)
    } else {
      if (selectedUrls) onSelect?.(selectedUrls)
    }
  }

  const hasSelection = multiSelect ? selectedUrls.size > 0 : Boolean(selectedUrls)
  const selectionCount = multiSelect ? selectedUrls.size : (selectedUrls ? 1 : 0)
  const isLoading = state.status === 'loading'

  return (
    <>
      <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`mpicker-modal${isDragOver ? ' mpicker-modal--dragover' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Chọn ảnh từ thư viện"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="mpicker-drag-overlay" aria-hidden="true">
            <IconUpload />
            <p>Thả ảnh để tải lên</p>
          </div>
        )}

        {/* Header */}
        <div className="mpicker-header">
          <h3 className="mpicker-title">
            Thư viện ảnh
            {multiSelect && <span className="mpicker-mode-badge">Chọn nhiều</span>}
          </h3>
          <div className="mpicker-header-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Kéo thả ảnh vào cửa sổ này hoặc click để chọn file"
            >
              <IconUpload />
              {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
            </button>
            <button type="button" className="btn btn-icon btn-secondary" onClick={onClose} aria-label="Đóng">
              <IconClose />
            </button>
          </div>
        </div>

        {/* Upload queue */}
        {uploadQueue.length > 0 && (
          <div className="mpicker-upload-queue">
            {uploadQueue.map((item) => (
              <div key={item.name} className={`mpicker-upload-item${item.error ? ' mpicker-upload-item--error' : ''}`}>
                <span className="mpicker-upload-name">{item.name}</span>
                {item.error
                  ? <span className="mpicker-upload-err">{item.error}</span>
                  : <div className="mpicker-upload-bar"><div style={{ width: `${item.progress}%` }} /></div>
                }
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="mpicker-search">
          <input
            className="control-input"
            type="search"
            placeholder="Tìm kiếm ảnh..."
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

        {/* Grid */}
        <div className="mpicker-body">
          {isLoading && (
            <div className="mpicker-state">Đang tải...</div>
          )}
          {state.status === 'error' && (
            <div className="mpicker-state mpicker-state-error">{state.error}</div>
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <div className="mpicker-state mpicker-state-empty">
              <IconImage />
              <p>Không có ảnh nào{search ? ' phù hợp' : ''}. Kéo thả ảnh vào đây để tải lên.</p>
            </div>
          )}
          {state.status === 'success' && state.items.length > 0 && (
            <div className="mpicker-grid">
              {state.items.map((media) => {
                const url = media.publicUrl
                const sel = isSelected(url)
                return (
                  <button
                    key={media.id}
                    type="button"
                    className={`mpicker-item${sel ? ' is-selected' : ''}`}
                    onClick={() => toggleUrl(url)}
                    title={media.filename?.split('/').pop() ?? ''}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={media.altText ?? ''}
                        className="mpicker-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mpicker-thumb mpicker-thumb-placeholder">
                        <IconImage />
                      </div>
                    )}
                    {sel && (
                      <div className="mpicker-item-check" aria-hidden="true">
                        <IconCheck />
                      </div>
                    )}
                    <div className="mpicker-item-info">
                      <span className="mpicker-item-name">
                        {(media.filename?.split('/').pop() ?? 'ảnh').replace(/\.[^.]+$/, '')}
                      </span>
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

        {/* Pagination */}
        {state.totalPages > 1 && (
          <div className="mpicker-pagination">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              ← Trước
            </button>
            <span className="mpicker-page-info">Trang {page} / {state.totalPages}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.min(state.totalPages, p + 1))}
              disabled={page >= state.totalPages || isLoading}
            >
              Sau →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mpicker-footer">
          {hasSelection ? (
            <span className="mpicker-hint mpicker-hint--selected">
              Đã chọn {selectionCount} ảnh
            </span>
          ) : (
            <span className="mpicker-hint">
              {multiSelect ? 'Chọn nhiều ảnh (Ctrl+Click)' : 'Chọn một ảnh để sử dụng'}
            </span>
          )}
          <div className="mpicker-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={!hasSelection}
            >
              {multiSelect
                ? `Chọn ${selectionCount > 0 ? `${selectionCount} ảnh` : 'ảnh'}`
                : 'Chọn ảnh này'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
