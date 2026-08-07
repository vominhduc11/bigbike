import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { fetchMedia, uploadMedia, fetchMediaFolders, fetchMediaTags } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { useHasPermission } from '../lib/auth'
import { MediaRequirementHint, MediaValidationError } from './MediaRequirementHint'
import { useMediaValidation } from '../lib/useMediaDimensions'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterSelect } from './FilterSelect'
import { IconClose, IconUpload, IconCheck } from './media-picker/pickerIcons'
import { formatBytes, mergeMediaCacheItem } from './media-picker/pickerUtils'
import { useModalFocusTrap, useBodyScrollLock } from './media-picker/useModalBehavior'
import { MAX_MEDIA_UPLOAD_BYTES, VIDEO_MEDIA_MIME_TYPES } from '../lib/mediaConstants'

const ALLOWED_MIME = VIDEO_MEDIA_MIME_TYPES
const MAX_FILE_SIZE = MAX_MEDIA_UPLOAD_BYTES
const PAGE_SIZE = 20

function IconVideo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

function PickerVideoThumbnail({ url }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return (
      <div className="mpicker-thumb mpicker-thumb-video" role="img" aria-label={failed ? t('media.mediaLoadError') : t('media.missingPublicUrl')}>
        <IconVideo />
      </div>
    )
  }

  return (
    <div className="mpicker-thumb mpicker-thumb-video">
      <video src={`${url}#t=0.001`} className="h-full w-full object-cover" muted preload="metadata" onError={() => setFailed(true)} />
    </div>
  )
}

export function VideoPickerModal({ onSelect, onClose, recommend = IMAGE_RECO.video }) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  const canRead = hasPermission('media.read')
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
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1, error: '', refreshError: '' })
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  // Same media-cache trick as MediaPickerModal: onSelect passes back the full
  // media item (2nd arg) so callers can prefill/sync-back a context title.
  const mediaCacheRef = useRef(new Map())
  const validation = useMediaValidation('video', selectedUrl, recommend)

  function markLoading() {
    setState((prev) => ({
      ...prev,
      status: prev.items.length > 0 ? 'refreshing' : 'loading',
      error: '',
      refreshError: '',
    }))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [debouncedSearch, folderFilter, tag])

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
    setState((previous) => ({
      ...previous,
      status: previous.items.length > 0 ? 'refreshing' : 'loading',
      error: '',
      refreshError: '',
    }))
    fetchMedia({ search: debouncedSearch, mimeType: 'video/', page, pageSize: PAGE_SIZE, folderFilter: folderFilter || undefined, tag: tag || undefined })
      .then((result) => {
        if (!active) return
        const items = result.items ?? []
        items.forEach((it) => mergeMediaCacheItem(mediaCacheRef, it))
        const totalPages = Math.max(1, Number(result.pagination?.totalPages) || 1)
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
      .catch((loadError) => {
        if (!active) return
        setState((previous) => previous.items.length > 0
          ? { ...previous, status: 'success', refreshError: loadError?.message || 'refresh-failed', error: '' }
          : { status: 'error', items: [], totalPages: 1, error: loadError?.message || '', refreshError: '' })
      })
    return () => { active = false }
  }, [canRead, debouncedSearch, page, reloadKey, folderFilter, tag])

  // Escape đi qua attemptClose để hỏi xác nhận khi đang tải lên / đã chọn.
  useModalFocusTrap({ modalRef, onClose: attemptClose })
  useBodyScrollLock()

  async function handleFileChange(event) {
    if (!canWrite) return
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
        mediaCacheRef.current.set(url, result.item)
        markLoading()
        setSelectedUrl(url)
        setSearch('')
        setFolderFilter('')
        setTag('')
        setPage(1)
        setReloadKey((value) => value + 1)
      } else {
        setUploadError(t('homeVideos.picker.uploadError'))
      }
    } catch (uploadFailure) {
      setUploadError(uploadFailure?.message || t('homeVideos.picker.uploadError'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleConfirm() {
    if (selectedUrl && !validation.blocked) onSelect(selectedUrl, mediaCacheRef.current.get(selectedUrl) ?? null)
  }

  // Hỏi xác nhận khi đóng lúc đang tải lên hoặc đã chọn video để tránh mất lựa
  // chọn / tiến trình. Dùng cho backdrop, nút đóng, Huỷ và Escape.
  async function attemptClose() {
    if (uploading) {
      setUploadError(t('media.closeWhileUploading'))
      return
    }
    if (selectedUrl) {
      const ok = await showConfirm(
        t('media.picker.closeConfirm', { defaultValue: 'Bạn đang có tệp đã chọn. Đóng sẽ bỏ lựa chọn này. Tiếp tục?' }),
        t('media.picker.closeConfirmTitle', { defaultValue: 'Đóng cửa sổ chọn?' }),
      )
      if (!ok) return
    }
    onClose()
  }

  const isRefreshing = state.status === 'refreshing'
  const canConfirm = Boolean(selectedUrl) && !isRefreshing && !validation.blocked && validation.status !== 'loading'

  const isLoading = state.status === 'loading'

  if (!canRead) {
    return createPortal(
      <>
        <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
        <div ref={modalRef} tabIndex={-1} className="mpicker-modal" role="dialog" aria-modal="true" aria-label={t('media.videoPermissionDeniedTitle')}>
          <div className="mpicker-header">
            <h3 className="mpicker-title">{t('media.videoPermissionDeniedTitle')}</h3>
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>{t('common.close')}</Button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            {t('media.videoPermissionDeniedDesc')}
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
      <div ref={modalRef} className="mpicker-modal" role="dialog" aria-modal="true" aria-label={t('homeVideos.picker.dialogLabel')}>
        <div className="mpicker-header">
          <h3 className="mpicker-title">{t('homeVideos.picker.title')}</h3>
          <div className="mpicker-header-actions">
            {canWrite && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_MIME.join(',')}
                  className="hidden"
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
              </>
            )}
            <Button variant="secondary" size="icon" type="button" onClick={attemptClose} aria-label={t('homeVideos.picker.close')}>
              <IconClose />
            </Button>
          </div>
        </div>

        <div className="mpicker-search">
          <Input
            type="search"
            placeholder={t('homeVideos.picker.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
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
            <Button variant="unstyled" onClick={() => setUploadError('')} aria-label={t('homeVideos.picker.dismissError')}><IconClose /></Button>
          </div>
        )}

        <div className="mpicker-body">
          {isLoading && <div className="mpicker-state">{t('homeVideos.picker.loading')}</div>}
          {state.status === 'error' && (
            <div className="mpicker-state mpicker-state-error">
              <p>{state.error || t('homeVideos.picker.loadError')}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setReloadKey((value) => value + 1)}>{t('common.retry')}</Button>
            </div>
          )}
          {isRefreshing && <p className="px-4 py-2 text-sm text-muted-foreground" role="status">{t('media.refreshing')}</p>}
          {state.refreshError && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              <span>{t('media.refreshError')}</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setReloadKey((value) => value + 1)}>{t('common.retry')}</Button>
            </div>
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <div className="mpicker-state mpicker-state-empty">
              <IconVideo />
              <p>{search ? t('homeVideos.picker.emptySearch') : t('homeVideos.picker.empty')}</p>
            </div>
          )}
          {(state.status === 'success' || state.status === 'refreshing') && state.items.length > 0 && (
            <div className="mpicker-grid" aria-busy={isRefreshing || undefined}>
              {state.items.map((media) => {
                const url = media.publicUrl
                const isSelected = url === selectedUrl
                const filename = media.filename?.split('/').pop() ?? t('homeVideos.picker.defaultFileName')
                return (
                  <Button
                    variant="unstyled"
                    key={media.id}
                    className={`mpicker-item${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedUrl(isSelected ? null : url)}
                    disabled={isRefreshing || !url}
                    aria-pressed={isSelected}
                    title={filename}
                  >
                    <PickerVideoThumbnail url={url} />
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
                  </Button>
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
              disabled={page <= 1 || isLoading || isRefreshing}
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
              disabled={page >= state.totalPages || isLoading || isRefreshing}
            >
              {t('homeVideos.picker.next')}
            </Button>
          </div>
        )}

        <div className="px-4 pt-1">
          <MediaRequirementHint recommend={recommend} />
          {selectedUrl && (
            <MediaValidationError
              reasons={validation.reasons}
              kind="video"
              width={validation.width}
              height={validation.height}
              recommend={recommend}
            />
          )}
        </div>

        <div className="mpicker-footer">
          {selectedUrl ? (
            <span className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap max-w-[300px]">
              {selectedUrl.split('/').pop()}
            </span>
          ) : (
            <span className="mpicker-hint">{t('homeVideos.picker.selectHint')}</span>
          )}
          <div className="mpicker-footer-actions">
            <Button variant="secondary" type="button" onClick={attemptClose}>{t('common.cancel')}</Button>
            <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
              {t('homeVideos.picker.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
