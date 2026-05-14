import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMedia, uploadMedia } from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ALLOWED_MIME = ['video/mp4']
const MAX_FILE_SIZE = 50 * 1024 * 1024
const PAGE_SIZE = 20

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
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 280)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1, error: '' })
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  function markLoading() {
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [debouncedSearch])

  useEffect(() => {
    let active = true
    fetchMedia({ search: debouncedSearch, mimeType: 'video/', page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!active) return
        setState({
          status: 'success',
          items: result.items ?? [],
          totalPages: result.pagination?.totalPages ?? 1,
          error: '',
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          status: 'error',
          items: [],
          totalPages: 1,
          error: error.message || t('homeVideos.picker.loadError'),
        })
      })
    return () => { active = false }
  }, [debouncedSearch, page, reloadKey, t])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(t('homeVideos.picker.unsupportedType', { type: file.type || 'unknown' }))
      event.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(t('homeVideos.picker.maxSizeError', { size: formatBytes(file.size) }))
      event.target.value = ''
      return
    }

    setUploadError('')
    setUploading(true)
    setUploadProgress(0)
    try {
      const result = await uploadMedia(file, '', (pct) => setUploadProgress(pct))
      const url = result?.item?.publicUrl
      if (url) {
        markLoading()
        setSelectedUrl(url)
        setSearch('')
        setPage(1)
        setReloadKey((value) => value + 1)
      }
    } catch (error) {
      setUploadError(error.message || t('homeVideos.picker.uploadError'))
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
      <div className="mpicker-modal" role="dialog" aria-modal="true" aria-label={t('homeVideos.picker.dialogLabel')}>
        <div className="mpicker-header">
          <h3 className="mpicker-title">{t('homeVideos.picker.title')}</h3>
          <div className="mpicker-header-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <IconUpload />
              {uploading
                ? t('homeVideos.picker.uploading', { progress: uploadProgress || 0 })
                : t('homeVideos.picker.uploadButton')}
            </Button>
            <Button variant="secondary" size="icon" type="button" onClick={onClose} aria-label={t('homeVideos.picker.close')}>
              <IconClose />
            </Button>
          </div>
        </div>

        <div className="mpicker-search">
          <Input
            type="search"
            placeholder={t('homeVideos.picker.searchPlaceholder')}
            value={search}
            onChange={(event) => {
              markLoading()
              setSearch(event.target.value)
            }}
            autoFocus
           />
        </div>

        {uploadError && (
          <div className="mpicker-upload-error">
            {uploadError}
            <button type="button" onClick={() => setUploadError('')} aria-label={t('homeVideos.picker.dismissError')}>x</button>
          </div>
        )}

        <div className="mpicker-body">
          {isLoading && <div className="mpicker-state">{t('homeVideos.picker.loading')}</div>}
          {state.status === 'error' && <div className="mpicker-state mpicker-state-error">{state.error}</div>}
          {state.status === 'success' && state.items.length === 0 && (
            <div className="mpicker-state mpicker-state-empty">
              <IconVideo />
              <p>{search ? t('homeVideos.picker.emptySearch') : t('homeVideos.picker.empty')}</p>
            </div>
          )}
          {state.status === 'success' && state.items.length > 0 && (
            <div className="mpicker-grid">
              {state.items.map((media) => {
                const url = media.publicUrl
                const isSelected = url === selectedUrl
                const filename = media.filename?.split('/').pop() ?? t('homeVideos.picker.defaultFileName')
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
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => {
                markLoading()
                setPage((value) => Math.max(1, value - 1))
              }}
              disabled={page <= 1 || isLoading}
            >
              {t('homeVideos.picker.prev')}
            </Button>
            <span className="mpicker-page-info">{t('homeVideos.picker.pageInfo', { page, totalPages: state.totalPages })}</span>
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => {
                markLoading()
                setPage((value) => Math.min(state.totalPages, value + 1))
              }}
              disabled={page >= state.totalPages || isLoading}
            >
              {t('homeVideos.picker.next')}
            </Button>
          </div>
        )}

        <div className="mpicker-footer">
          {selectedUrl ? (
            <span style={{ fontSize: 12, color: 'var(--admin-color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
              {selectedUrl.split('/').pop()}
            </span>
          ) : (
            <span className="mpicker-hint">{t('homeVideos.picker.selectHint')}</span>
          )}
          <div className="mpicker-footer-actions">
            <Button variant="secondary" type="button" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="button" onClick={handleConfirm} disabled={!selectedUrl}>
              {t('homeVideos.picker.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
