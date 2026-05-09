import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMediaReferences, updateMedia } from '../lib/adminApi'

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

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

/**
 * Modal for editing altText / title / caption of a media item,
 * and displaying all places where this file is currently in use.
 */
export function MediaDetailModal({ media, onSave, onClose, onPreview }) {
  const { t } = useTranslation()
  const [altText, setAltText] = useState(media.altText ?? '')
  const [title, setTitle] = useState(media.title ?? '')
  const [caption, setCaption] = useState(media.caption ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [refs, setRefs] = useState(media.references ?? [])
  const [refsLoading, setRefsLoading] = useState(false)

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')

  useEffect(() => {
    // If references not already bundled in the list item, fetch separately
    if (media.references && media.references.length > 0) return
    if (media.usageCount === 0) return
    setRefsLoading(true)
    fetchMediaReferences(media.id)
      .then(setRefs)
      .catch(() => {})
      .finally(() => setRefsLoading(false))
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const usageCount = refs.length > 0 ? refs.length : (media.usageCount ?? 0)

  return (
    <>
      <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mpicker-modal" role="dialog" aria-modal="true" aria-label={t('media.editTitle')}
        style={{ maxWidth: 820, width: '100%' }}>
        <div className="mpicker-header">
          <h3 className="mpicker-title">{t('media.editTitle')}</h3>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>

        <div className="mpicker-body" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Preview + form fields */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, width: 360, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '100%', height: 240, background: 'var(--c-bg-subtle)', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isImage && media.publicUrl ? (
                  <button
                    type="button"
                    onClick={() => onPreview && onPreview()}
                    aria-label={t('media.preview')}
                    style={{ all: 'unset', cursor: onPreview ? 'zoom-in' : 'default', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <img src={media.publicUrl} alt={altText || ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </button>
                ) : isVideo && media.publicUrl ? (
                  <video src={media.publicUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} preload="metadata" />
                ) : isAudio && media.publicUrl ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    <audio src={media.publicUrl} controls preload="metadata" style={{ width: '100%' }} />
                  </div>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                )}
              </div>
              {onPreview && media.publicUrl && (isImage || isVideo || isAudio) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onPreview()}
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  {t('media.preview')}
                </button>
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

          {/* Usage section */}
          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {t('media.usageTitle')}
              {usageCount > 0
                ? <span style={{ background: 'var(--c-primary)', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{usageCount}</span>
                : <span style={{ background: 'var(--c-success)', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600 }}>{t('media.usageUnused')}</span>
              }
            </p>

            {refsLoading && (
              <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>{t('common.loading')}</p>
            )}

            {!refsLoading && usageCount === 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>{t('media.usageNoneDesc')}</p>
            )}

            {!refsLoading && refs.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {refs.map((ref, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <span style={{
                      background: 'var(--c-bg-subtle)',
                      border: '1px solid var(--c-border)',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: 'var(--c-text-muted)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {TYPE_LABEL[ref.type] ?? ref.type}
                    </span>
                    {ref.adminPath ? (
                      <a
                        href={ref.adminPath}
                        style={{ color: 'var(--c-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={ref.name}
                      >
                        {ref.name}
                      </a>
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref.name}>{ref.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

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
