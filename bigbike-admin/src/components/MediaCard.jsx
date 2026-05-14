import { Edit2, Trash2, RotateCcw, AlertTriangle, Music, FileText, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import styles from '../screens/MediaLibraryScreen.module.css'
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
    styles.card,
    selected ? styles.selected : '',
    focused ? styles.focused : '',
    media.status === 'DELETED' ? styles.cardDeleted : '',
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
        <span className={`${styles.cardBadge} ${styles.cardBadgeDeleted}`}>
          {t('media.statusDeleted')}
        </span>
      )}
      {onToggleSelect && (
        <Checkbox checked={selected} onCheckedChange={onToggleSelect}
          aria-label={t('media.select')}
          onClick={(e) => e.stopPropagation()}
          className={styles.cardCheckbox}  />
      )}

      <div role="button" tabIndex={0}
        onClick={onPreview}
        onKeyDown={onThumbKeyDown}
        aria-label={t('media.preview')}
        className={styles.thumbWrap}>
        {isImage(media.mimeType) && media.publicUrl ? (
          <img src={media.publicUrl} alt={media.altText || filename} loading="lazy" />
        ) : isVideo(media.mimeType) && media.publicUrl ? (
          <video src={`${media.publicUrl}#t=0.001`} muted preload="metadata" />
        ) : (
          <div className={styles.thumbPlaceholder}>
            {isAudio(media.mimeType)
              ? <Music size={36} />
              : <FileText size={36} />}
          </div>
        )}

        {(onEdit || onDelete || onRestore || onHardDelete || onCopyUrl) && (
          <div className={styles.actionOverlay}>
            <div className={styles.overlayActions}>
              {media.publicUrl && (
                <button type="button" onClick={handleCopyUrl}
                  className={styles.iconBtn}
                  title={t('media.copyUrl')} aria-label={t('media.copyUrl')}>
                  <Copy size={14} />
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className={styles.iconBtn}
                  title={t('common.edit')} aria-label={t('common.edit')}>
                  <Edit2 size={14} />
                </button>
              )}
              {onRestore && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onRestore() }}
                  className={styles.iconBtn} disabled={deleting}
                  title={t('media.restore')} aria-label={t('media.restore')}>
                  <RotateCcw size={14} />
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className={`${styles.iconBtn} ${styles.danger}`} disabled={deleting}
                  title={t('common.delete')} aria-label={t('common.delete')}>
                  <Trash2 size={14} />
                </button>
              )}
              {onHardDelete && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onHardDelete() }}
                  className={`${styles.iconBtn} ${styles.dangerSolid}`} disabled={deleting}
                  title={t('media.hardDelete')} aria-label={t('media.hardDelete')}>
                  <AlertTriangle size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardName} title={media.filename ?? ''}>{filename}</p>
        <p className={styles.cardMeta}>{meta || '—'}</p>
        {media.usageCount > 0 ? (
          <span className={`${styles.cardUsageBadge} ${styles.used}`}>
            {t('media.usedIn', { count: media.usageCount })}
          </span>
        ) : (
          <span className={`${styles.cardUsageBadge} ${styles.unused}`}>
            {t('media.usageUnused')}
          </span>
        )}
      </div>
    </div>
  )
}
