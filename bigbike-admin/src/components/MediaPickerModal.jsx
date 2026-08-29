import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { fetchMedia, fetchMediaBlob, uploadMedia, fetchMediaFolders, fetchMediaTags } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { useHasPermission } from '../lib/auth'
import { resolveDisplayUrl, resolveThumbUrl } from '../lib/contracts'
import { MediaRequirementHint, MediaValidationError } from './MediaRequirementHint'
import { readImageFileDimensions, useMediaValidation } from '../lib/useMediaDimensions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterSelect } from './FilterSelect'
import { IconClose, IconUpload, IconCheck } from './media-picker/pickerIcons'
import { formatBytes, mergeMediaCacheItem } from './media-picker/pickerUtils'
import { useModalFocusTrap, useBodyScrollLock } from './media-picker/useModalBehavior'
import { sendAdminWs } from '../lib/adminWebSocket'
import { IMAGE_MEDIA_MIME_TYPES, MAX_MEDIA_UPLOAD_BYTES, VIDEO_MEDIA_MIME_TYPES, normalizeMediaMimeType } from '../lib/mediaConstants'
import { evaluateImageDimensions } from '../lib/imageRecommendations'
import { BrandLogoCropDialog } from './BrandLogoCropDialog'
import { HelpTooltip } from './HelpTooltip'
import {
  BRAND_LOGO_MIME_TYPES,
  brandLogoIssueTranslationKey,
  getBrandLogoSourceDecision,
  isBrandLogoBlockingIssue,
  inspectBrandLogoFile,
} from '../lib/brandLogoPolicy'

const ALLOWED_MIME = IMAGE_MEDIA_MIME_TYPES
const MAX_FILE_SIZE = MAX_MEDIA_UPLOAD_BYTES

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function PickerImageThumbnail({ src, alt }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div className="mpicker-thumb mpicker-thumb-placeholder" role="img" aria-label={failed ? t('media.mediaLoadError') : t('media.missingPublicUrl')}>
        <IconImage />
      </div>
    )
  }

  return (
    <img
      src={resolveDisplayUrl(src)}
      alt={alt || ''}
      className="mpicker-thumb"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * MediaPickerModal — browse + upload media, call onSelect on pick.
 *
 * Chỉ làm đúng một việc: tìm/tải lên/chọn. Sửa mô tả ảnh và xoá file thuộc về màn
 * Thư viện media.
 *
 * Props:
 *   onSelect(url, media)          — url string, plus the full media item
 *                                    ({id, altText, title, ...}) so callers can
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
  const isBrandLogo = Boolean(recommend?.brandLogo)
  const pickerMimeTypes = kind === 'video' ? VIDEO_MEDIA_MIME_TYPES : ALLOWED_MIME
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
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1, error: '', refreshError: '' })
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([]) // { name, progress, error }
  const [uploadError, setUploadError] = useState('')
  const [uploadWarning, setUploadWarning] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [validatingSelection, setValidatingSelection] = useState(false)
  const [cropSource, setCropSource] = useState(null)
  const fileInputRef = useRef(null)
  const PAGE_SIZE = 30
  // Full media objects by URL, so handleConfirm can hand callers altText/title —
  // not just the URL. Populated from fetched pages and from this session's uploads.
  const mediaCacheRef = useRef(new Map())
  // Brand logos are inspected from the original media bytes and may need a
  // manual crop, so the generic URL ratio validator must not block selection.
  const validation = useMediaValidation(kind, selectedUrl, isBrandLogo ? null : recommend)

  // Reset page on new search / filter.
  useEffect(() => {
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
    setState((p) => ({
      ...p,
      status: p.items.length > 0 ? 'refreshing' : 'loading',
      error: '',
      refreshError: '',
    }))
    fetchMedia({ search: debouncedSearch, mimeTypes: pickerMimeTypes, page, pageSize: PAGE_SIZE, folderFilter: folderFilter || undefined, tag: tag || undefined })
      .then((r) => {
        if (!active) return
        const items = r.items ?? []
        items.forEach((it) => mergeMediaCacheItem(mediaCacheRef, it))
        const totalPages = Math.max(1, Number(r.pagination?.totalPages) || 1)
        if (page > totalPages) {
          setPage(totalPages)
          return
        }
        setState({
          status: 'success',
          items,
          totalPages,
          error: '',
          refreshError: '',
        })
      })
      .catch((e) => {
        if (!active) return
        setState((previous) => previous.items.length > 0
          ? { ...previous, status: 'success', refreshError: e.message || 'refresh-failed', error: '' }
          : { status: 'error', items: [], totalPages: 1, error: e.message || '', refreshError: '' })
      })
    return () => { active = false }
  }, [canRead, debouncedSearch, page, refreshKey, kind, folderFilter, tag, pickerMimeTypes])

  // Escape đi qua attemptClose để hỏi xác nhận khi đang tải lên / đã chọn.
  useModalFocusTrap({ modalRef, onClose: attemptClose })
  useBodyScrollLock()

  // ── Upload helpers ──────────────────────────────────────────────────────────

  function brandLogoErrorMessage(issue, details) {
    return t(brandLogoIssueTranslationKey(issue), {
      w: details?.width,
      h: details?.height,
      defaultValue: t('common.unknown'),
    })
  }

  function brandLogoFailureMessage(failure, fallback) {
    const detailMessage = failure?.details?.find((detail) => detail?.message)?.message
    if (detailMessage) return detailMessage
    if (failure?.message === 'MEDIA_UNAVAILABLE' || failure?.message === 'BRAND_LOGO_MEDIA_UNAVAILABLE') {
      return brandLogoErrorMessage('MEDIA_UNAVAILABLE')
    }
    return failure?.message || fallback
  }

  function brandLogoQualityFromDetails(details, issues) {
    return {
      status: 'VALID',
      issues,
      width: details?.width ?? null,
      height: details?.height ?? null,
      fileSize: details?.fileSize ?? null,
      mimeType: details?.mimeType ?? null,
      transparent: details?.transparent ?? null,
      ratio: details?.width && details?.height ? details.width / details.height : null,
    }
  }

  function openCropForFile(file, details) {
    setUploadError('')
    setSelectedUrl(null)
    setCropSource({
      url: URL.createObjectURL(file),
      filename: file.name || 'brand-logo.png',
      sourceMimeType: details?.mimeType || file.type || '',
      sourceTransparent: details?.transparent,
    })
  }

  async function uploadFiles(files) {
    if (!canWrite) {
      setUploadError(t('media.permissionDeniedDesc'))
      return
    }
    const valid = []
    const validationErrors = []
    const validationWarnings = []
    setUploadWarning('')
    for (const file of files) {
      const fileType = normalizeMediaMimeType(file.type)
      if (isBrandLogo && !BRAND_LOGO_MIME_TYPES.includes(fileType)) {
        validationErrors.push(brandLogoErrorMessage('UNSUPPORTED_TYPE'))
        continue
      }
      if (!pickerMimeTypes.includes(fileType)) {
        validationErrors.push(t(kind === 'image' ? 'media.unsupportedImageType' : 'media.unsupportedType', { type: file.type || file.name }))
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        validationErrors.push(t('media.fileTooLarge', { size: formatBytes(file.size), limit: formatBytes(MAX_FILE_SIZE) }))
        continue
      }
      let dimensions = null
      if (isBrandLogo) {
        try {
          const details = await inspectBrandLogoFile(file)
          const decision = getBrandLogoSourceDecision(details)
          const blockingIssues = decision.issues.filter(isBrandLogoBlockingIssue)
          if (blockingIssues.length) {
            validationErrors.push(blockingIssues.map((issue) => brandLogoErrorMessage(issue, details)).join(' '))
            continue
          }
          const warningIssues = decision.issues.filter((issue) => !isBrandLogoBlockingIssue(issue))
          if (warningIssues.length) {
            validationWarnings.push(warningIssues.map((issue) => brandLogoErrorMessage(issue, details)).join(' '))
          }
          if (decision.needsCrop) {
            setUploadError(validationErrors.join(' '))
            setUploadWarning(validationWarnings.join(' '))
            openCropForFile(file, details)
            return
          }
          dimensions = { width: details.width, height: details.height }
          valid.push({
            file,
            dimensions,
            logoQuality: brandLogoQualityFromDetails(details, warningIssues),
          })
          continue
        } catch {
          validationErrors.push(brandLogoErrorMessage('UNREADABLE'))
          continue
        }
      } else if (kind === 'image' && recommend?.exactRatio) {
        try {
          dimensions = await readImageFileDimensions(file)
        } catch {
          validationErrors.push(t('mediaReco.categoryImageUnreadable'))
          continue
        }
        const reasons = evaluateImageDimensions(dimensions.width, dimensions.height, recommend)
        if (reasons?.includes('unreadableDimensions')) {
          validationErrors.push(t('mediaReco.categoryImageUnreadable'))
          continue
        }
        if (reasons?.includes('wrongRatio')) {
          validationErrors.push(t('mediaReco.categoryImageWrongRatio', {
            w: dimensions.width,
            h: dimensions.height,
          }))
          continue
        }
      }
      valid.push({ file, dimensions })
    }
    setUploadError(validationErrors.join(' '))
    setUploadWarning(validationWarnings.join(' '))
    if (!valid.length) return

    setUploading(true)
    const uploadedUrls = []
    // Upload thẳng vào thư mục đang lọc trong picker. "Chưa phân loại" cũng là 1 đích rõ
    // ràng (khác "Tất cả" — không đích nào) nên cần cờ riêng, xem ghi chú ở uploadMedia().
    const targetFolderId = folderFilter && folderFilter !== 'NONE' ? folderFilter : null
    const targetClearFolder = folderFilter === 'NONE'

    for (const entry of valid) {
      const { file, dimensions, logoQuality } = entry
      // Khoá theo id duy nhất, KHÔNG theo tên: hai file trùng tên sẽ không còn bị
      // cập nhật nhầm tiến trình lẫn nhau.
      const itemId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
      setUploadQueue((q) => [...q, { id: itemId, name: file.name, progress: 0, error: null, status: 'pending' }])
      sendAdminWs('/app/admin/maintenance/uploads', { uploadId: itemId, status: 'PENDING' })
      sendAdminWs('/app/admin/maintenance/uploads', { uploadId: itemId, status: 'UPLOADING' })
      try {
        const result = await uploadMedia(file, '', (pct) => {
          setUploadQueue((q) => q.map((item) => item.id === itemId ? { ...item, progress: pct } : item))
        }, targetFolderId, targetClearFolder)
        const url = result?.item?.publicUrl
        if (url) {
          uploadedUrls.push(url)
          mediaCacheRef.current.set(url, dimensions
            ? {
                ...result.item,
                width: result.item?.width ?? dimensions.width,
                height: result.item?.height ?? dimensions.height,
                ...(logoQuality ? { logoQuality } : {}),
              }
            : result.item)
          setUploadQueue((q) => q.map((item) => item.id === itemId ? { ...item, progress: 100, status: 'done' } : item))
          sendAdminWs('/app/admin/maintenance/uploads', { uploadId: itemId, status: 'DONE' })
        } else {
          setUploadQueue((q) => q.map((item) => item.id === itemId
            ? { ...item, error: t('media.picker.uploadFailed'), status: 'error' }
            : item))
          sendAdminWs('/app/admin/maintenance/uploads', { uploadId: itemId, status: 'ERROR' })
        }
      } catch (uploadFailure) {
        setUploadQueue((q) => q.map((item) => item.id === itemId
          ? { ...item, error: uploadFailure?.message || t('media.picker.uploadFailed'), status: 'error' }
          : item))
        sendAdminWs('/app/admin/maintenance/uploads', { uploadId: itemId, status: 'ERROR' })
      }
    }

    setUploading(false)
    // Đồng bộ ô search/trang — KHÔNG reset folderFilter/tag nữa vì item mới đã được gán
    // đúng thư mục đang lọc (nếu có), nên vẫn khớp filter hiện tại, không cần né sang
    // "Tất cả thư mục" như trước.
    setPage(1)
    setSearch('')
    // Refetch ngay với search rỗng tường minh (không chờ debounce 300ms bắt kịp) để
    // ảnh/video vừa tải chắc chắn hiện ra ngay, không bị lần fetch đầu vẫn lọc theo
    // từ khoá tìm kiếm cũ.
    if (canRead) {
      setState((p) => ({ ...p, status: p.items.length > 0 ? 'refreshing' : 'loading', error: '', refreshError: '' }))
      try {
        const r = await fetchMedia({ search: '', mimeTypes: pickerMimeTypes, page: 1, pageSize: PAGE_SIZE, folderFilter: folderFilter || undefined, tag: tag || undefined })
        const items = r.items ?? []
        items.forEach((it) => mergeMediaCacheItem(mediaCacheRef, it))
        setState({ status: 'success', items, totalPages: Math.max(1, Number(r.pagination?.totalPages) || 1), error: '', refreshError: '' })
      } catch { /* effect bên dưới (refreshKey bump) sẽ tự thử lại */ }
    }
    setRefreshKey((k) => k + 1)
    // Auto-select uploaded image
    if (uploadedUrls.length > 0) setSelectedUrl(uploadedUrls[uploadedUrls.length - 1])
    setTimeout(() => setUploadQueue((queue) => queue.filter((item) => item.status !== 'done')), 3000)
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

  async function toggleMedia(media) {
    const url = media?.publicUrl
    if (!url || validatingSelection) return
    if (!isBrandLogo) {
      setSelectedUrl((prev) => (prev === url ? null : url))
      return
    }

    setValidatingSelection(true)
    setUploadError('')
    setUploadWarning('')
    try {
      if (!media.id) throw new Error('MEDIA_UNAVAILABLE')
      const { blob, filename } = await fetchMediaBlob(media.id, media.filename || 'brand-logo.png')
      const file = new File([blob], filename || media.filename || 'brand-logo.png', {
        type: media.mimeType || blob.type || '',
      })
      const details = await inspectBrandLogoFile(file)
      const decision = getBrandLogoSourceDecision(details)
      const blockingIssues = decision.issues.filter(isBrandLogoBlockingIssue)
      if (blockingIssues.length) {
        setUploadError(blockingIssues.map((issue) => brandLogoErrorMessage(issue, details)).join(' '))
      } else if (decision.needsCrop) {
        if (!canWrite) {
          setUploadError(t('media.permissionDeniedDesc'))
          return
        }
        setSelectedUrl(null)
        openCropForFile(file, details)
      } else {
        const warningIssues = decision.issues.filter((issue) => !isBrandLogoBlockingIssue(issue))
        setUploadWarning(warningIssues.map((issue) => brandLogoErrorMessage(issue, details)).join(' '))
        mediaCacheRef.current.set(url, {
          ...media,
          width: details.width,
          height: details.height,
          mimeType: details.mimeType,
          logoQuality: brandLogoQualityFromDetails(details, warningIssues),
        })
        setSelectedUrl(url)
      }
    } catch (selectionError) {
      setUploadError(brandLogoFailureMessage(selectionError, t('brands.logo.errors.mediaUnavailable')))
    } finally {
      setValidatingSelection(false)
    }
  }

  function closeCrop() {
    if (cropSource?.url?.startsWith('blob:')) URL.revokeObjectURL(cropSource.url)
    setCropSource(null)
  }

  async function handleCropComplete(file) {
    closeCrop()
    await uploadFiles([file])
  }

  function handleConfirm() {
    const exactRatioReady = !recommend?.exactRatio || validation.status === 'loaded'
    if (selectedUrl && exactRatioReady && !validation.blocked) {
      const cachedMedia = mediaCacheRef.current.get(selectedUrl) ?? null
      const selectedMedia = recommend?.exactRatio && validation.status === 'loaded'
        ? {
            ...(cachedMedia || {}),
            publicUrl: cachedMedia?.publicUrl || selectedUrl,
            width: validation.width,
            height: validation.height,
          }
        : cachedMedia
      onSelect?.(selectedUrl, selectedMedia)
    }
  }

  const hasSelection = Boolean(selectedUrl)
  const isLoading = state.status === 'loading'
  const isRefreshing = state.status === 'refreshing'
  const exactRatioReady = !recommend?.exactRatio || validation.status === 'loaded'
  const canConfirm = hasSelection && !isRefreshing && !validatingSelection && exactRatioReady && !validation.blocked

  // Hỏi xác nhận khi đóng lúc đang tải lên hoặc đã chọn để tránh mất lựa chọn/tiến
  // trình. Dùng cho backdrop, nút đóng, Huỷ và Escape (qua useModalFocusTrap).
  async function attemptClose() {
    if (uploading) {
      setUploadError(t('media.closeWhileUploading'))
      return
    }
    if (hasSelection) {
      const ok = await showConfirm(
        t('media.picker.closeConfirm', { defaultValue: 'Bạn đang có tệp đã chọn. Đóng sẽ bỏ lựa chọn này. Tiếp tục?' }),
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
        <div ref={modalRef} tabIndex={-1} className="mpicker-modal" role="dialog" aria-modal="true" aria-label={t('media.permissionDeniedTitle')}>
          <div className="mpicker-header">
            <h3 className="mpicker-title">{t('media.permissionDeniedTitle')}</h3>
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>{t('common.close')}</Button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            {t('media.permissionDeniedDesc')}
          </div>
        </div>
      </>,
      document.body,
    )
  }

  // Portal to <body> so the fixed-position backdrop/modal cover the whole
  // viewport. Rendered inline, an ancestor with a transform (e.g. a dnd-kit
  // sortable card) would become the containing block and trap the overlay.
  return (
    <>
      {createPortal(
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
                  accept={pickerMimeTypes.join(',')}
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
            : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{t('media.picker.requirementsLabel')}</span>
                <HelpTooltip content={t('media.picker.sizeHint')} />
              </div>
            )}
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
                  ? <>
                      <span className="mpicker-upload-err">{item.error}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setUploadQueue((queue) => queue.filter((entry) => entry.id !== item.id))}
                        aria-label={t('notifications.close')}
                      >
                        <IconClose />
                      </Button>
                    </>
                  : <progress className="h-1 flex-1 accent-primary" value={item.progress} max="100" aria-label={t('media.uploadProgress', { name: item.name })} />
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
        {uploadWarning && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-sm border border-warning bg-warning-bg px-3 py-2 text-sm text-warning" role="status">
            <span>{uploadWarning}</span>
            <Button variant="unstyled" onClick={() => setUploadWarning('')} aria-label={t('media.picker.dismissError')}><IconClose /></Button>
          </div>
        )}

        {/* Grid */}
        <div className="mpicker-body">
          {isLoading && (
            <div className="mpicker-state">{t('common.loading')}</div>
          )}
          {state.status === 'error' && (
            <div className="mpicker-state mpicker-state-error">
              <p>{t('media.loadError')}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>{t('common.retry')}</Button>
            </div>
          )}
          {isRefreshing && <p className="px-4 py-2 text-sm text-muted-foreground" role="status">{t('media.refreshing')}</p>}
          {state.refreshError && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              <span>{t('media.refreshError')}</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>{t('common.retry')}</Button>
            </div>
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <div className="mpicker-state mpicker-state-empty">
              <IconImage />
              <p>{search ? t('media.picker.emptySearch') : t('media.picker.empty')}</p>
            </div>
          )}
          {(state.status === 'success' || state.status === 'refreshing') && state.items.length > 0 && (
            <div className="mpicker-grid" aria-busy={isRefreshing || undefined}>
              {state.items.map((media) => {
                const url = media.publicUrl
                const thumbUrl = resolveThumbUrl(media)
                const sel = selectedUrl === url
                return (
                    <Button
                      key={media.id}
                      variant="unstyled"
                      className={`mpicker-item${sel ? ' is-selected' : ''}`}
                      onClick={() => toggleMedia(media)}
                      disabled={isRefreshing || validatingSelection || !url}
                      aria-pressed={sel}
                      title={media.filename?.split('/').pop() ?? ''}
                    >
                      <PickerImageThumbnail src={thumbUrl} alt={media.altText} />
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
              disabled={page <= 1 || isLoading || isRefreshing}
            >
              {t('media.picker.prev')}
            </Button>
            <span className="mpicker-page-info">{t('media.picker.pageInfo', { page, totalPages: state.totalPages })}</span>
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => setPage((p) => Math.min(state.totalPages, p + 1))}
              disabled={page >= state.totalPages || isLoading || isRefreshing}
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
      )}
      {isBrandLogo && cropSource ? (
        <BrandLogoCropDialog
          open
          sourceUrl={cropSource.url}
          filename={cropSource.filename}
          sourceMimeType={cropSource.sourceMimeType}
          sourceTransparent={cropSource.sourceTransparent}
          onCancel={closeCrop}
          onComplete={handleCropComplete}
        />
      ) : null}
    </>
  )
}
