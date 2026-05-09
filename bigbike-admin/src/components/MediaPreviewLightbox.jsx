import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X as XIcon, Music, FileText } from 'lucide-react'

/**
 * Full-screen preview overlay for media items.
 * - When `items[]` and `index` provided, supports prev/next navigation (arrow keys + buttons).
 * - When only `media` provided, shows a single item without nav.
 * - Click backdrop or press Escape to close.
 */
export function MediaPreviewLightbox({ media, items, index, onClose, onNavigate }) {
  const { t } = useTranslation()

  // Resolve current item: prefer items[index] if both provided
  const current = (Array.isArray(items) && typeof index === 'number') ? items[index] : media
  const total = Array.isArray(items) ? items.length : 0
  const hasNav = total > 1 && typeof onNavigate === 'function'

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (!hasNav) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); onNavigate(Math.max(0, index - 1)) }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNavigate(Math.min(total - 1, index + 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate, hasNav, index, total])

  if (!current) return null

  const isImage = current.mimeType?.startsWith('image/')
  const isVideo = current.mimeType?.startsWith('video/')
  const isAudio = current.mimeType?.startsWith('audio/')
  const filename = (current.filename ?? current.publicUrl ?? '').split('/').pop()

  const canPrev = hasNav && index > 0
  const canNext = hasNav && index < total - 1

  return (
    <div role="dialog" aria-modal="true" aria-label={filename}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}
    >
      {/* Close button */}
      <button type="button" onClick={onClose} aria-label={t('common.close')}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}>
        <XIcon size={22} />
      </button>

      {/* Counter */}
      {hasNav && (
        <div style={{
          position: 'absolute', top: '1rem', left: '1rem',
          color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem',
          background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: 4,
        }}>
          {index + 1} / {total}
        </div>
      )}

      {/* Prev button */}
      {hasNav && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); if (canPrev) onNavigate(index - 1) }}
          disabled={!canPrev}
          aria-label={t('media.previous')}
          style={{
            position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: 'none', cursor: canPrev ? 'pointer' : 'not-allowed',
            opacity: canPrev ? 1 : 0.3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}>
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Next button */}
      {hasNav && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); if (canNext) onNavigate(index + 1) }}
          disabled={!canNext}
          aria-label={t('media.next')}
          style={{
            position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: 'none', cursor: canNext ? 'pointer' : 'not-allowed',
            opacity: canNext ? 1 : 0.3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}>
          <ChevronRight size={28} />
        </button>
      )}

      {/* Content */}
      <div onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isImage && current.publicUrl && (
          <img src={current.publicUrl} alt={current.altText || filename}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 4 }} />
        )}
        {isVideo && current.publicUrl && (
          <video src={current.publicUrl} controls autoPlay
            style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 4, background: '#000' }} />
        )}
        {isAudio && current.publicUrl && (
          <div style={{ background: 'var(--c-surface)', padding: '2rem', borderRadius: 8, minWidth: 320, color: 'var(--c-text)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Music size={64} /></div>
            <p style={{ margin: '0 0 1rem 0', fontWeight: 600, textAlign: 'center', wordBreak: 'break-all' }}>
              {filename}
            </p>
            <audio src={current.publicUrl} controls autoPlay style={{ width: '100%' }} />
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div style={{ background: 'var(--c-surface)', padding: '2rem', borderRadius: 8, color: 'var(--c-text)', textAlign: 'center' }}>
            <FileText size={48} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0 }}>{filename}</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{current.mimeType ?? ''}</p>
          </div>
        )}
      </div>

      <p style={{
        marginTop: '1rem', color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem',
        maxWidth: '90vw', textAlign: 'center', wordBreak: 'break-all',
      }}>
        {filename}
      </p>

      {hasNav && (
        <p style={{
          marginTop: 4, color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', textAlign: 'center',
        }}>
          {t('media.lightboxHint')}
        </p>
      )}
    </div>
  )
}
