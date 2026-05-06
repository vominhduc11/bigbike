import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { MediaDetailModal } from '../components/MediaDetailModal'
import { showConfirm } from '../lib/confirm'
import { deleteMedia, fetchMedia, uploadMedia } from '../lib/adminApi'
import { formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96]
const INITIAL_QUERY = { search: '', mimeType: 'ALL', status: 'ALL', storageProvider: 'ALL', page: 1, pageSize: 24 }

export function MediaLibraryScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [editingMedia, setEditingMedia] = useState(null)
  const fileInputRef = useRef(null)

  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    fetchMedia(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  async function handleDelete(mediaId) {
    const confirmed = await showConfirm(t('media.deleteConfirm'), t('media.deleteConfirmTitle'))
    if (!confirmed) return
    setDeleting(mediaId)
    setDeleteError('')
    try {
      await deleteMedia(mediaId)
      setState((p) => ({ ...p, items: p.items.filter((m) => m.id !== mediaId) }))
    } catch (e) {
      setDeleteError(e.message || t('media.deleteError'))
    } finally {
      setDeleting(null)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(t('media.unsupportedType', { type: file.type }))
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(t('media.fileTooLarge', { size: formatBytes(file.size), limit: formatBytes(MAX_FILE_SIZE) }))
      e.target.value = ''
      return
    }

    setUploadError('')
    setUploading(true)
    setUploadProgress(0)
    try {
      await uploadMedia(file, '', (pct) => setUploadProgress(pct))
      setQuery((p) => ({ ...p }))
    } catch (err) {
      setUploadError(err.message || t('media.uploadError'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleMediaSaved(updated) {
    setState((p) => ({
      ...p,
      items: p.items.map((m) => m.id === updated.id ? updated : m),
    }))
    setEditingMedia(null)
  }

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  const isImage = (mime) => mime && mime.startsWith('image/')
  const isVideo = (mime) => mime && mime.startsWith('video/')
  const isAudio = (mime) => mime && mime.startsWith('audio/')

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('media.eyebrow')}</p>
          <h1>{t('media.title')}</h1>
          <p>{t('media.description')}</p>
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
              {uploading ? `${t('common.uploading')}${uploadProgress ? ` ${uploadProgress}%` : '...'}` : t('common.upload')}
            </button>
          </div>
        )}
      </header>

      {uploadError && (
        <p className="inline-error">
          {uploadError}
          <button type="button" onClick={() => setUploadError('')}>✕</button>
        </p>
      )}

      {deleteError && (
        <p className="inline-error">
          {deleteError}
          <button type="button" onClick={() => setDeleteError('')}>✕</button>
        </p>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('media.searchPlaceholder')} />
        </label>
        <label>
          {t('media.filterType')}
          <select className="control-select" value={query.mimeType}
            onChange={(e) => updateQuery({ mimeType: e.target.value }, { resetPage: true })}>
            <option value="ALL">{t('media.allFiles')}</option>
            <option value="image/">{t('media.images')}</option>
            <option value="video/">{t('media.videos')}</option>
            <option value="audio/">{t('media.audios')}</option>
          </select>
        </label>
        <label>
          {t('media.filterStatus')}
          <select className="control-select" value={query.status}
            onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            <option value="ALL">{t('common.all')}</option>
            <option value="ACTIVE">{t('media.statusActive')}</option>
            <option value="DELETED">{t('media.statusDeleted')}</option>
          </select>
        </label>
        <label>
          {t('media.filterProvider')}
          <select className="control-select" value={query.storageProvider}
            onChange={(e) => updateQuery({ storageProvider: e.target.value }, { resetPage: true })}>
            <option value="ALL">{t('common.all')}</option>
            <option value="MINIO">MinIO</option>
            <option value="LEGACY_WP">Legacy WP</option>
          </select>
        </label>
        <label>
          {t('common.pageSize')}
          <select className="control-select" value={query.pageSize}
            onChange={(e) => updateQuery({ pageSize: Number(e.target.value) }, { resetPage: true })}>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title={t('media.loading')} description={t('common.pleaseWait')} />}
      {state.status === 'error' && <StatePanel tone="danger" title={t('media.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('media.empty')} description={t('media.emptyDesc')}
          actionLabel={t('common.resetFilters')} onAction={resetFilters} />
      )}

      {state.status === 'success' && state.items.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {state.items.map((media) => (
              <div key={media.id} style={{ border: '1px solid var(--c-border)', borderRadius: '6px', overflow: 'hidden', background: 'var(--c-surface)' }}>
                <div style={{ height: '120px', background: 'var(--c-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {isImage(media.mimeType) && media.publicUrl ? (
                    <img src={media.publicUrl} alt={media.altText || media.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : isVideo(media.mimeType) && media.publicUrl ? (
                    <video src={`${media.publicUrl}#t=0.001`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                  ) : isAudio(media.mimeType) && media.publicUrl ? (
                    <div style={{ width: '100%', padding: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      <audio src={media.publicUrl} controls preload="none" style={{ width: '100%', height: '28px' }} />
                    </div>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  )}
                </div>
                <div style={{ padding: '0.5rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={media.filename ?? ''}>
                    {formatText((media.filename ?? '').split('/').pop())}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{formatBytes(media.fileSize)}</p>
                  <p style={{ fontSize: '0.7rem', color: media.storageProvider === 'MINIO' ? 'var(--c-success)' : 'var(--c-warning)' }}>
                    {media.storageProvider}
                  </p>
                  {canUpdate && (
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        onClick={() => setEditingMedia(media)}>
                        {t('common.edit')}
                      </button>
                      <button type="button" className="btn btn-danger" style={{ flex: 1, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        onClick={() => handleDelete(media.id)} disabled={deleting === media.id}>
                        {deleting === media.id ? t('media.deleting') : t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}

      {editingMedia && (
        <MediaDetailModal
          media={editingMedia}
          onSave={handleMediaSaved}
          onClose={() => setEditingMedia(null)}
        />
      )}
    </section>
  )
}
