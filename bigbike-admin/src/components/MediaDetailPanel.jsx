import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { X as XIcon, Copy, Maximize2, Edit2, Trash2, RotateCcw, AlertTriangle, Music, FileText, RefreshCw } from 'lucide-react'
import { fetchMediaFolders, fetchMediaReferences, replaceMediaFile, updateMedia } from '../lib/adminApi'
import { TagInput } from './TagInput'
import styles from './MediaDetailPanel.module.css'

const TYPE_LABEL = {
  PRODUCT: 'Sản phẩm',
  PRODUCT_GALLERY: 'Gallery sản phẩm',
  PRODUCT_VARIANT: 'Biến thể sản phẩm',
  PRODUCT_VARIANT_GALLERY: 'Gallery biến thể',
  CATEGORY: 'Danh mục',
  BRAND: 'Thương hiệu',
  HOME_VIDEO: 'Video trang chủ',
  CONTENT: 'Bài viết',
  CONTENT_PRODUCT_IMG: 'Bài viết (ảnh sản phẩm)',
  CONTENT_SEO_OG: 'Bài viết (SEO OG)',
  PAGE_SEO_OG: 'Trang (SEO OG)',
  SLIDER_DESKTOP: 'Banner desktop',
  SLIDER_MOBILE: 'Banner mobile',
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
  const [refs, setRefs] = useState(media.references ?? [])
  const [refsLoading, setRefsLoading] = useState(false)
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
    setRefs(media.references ?? [])
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Array.isArray(foldersProp)) return
    fetchMediaFolders().then(setFoldersLocal)
  }, [foldersProp])

  // Lazy-load references when not bundled
  useEffect(() => {
    if (media.references && media.references.length > 0) return
    if ((media.usageCount ?? 0) === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefsLoading(true)
    fetchMediaReferences(media.id)
      .then(setRefs)
      .catch(() => {})
      .finally(() => setRefsLoading(false))
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <aside className={styles.panel} role="complementary" aria-label={t('media.editTitle')}>
      <header className={styles.header}>
        <h3 className={styles.heading}>{t('media.editTitle')}</h3>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className={styles.closeBtn}>
          <XIcon size={18} />
        </button>
      </header>

      <div className={styles.body}>
        {/* Preview */}
        <section className={styles.preview}>
          <button type="button" onClick={onPreview} aria-label={t('media.preview')} className={styles.previewArea}>
            {isImage && media.publicUrl ? (
              <img src={media.publicUrl} alt={altText || ''} />
            ) : isVideo && media.publicUrl ? (
              <video src={media.publicUrl} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
            ) : isAudio && media.publicUrl ? (
              <div className={styles.audioWrap}>
                <Music size={48} />
                <audio src={media.publicUrl} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
              </div>
            ) : (
              <FileText size={48} />
            )}
            {(isImage || isVideo) && (
              <span className={styles.previewHint}>
                <Maximize2 size={14} /> {t('media.preview')}
              </span>
            )}
          </button>

          <div className={styles.urlRow}>
            <input type="text" readOnly value={media.publicUrl || ''} className="control-input" style={{ fontSize: '0.75rem' }} />
            <button type="button" onClick={() => handleCopyUrl()} className="btn btn-secondary" style={{ flexShrink: 0 }}
              title={t('media.copyUrl')} aria-label={t('media.copyUrl')}>
              <Copy size={14} />
            </button>
          </div>

          {canUpdate && !isTrash && isImage && (
            <>
              <input ref={replaceInputRef} type="file" accept="image/*"
                style={{ display: 'none' }} onChange={handleReplaceFile} />
              <button type="button" onClick={handleReplaceClick}
                className="btn btn-secondary"
                disabled={replacing}
                style={{ width: '100%', fontSize: '0.78rem' }}>
                <RefreshCw size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                {replacing ? t('media.replacing') : t('media.replaceFile')}
              </button>
              <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', margin: 0 }}>
                {t('media.replaceHint')}
              </p>
            </>
          )}
        </section>

        {/* Metadata fields */}
        <form id="media-detail-panel-form" onSubmit={handleSave} className={styles.form}>
          <fieldset disabled={!canUpdate || isTrash} style={{ all: 'unset', display: 'contents' }}>
            <label className={styles.field}>
              <span>{t('media.fieldAltText')}</span>
              <input className="control-input" type="text" value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder={t('media.fieldAltTextPlaceholder')} />
            </label>
            <label className={styles.field}>
              <span>{t('media.fieldTitle')}</span>
              <input className="control-input" type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('media.fieldTitlePlaceholder')} />
            </label>
            <label className={styles.field}>
              <span>{t('media.fieldCaption')}</span>
              <textarea className="control-input" rows={2} value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('media.fieldCaptionPlaceholder')} style={{ resize: 'vertical' }} />
            </label>
            <label className={styles.field}>
              <span>{t('media.folder')}</span>
              <select className="control-select" value={folderId}
                onChange={(e) => setFolderId(e.target.value)}>
                <option value="">{t('media.uncategorized')}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>{t('media.tags')}</span>
              <TagInput value={tags} onChange={setTags}
                placeholder={t('media.tagsPlaceholder')}
                disabled={!canUpdate || isTrash} />
            </label>
          </fieldset>
          {error && <p className={styles.error}>{error}</p>}
        </form>

        {/* Technical info */}
        <section className={styles.info}>
          <p className={styles.sectionTitle}>{t('media.technicalInfo')}</p>
          <dl className={styles.dl}>
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
          <section className={styles.info}>
            <p className={styles.sectionTitle}>{t('media.variants')}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(media.sizes).map(([name, url]) => (
                <li key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                  <span style={{
                    background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)',
                    borderRadius: 4, padding: '1px 8px', fontSize: '0.68rem',
                    fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>
                    {name}
                  </span>
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--c-text-muted)',
                  }} title={url}>
                    {url}
                  </span>
                  <button type="button" onClick={() => handleCopyUrl(url)}
                    aria-label={t('media.copyUrl')} title={t('media.copyUrl')}
                    style={{
                      all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--c-text-muted)',
                      borderRadius: 3, display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-bg-subtle)'; e.currentTarget.style.color = 'var(--c-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-muted)' }}
                  >
                    <Copy size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Usage / references */}
        <section className={styles.info}>
          <p className={styles.sectionTitle}>
            {t('media.usageTitle')}
            {media.usageCount > 0
              ? <span className={`${styles.badge} ${styles.badgePrimary}`}>{media.usageCount}</span>
              : <span className={`${styles.badge} ${styles.badgeMuted}`}>{t('media.usageUnused')}</span>}
          </p>
          {refsLoading && <p className={styles.muted}>{t('common.loading')}</p>}
          {!refsLoading && (media.usageCount ?? 0) === 0 && (
            <p className={styles.muted}>{t('media.usageNoneDesc')}</p>
          )}
          {!refsLoading && refs.length > 0 && (
            <ul className={styles.refList}>
              {refs.map((r, i) => (
                <li key={i}>
                  <span className={styles.refType}>{TYPE_LABEL[r.type] ?? r.type}</span>
                  {r.adminPath ? <a href={r.adminPath} title={r.name}>{r.name}</a>
                    : <span title={r.name}>{r.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.dangerActions}>
          {canUpdate && !isTrash && onDelete && (
            <button type="button" className="btn btn-danger" onClick={onDelete} title={t('common.delete')}>
              <Trash2 size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('common.delete')}
            </button>
          )}
          {canUpdate && isTrash && onRestore && (
            <button type="button" className="btn btn-primary" onClick={onRestore}>
              <RotateCcw size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('media.restore')}
            </button>
          )}
          {canHardDelete && onHardDelete && (
            <button type="button" onClick={onHardDelete}
              style={{
                background: '#7f1d1d', color: '#fff', border: 'none',
                padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem',
              }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('media.hardDelete')}
            </button>
          )}
        </div>
        <div className={styles.saveActions}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          {canUpdate && !isTrash && (
            <button type="submit" form="media-detail-panel-form" className="btn btn-primary"
              disabled={saving || !dirty}>
              <Edit2 size={14} style={{ verticalAlign: 'text-bottom' }} /> {saving ? t('common.saving') : t('common.save')}
            </button>
          )}
        </div>
      </footer>
    </aside>
  )
}
