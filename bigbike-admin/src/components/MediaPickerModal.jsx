import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { fetchMedia, uploadMedia, fetchMediaFolders, fetchMediaTags } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { useHasPermission } from '../lib/auth'
import { resolveDisplayUrl, resolveThumbUrl } from '../lib/contracts'
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

/**
 * MediaPickerModal — browse + upload media, call onSelect on pick.
 *
 * Chỉ làm đúng một việc: tìm/tải lên/chọn. Sửa mô tả ảnh và xoá file thuộc về màn
 * Thư viện media — alt text nhập ở màn gọi đã được `useMediaAltSync` ghi ngược về
 * thư viện nên không cần ô sửa lồng trong picker.
 *
 * Props:
 *   onSelect(url, media)          — url string, plus the full media item
 *                                    ({id, altText, title, isNewUpload, ...}) so callers can
 *                                    prefill a context alt field. `media` is the 2nd arg so
 *                                    existing `onSelect={(url) => ...}` callers keep working.
 *   onClose()                     — called when modal should close
 *   recommend                     — spec từ imageRecommendations.js; có thì CHẶN xác nhận khi ảnh
 *                                    đã chọn không đạt
 *   kind                          — 'image' | 'video', mặc định 'image' (đo naturalWidth/Height
 *                                    hay videoWidth/Height tương ứng)
 */
export function MediaPickerModal({ onSelect, onClose, recommend, kind = 'image' }) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  const canRead = hasPermission('media.read')
  // media.write gates uploading new files from inside the picker.
  const canWrite = canRead && hasPermission('media.write')
  const modalRef = useRef(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  // Lọc theo Thư mục/Tag — API fetchMedia đã hỗ trợ folderFilter/tag (không cần backend mới).
  const [folderFilter, setFolderFilter] = useState('')
  const [tag, setTag] = useState('')
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [filtersError, setFiltersError] = useState(false)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1 })
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([]) // { name, progress, error }
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const fileInputRef = useRef(null)
  const PAGE_SIZE = 30
  // Full media objects by URL, so handleConfirm can hand callers altText/title —
  // not just the URL. Populated from fetched pages and from this session's uploads
  // (uploads are tagged isNewUpload so callers know to sync alt text back).
  const mediaCacheRef = useRef(new Map())
  const validation = useMediaValidation(kind, selectedUrl, recommend)

  // Reset page on new search / filter.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [debouncedSearch, folderFilter, tag])

  // Nạp danh sách thư mục + tag để lọc (chỉ 1 lần khi mở picker). Dùng allSettled
  // để giữ phần tải được và HIỆN lỗi thay vì nuốt im lặng.
  useEffect(() => {
    if (!canRead) return undefined
    let active = true
    Promise.allSettled([fetchMediaFolders(), fetchMediaTags()]).then(([fRes, tRes]) => {
      if (!active) return
      if (fRes.status === 'fulfilled') setFolders(fRes.value ?? [])
      if (tRes.status === 'fulfilled') setTags(tRes.value ?? [])
      setFiltersError(fRes.status === 'rejected' || tRes.status === 'rejected')
    })
    return () => { active = false }
  }, [canRead])

  useEffect(() => {
    if (!canRead) return undefined
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [canRead, debouncedSearch, page, refreshKey, kind, folderFilter, tag])

  // Escape đi qua attemptClose để hỏi xác nhận khi đang tải lên / đã chọn.
  useModalFocusTrap({ modalRef, onClose: attemptClose })
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
      // Khoá theo id duy nhất, KHÔNG theo tên: hai file trùng tên sẽ không còn bị
      // cập nhật nhầm tiến trình lẫn nhau.
      const itemId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
      setUploadQueue((q) => [...q, { id: itemId, name: file.name, progress: 0, error: null }])
      try {
        const result = await uploadMedia(file, '', (pct) => {
          setUploadQueue((q) => q.map((item) => item.id === itemId ? { ...item, progress: pct } : item))
        })
        const url = result?.item?.publicUrl
        if (url) {
          uploadedUrls.push(url)
          // isNewUpload tells callers this item has no saved alt/title yet — they
          // should sync the context alt the admin types back into the library.
          mediaCacheRef.current.set(url, { ...result.item, isNewUpload: true })
          setUploadQueue((q) => q.map((item) => item.id === itemId ? { ...item, progress: 100 } : item))
        }
      } catch {
        // Thông báo thân thiện thay vì message lỗi thô.
        setUploadQueue((q) => q.map((item) => item.id === itemId ? { ...item, error: t('media.picker.uploadFailed') } : item))
      }
    }

    setUploading(false)
    // Refresh grid — dùng refreshKey để force re-fetch kể cả khi page/search không đổi
    setPage(1)
    setSearch('')
    setRefreshKey((k) => k + 1)
    // Auto-select uploaded image
    if (uploadedUrls.length > 0) setSelectedUrl(uploadedUrls[uploadedUrls.length - 1])
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

  // ── Selection helpers ────────────────────────────────────────────────────────

  function toggleUrl(url) {
    setSelectedUrl((prev) => (prev === url ? null : url))
  }

  function handleConfirm() {
    if (selectedUrl && !validation.blocked) {
      onSelect?.(selectedUrl, mediaCacheRef.current.get(selectedUrl) ?? null)
    }
  }

  const hasSelection = Boolean(selectedUrl)
  const isLoading = state.status === 'loading'
  const canConfirm = hasSelection && !validation.blocked && validation.status !== 'loading'

  // Hỏi xác nhận khi đóng lúc đang tải lên hoặc đã chọn để tránh mất lựa chọn/tiến
  // trình. Dùng cho backdrop, nút đóng, Huỷ và Escape (qua useModalFocusTrap).
  async function attemptClose() {
    if (uploading || hasSelection) {
      const ok = await showConfirm(
        t('media.picker.closeConfirm', { defaultValue: 'Bạn đang chọn hoặc tải file lên. Đóng sẽ mất lựa chọn và tiến trình đang tải. Tiếp tục?' }),
        t('media.picker.closeConfirmTitle', { defaultValue: 'Đóng cửa sổ chọn?' }),
      )
      if (!ok) return
    }
    onClose()
  }

  if (!canRead) {
    return createPortal(
      <>
        <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
        <div className="mpicker-modal" role="dialog" aria-modal="true" aria-label="Thiếu quyền Media">
          <div className="mpicker-header">
            <h3 className="mpicker-title">Không thể mở Thư viện Media</h3>
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>Đóng</Button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            Tài khoản cần quyền media.read để xem và chọn file. Không có yêu cầu Media nào được gửi.
          </div>
        </div>
      </>,
      document.body,
    )
  }

  // Portal to <body> so the fixed-position backdrop/modal cover the whole
  // viewport. Rendered inline, an ancestor with a transform (e.g. a dnd-kit
  // sortable card) would become the containing block and trap the overlay.
  return createPortal(
    <>
      <div className="mpicker-backdrop" onClick={attemptClose} aria-hidden="true" />
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
          <h3 className="mpicker-title">{t('media.picker.title')}</h3>
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
            <Button variant="secondary" size="icon" type="button" onClick={attemptClose} aria-label={t('common.close')}>
              <IconClose />
            </Button>
          </div>
        </div>

        {/* Gợi ý kích thước — ảnh đăng lên web nên đúng kích thước/tỉ lệ theo vị trí dùng */}
        <div className="px-4 pt-1">
          {recommend
            ? <MediaRequirementHint recommend={recommend} />
            : <p className="text-xs text-muted-foreground">{t('media.picker.sizeHint')}</p>}
          {selectedUrl && (
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
              <div key={item.id} className={`mpicker-upload-item${item.error ? ' mpicker-upload-item--error' : ''}`}>
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
          {filtersError && (
            <p className="mt-1 text-xs text-danger">
              {t('media.picker.filtersError', { defaultValue: 'Không tải được danh sách thư mục hoặc thẻ để lọc.' })}
            </p>
          )}
        </div>

        {uploadError && (
          <div className="mpicker-upload-error">
            {uploadError}
            <Button variant="unstyled" onClick={() => setUploadError('')} aria-label={t('media.picker.dismissError')}><IconClose /></Button>
          </div>
        )}

        {/* Grid */}
        <div className="mpicker-body">
          {isLoading && (
            <div className="mpicker-state">{t('common.loading')}</div>
          )}
          {state.status === 'error' && (
            <div className="mpicker-state mpicker-state-error">{t('media.loadError')}</div>
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
                const thumbUrl = resolveThumbUrl(media)
                const sel = selectedUrl === url
                return (
                    <Button
                      key={media.id}
                      variant="unstyled"
                      className={`mpicker-item${sel ? ' is-selected' : ''}`}
                      onClick={() => toggleUrl(url)}
                      aria-pressed={sel}
                      title={media.filename?.split('/').pop() ?? ''}
                    >
                      {thumbUrl ? (
                        <img
                          src={resolveDisplayUrl(thumbUrl)}
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
                    </Button>
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
              {t('media.picker.selectedCount', { count: 1 })}
            </span>
          ) : (
            <span className="mpicker-hint">{t('media.picker.singleSelectHint')}</span>
          )}
          <div className="mpicker-footer-actions">
            <Button variant="secondary" type="button" onClick={attemptClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {t('media.picker.confirmSingle')}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
