import { Pencil, Trash2, RotateCcw, AlertTriangle, Music, FileText, Copy } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useTranslation } from 'react-i18next'
import { formatText } from '../lib/formatters'
import { formatBytes, toClipboardUrl } from './media-picker/pickerUtils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

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
  const displayName = media.title ? formatText(media.title) : filename
  const dimensions = media.width && media.height ? `${media.width}×${media.height}` : null
  const meta = [formatBytes(media.fileSize), dimensions].filter(Boolean).join(' · ')

  const className = [
    'medialib-card',
    selected ? 'medialib-is-selected' : '',
    focused ? 'medialib-is-focused' : '',
    media.status === 'DELETED' ? 'medialib-card-deleted' : '',
  ].filter(Boolean).join(' ')

  function handleCopyUrl(e) {
    e.stopPropagation()
    if (!media.publicUrl) return
    navigator.clipboard.writeText(toClipboardUrl(media.publicUrl))
      .then(() => toast.success(t('media.urlCopied')))
      .catch(() => toast.error(t('media.copyFailed')))
    onCopyUrl?.()
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
          aria-label={t('media.selectNamed', { name: displayName, defaultValue: 'Chọn {{name}}' })}
          onClick={(e) => e.stopPropagation()}
          className="medialib-card-checkbox"  />
      )}

      {/* Thumb là container KHÔNG tương tác; vùng "mở xem lớn" và vùng "nút thao
          tác" là hai phần tử ANH EM bên trong, không lồng nút-trong-nút. */}
      <div className="medialib-thumb-wrap">
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

        {/* Vùng điều hướng: nút thật phủ kín thumb để mở xem lớn (Enter/Space
            chuẩn). Đặt TRƯỚC overlay để overlay (cùng position, đứng sau DOM) xếp
            trên và nhận click cho các nút thao tác. */}
        <Button variant="unstyled" onClick={onPreview}
          aria-label={t('media.previewNamed', { name: displayName, defaultValue: 'Xem lớn {{name}}' })}
          className="absolute inset-0 cursor-zoom-in border-0 bg-transparent p-0" />

        {(onEdit || onDelete || onRestore || onHardDelete || onCopyUrl) && (
          <div className="medialib-action-overlay">
            <div className="medialib-overlay-actions">
              {media.publicUrl && (
                <Button variant="unstyled" onClick={handleCopyUrl}
                  className="medialib-icon-btn"
                  title={t('media.copyUrl')} aria-label={t('media.copyUrl')}>
                  <Copy size={14} />
                </Button>
              )}
              {onEdit && (
                <Button variant="unstyled" onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className="medialib-icon-btn"
                  title={t('common.edit')} aria-label={t('common.edit')}>
                  <Pencil size={14} />
                </Button>
              )}
              {onRestore && (
                <Button variant="unstyled" onClick={(e) => { e.stopPropagation(); onRestore() }}
                  className="medialib-icon-btn" disabled={deleting}
                  title={t('media.restore')} aria-label={t('media.restore')}>
                  <RotateCcw size={14} />
                </Button>
              )}
              {onDelete && (
                <Button variant="unstyled" onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="medialib-icon-btn medialib-btn-danger" disabled={deleting}
                  title={t('common.delete')} aria-label={t('common.delete')}>
                  <Trash2 size={14} />
                </Button>
              )}
              {onHardDelete && (
                <Button variant="unstyled" onClick={(e) => { e.stopPropagation(); onHardDelete() }}
                  className="medialib-icon-btn medialib-btn-danger-solid" disabled={deleting}
                  title={t('media.hardDelete')} aria-label={t('media.hardDelete')}>
                  <AlertTriangle size={14} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="medialib-card-body">
        <p className="medialib-card-name" title={media.filename ?? ''}>{displayName}</p>
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
