import { Edit2, Trash2, RotateCcw, AlertTriangle, Music, FileText, Copy, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import styles from '../screens/MediaLibraryScreen.module.css'
import { formatText } from '../lib/formatters'

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
    <div className={`${styles.listRow} ${selected ? styles.selected : ''}`}>
      {onToggleSelect ? (
        <input type="checkbox" checked={selected} onChange={onToggleSelect}
          aria-label={t('media.select')} className={styles.cardCheckbox}
          style={{ position: 'static' }} />
      ) : <span />}

      <button type="button" onClick={onPreview} aria-label={t('media.preview')}
        className={styles.listThumb}>
        {isImage(media.mimeType) && media.publicUrl ? (
          <img src={media.publicUrl} alt={filename} loading="lazy" />
        ) : isVideo(media.mimeType) && media.publicUrl ? (
          <video src={`${media.publicUrl}#t=0.001`} muted preload="metadata" />
        ) : (
          <div className={styles.thumbPlaceholder}>
            {isAudio(media.mimeType) ? <Music size={20} /> : <FileText size={20} />}
          </div>
        )}
      </button>

      <div className={styles.listName}>
        <span className="primary" title={media.filename ?? ''}>{filename}</span>
        <span className="secondary">{media.altText || media.title || '—'}</span>
      </div>

      <span style={{ fontSize: '0.78rem' }}>{formatSize(media.fileSize)}</span>
      <span style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>{dimensions}</span>
      <span style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>{dateStr}</span>

      <span>
        {media.usageCount > 0 ? (
          <span className={`${styles.cardUsageBadge} ${styles.used}`}>{media.usageCount}</span>
        ) : (
          <span className={`${styles.cardUsageBadge} ${styles.unused}`}>—</span>
        )}
      </span>

      <div className={styles.listActions}>
        <button type="button" onClick={onPreview} className={styles.iconBtnLight}
          title={t('media.preview')}>
          <Eye size={14} />
        </button>
        {media.publicUrl && (
          <button type="button" onClick={handleCopyUrl} className={styles.iconBtnLight}
            title={t('media.copyUrl')}>
            <Copy size={14} />
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className={styles.iconBtnLight}
            title={t('common.edit')}>
            <Edit2 size={14} />
          </button>
        )}
        {onRestore && (
          <button type="button" onClick={onRestore} className={styles.iconBtnLight} disabled={deleting}
            title={t('media.restore')}>
            <RotateCcw size={14} />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete}
            className={`${styles.iconBtnLight} ${styles.danger}`} disabled={deleting}
            title={t('common.delete')}>
            <Trash2 size={14} />
          </button>
        )}
        {onHardDelete && (
          <button type="button" onClick={onHardDelete}
            className={`${styles.iconBtnLight} ${styles.dangerSolid}`} disabled={deleting}
            title={t('media.hardDelete')}>
            <AlertTriangle size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
