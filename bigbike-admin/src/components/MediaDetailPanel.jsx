import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { X as XIcon, Copy, Download, Maximize2, Pencil, Trash2, RotateCcw, AlertTriangle, Music, FileText, ImageOff } from 'lucide-react'
import { fetchMediaFolders, updateMedia } from '../lib/adminApi'
import { useMediaReferences } from '../lib/useMediaReferences'
import { showConfirm } from '../lib/confirm'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useDraftAutosave } from '../lib/useDraftAutosave'
import { TagInput } from './TagInput'
import { CollapsibleSection } from './CollapsibleSection'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getMediaReferenceAdminPath, REFERENCE_TYPE_KEYS, formatBytes, toClipboardUrl } from './media-picker/pickerUtils'


function formatDate(iso) {
  if (!iso) return '—'
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return iso }
}

function detailActionError(t, error, fallback) {
  if (error?.status === 403) return t('media.actionForbidden')
  if (error?.status === 404) return t('media.actionNotFound')
  if (error?.status === 409) return error.message || t('media.actionConflict')
  if (error?.status === 0 || error?.code === 'NETWORK_ERROR') return t('media.actionNetworkError')
  return error?.message || fallback
}

/**
 * Slide-in detail panel — does not block the grid behind it.
 * Shows preview, editable metadata, technical info, references.
 */
export function MediaDetailPanel({ media, onClose, onSaved, onPreview, onDownload, onDelete, onRestore, onHardDelete, canUpdate, canHardDelete, actionBusy = false, folders: foldersProp }) {
  const { t } = useTranslation()
  const [altText, setAltText] = useState(media.altText ?? '')
  const [title, setTitle] = useState(media.title ?? '')
  const [folderId, setFolderId] = useState(media.folderId ?? '')
  const [tags, setTags] = useState(Array.isArray(media.tags) ? media.tags : [])
  // Use folders from parent prop when provided (kept fresh by parent screen),
  // fall back to fetching once on mount when used standalone (e.g. MediaPicker).
  const [foldersLocal, setFoldersLocal] = useState([])
  const folders = Array.isArray(foldersProp) ? foldersProp : foldersLocal
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Danh sách biến thể kỹ thuật được gom vào đây, đóng sẵn để giữ luồng chính gọn.
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const { refs, refsLoading, refsError, retryRefs } = useMediaReferences(media)

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')
  const isTrash = media.status === 'DELETED'
  const filename = (media.filename ?? media.publicUrl ?? '').split('/').pop()
  const hasVariants = Boolean(media.sizes && Object.keys(media.sizes).length > 0)

  const dirty =
    altText !== (media.altText ?? '') ||
    title !== (media.title ?? '') ||
    folderId !== (media.folderId ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(Array.isArray(media.tags) ? media.tags : [])

  const mediaDraftKey = `draft:media-detail:${media.id}`
  const mediaDraftValue = { mediaId: media.id, altText, title, folderId, tags }
  const { recovered: recoveredMediaDraft, clear: clearMediaDraft } = useDraftAutosave(
    mediaDraftKey,
    mediaDraftValue,
    { enabled: Boolean(canUpdate && !isTrash), dirty },
  )

  // Cảnh báo khi rời trang lúc đang sửa (mở link tham chiếu → điều hướng cả trang,
  // reload/đóng tab, hoặc điều hướng nội bộ qua router) — attemptClose chỉ lo nút
  // Đóng/Huỷ/Esc trong panel.
  useUnsavedChanges(canUpdate && !isTrash && dirty, t('media.discardConfirm'))

  // F6 — nút Đóng (header) / Esc / nút Huỷ (footer) đều đóng ngay lập tức mà
  // không hỏi khi còn thay đổi chưa lưu (dirty). Hỏi xác nhận trước khi đóng,
  // giống điều kiện disable của nút Lưu.
  const attemptClose = useCallback(async () => {
    if (dirty) {
      const confirmed = await showConfirm(
        t('media.discardConfirm', { defaultValue: 'Bạn đang có thay đổi chưa lưu. Đóng sẽ mất các thay đổi đó. Tiếp tục?' }),
        t('media.discardConfirmTitle', { defaultValue: 'Huỷ thay đổi?' }),
      )
      if (!confirmed) return
    }
    clearMediaDraft()
    onClose()
  }, [clearMediaDraft, dirty, onClose, t])

  // Reset form fields when switching media
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const savedForm = recoveredMediaDraft?.value?.mediaId === media.id
      ? recoveredMediaDraft.value
      : null
    setAltText(savedForm?.altText ?? media.altText ?? '')
    setTitle(savedForm?.title ?? media.title ?? '')
    setFolderId(savedForm?.folderId ?? media.folderId ?? '')
    setTags(savedForm?.tags ?? (Array.isArray(media.tags) ? media.tags : []))
    setError('')
    setPreviewFailed(false)
  }, [media.altText, media.folderId, media.id, media.tags, media.title, recoveredMediaDraft])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (Array.isArray(foldersProp)) return
    fetchMediaFolders()
      .then(setFoldersLocal)
      // Thông báo thân thiện thay vì message lỗi thô từ máy chủ.
      .catch(() => setError(t('media.loadError')))
  }, [foldersProp, t])

  // ESC to close — cùng đường xác nhận với nút Đóng/Huỷ (attemptClose)
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') attemptClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [attemptClose])

  // O3 — Ctrl/Cmd+S để lưu, chỉ khi đang có thay đổi để lưu (khớp điều kiện
  // disable của nút Lưu).
  useSaveShortcut(canUpdate && !isTrash && dirty, () => {
    document.getElementById('media-detail-panel-form')?.requestSubmit()
  })

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { altText, title, tags }
      if (folderId === '') { payload.clearFolder = true } else { payload.folderId = folderId }
      const result = await updateMedia(media.id, payload)
      onSaved(result.item)
      clearMediaDraft()
      toast.success(t('media.saveSuccess'))
    } catch (saveError) {
      setError(detailActionError(t, saveError, t('media.saveError')))
    } finally { setSaving(false) }
  }

  function handleCopyUrl(specificUrl) {
    const path = specificUrl || media.publicUrl
    if (!path) return
    navigator.clipboard.writeText(toClipboardUrl(path))
      .then(() => toast.success(t('media.urlCopied')))
      .catch(() => toast.error(t('media.copyFailed')))
  }

  return (
    <aside className="mediadetail-panel" role="complementary" aria-label={t('media.editTitle')}>
      <header className="mediadetail-header">
        <h3 className="mediadetail-heading">{t('media.editTitle')}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={attemptClose} aria-label={t('common.close')} className="mediadetail-close-btn">
          <XIcon size={18} />
        </Button>
      </header>

      <div className="mediadetail-body">
        {/* Preview */}
        <section className="mediadetail-preview">
          <Button variant="unstyled" onClick={onPreview} disabled={!media.publicUrl} aria-label={t('media.preview')} className="mediadetail-preview-area">
            {previewFailed ? (
              <div role="alert" className="flex flex-col items-center gap-2 text-sm text-danger">
                <ImageOff size={40} aria-hidden="true" />
                <span>{t('media.mediaLoadError')}</span>
              </div>
            ) : isImage && media.publicUrl ? (
              <img src={media.publicUrl} alt={altText || filename || t('media.preview')} onError={() => setPreviewFailed(true)} />
            ) : isVideo && media.publicUrl ? (
              <video src={media.publicUrl} controls preload="metadata" onError={() => setPreviewFailed(true)} onClick={(e) => e.stopPropagation()} />
            ) : isAudio && media.publicUrl ? (
              <div className="mediadetail-audio-wrap">
                <Music size={48} />
                <audio src={media.publicUrl} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
              </div>
            ) : (
              <FileText size={48} />
            )}
            {!previewFailed && media.publicUrl && (isImage || isVideo) && (
              <span className="mediadetail-preview-hint">
                <Maximize2 size={14} /> {t('media.preview')}
              </span>
            )}
          </Button>

          <div className="mediadetail-url-row">
            <Input type="text" readOnly value={media.publicUrl || ''} className="text-xs"  />
            <Button variant="outline" size="icon" onClick={() => handleCopyUrl()} className="shrink-0"
              title={t('media.copyUrl')} aria-label={t('media.copyUrl')}>
              <Copy size={14} />
            </Button>
            {onDownload && (
              <Button variant="outline" size="icon" onClick={() => onDownload(media)} className="shrink-0"
                title={t('media.download')} aria-label={t('media.download')}>
                <Download size={14} />
              </Button>
            )}
          </div>
        </section>

        {/* Metadata fields */}
        <form id="media-detail-panel-form" onSubmit={handleSave} className="mediadetail-form">
          <fieldset disabled={!canUpdate || isTrash} className="contents">
            <label className="mediadetail-field">
              <span>{t('media.fieldAltText')}</span>
              <Input type="text" value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder={t('media.fieldAltTextPlaceholder')}  />
            </label>
            <label className="mediadetail-field">
              <span>{t('media.fieldTitle')}</span>
              <Input type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('media.fieldTitlePlaceholder')}  />
            </label>
            <label className="mediadetail-field">
              <span>{t('media.folder')}</span>
              <Select value={folderId || '__NONE__'}
                onValueChange={(value) => setFolderId(value === '__NONE__' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="__NONE__">{t('media.uncategorized')}</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent></Select>
            </label>
            <label className="mediadetail-field">
              <span>{t('media.tags')}</span>
              <TagInput value={tags} onChange={setTags}
                placeholder={t('media.tagsPlaceholder')}
                disabled={!canUpdate || isTrash} />
            </label>
          </fieldset>
          {error && <p className="mediadetail-error">{error}</p>}
        </form>

        {/* Technical info */}
        <section className="mediadetail-info">
          <p className="mediadetail-section-title">{t('media.technicalInfo')}</p>
          <dl className="mediadetail-dl">
            <dt>{t('media.colName')}</dt><dd title={filename}>{filename || '—'}</dd>
            <dt>{t('media.colSize')}</dt><dd>{formatBytes(media.fileSize)}</dd>
            {media.width && media.height && (<><dt>{t('media.colDimensions')}</dt><dd>{media.width}×{media.height}</dd></>)}
            <dt>{t('media.fieldMime')}</dt><dd>{media.mimeType || '—'}</dd>
            <dt>{t('media.fieldUploadedAt')}</dt><dd>{formatDate(media.createdAt)}</dd>
            <dt>{t('media.fieldUpdatedAt')}</dt><dd>{formatDate(media.updatedAt)}</dd>
          </dl>
        </section>

        {/* Usage / references */}
        <section className="mediadetail-info">
          <p className="mediadetail-section-title">
            {t('media.usageTitle')}
            {(refsError ? media.usageCount : refs.length) > 0
              ? <span className="mediadetail-badge mediadetail-badge-primary">{refsError ? media.usageCount : refs.length}</span>
              : <span className="mediadetail-badge mediadetail-badge-muted">{t('media.usageUnused')}</span>}
          </p>
          {refsLoading && <p className="mediadetail-muted">{t('common.loading')}</p>}
          {!refsLoading && refsError && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
              <span>{t('media.referencesLoadError')}</span>
              <Button type="button" variant="secondary" size="sm" onClick={retryRefs}>{t('common.retry')}</Button>
            </div>
          )}
          {!refsLoading && !refsError && refs.length === 0 && (
            <p className="mediadetail-muted">{t('media.usageNoneDesc')}</p>
          )}
          {!refsLoading && !refsError && refs.length > 0 && (
            <ul className="mediadetail-ref-list">
              {refs.map((r, i) => {
                const adminPath = getMediaReferenceAdminPath(r)
                const referenceName = r.name || t('common.unknown')
                return (
                  <li key={i}>
                    <span className="mediadetail-ref-type">{REFERENCE_TYPE_KEYS[r.type] ? t(REFERENCE_TYPE_KEYS[r.type]) : (r.type || t('common.unknown'))}</span>
                    {adminPath ? <a href={adminPath} title={referenceName}>{referenceName}</a>
                      : <span title={referenceName}>{referenceName}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Nâng cao — thông tin kỹ thuật, đóng sẵn */}
        {hasVariants && (
          <CollapsibleSection
            title={t('media.advancedSection')}
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((s) => !s)}
          >
            {hasVariants && (
              <div className="mt-3">
                <p className="mediadetail-section-title">{t('media.variants')}</p>
                <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                  {Object.entries(media.sizes).map(([name, url]) => (
                    <li key={name} className="flex items-center gap-1.5 text-xs">
                      <span className="bg-surface-muted border border-border rounded-xs px-2 py-px text-xs font-bold text-muted-foreground uppercase shrink-0">
                        {name}
                      </span>
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground" title={url}>
                        {url}
                      </span>
                      <Button variant="ghost" size="icon" type="button" onClick={() => handleCopyUrl(url)}
                        aria-label={t('media.copyUrl')} title={t('media.copyUrl')}
                        className="text-muted-foreground hover:text-primary h-6 w-6 shrink-0 rounded-xs"
                      >
                        <Copy size={13} />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleSection>
        )}
      </div>

      <footer className="mediadetail-footer">
        <div className="mediadetail-danger-actions">
          {canUpdate && !isTrash && onDelete && (
            <Button variant="danger" type="button" onClick={onDelete} loading={actionBusy} disabled={actionBusy} title={t('common.delete')}>
              <Trash2 size={14} /> {t('common.delete')}
            </Button>
          )}
          {canUpdate && isTrash && onRestore && (
            <Button type="button" onClick={onRestore} loading={actionBusy} disabled={actionBusy}>
              <RotateCcw size={14} /> {t('media.restore')}
            </Button>
          )}
          {canHardDelete && isTrash && onHardDelete && (
            <Button variant="danger" type="button" onClick={onHardDelete} loading={actionBusy} disabled={actionBusy} className="text-xs">
              <AlertTriangle size={14} className="align-text-bottom" /> {t('media.hardDelete')}
            </Button>
          )}
        </div>
        <div className="mediadetail-save-actions">
          <Button variant="outline" type="button" onClick={attemptClose} disabled={saving || actionBusy}>
            {t('common.cancel')}
          </Button>
          {canUpdate && !isTrash && (
            <Button type="submit" form="media-detail-panel-form" loading={saving} disabled={!dirty}>
              <Pencil size={14} /> {t('common.save')}
            </Button>
          )}
        </div>
      </footer>
    </aside>
  )
}
