import { Edit2, Trash2, RotateCcw, AlertTriangle, Music, FileText, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { formatText } from '../lib/formatters'
import { Checkbox } from '@/components/ui/checkbox'

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isImage = (m) => m && m.startsWith('image/')
const isVideo = (m) => m && m.startsWith('video/')
const isAudio = (m) => m && m.startsWith('audio/')

export function MediaCard({
  media, selected, focused, deleting,
  onToggleSelect, onPreview,
  onEdit, onDelete, onRestore, onHardDelete,
  onCopyUrl,
}) {
  const { t } = useTranslation()
  const filename = formatText((media.filename ?? '').split('/').pop())
  const dimensions = media.width && media.height ? `${media.width}×${media.height}` : null
  const meta = [formatSize(media.fileSize), dimensions].filter(Boolean).join(' · ')

  const className = [
    'medialib-card',
    selected ? 'medialib-is-selected' : '',
    focused ? 'medialib-is-focused' : '',
    media.status === 'DELETED' ? 'medialib-card-deleted' : '',
  ].filter(Boolean).join(' ')

  function handleCopyUrl(e) {
    e.stopPropagation()
    if (!media.publicUrl) return
    const url = window.location.origin + media.publicUrl
    navigator.clipboard.writeText(url)
      .then(() => toast.success(t('media.urlCopied')))
      .catch(() => toast.error(t('media.copyFailed')))
    onCopyUrl?.()
  }

  // Thumb is a clickable div (role=button), NOT a real <button>, so it can host
  // child buttons in the hover overlay without nesting <button> elements.
  // Keyboard activation is handled via onKeyDown to keep accessibility intact.
  function onThumbKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPreview?.()
    }
  }

  return (
    <div className={className}>
      {media.status === 'DELETED' && (
        <span className="medialib-card-badge medialib-card-badge-deleted">
          {t('media.statusDeleted')}
        </span>
      )}
      {onToggleSelect && (
        <Checkbox checked={selected} onCheckedChange={onToggleSelect}
          aria-label={t('media.select')}
          onClick={(e) => e.stopPropagation()}
          className="medialib-card-checkbox"  />
      )}

      <div role="button" tabIndex={0}
        onClick={onPreview}
        onKeyDown={onThumbKeyDown}
        aria-label={t('media.preview')}
        className="medialib-thumb-wrap">
        {isImage(media.mimeType) && media.publicUrl ? (
          <img src={media.publicUrl} alt={media.altText || filename} loading="lazy" />
        ) : isVideo(media.mimeType) && media.publicUrl ? (
          <video src={`${media.publicUrl}#t=0.001`} muted preload="metadata" />
        ) : (
          <div className="medialib-thumb-placeholder">
            {isAudio(media.mimeType)
              ? <Music size={36} />
              : <FileText size={36} />}
          </div>
        )}

        {(onEdit || onDelete || onRestore || onHardDelete || onCopyUrl) && (
          <div className="medialib-action-overlay">
            <div className="medialib-overlay-actions">
              {media.publicUrl && (
                <button type="button" onClick={handleCopyUrl}
                  className="medialib-icon-btn"
                  title={t('media.copyUrl')} aria-label={t('media.copyUrl')}>
                  <Copy size={14} />
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className="medialib-icon-btn"
                  title={t('common.edit')} aria-label={t('common.edit')}>
                  <Edit2 size={14} />
                </button>
              )}
              {onRestore && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onRestore() }}
                  className="medialib-icon-btn" disabled={deleting}
                  title={t('media.restore')} aria-label={t('media.restore')}>
                  <RotateCcw size={14} />
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="medialib-icon-btn medialib-btn-danger" disabled={deleting}
                  title={t('common.delete')} aria-label={t('common.delete')}>
                  <Trash2 size={14} />
                </button>
              )}
              {onHardDelete && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onHardDelete() }}
                  className="medialib-icon-btn medialib-btn-danger-solid" disabled={deleting}
                  title={t('media.hardDelete')} aria-label={t('media.hardDelete')}>
                  <AlertTriangle size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="medialib-card-body">
        <p className="medialib-card-name" title={media.filename ?? ''}>{filename}</p>
        <p className="medialib-card-meta">{meta || '—'}</p>
        {media.usageCount > 0 ? (
          <span className="medialib-card-usage-badge medialib-is-used">
            {t('media.usedIn', { count: media.usageCount })}
          </span>
        ) : (
          <span className="medialib-card-usage-badge medialib-is-unused">
            {t('media.usageUnused')}
          </span>
        )}
      </div>
    </div>
  )
}
