import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X as XIcon, Music, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDialogA11y } from '@/lib/useDialogA11y'
import { useBodyScrollLock } from './media-picker/useModalBehavior'

/**
 * Full-screen preview overlay for media items.
 * - When `items[]` and `index` provided, supports prev/next navigation (arrow keys + buttons).
 * - When only `media` provided, shows a single item without nav.
 * - Click backdrop or press Escape to close.
 */
export function MediaPreviewLightbox({ media, items, index, onClose, onNavigate }) {
  const { t } = useTranslation()
  const dialogRef = useRef(null)
  // A3: focus-trap + đưa/trả focus + Escape cho overlay tự dựng.
  useDialogA11y(dialogRef, { onClose })
  // Khoá scroll nền khi lightbox mở.
  useBodyScrollLock()

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
      className="fixed inset-0 z-[var(--admin-z-modal)] bg-black/90 flex flex-col items-center justify-center p-8 outline-none"
    >
      {/* Close button */}
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white z-[2]">
        <XIcon size={22} />
      </Button>

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
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white z-[2]">
          <ChevronLeft size={28} />
        </Button>
      )}

      {/* Next button */}
      {hasNav && (
        <Button type="button" variant="ghost" size="icon"
          onClick={(e) => { e.stopPropagation(); if (canNext) onNavigate(index + 1) }}
          disabled={!canNext}
          aria-label={t('media.next')}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white z-[2]">
          <ChevronRight size={28} />
        </Button>
      )}

      {/* Content */}
      <div onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[80vh] flex items-center justify-center">
        {isImage && current.publicUrl && (
          <img src={current.publicUrl} alt={current.altText || filename}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xs" />
        )}
        {isVideo && current.publicUrl && (
          <video src={current.publicUrl} controls
            className="max-w-[90vw] max-h-[80vh] rounded-xs bg-black" />
        )}
        {isAudio && current.publicUrl && (
          <div className="bg-surface p-4 sm:p-8 rounded-md w-[min(320px,90vw)] text-foreground">
            <div className="flex justify-center mb-3"><Music size={64} /></div>
            <p className="m-0 mb-4 font-semibold text-center break-all">
              {filename}
            </p>
            <audio src={current.publicUrl} controls className="w-full" />
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="bg-surface p-8 rounded-md text-foreground text-center">
            <FileText size={48} className="mx-auto mb-3" />
            <p className="m-0">{filename}</p>
            <p className="mt-2 mb-0 text-sm text-muted-foreground">{current.mimeType ?? ''}</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-white/85 text-sm max-w-[90vw] text-center break-all">
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
