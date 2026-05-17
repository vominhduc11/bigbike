import { Edit2, Trash2, RotateCcw, AlertTriangle, Music, FileText, Copy, Eye } from 'lucide-react'
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

export function MediaListRow({
  media, selected, deleting,
  onToggleSelect, onPreview,
  onEdit, onDelete, onRestore, onHardDelete,
}) {
  const { t } = useTranslation()
  const filename = formatText((media.filename ?? '').split('/').pop())
  const dimensions = media.width && media.height ? `${media.width}×${media.height}` : '—'
  const dateStr = media.createdAt ? new Date(media.createdAt).toLocaleDateString('vi-VN') : '—'

  function handleCopyUrl() {
    if (!media.publicUrl) return
    const url = window.location.origin + media.publicUrl
    navigator.clipboard.writeText(url)
      .then(() => toast.success(t('media.urlCopied')))
      .catch(() => toast.error(t('media.copyFailed')))
  }

  return (
    <div className={`medialib-list-row ${selected ? 'medialib-is-selected' : ''}`}>
      {onToggleSelect ? (
        <Checkbox checked={selected} onCheckedChange={onToggleSelect}
          aria-label={t('media.select')} className="medialib-card-checkbox"
          style={{ position: 'static' }}  />
      ) : <span />}

      <button type="button" onClick={onPreview} aria-label={t('media.preview')}
        className="medialib-list-thumb">
        {isImage(media.mimeType) && media.publicUrl ? (
          <img src={media.publicUrl} alt={filename} loading="lazy" />
        ) : isVideo(media.mimeType) && media.publicUrl ? (
          <video src={`${media.publicUrl}#t=0.001`} muted preload="metadata" />
        ) : (
          <div className="medialib-thumb-placeholder">
            {isAudio(media.mimeType) ? <Music size={20} /> : <FileText size={20} />}
          </div>
        )}
      </button>

      <div className="medialib-list-name">
        <span className="medialib-list-name-primary" title={media.filename ?? ''}>{filename}</span>
        <span className="medialib-list-name-secondary">{media.altText || media.title || '—'}</span>
      </div>

      <span className="text-[0.78rem]">{formatSize(media.fileSize)}</span>
      <span className="text-[0.78rem] text-muted-foreground">{dimensions}</span>
      <span className="text-[0.78rem] text-muted-foreground">{dateStr}</span>

      <span>
        {media.usageCount > 0 ? (
          <span className="medialib-card-usage-badge medialib-is-used">{media.usageCount}</span>
        ) : (
          <span className="medialib-card-usage-badge medialib-is-unused">—</span>
        )}
      </span>

      <div className="medialib-list-actions">
        <button type="button" onClick={onPreview} className="medialib-icon-btn-light"
          title={t('media.preview')}>
          <Eye size={14} />
        </button>
        {media.publicUrl && (
          <button type="button" onClick={handleCopyUrl} className="medialib-icon-btn-light"
            title={t('media.copyUrl')}>
            <Copy size={14} />
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className="medialib-icon-btn-light"
            title={t('common.edit')}>
            <Edit2 size={14} />
          </button>
        )}
        {onRestore && (
          <button type="button" onClick={onRestore} className="medialib-icon-btn-light" disabled={deleting}
            title={t('media.restore')}>
            <RotateCcw size={14} />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="medialib-icon-btn-light medialib-btn-danger" disabled={deleting}
            title={t('common.delete')}>
            <Trash2 size={14} />
          </button>
        )}
        {onHardDelete && (
          <button type="button" onClick={onHardDelete}
            className="medialib-icon-btn-light medialib-btn-danger-solid" disabled={deleting}
            title={t('media.hardDelete')}>
            <AlertTriangle size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
