import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { X as XIcon, Copy, Maximize2, Edit2, Trash2, RotateCcw, AlertTriangle, Music, FileText, RefreshCw } from 'lucide-react'
import { fetchMediaFolders, replaceMediaFile, updateMedia } from '../lib/adminApi'
import { useMediaReferences } from '../lib/useMediaReferences'
import { TagInput } from './TagInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const REFERENCE_TYPE_KEYS = {
  PRODUCT: 'media.referenceType.PRODUCT',
  PRODUCT_GALLERY: 'media.referenceType.PRODUCT_GALLERY',
  PRODUCT_VARIANT: 'media.referenceType.PRODUCT_VARIANT',
  PRODUCT_VARIANT_GALLERY: 'media.referenceType.PRODUCT_VARIANT_GALLERY',
  CATEGORY: 'media.referenceType.CATEGORY',
  BRAND: 'media.referenceType.BRAND',
  HOME_VIDEO: 'media.referenceType.HOME_VIDEO',
  CONTENT: 'media.referenceType.CONTENT',
  CONTENT_PRODUCT_IMG: 'media.referenceType.CONTENT_PRODUCT_IMG',
  CONTENT_SEO_OG: 'media.referenceType.CONTENT_SEO_OG',
  PAGE_SEO_OG: 'media.referenceType.PAGE_SEO_OG',
  SLIDER_DESKTOP: 'media.referenceType.SLIDER_DESKTOP',
  SLIDER_MOBILE: 'media.referenceType.SLIDER_MOBILE',
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return iso }
}

/**
 * Slide-in detail panel — does not block the grid behind it.
 * Shows preview, editable metadata, technical info, references.
 */
export function MediaDetailPanel({ media, onClose, onSaved, onPreview, onDelete, onRestore, onHardDelete, canUpdate, canHardDelete, folders: foldersProp }) {
  const { t } = useTranslation()
  const [altText, setAltText] = useState(media.altText ?? '')
  const [title, setTitle] = useState(media.title ?? '')
  const [caption, setCaption] = useState(media.caption ?? '')
  const [folderId, setFolderId] = useState(media.folderId ?? '')
  const [tags, setTags] = useState(Array.isArray(media.tags) ? media.tags : [])
  // Use folders from parent prop when provided (kept fresh by parent screen),
  // fall back to fetching once on mount when used standalone (e.g. MediaPicker).
  const [foldersLocal, setFoldersLocal] = useState([])
  const folders = Array.isArray(foldersProp) ? foldersProp : foldersLocal
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState('')
  const { refs, refsLoading } = useMediaReferences(media)
  const replaceInputRef = useRef(null)

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')
  const isTrash = media.status === 'DELETED'
  const filename = (media.filename ?? media.publicUrl ?? '').split('/').pop()

  // Reset form fields when switching media
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAltText(media.altText ?? '')
    setTitle(media.title ?? '')
    setCaption(media.caption ?? '')
    setFolderId(media.folderId ?? '')
    setTags(Array.isArray(media.tags) ? media.tags : [])
    setError('')
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Array.isArray(foldersProp)) return
    fetchMediaFolders().then(setFoldersLocal)
  }, [foldersProp])

  // ESC to close
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { altText, title, caption, tags }
      if (folderId === '') { payload.clearFolder = true } else { payload.folderId = folderId }
      const result = await updateMedia(media.id, payload)
      onSaved(result.item)
      toast.success(t('media.saveSuccess'))
    } catch (err) {
      setError(err.message || t('media.saveError'))
    } finally { setSaving(false) }
  }

  function handleCopyUrl(specificUrl) {
    const path = specificUrl || media.publicUrl
    if (!path) return
    const url = window.location.origin + path
    navigator.clipboard.writeText(url)
      .then(() => toast.success(t('media.urlCopied')))
      .catch(() => toast.error(t('media.copyFailed')))
  }

  async function handleReplaceClick() { replaceInputRef.current?.click() }

  async function handleReplaceFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setReplacing(true)
    try {
      const result = await replaceMediaFile(media.id, file)
      onSaved(result.item)
      toast.success(t('media.replaceSuccess'))
    } catch (err) {
      toast.error(err.message || t('media.replaceError'))
    } finally { setReplacing(false) }
  }

  const dirty =
    altText !== (media.altText ?? '') ||
    title !== (media.title ?? '') ||
    caption !== (media.caption ?? '') ||
    folderId !== (media.folderId ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(Array.isArray(media.tags) ? media.tags : [])

  return (
    <aside className="mediadetail-panel" role="complementary" aria-label={t('media.editTitle')}>
      <header className="mediadetail-header">
        <h3 className="mediadetail-heading">{t('media.editTitle')}</h3>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="mediadetail-close-btn">
          <XIcon size={18} />
        </button>
      </header>

      <div className="mediadetail-body">
        {/* Preview */}
        <section className="mediadetail-preview">
          <button type="button" onClick={onPreview} aria-label={t('media.preview')} className="mediadetail-preview-area">
            {isImage && media.publicUrl ? (
              <img src={media.publicUrl} alt={altText || ''} />
            ) : isVideo && media.publicUrl ? (
              <video src={media.publicUrl} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
            ) : isAudio && media.publicUrl ? (
              <div className="mediadetail-audio-wrap">
                <Music size={48} />
                <audio src={media.publicUrl} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
              </div>
            ) : (
              <FileText size={48} />
            )}
            {(isImage || isVideo) && (
              <span className="mediadetail-preview-hint">
                <Maximize2 size={14} /> {t('media.preview')}
              </span>
            )}
          </button>

          <div className="mediadetail-url-row">
            <Input type="text" readOnly value={media.publicUrl || ''} className="text-xs"  />
            <Button variant="outline" size="icon" onClick={() => handleCopyUrl()} className="shrink-0"
              title={t('media.copyUrl')} aria-label={t('media.copyUrl')}>
              <Copy size={14} />
            </Button>
          </div>

          {canUpdate && !isTrash && isImage && (
            <>
              <input ref={replaceInputRef} type="file" accept="image/*"
                className="hidden" onChange={handleReplaceFile} />
              <Button variant="outline" size="sm" onClick={handleReplaceClick}
                loading={replacing} className="w-full">
                <RefreshCw size={13} />
                {t('media.replaceFile')}
              </Button>
              <p className="text-xs text-muted-foreground m-0">
                {t('media.replaceHint')}
              </p>
            </>
          )}
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
              <span>{t('media.fieldCaption')}</span>
              <Textarea rows={2} value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('media.fieldCaptionPlaceholder')} className="resize-y"  />
            </label>
            <label className="mediadetail-field">
              <span>{t('media.folder')}</span>
              <Select value={folderId}
                onValueChange={setFolderId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
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

        {/* Image variants */}
        {media.sizes && Object.keys(media.sizes).length > 0 && (
          <section className="mediadetail-info">
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
          </section>
        )}

        {/* Usage / references */}
        <section className="mediadetail-info">
          <p className="mediadetail-section-title">
            {t('media.usageTitle')}
            {media.usageCount > 0
              ? <span className="mediadetail-badge mediadetail-badge-primary">{media.usageCount}</span>
              : <span className="mediadetail-badge mediadetail-badge-muted">{t('media.usageUnused')}</span>}
          </p>
          {refsLoading && <p className="mediadetail-muted">{t('common.loading')}</p>}
          {!refsLoading && (media.usageCount ?? 0) === 0 && (
            <p className="mediadetail-muted">{t('media.usageNoneDesc')}</p>
          )}
          {!refsLoading && refs.length > 0 && (
            <ul className="mediadetail-ref-list">
              {refs.map((r, i) => (
                <li key={i}>
                  <span className="mediadetail-ref-type">{REFERENCE_TYPE_KEYS[r.type] ? t(REFERENCE_TYPE_KEYS[r.type]) : r.type}</span>
                  {r.adminPath ? <a href={r.adminPath} title={r.name}>{r.name}</a>
                    : <span title={r.name}>{r.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="mediadetail-footer">
        <div className="mediadetail-danger-actions">
          {canUpdate && !isTrash && onDelete && (
            <Button variant="danger" onClick={onDelete} title={t('common.delete')}>
              <Trash2 size={14} /> {t('common.delete')}
            </Button>
          )}
          {canUpdate && isTrash && onRestore && (
            <Button onClick={onRestore}>
              <RotateCcw size={14} /> {t('media.restore')}
            </Button>
          )}
          {canHardDelete && onHardDelete && (
            <Button variant="danger" type="button" onClick={onHardDelete} className="text-xs">
              <AlertTriangle size={14} className="align-text-bottom" /> {t('media.hardDelete')}
            </Button>
          )}
        </div>
        <div className="mediadetail-save-actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          {canUpdate && !isTrash && (
            <Button type="submit" form="media-detail-panel-form" loading={saving} disabled={!dirty}>
              <Edit2 size={14} /> {t('common.save')}
            </Button>
          )}
        </div>
      </footer>
    </aside>
  )
}
