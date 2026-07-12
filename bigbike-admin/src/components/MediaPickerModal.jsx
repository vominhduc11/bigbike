import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { fetchMedia, uploadMedia, fetchMediaFolders, fetchMediaTags } from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'
import { useHasPermission } from '../lib/auth'
import { resolveDisplayUrl } from '../lib/contracts'
import { MediaDetailModal } from './MediaDetailModal'
import { MediaRequirementHint, MediaValidationError } from './MediaRequirementHint'
import { useMediaValidation } from '../lib/useMediaDimensions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterSelect } from './FilterSelect'
import { IconClose, IconUpload, IconCheck } from './media-picker/pickerIcons'
import { formatBytes, mergeMediaCacheItem } from './media-picker/pickerUtils'
import { useModalFocusTrap, useBodyScrollLock } from './media-picker/useModalBehavior'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_FILE_SIZE = 50 * 1024 * 1024

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/**
 * MediaPickerModal — browse + upload media, call onSelect on pick.
 *
 * Props:
 *   onSelect(url, media)          — single-select mode (default): url string, plus the
 *                                    full media item ({id, altText, title, isNewUpload, ...})
 *                                    so callers can prefill a context alt field. `media` is
 *                                    the 2nd arg so existing `onSelect={(url) => ...}` callers
 *                                    keep working unchanged.
 *   onSelectMultiple(urls, items) — multi-select mode: array of URL strings, plus the
 *                                    matching array of media items (same order)
 *   multiSelect                   — enable multi-select (default: false)
 *   onClose()                     — called when modal should close
 *   recommend                     — spec từ imageRecommendations.js; có thì CHẶN xác nhận khi ảnh
 *                                    đã chọn không đạt (chỉ áp dụng ở chế độ single-select)
 *   kind                          — 'image' | 'video', mặc định 'image' (đo naturalWidth/Height
 *                                    hay videoWidth/Height tương ứng)
 */
export function MediaPickerModal({ onSelect, onSelectMultiple, multiSelect = false, onClose, recommend, kind = 'image' }) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  // media.write gates both uploading new files and editing metadata (alt/title).
  const canWrite = hasPermission('media.write')
  const modalRef = useRef(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  // Lọc theo Thư mục/Tag — API fetchMedia đã hỗ trợ folderFilter/tag (không cần backend mới).
  const [folderFilter, setFolderFilter] = useState('')
  const [tag, setTag] = useState('')
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1 })
  // Single-select: string | null; Multi-select: Set<string>
  const [selectedUrls, setSelectedUrls] = useState(() => multiSelect ? new Set() : null)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([]) // { name, progress, error }
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  // Inline metadata editor (alt/title) without leaving the picker.
  const [detailMedia, setDetailMedia] = useState(null)
  const detailOpenRef = useRef(false)
  const fileInputRef = useRef(null)
  const PAGE_SIZE = 30
  // Full media objects by URL, so handleConfirm can hand callers altText/title —
  // not just the URL. Populated from fetched pages and from this session's uploads
  // (uploads are tagged isNewUpload so callers know to sync alt text back).
  const mediaCacheRef = useRef(new Map())
  const validation = useMediaValidation(kind, !multiSelect ? selectedUrls : null, recommend)

  // Reset page on new search / filter.
  useEffect(() => { setPage(1) }, [debouncedSearch, folderFilter, tag])

  // Nạp danh sách thư mục + tag để lọc (chỉ 1 lần khi mở picker).
  useEffect(() => {
    let active = true
    Promise.all([
      fetchMediaFolders().catch(() => []),
      fetchMediaTags().catch(() => []),
    ]).then(([f, tg]) => {
      if (!active) return
      setFolders(f ?? [])
      setTags(tg ?? [])
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchMedia({ search: debouncedSearch, mimeType: `${kind}/`, page, pageSize: PAGE_SIZE, folderFilter: folderFilter || undefined, tag: tag || undefined })
      .then((r) => {
        if (!active) return
        const items = r.items ?? []
        items.forEach((it) => mergeMediaCacheItem(mediaCacheRef, it))
        setState({
          status: 'success',
          items,
          totalPages: r.pagination?.totalPages ?? 1,
        })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], totalPages: 1, error: e.message })
      })
    return () => { active = false }
  }, [debouncedSearch, page, refreshKey, kind, folderFilter, tag])

  // While the detail editor is open it owns the keyboard (Escape/Tab); let its own
  // handler manage focus so we don't close the whole picker.
  useModalFocusTrap({ modalRef, onClose, isSuspendedRef: detailOpenRef })
  useBodyScrollLock()

  // ── Upload helpers ──────────────────────────────────────────────────────────

  async function uploadFiles(files) {
    if (!canWrite) return
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
          // isNewUpload tells callers this item has no saved alt/title yet — they
          // should sync the context alt the admin types back into the library.
          mediaCacheRef.current.set(url, { ...result.item, isNewUpload: true })
          setUploadQueue((q) => q.map((item) => item.name === file.name ? { ...item, progress: 100 } : item))
        }
      } catch (err) {
        setUploadQueue((q) => q.map((item) => item.name === file.name ? { ...item, error: err.message || t('media.picker.uploadFailed') } : item))
      }
    }

    setUploading(false)
    // Refresh grid — dùng refreshKey để force re-fetch kể cả khi page/search không đổi
    setPage(1)
    setSearch('')
    setRefreshKey((k) => k + 1)
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
    if (!canWrite) return
    e.preventDefault()
    setIsDragOver(true)
  }
  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false)
  }
  function handleDrop(e) {
    if (!canWrite) return
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) uploadFiles(files)
  }

  // ── Inline metadata editor ───────────────────────────────────────────────────

  function openDetail(media) {
    detailOpenRef.current = true
    setDetailMedia(media)
  }
  function closeDetail() {
    detailOpenRef.current = false
    setDetailMedia(null)
  }
  function handleDetailSaved(updated) {
    if (updated?.id) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)),
      }))
      if (updated.publicUrl) {
        const cached = mediaCacheRef.current.get(updated.publicUrl)
        mediaCacheRef.current.set(updated.publicUrl, { ...cached, ...updated })
      }
    }
    closeDetail()
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
      if (urls.length) onSelectMultiple?.(urls, urls.map((u) => mediaCacheRef.current.get(u) ?? null))
    } else {
      if (selectedUrls && !validation.blocked) onSelect?.(selectedUrls, mediaCacheRef.current.get(selectedUrls) ?? null)
    }
  }

  const hasSelection = multiSelect ? selectedUrls.size > 0 : Boolean(selectedUrls)
  const selectionCount = multiSelect ? selectedUrls.size : (selectedUrls ? 1 : 0)
  const isLoading = state.status === 'loading'
  const canConfirm = hasSelection && (multiSelect || (!validation.blocked && validation.status !== 'loading'))

  // Portal to <body> so the fixed-position backdrop/modal cover the whole
  // viewport. Rendered inline, an ancestor with a transform (e.g. a dnd-kit
  // sortable card) would become the containing block and trap the overlay.
  return createPortal(
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
            {canWrite && (
              <>
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
              </>
            )}
            <Button variant="secondary" size="icon" type="button" onClick={onClose} aria-label={t('common.close')}>
              <IconClose />
            </Button>
          </div>
        </div>

        {/* Gợi ý kích thước — ảnh đăng lên web nên đúng kích thước/tỉ lệ theo vị trí dùng */}
        <div className="px-4 pt-1">
          {recommend
            ? <MediaRequirementHint recommend={recommend} />
            : <p className="text-xs text-muted-foreground">{t('media.picker.sizeHint')}</p>}
          {!multiSelect && selectedUrls && (
            <MediaValidationError
              reasons={validation.reasons}
              kind={kind}
              width={validation.width}
              height={validation.height}
              recommend={recommend}
            />
          )}
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

        {/* Search + lọc theo thư mục / tag */}
        <div className="mpicker-search">
          <Input
            type="search"
            placeholder={t('media.picker.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
           />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FilterSelect
              value={folderFilter}
              onValueChange={setFolderFilter}
              ariaLabel={t('media.folders')}
              options={[
                { value: '', label: t('media.allFolders') },
                { value: 'NONE', label: t('media.uncategorized') },
                ...folders.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
            {tags.length > 0 && (
              <FilterSelect
                value={tag}
                onValueChange={setTag}
                ariaLabel={t('media.popularTags')}
                options={[
                  { value: '', label: t('media.allTags', { defaultValue: 'Tất cả thẻ' }) },
                  ...tags.map((tg) => ({ value: tg, label: tg })),
                ]}
              />
            )}
          </div>
        </div>

        {uploadError && (
          <div className="mpicker-upload-error">
            {uploadError}
            <button type="button" onClick={() => setUploadError('')} aria-label={t('media.picker.dismissError')}><IconClose /></button>
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
                  <div key={media.id} className="relative group">
                    <button
                      type="button"
                      className={`mpicker-item w-full${sel ? ' is-selected' : ''}`}
                      onClick={() => toggleUrl(url)}
                      title={media.filename?.split('/').pop() ?? ''}
                    >
                      {url ? (
                        <img
                          src={resolveDisplayUrl(url)}
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
                    {canWrite && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDetail(media) }}
                        className="absolute top-1.5 left-1.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 focus:opacity-100 group-hover:opacity-100"
                        title={t('media.picker.editInfo')}
                        aria-label={t('media.picker.editInfo')}
                      >
                        <IconPencil />
                      </button>
                    )}
                  </div>
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
              disabled={!canConfirm}
            >
              {multiSelect ? t('media.picker.confirmMulti', { count: selectionCount }) : t('media.picker.confirmSingle')}
            </Button>
          </div>
        </div>
      </div>

      {detailMedia && (
        <MediaDetailModal
          media={detailMedia}
          onSave={handleDetailSaved}
          onClose={closeDetail}
        />
      )}
    </>,
    document.body,
  )
}
