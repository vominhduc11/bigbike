import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateMedia } from '../lib/adminApi'

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

/**
 * Modal for editing altText / title / caption of a media item.
 * Props:
 *   media    — normalized media object (id, publicUrl, mimeType, altText, title, caption)
 *   onSave   — called with updated media item after successful save
 *   onClose  — called when modal should close
 */
export function MediaDetailModal({ media, onSave, onClose }) {
  const { t } = useTranslation()
  const [altText, setAltText] = useState(media.altText ?? '')
  const [title, setTitle] = useState(media.title ?? '')
  const [caption, setCaption] = useState(media.caption ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await updateMedia(media.id, { altText, title, caption })
      onSave(result.item)
    } catch (err) {
      setError(err.message || t('media.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mpicker-modal" role="dialog" aria-modal="true" aria-label={t('media.editTitle')}>
        <div className="mpicker-header">
          <h3 className="mpicker-title">{t('media.editTitle')}</h3>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        <div className="mpicker-body" style={{ padding: '1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, width: 160, height: 120, background: 'var(--c-bg-subtle)', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isImage && media.publicUrl ? (
              <img src={media.publicUrl} alt={altText || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : isVideo && media.publicUrl ? (
              <video src={`${media.publicUrl}#t=0.001`} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} muted preload="metadata" />
            ) : isAudio && media.publicUrl ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <audio src={media.publicUrl} controls preload="metadata" style={{ width: '100%' }} />
              </div>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            )}
          </div>

          <form id="media-detail-form" onSubmit={handleSave} style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('media.fieldAltText')}</span>
              <input className="control-input" type="text" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder={t('media.fieldAltTextPlaceholder')} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('media.fieldTitle')}</span>
              <input className="control-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('media.fieldTitlePlaceholder')} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('media.fieldCaption')}</span>
              <textarea className="control-input" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('media.fieldCaptionPlaceholder')} style={{ resize: 'vertical' }} />
            </label>

            {error && <p style={{ color: 'var(--c-danger)', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
          </form>
        </div>

        <div className="mpicker-footer">
          <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
            {(media.filename ?? '').split('/').pop()}
          </span>
          <div className="mpicker-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
            <button type="submit" form="media-detail-form" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
