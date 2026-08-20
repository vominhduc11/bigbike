import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X as XIcon, Music, FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDialogA11y } from '@/lib/useDialogA11y'
import { useBodyScrollLock } from './media-picker/useModalBehavior'

/**
 * Full-screen preview overlay for media items.
 * - When `items[]` and `index` provided, supports prev/next navigation (arrow keys + buttons).
 * - When only `media` provided, shows a single item without nav.
 * - Click backdrop or press Escape to close.
 */
export function MediaPreviewLightbox({ media, items, index, onClose, onNavigate, onDownload }) {
  const { t } = useTranslation()
  const dialogRef = useRef(null)
  // A3: focus-trap + đưa/trả focus + Escape cho overlay tự dựng.
  useDialogA11y(dialogRef, { onClose })
  // Khoá scroll nền khi lightbox mở.
  useBodyScrollLock()
  const [loadedImageUrl, setLoadedImageUrl] = useState('')
  const [errorImageUrl, setErrorImageUrl] = useState('')
  const [errorMediaUrl, setErrorMediaUrl] = useState('')

  // Resolve current item: prefer items[index] if both provided
  const current = (Array.isArray(items) && typeof index === 'number') ? items[index] : media
  const total = Array.isArray(items) ? items.length : 0
  const hasNav = total > 1 && typeof onNavigate === 'function'

  // Escape/focus-trap/restore do useDialogA11y lo; ở đây chỉ xử lý phím Mũi tên
  // điều hướng để không gọi onClose hai lần.
  useEffect(() => {
    if (!hasNav) return undefined
    function onKey(e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); onNavigate(Math.max(0, index - 1)) }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNavigate(Math.min(total - 1, index + 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNavigate, hasNav, index, total])

  if (!current) return null

  const isImage = current.mimeType?.startsWith('image/')
  const isVideo = current.mimeType?.startsWith('video/')
  const isAudio = current.mimeType?.startsWith('audio/')
  const filename = (current.filename ?? current.publicUrl ?? '').split('/').pop()
  const canPrev = hasNav && index > 0
  const canNext = hasNav && index < total - 1

  return (
    <div role="dialog" aria-modal="true" aria-label={filename}
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-[var(--admin-z-modal)] flex flex-col items-center justify-center bg-black/90 p-8 outline-none"
    >
      {/* Close button */}
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}
        className="absolute right-4 top-4 z-10 h-11 w-11 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white">
        <XIcon size={22} />
      </Button>
      {onDownload && (
        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDownload(current) }}
          aria-label={t('media.download')} title={t('media.download')}
          className="absolute right-16 top-4 z-10 h-11 w-11 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white">
          <Download size={20} />
        </Button>
      )}

      {/* Counter */}
      {hasNav && (
        <div className="absolute top-4 left-4 text-white/80 text-sm bg-black/40 px-3 py-1.5 rounded-xs">
          {index + 1} / {total}
        </div>
      )}

      {/* Prev button */}
      {hasNav && (
        <Button type="button" variant="ghost" size="icon"
          onClick={(e) => { e.stopPropagation(); if (canPrev) onNavigate(index - 1) }}
          disabled={!canPrev}
          aria-label={t('media.previous')}
          className="absolute left-4 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white">
          <ChevronLeft size={28} />
        </Button>
      )}

      {/* Next button */}
      {hasNav && (
        <Button type="button" variant="ghost" size="icon"
          onClick={(e) => { e.stopPropagation(); if (canNext) onNavigate(index + 1) }}
          disabled={!canNext}
          aria-label={t('media.next')}
          className="absolute right-4 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white">
          <ChevronRight size={28} />
        </Button>
      )}

      {/* Content */}
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-screen max-w-full items-center justify-center">
        {isImage && current.publicUrl && (
          errorImageUrl === current.publicUrl ? (
            <div role="alert" className="rounded-md bg-surface px-6 py-8 text-center text-sm text-danger">
              {t('media.imageLoadError', { defaultValue: 'Không thể tải ảnh này.' })}
            </div>
          ) : (
            <>
              {loadedImageUrl !== current.publicUrl ? <span className="absolute text-sm text-white/80">{t('media.imageLoading', { defaultValue: 'Đang tải ảnh…' })}</span> : null}
              <img
                src={current.publicUrl}
                alt={current.altText || filename}
                onLoad={() => setLoadedImageUrl(current.publicUrl)}
                onError={() => setErrorImageUrl(current.publicUrl)}
                className={loadedImageUrl === current.publicUrl ? 'max-h-screen max-w-full rounded-xs object-contain' : 'max-h-screen max-w-full rounded-xs object-contain opacity-0'}
              />
            </>
          )
        )}
        {isVideo && current.publicUrl && (
          errorMediaUrl === current.publicUrl ? (
            <div role="alert" className="rounded-md bg-surface px-6 py-8 text-center text-sm text-danger">
              {t('media.mediaLoadError')}
            </div>
          ) : (
            <video src={current.publicUrl} controls onError={() => setErrorMediaUrl(current.publicUrl)}
              className="max-h-screen max-w-full rounded-xs bg-black" />
          )
        )}
        {isAudio && current.publicUrl && (
            <div className="w-full max-w-md rounded-md bg-surface p-4 text-foreground sm:p-8">
            <div className="flex justify-center mb-3"><Music size={64} /></div>
            <p className="m-0 mb-4 font-semibold text-center break-all">
              {filename}
            </p>
            <audio src={current.publicUrl} controls className="w-full" />
          </div>
        )}
        {(!current.publicUrl || (!isImage && !isVideo && !isAudio)) && (
          <div className="bg-surface p-8 rounded-md text-foreground text-center">
            <FileText size={48} className="mx-auto mb-3" />
            <p className="m-0">{filename}</p>
            <p className="mt-2 mb-0 text-sm text-muted-foreground">{current.publicUrl ? (current.mimeType || '—') : t('media.missingPublicUrl')}</p>
          </div>
        )}
      </div>

      <p className="mt-4 max-w-full break-all text-sm text-center text-white/85">
        {filename}
      </p>

      {hasNav && (
        <p className="mt-1 text-white/50 text-xs text-center">
          {t('media.lightboxHint')}
        </p>
      )}
    </div>
  )
}
