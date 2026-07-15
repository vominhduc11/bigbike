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

const ALLOWED_MIME = ['video/mp4']
const MAX_FILE_SIZE = 50 * 1024 * 1024
const PAGE_SIZE = 20

function IconVideo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

export function VideoPickerModal({ onSelect, onClose, recommend = IMAGE_RECO.video }) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  const canWrite = hasPermission('media.write')
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
  const [state, setState] = useState({ status: 'loading', items: [], totalPages: 1, error: '' })
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
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [debouncedSearch, folderFilter, tag])

  // Nạp danh sách thư mục + tag để lọc (chỉ 1 lần khi mở picker). Dùng allSettled
  // để giữ phần tải được và HIỆN lỗi thay vì nuốt im lặng.
  useEffect(() => {
    let active = true
    Promise.allSettled([fetchMediaFolders(), fetchMediaTags()]).then(([fRes, tRes]) => {
      if (!active) return
      if (fRes.status === 'fulfilled') setFolders(fRes.value ?? [])
      if (tRes.status === 'fulfilled') setTags(tRes.value ?? [])
      setFiltersError(fRes.status === 'rejected' || tRes.status === 'rejected')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetchMedia({ search: debouncedSearch, mimeType: 'video/', page, pageSize: PAGE_SIZE, folderFilter: folderFilter || undefined, tag: tag || undefined })
      .then((result) => {
        if (!active) return
        const items = result.items ?? []
        items.forEach((it) => mergeMediaCacheItem(mediaCacheRef, it))
        setState({
          status: 'success',
          items,
          totalPages: result.pagination?.totalPages ?? 1,
          error: '',
        })
      })
      .catch(() => {
        if (!active) return
        // Thông báo thân thiện thay vì message lỗi thô từ máy chủ.
        setState({
          status: 'error',
          items: [],
          totalPages: 1,
          error: t('homeVideos.picker.loadError'),
        })
      })
    return () => { active = false }
  }, [debouncedSearch, page, reloadKey, t, folderFilter, tag])

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
        mediaCacheRef.current.set(url, { ...result.item, isNewUpload: true })
        markLoading()
        setSelectedUrl(url)
        setSearch('')
        setPage(1)
        setReloadKey((value) => value + 1)
      }
    } catch {
      // Thông báo thân thiện thay vì message lỗi thô từ máy chủ.
      setUploadError(t('homeVideos.picker.uploadError'))
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
    if (uploading || selectedUrl) {
      const ok = await showConfirm(
        t('media.picker.closeConfirm', { defaultValue: 'Bạn đang chọn hoặc tải file lên. Đóng sẽ mất lựa chọn và tiến trình đang tải. Tiếp tục?' }),
        t('media.picker.closeConfirmTitle', { defaultValue: 'Đóng cửa sổ chọn?' }),
      )
      if (!ok) return
    }
    onClose()
  }

  const canConfirm = Boolean(selectedUrl) && !validation.blocked && validation.status !== 'loading'

  const isLoading = state.status === 'loading'

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
            onChange={(event) => {
              markLoading()
              setSearch(event.target.value)
            }}
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
                  <Button
                    variant="unstyled"
                    key={media.id}
                    className={`mpicker-item${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedUrl(isSelected ? null : url)}
                    aria-pressed={isSelected}
                    title={filename}
                  >
                    <div className="mpicker-thumb mpicker-thumb-video">
                      {url ? (
                        <video src={`${url}#t=0.001`} className="w-full h-full object-cover" muted preload="metadata" />
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
