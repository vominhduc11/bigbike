import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMedia, uploadMedia } from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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
  const { t } = useTranslation()
  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)
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

  // Focus trap + ESC + restore focus
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const modal = modalRef.current
    const initialFocusTarget = modal?.querySelector(focusableSelector)
    if (initialFocusTarget) initialFocusTarget.focus()

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const currentModal = modalRef.current
      if (!currentModal) return
      const focusables = Array.from(currentModal.querySelectorAll(focusableSelector))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
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
        setUploadError(t('media.unsupportedType', { type: file.type }))
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('media.fileTooLarge', { size: formatBytes(file.size), limit: '50 MB' }))
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
        setUploadQueue((q) => q.map((item) => item.name === file.name ? { ...item, error: err.message || t('media.picker.uploadFailed') } : item))
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
        ref={modalRef}
        className={`mpicker-modal${isDragOver ? ' mpicker-modal--dragover' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('media.picker.dialogLabel')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="mpicker-drag-overlay" aria-hidden="true">
            <IconUpload />
            <p>{t('media.picker.dropToUpload')}</p>
          </div>
        )}

        {/* Header */}
        <div className="mpicker-header">
          <h3 className="mpicker-title">
            {t('media.picker.title')}
            {multiSelect && <span className="mpicker-mode-badge">{t('media.picker.multiMode')}</span>}
          </h3>
          <div className="mpicker-header-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={t('media.picker.uploadTitle')}
            >
              <IconUpload />
              {uploading ? t('media.picker.uploading') : t('media.picker.uploadButton')}
            </Button>
            <Button variant="secondary" size="icon" type="button" onClick={onClose} aria-label={t('common.close')}>
              <IconClose />
            </Button>
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
          <Input
            type="search"
            placeholder={t('media.picker.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
           />
        </div>

        {uploadError && (
          <div className="mpicker-upload-error">
            {uploadError}
            <button type="button" onClick={() => setUploadError('')} aria-label={t('media.picker.dismissError')}>✕</button>
          </div>
        )}

        {/* Grid */}
        <div className="mpicker-body">
          {isLoading && (
            <div className="mpicker-state">{t('common.loading')}</div>
          )}
          {state.status === 'error' && (
            <div className="mpicker-state mpicker-state-error">{state.error}</div>
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <div className="mpicker-state mpicker-state-empty">
              <IconImage />
              <p>{search ? t('media.picker.emptySearch') : t('media.picker.empty')}</p>
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
                        {(media.filename?.split('/').pop() ?? t('media.picker.defaultItemName')).replace(/\.[^.]+$/, '')}
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
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              {t('media.picker.prev')}
            </Button>
            <span className="mpicker-page-info">{t('media.picker.pageInfo', { page, totalPages: state.totalPages })}</span>
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => setPage((p) => Math.min(state.totalPages, p + 1))}
              disabled={page >= state.totalPages || isLoading}
            >
              {t('media.picker.next')}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="mpicker-footer">
          {hasSelection ? (
            <span className="mpicker-hint mpicker-hint--selected">
              {t('media.picker.selectedCount', { count: selectionCount })}
            </span>
          ) : (
            <span className="mpicker-hint">
              {multiSelect ? t('media.picker.multiSelectHint') : t('media.picker.singleSelectHint')}
            </span>
          )}
          <div className="mpicker-footer-actions">
            <Button variant="secondary" type="button" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!hasSelection}
            >
              {multiSelect ? t('media.picker.confirmMulti', { count: selectionCount }) : t('media.picker.confirmSingle')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
